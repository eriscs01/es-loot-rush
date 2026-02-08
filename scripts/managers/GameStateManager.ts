import { Player, PlayerLeaveAfterEvent, PlayerSpawnAfterEvent, system, world } from "@minecraft/server";
import { ConfigManager } from "./ConfigManager";
import { PropertyStore } from "./PropertyStore";
import { TeamManager } from "./TeamManager";
import { ChallengeManager } from "./ChallengeManager";
import { ChallengeRecord } from "../types";
import { ChestManager } from "./ChestManager";
import { AudioManager } from "./AudioManager";
import { ScoreboardManager } from "./ScoreboardManager";
import { BookManager } from "./BookManager";
import { DebugLogger } from "./DebugLogger";
import { DYNAMIC_KEYS } from "../config/constants";

export class GameStateManager {
  private gameActive = false;
  private gamePaused = false;
  private currentRound = 1;
  private totalRounds = 3;
  private roundDurationTicks = 12000;
  private roundStartTick = 0;
  private pausedAtTick = 0;
  private roundTimerHandle?: number;
  private warned60 = false;
  private warned30 = false;
  private lastSecondWarning?: number;
  private pauseEffectHandle?: number;
  private initialized = false;
  private readonly debugLogger: DebugLogger;
  private playerTimerHandles: Map<string, number> = new Map();
  private cachedDisplayText: string = "";
  private playerJoinHandler?: (_arg: any) => void;
  private playerLeaveHandler?: (_arg: any) => void;

  constructor(
    private readonly propertyStore: PropertyStore,
    private readonly configManager: ConfigManager,
    private readonly teamManager: TeamManager,
    private readonly challengeManager: ChallengeManager,
    private readonly chestManager: ChestManager,
    private readonly audioManager: AudioManager,
    private readonly scoreboardManager: ScoreboardManager,
    private readonly bookManager: BookManager
  ) {
    void configManager;
    void teamManager;
    void challengeManager;
    void chestManager;
    void audioManager;
    void scoreboardManager;
    void bookManager;
    this.debugLogger = new DebugLogger(propertyStore);
  }

  initialize(): void {
    world.afterEvents.worldLoad.subscribe(() => {
      this.registerPauseGuards();
      if (this.initialized) return;
      this.initialized = true;
      this.configManager.loadConfig();
      this.teamManager.loadRostersFromProperties();
      this.ensureDefaults();
      this.gameActive = this.propertyStore.getBoolean(DYNAMIC_KEYS.gameActive, false);
      this.gamePaused = this.propertyStore.getBoolean(DYNAMIC_KEYS.gamePaused, false);
      this.currentRound = this.propertyStore.getNumber(DYNAMIC_KEYS.currentRound, 1);
      this.roundStartTick = this.propertyStore.getNumber(DYNAMIC_KEYS.roundStartTick, system.currentTick);
      this.pausedAtTick = this.propertyStore.getNumber(DYNAMIC_KEYS.pausedAtTick, 0);
    });
  }

