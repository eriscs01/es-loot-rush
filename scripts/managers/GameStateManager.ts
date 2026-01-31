import { system, world } from "@minecraft/server";
import { ConfigManager } from "./ConfigManager";
import { PropertyStore } from "./PropertyStore";
import { TeamManager } from "./TeamManager";
import { ChallengeManager } from "./ChallengeManager";
import { ChallengeRecord } from "../types";
import { ChestManager } from "./ChestManager";
import { HUDManager } from "./HUDManager";
import { AudioManager } from "./AudioManager";
import { DebugLogger } from "./DebugLogger";
import { DYNAMIC_KEYS } from "../config/constants";

export class GameStateManager {
  private gameActive = false;
  private gamePaused = false;
  private currentRound = 1;
  private roundStartTick = 0;
  private pausedAtTick = 0;
  private roundTimerHandle?: number;
  private warned60 = false;
  private warned30 = false;
  private lastSecondWarning?: number;
  private pauseEffectHandle?: number;
  private initialized = false;
  private readonly debugLogger: DebugLogger;

  constructor(
    private readonly propertyStore: PropertyStore,
    private readonly configManager: ConfigManager,
    private readonly teamManager: TeamManager,
    private readonly challengeManager: ChallengeManager,
    private readonly chestManager: ChestManager,
    private readonly hudManager: HUDManager,
    private readonly audioManager?: AudioManager
  ) {
    void configManager;
    void teamManager;
    void challengeManager;
    void chestManager;
    void hudManager;
    void audioManager;
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
    this.updatePauseHUD(false);
    this.stopRoundTimer();
    this.challengeManager.stopMonitoring();
    this.teamManager.unregisterJoinHandlers();
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

    world.getAllPlayers().forEach((p) => {
      this.hudManager.clearHUD(p);
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
    const roundDuration = this.configManager.getConfigValue("roundDurationTicks");
    return Math.max(roundDuration - elapsed, 0);
  }

  transitionToNextRound(): void {
    const totalRounds = this.configManager.getConfigValue("totalRounds");
    if (this.currentRound >= totalRounds) {
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
    world.sendMessage(`§6[LOOT RUSH] §fRound ${this.currentRound} begins!`);
    players.forEach((p) => {
      this.hudManager.updateRoundInfo(p);
      this.hudManager.updateTimer(p);
    });
    this.audioManager?.playStartHorn(players);
  }

  forceRound(roundNumber: number): void {
    this.currentRound = roundNumber - 1;
    this.transitionToNextRound();
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
    this.handleTimerWarnings(remaining);
    if (remaining === 0) {
      this.transitionToNextRound();
    }
    this.updateAllTimers();
  }

  private handleTimerWarnings(remainingTicks: number): void {
    const remainingSeconds = Math.ceil(Math.max(remainingTicks, 0) / 20);
    const players = world.getAllPlayers();

    // Every second at 10s and below
    if (remainingSeconds <= 10) {
      if (this.lastSecondWarning !== remainingSeconds) {
        this.audioManager?.playTimerWarning10(players);
        this.lastSecondWarning = remainingSeconds;
      }
      return;
    }

    // One-time 30s warning (higher pitch)
    if (!this.warned30 && remainingSeconds <= 30) {
      this.audioManager?.playTimerWarning30(players);
      this.warned30 = true;
    }

    // One-time 60s warning
    if (!this.warned60 && remainingSeconds <= 60) {
      this.audioManager?.playTimerWarning60(players);
      this.warned60 = true;
    }
  }

  private resetTimerWarnings(): void {
    this.warned60 = false;
    this.warned30 = false;
    this.lastSecondWarning = undefined;
  }

  private updateAllTimers(): void {
    const players = world.getAllPlayers();
    players.forEach((p) => this.hudManager.updateTimer(p));
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
    system.run(() => {
      const players = world.getAllPlayers();
      players.forEach((p) => this.hudManager.setPaused(p, paused));
    });
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
    players.forEach((p) => {
      try {
        system.run(() => {
          p.onScreenDisplay.setTitle("§6§lGAME OVER!", {
            subtitle,
            fadeInDuration: 0,
            stayDuration: 100,
            fadeOutDuration: 10,
          });
        });
      } catch (err) {
        this.debugLogger?.warn("Failed to show game over title", p.nameTag, err);
      }
      this.hudManager.clearHUD(p);
    });

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
    this.audioManager?.playVictorySounds(players);
  }

  private initiateHUDState(): void {
    system.run(() => {
      const players = world.getAllPlayers();
      players.forEach((p) => {
        this.hudManager.updateRoundInfo(p);
        this.hudManager.updateTimer(p);
        this.hudManager.updateScores(p);
      });
    });
  }
}