  startGame(challenges: ChallengeRecord[]): void {
    this.propertyStore.setBoolean(DYNAMIC_KEYS.gameActive, true);
    this.propertyStore.setBoolean(DYNAMIC_KEYS.teamsFormed, true);
    this.propertyStore.setBoolean(DYNAMIC_KEYS.gamePaused, false);
    this.propertyStore.setNumber(DYNAMIC_KEYS.pausedAtTick, 0);
    this.propertyStore.setNumber(DYNAMIC_KEYS.crimsonScore, 0);
    this.propertyStore.setNumber(DYNAMIC_KEYS.azureScore, 0);
    this.gameActive = true;
    this.gamePaused = false;
    this.currentRound = 1;
    this.totalRounds = this.configManager.getConfigValue("totalRounds");
    this.roundDurationTicks = this.configManager.getConfigValue("roundDurationTicks");
    this.roundStartTick = system.currentTick;
    this.pausedAtTick = 0;
    this.resetTimerWarnings();
    this.persistRoundState();
    this.propertyStore.setString(DYNAMIC_KEYS.activeChallenges, "[]");
    this.propertyStore.setString(DYNAMIC_KEYS.completedChallenges, "[]");
    this.startRoundTimer();
    this.initiateHUDState();
    this.challengeManager.monitorCompletion(challenges);
    this.teamManager.registerJoinHandlers();
    this.registerPlayerTimerHandlers();

    // Initialize and show scoreboard
    this.scoreboardManager.initializeScoreboard();
    this.scoreboardManager.showScoreboard();
    this.scoreboardManager.updateScores(0, 0);

    // Start timers for all current players
    world.getAllPlayers().forEach((p) => this.startPlayerTimer(p));

    this.debugLogger?.log(`Game started at tick ${this.roundStartTick}`);
  }

  endGame(announceWinner = false): void {
    this.propertyStore.setBoolean(DYNAMIC_KEYS.gameActive, false);
    this.propertyStore.setBoolean(DYNAMIC_KEYS.gamePaused, false);
    this.propertyStore.setNumber(DYNAMIC_KEYS.pausedAtTick, 0);
    this.gameActive = false;
    this.gamePaused = false;
    this.pausedAtTick = 0;
    this.clearPauseEffects();
    this.stopRoundTimer();
    this.stopAllPlayerTimers();
    this.unregisterPlayerTimerHandlers();
    this.challengeManager.stopMonitoring();
    this.teamManager.unregisterJoinHandlers();

    // Hide scoreboard on game end
    this.scoreboardManager.hideScoreboard();

    this.bookManager?.removeBooksFromAllPlayers();
    this.debugLogger?.log(`Game ended. Winner announced: ${announceWinner}`);
    if (announceWinner) {
      this.announceWinner();
    }
  }

  resetGame(): void {
    this.endGame(false);
    this.propertyStore.setBoolean(DYNAMIC_KEYS.teamsFormed, false);
    this.propertyStore.setBoolean(DYNAMIC_KEYS.gamePaused, false);
    this.propertyStore.setNumber(DYNAMIC_KEYS.pausedAtTick, 0);
    this.currentRound = 0;
    this.roundStartTick = system.currentTick;
    this.propertyStore.setNumber(DYNAMIC_KEYS.currentRound, this.currentRound);
    this.propertyStore.setNumber(DYNAMIC_KEYS.roundStartTick, this.roundStartTick);
    this.propertyStore.setNumber(DYNAMIC_KEYS.crimsonScore, 0);
    this.propertyStore.setNumber(DYNAMIC_KEYS.azureScore, 0);
    this.propertyStore.setString(DYNAMIC_KEYS.activeChallenges, "[]");
    this.propertyStore.setString(DYNAMIC_KEYS.completedChallenges, "[]");
    this.resetTimerWarnings();

    this.challengeManager.resetChallenges();
    this.teamManager.clearTeams();
    this.chestManager.clearChestReferences();
    this.bookManager?.removeBooksFromAllPlayers();

    // Reset scoreboard
    this.scoreboardManager.resetScoreboard();

    world.getAllPlayers().forEach((p) => {
      this.teamManager.resetPlayerNameTag(p);
    });

    this.debugLogger?.log("Game state fully reset");
    world.sendMessage("§6[LOOT RUSH] §fState reset. Run lr:teamup to form teams.");
  }

  pauseGame(): void {
    if (this.gamePaused) return;
    this.gamePaused = true;
    this.propertyStore.setBoolean(DYNAMIC_KEYS.gamePaused, true);
    this.pausedAtTick = system.currentTick;
    this.propertyStore.setNumber(DYNAMIC_KEYS.pausedAtTick, this.pausedAtTick);
    this.applyPauseEffects();
    this.updatePauseHUD(true);
    this.debugLogger?.log(`Game paused at tick ${this.pausedAtTick}`);
  }

  resumeGame(): void {
    if (!this.gamePaused) return;
    this.gamePaused = false;
    if (this.pausedAtTick) {
      const pauseDuration = system.currentTick - this.pausedAtTick;
      this.roundStartTick += pauseDuration;
      this.persistRoundState();
    }
    this.pausedAtTick = 0;
    this.propertyStore.setNumber(DYNAMIC_KEYS.pausedAtTick, 0);
    this.propertyStore.setBoolean(DYNAMIC_KEYS.gamePaused, false);
    this.clearPauseEffects();
    this.updatePauseHUD(false);
    this.debugLogger?.log(`Game resumed; roundStartTick adjusted to ${this.roundStartTick}`);
  }

  getCurrentRound(): number {
    return this.currentRound;
  }

  getRemainingTime(): number {
    const effectiveTick = this.gamePaused && this.pausedAtTick ? this.pausedAtTick : system.currentTick;
    const elapsed = effectiveTick - this.roundStartTick;
    return Math.max(this.roundDurationTicks - elapsed, 0);
  }

  transitionToNextRound(): void {
    if (this.currentRound >= this.totalRounds) {
      this.endGame(true);
      return;
    }

    this.currentRound += 1;
    this.roundStartTick = system.currentTick;
    this.pausedAtTick = 0;
    this.propertyStore.setNumber(DYNAMIC_KEYS.pausedAtTick, 0);
    this.propertyStore.setBoolean(DYNAMIC_KEYS.gamePaused, false);
    this.resetTimerWarnings();
    this.persistRoundState();
    this.debugLogger?.log(`Transitioning to round ${this.currentRound}`);

    this.challengeManager.resetChallenges();
    const challenges = this.challengeManager.selectChallenges();
    this.challengeManager.monitorCompletion(challenges);

    const players = world.getAllPlayers();
    const roundMessage = `§6[LOOT RUSH] §fRound §e${this.currentRound}§f of §e${this.totalRounds}§f begins!`;
    world.sendMessage(roundMessage);
    this.audioManager?.playStartHorn(players);

    // Immediately update the cached display text for the new round
    const remaining = this.getRemainingTime();
    this.updateTimerDisplay(remaining);
  }

  forceRound(roundNumber: number): void {
    this.currentRound = roundNumber - 1;
    system.run(() => this.transitionToNextRound());
  }

  isGameActive(): boolean {
    return this.propertyStore.getBoolean(DYNAMIC_KEYS.gameActive, this.gameActive);
  }

  private registerPauseGuards(): void {
    // Cancel block interactions while paused
    world.beforeEvents.playerBreakBlock.subscribe((event) => {
      if (this.gamePaused && this.isGameActive()) {
        event.cancel = true;
      }
    });

    (world.beforeEvents as any).playerPlaceBlock?.subscribe((event: any) => {
      if (this.gamePaused && this.isGameActive()) {
        event.cancel = true;
      }
    });

    world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
      if (this.gamePaused && this.isGameActive()) {
        event.cancel = true;
      }
    });

    world.beforeEvents.itemUse.subscribe((event) => {
      if (this.gamePaused && this.isGameActive()) {
        event.cancel = true;
      }
    });

    (world.beforeEvents as any).itemUseOn?.subscribe((event: any) => {
      if (this.gamePaused && this.isGameActive()) {
        event.cancel = true;
      }
    });
  }

  private ensureDefaults(): void {
    if (this.propertyStore.get(DYNAMIC_KEYS.gameActive) === undefined) {
      this.propertyStore.setBoolean(DYNAMIC_KEYS.gameActive, false);
    }
    if (this.propertyStore.get(DYNAMIC_KEYS.gamePaused) === undefined) {
      this.propertyStore.setBoolean(DYNAMIC_KEYS.gamePaused, false);
    }
    if (this.propertyStore.get(DYNAMIC_KEYS.debugMode) === undefined) {
      this.propertyStore.setBoolean(DYNAMIC_KEYS.debugMode, false);
    }
    if (this.propertyStore.get(DYNAMIC_KEYS.teamsFormed) === undefined) {
      this.propertyStore.setBoolean(DYNAMIC_KEYS.teamsFormed, false);
    }
    if (this.propertyStore.get(DYNAMIC_KEYS.currentRound) === undefined) {
      this.propertyStore.setNumber(DYNAMIC_KEYS.currentRound, 1);
    }
    if (this.propertyStore.get(DYNAMIC_KEYS.roundStartTick) === undefined) {
      this.propertyStore.setNumber(DYNAMIC_KEYS.roundStartTick, system.currentTick);
    }
    if (this.propertyStore.get(DYNAMIC_KEYS.pausedAtTick) === undefined) {
      this.propertyStore.setNumber(DYNAMIC_KEYS.pausedAtTick, 0);
    }
    if (this.propertyStore.get(DYNAMIC_KEYS.crimsonScore) === undefined) {
      this.propertyStore.setNumber(DYNAMIC_KEYS.crimsonScore, 0);
    }
    if (this.propertyStore.get(DYNAMIC_KEYS.azureScore) === undefined) {
      this.propertyStore.setNumber(DYNAMIC_KEYS.azureScore, 0);
    }
    if (!this.propertyStore.getString(DYNAMIC_KEYS.activeChallenges)) {
      this.propertyStore.setString(DYNAMIC_KEYS.activeChallenges, "[]");
    }
    if (!this.propertyStore.getString(DYNAMIC_KEYS.completedChallenges)) {
      this.propertyStore.setString(DYNAMIC_KEYS.completedChallenges, "[]");
    }
  }

  private persistRoundState(): void {
    this.propertyStore.setNumber(DYNAMIC_KEYS.currentRound, this.currentRound);
    this.propertyStore.setNumber(DYNAMIC_KEYS.roundStartTick, this.roundStartTick);
  }

  private startRoundTimer(): void {
    if (typeof system.runInterval !== "function") return;
    if (this.roundTimerHandle !== undefined && typeof system.clearRun === "function") {
      system.clearRun(this.roundTimerHandle);
    }
    // Check once per second (20 ticks) to minimize overhead.
    this.roundTimerHandle = system.runInterval(() => this.handleRoundTick(), 20);
  }

  private stopRoundTimer(): void {
    if (this.roundTimerHandle === undefined) return;
    if (typeof system.clearRun === "function") {
      system.clearRun(this.roundTimerHandle);
    }
    this.roundTimerHandle = undefined;
  }

  private handleRoundTick(): void {
    if (!this.isGameActive() || this.gamePaused) return;
    const remaining = this.getRemainingTime();
    this.updateTimerDisplay(remaining);
    if (remaining === 0) {
      this.transitionToNextRound();
    }
  }

  private resetTimerWarnings(): void {
    this.warned60 = false;
    this.warned30 = false;
    this.lastSecondWarning = undefined;
  }

  private updateTimerDisplay(remainingTicks: number): void {
    const remainingSeconds = Math.ceil(Math.max(remainingTicks, 0) / 20);

    // Format time as MM:SS
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;
    const timeStr = `${minutes}:${seconds.toString().padStart(2, "0")}`;

    // Color based on remaining time
    const color = remainingSeconds <= 10 ? "§c" : remainingSeconds <= 30 ? "§6" : "§e";

    // Cache the display text (calculated once per tick)
    this.cachedDisplayText = `§fRound §e${this.currentRound}§f/§e${this.totalRounds} §7~ ${color}${timeStr}`;

    // Audio warnings
    const players = world.getAllPlayers();
    if (remainingSeconds <= 10 && this.lastSecondWarning !== remainingSeconds) {
      this.audioManager?.playTimerWarning10(players);
      this.lastSecondWarning = remainingSeconds;
    }

    if (!this.warned30 && remainingSeconds === 30) {
      this.audioManager?.playTimerWarning30(players);
      this.warned30 = true;
    }

    if (!this.warned60 && remainingSeconds === 60) {
      this.audioManager?.playTimerWarning60(players);
      this.warned60 = true;
    }
  }

  private startPlayerTimer(player: Player): void {
    const playerId = player.id;
    if (this.playerTimerHandles.has(playerId)) return;

    // Calculate delay to sync with the next 20-tick boundary
    const currentTick = system.currentTick;
    const tickOffset = currentTick % 20;
    const delay = tickOffset === 0 ? 0 : 20 - tickOffset;

    // Start after delay to synchronize with main timer
    system.runTimeout(() => {
      // Double-check player is still valid and game is still active
      if (!this.isGameActive() || this.playerTimerHandles.has(playerId)) return;

      const handle = system.runInterval(() => {
        try {
          if (!player || !this.isGameActive()) return;

          const displayText = this.gamePaused ? "§c§lGAME PAUSED" : this.cachedDisplayText;

          player.onScreenDisplay.setActionBar(displayText);
        } catch (err) {
          this.debugLogger?.warn("Failed to update player timer", player.name, err);
        }
      }, 20);

      this.playerTimerHandles.set(playerId, handle);
      this.debugLogger?.debug(`Started synchronized timer for player ${player.name} (delay: ${delay} ticks)`);
    }, delay);
  }

  private stopPlayerTimer(playerId: string): void {
    system.run(() => {
      const handle = this.playerTimerHandles.get(playerId);
      if (handle !== undefined) {
        system.clearRun(handle);
        this.playerTimerHandles.delete(playerId);
        this.debugLogger?.debug(`Stopped timer for player ${playerId}`);
      }
    });
  }

  private stopAllPlayerTimers(): void {
    system.run(() => {
      this.playerTimerHandles.forEach((handle) => {
        system.clearRun(handle);
      });
      this.playerTimerHandles.clear();
      this.debugLogger?.log("Stopped all player timers");
    });
  }

  private registerPlayerTimerHandlers(): void {
    system.run(() => {
      this.playerJoinHandler = world.afterEvents.playerSpawn.subscribe((event: PlayerSpawnAfterEvent) => {
        if (this.isGameActive() && !this.gamePaused) {
          system.run(() => {
            this.startPlayerTimer(event.player);
          });
        }
      });

      this.playerLeaveHandler = world.afterEvents.playerLeave.subscribe((event: PlayerLeaveAfterEvent) => {
        this.stopPlayerTimer(event.playerId);
      });

      this.debugLogger?.log("Registered player timer handlers");
    });
  }

  private unregisterPlayerTimerHandlers(): void {
    system.run(() => {
      if (this.playerJoinHandler) {
        world.afterEvents.playerSpawn.unsubscribe(this.playerJoinHandler);
        this.playerJoinHandler = undefined;
      }
      if (this.playerLeaveHandler) {
        world.afterEvents.playerLeave.unsubscribe(this.playerLeaveHandler);
        this.playerLeaveHandler = undefined;
      }
      this.debugLogger?.log("Unregistered player timer handlers");
    });
  }

  private applyPauseEffects(): void {
    if (this.pauseEffectHandle !== undefined && typeof system.clearRun === "function") {
      system.clearRun(this.pauseEffectHandle);
    }

    this.pauseEffectHandle = system.runInterval(() => {
      const players = world.getAllPlayers();
      players.forEach((p) => {
        try {
          p.addEffect("slowness", 40, { amplifier: 255, showParticles: false });
          p.addEffect("mining_fatigue", 40, { amplifier: 255, showParticles: false });
        } catch (err) {
          this.debugLogger?.warn("Failed to apply pause effects", p.nameTag, err);
        }
      });
    }, 20);
  }

  private clearPauseEffects(): void {
    if (this.pauseEffectHandle !== undefined && typeof system.clearRun === "function") {
      system.clearRun(this.pauseEffectHandle);
    }
    this.pauseEffectHandle = undefined;

    const players = world.getAllPlayers();
    players.forEach((p) => {
      try {
        system.run(() => {
          p.removeEffect("slowness");
          p.removeEffect("mining_fatigue");
        });
      } catch (err) {
        this.debugLogger?.warn("Failed to clear pause effects", p.nameTag, err);
      }
    });
  }

  private updatePauseHUD(paused: boolean): void {
    if (paused) {
      world.sendMessage("§c[GAME PAUSED]");
    } else {
      world.sendMessage("§a[GAME RESUMED]");
    }
    // Player timers will automatically pick up the paused state
  }

  private announceWinner(): void {
    const crimsonScore = this.teamManager.getTeamScore("crimson");
    const azureScore = this.teamManager.getTeamScore("azure");
    let subtitle = "§e§lTIE GAME!";
    let winnerLabel = "Tie";

    if (crimsonScore > azureScore) {
      subtitle = "§c§lCRIMSON WINS!";
      winnerLabel = "Crimson";
    } else if (azureScore > crimsonScore) {
      subtitle = "§b§lAZURE WINS!";
      winnerLabel = "Azure";
    }

    const players = world.getAllPlayers();

    // Step 1: Wait 3 seconds, then show "GAME OVER!" for 5 seconds
    system.runTimeout(() => {
      players.forEach((p) => {
        try {
          system.run(() => {
            p.onScreenDisplay.setTitle("§6§lGAME OVER!", {
              subtitle: undefined,
              fadeInDuration: 10,
              stayDuration: 100,
              fadeOutDuration: 20,
            });
          });
        } catch (err) {
          this.debugLogger?.warn("Failed to show game over title", p.nameTag, err);
        }
      });
    }, 60); // 3 seconds

    // Step 2: After game over display (3s + 6.5s = 9.5s), show winner title for 10 seconds
    system.runTimeout(() => {
      players.forEach((p) => {
        try {
          system.run(() => {
            p.onScreenDisplay.setTitle(subtitle, {
              subtitle: undefined,
              fadeInDuration: 20,
              stayDuration: 200,
              fadeOutDuration: 20,
            });
          });
        } catch (err) {
          this.debugLogger?.warn("Failed to show victory title", p.nameTag, err);
        }
      });
      this.audioManager?.playVictorySounds(players);
    }, 190); // 9.5 seconds

    // Step 3: After all titles (3s + 6.5s + 12s = 21.5s), send messages and effects
    system.runTimeout(() => {
      world.sendMessage(
        `§6[LOOT RUSH] §fGame over! §cCrimson: ${crimsonScore} §f| §bAzure: ${azureScore}. §eWinner: ${winnerLabel}`
      );
      try {
        const dim = world.getDimension("overworld");
        const targets = winnerLabel === "Tie" ? ["crimson", "azure"] : [winnerLabel.toLowerCase()];
        targets.forEach((teamId) => {
          const loc = this.chestManager.getChestLocation(teamId as "crimson" | "azure");
          if (loc) {
            system.run(() => {
              dim.spawnParticle("minecraft:firework_rocket", loc);
            });
          }
        });
      } catch (err) {
        this.debugLogger?.warn("Failed to spawn victory fireworks", err);
      }
    }, 430); // 21.5 seconds
  }

  private initiateHUDState(): void {
    const roundMessage = `§6[LOOT RUSH] §fRound §e${this.currentRound}§f of §e${this.totalRounds}§f begins!`;
    world.sendMessage(roundMessage);

    // Show initial timer display
    const remaining = this.getRemainingTime();
    this.updateTimerDisplay(remaining);
  }
}
