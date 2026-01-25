import { system, world } from "@minecraft/server";
import { ConfigManager } from "./ConfigManager";
import { TeamManager } from "./TeamManager";
import { ChallengeManager } from "./ChallengeManager";
import { ChestManager } from "./ChestManager";
import { HUDManager } from "./HUDManager";
import { AudioManager } from "./AudioManager";
import { DebugLogger } from "./DebugLogger";
import { GameConfig } from "../types";
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

  constructor(
    private readonly configManager: ConfigManager,
    private readonly teamManager: TeamManager,
    private readonly challengeManager: ChallengeManager,
    private readonly chestManager: ChestManager,
    private readonly hudManager: HUDManager,
    private readonly audioManager?: AudioManager,
    private readonly debugLogger?: DebugLogger,
    private readonly worldRef = world
  ) {}

  initialize(): void {
    this.registerDynamicProperties();
    this.registerPauseGuards();
    this.configManager.loadConfig();
    this.teamManager.loadRostersFromProperties();
    this.ensureDefaults();
    this.gameActive = this.getBooleanProperty(DYNAMIC_KEYS.gameActive, false);
    this.gamePaused = this.getBooleanProperty(DYNAMIC_KEYS.gamePaused, false);
    this.currentRound = this.getNumberProperty(DYNAMIC_KEYS.currentRound, 1);
    this.roundStartTick = this.getNumberProperty(DYNAMIC_KEYS.roundStartTick, system.currentTick);
    this.pausedAtTick = this.getNumberProperty(DYNAMIC_KEYS.pausedAtTick, 0);
  }

  startGame(): void {
    this.setBooleanProperty(DYNAMIC_KEYS.gameActive, true);
    this.setBooleanProperty(DYNAMIC_KEYS.teamsFormed, true);
    this.setBooleanProperty(DYNAMIC_KEYS.gamePaused, false);
    this.setNumberProperty(DYNAMIC_KEYS.pausedAtTick, 0);
    this.setNumberProperty(DYNAMIC_KEYS.crimsonScore, 0);
    this.setNumberProperty(DYNAMIC_KEYS.azureScore, 0);
    this.gameActive = true;
    this.gamePaused = false;
    this.currentRound = 1;
    this.roundStartTick = system.currentTick;
    this.pausedAtTick = 0;
    this.resetTimerWarnings();
    this.persistRoundState();
    this.worldRef.setDynamicProperty(DYNAMIC_KEYS.activeChallenges, "[]");
    this.worldRef.setDynamicProperty(DYNAMIC_KEYS.completedChallenges, "[]");
    this.startRoundTimer();
    this.updateAllTimers();
    this.chestManager.monitorChests();
    this.teamManager.registerJoinHandlers();
    this.debugLogger?.log(`Game started at tick ${this.roundStartTick}`);
  }

  endGame(announceWinner = false): void {
    this.setBooleanProperty(DYNAMIC_KEYS.gameActive, false);
    this.setBooleanProperty(DYNAMIC_KEYS.gamePaused, false);
    this.setNumberProperty(DYNAMIC_KEYS.pausedAtTick, 0);
    this.gameActive = false;
    this.gamePaused = false;
    this.pausedAtTick = 0;
    this.clearPauseEffects();
    this.updatePauseHUD(false);
    this.stopRoundTimer();
    this.chestManager.stopMonitoring();
    this.teamManager.unregisterJoinHandlers();
    this.debugLogger?.log(`Game ended. Winner announced: ${announceWinner}`);
    if (announceWinner) {
      this.announceWinner();
    }
  }

  resetGame(): void {
    this.endGame(false);
    this.setBooleanProperty(DYNAMIC_KEYS.teamsFormed, false);
    this.setBooleanProperty(DYNAMIC_KEYS.gamePaused, false);
    this.setNumberProperty(DYNAMIC_KEYS.pausedAtTick, 0);
    this.currentRound = 0;
    this.roundStartTick = system.currentTick;
    this.setNumberProperty(DYNAMIC_KEYS.currentRound, this.currentRound);
    this.setNumberProperty(DYNAMIC_KEYS.roundStartTick, this.roundStartTick);
    this.setNumberProperty(DYNAMIC_KEYS.crimsonScore, 0);
    this.setNumberProperty(DYNAMIC_KEYS.azureScore, 0);
    this.worldRef.setDynamicProperty(DYNAMIC_KEYS.activeChallenges, "[]");
    this.worldRef.setDynamicProperty(DYNAMIC_KEYS.completedChallenges, "[]");
    this.resetTimerWarnings();

    this.challengeManager.resetChallenges();
    this.teamManager.clearTeams();
    this.chestManager.clearChestReferences();

    const players = this.worldRef.getAllPlayers();
    players.forEach((p) => {
      this.hudManager.clearHUD(p);
      this.teamManager.resetPlayerNameTag(p);
    });

    this.debugLogger?.log("Game state fully reset");
    this.worldRef.sendMessage("§6[LOOT RUSH] §fState reset. Run lr:teamup to form teams.");
  }

  pauseGame(): void {
    if (this.gamePaused) return;
    this.gamePaused = true;
    this.setBooleanProperty(DYNAMIC_KEYS.gamePaused, true);
    this.pausedAtTick = system.currentTick;
    this.setNumberProperty(DYNAMIC_KEYS.pausedAtTick, this.pausedAtTick);
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
    this.setNumberProperty(DYNAMIC_KEYS.pausedAtTick, 0);
    this.setBooleanProperty(DYNAMIC_KEYS.gamePaused, false);
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
    this.setNumberProperty(DYNAMIC_KEYS.pausedAtTick, 0);
    this.setBooleanProperty(DYNAMIC_KEYS.gamePaused, false);
    this.resetTimerWarnings();
    this.persistRoundState();
    this.debugLogger?.log(`Transitioning to round ${this.currentRound}`);

    this.challengeManager.resetChallenges();
    this.challengeManager.selectChallenges();

    const players = this.worldRef.getAllPlayers();
    this.worldRef.sendMessage(`§6[LOOT RUSH] §fRound ${this.currentRound} begins!`);
    players.forEach((p) => {
      this.hudManager.updateRoundInfo(p);
      this.hudManager.updateTimer(p);
      this.hudManager.updateChallenges(p);
    });
    this.audioManager?.playStartHorn(players);
  }

  forceRound(roundNumber: number): void {
    this.currentRound = roundNumber - 1;
    this.transitionToNextRound();
  }

  getGameConfig(): GameConfig {
    return this.configManager.getConfig();
  }

  isGameActive(): boolean {
    const stored = this.worldRef.getDynamicProperty(DYNAMIC_KEYS.gameActive);
    return typeof stored === "boolean" ? stored : this.gameActive;
  }

  isPaused(): boolean {
    return this.gamePaused;
  }

  setTeamsFormed(flag: boolean): void {
    this.setBooleanProperty(DYNAMIC_KEYS.teamsFormed, flag);
  }

  isTeamsFormed(): boolean {
    const stored = this.worldRef.getDynamicProperty(DYNAMIC_KEYS.teamsFormed);
    return typeof stored === "boolean" ? stored : false;
  }

  private registerDynamicProperties(): void {
    const anyWorld = world as unknown as {
      beforeEvents?: { worldInitialize?: { subscribe: (callback: (ev: any) => void) => void } };
      afterEvents?: { worldInitialize?: { subscribe: (callback: (ev: any) => void) => void } };
    };

    const subscribe =
      anyWorld.beforeEvents?.worldInitialize?.subscribe ?? anyWorld.afterEvents?.worldInitialize?.subscribe;

    subscribe?.((event: any) => {
      const { propertyRegistry } = event ?? {};
      if (!propertyRegistry) return;
      propertyRegistry.registerBoolean(DYNAMIC_KEYS.gameActive);
      propertyRegistry.registerBoolean(DYNAMIC_KEYS.gamePaused);
      propertyRegistry.registerBoolean(DYNAMIC_KEYS.debugMode);
      propertyRegistry.registerBoolean(DYNAMIC_KEYS.teamsFormed);
      propertyRegistry.registerNumber(DYNAMIC_KEYS.currentRound);
      propertyRegistry.registerNumber(DYNAMIC_KEYS.roundStartTick);
      propertyRegistry.registerNumber(DYNAMIC_KEYS.pausedAtTick);
      propertyRegistry.registerNumber(DYNAMIC_KEYS.crimsonScore);
      propertyRegistry.registerNumber(DYNAMIC_KEYS.azureScore);
      propertyRegistry.registerString(DYNAMIC_KEYS.activeChallenges, 16000);
      propertyRegistry.registerString(DYNAMIC_KEYS.completedChallenges, 16000);
      propertyRegistry.registerString(DYNAMIC_KEYS.config, 16000);
      propertyRegistry.registerString(DYNAMIC_KEYS.crimsonPlayers, 16000);
      propertyRegistry.registerString(DYNAMIC_KEYS.azurePlayers, 16000);
      propertyRegistry.registerString(DYNAMIC_KEYS.chestCrimsonLocation, 16000);
      propertyRegistry.registerString(DYNAMIC_KEYS.chestAzureLocation, 16000);
      propertyRegistry.registerString(DYNAMIC_KEYS.spawnLocation, 16000);
    });
  }

  private registerPauseGuards(): void {
    // Cancel block interactions while paused
    this.worldRef.beforeEvents.playerBreakBlock.subscribe((event) => {
      if (this.gamePaused && this.isGameActive()) {
        event.cancel = true;
      }
    });

    (this.worldRef.beforeEvents as any).playerPlaceBlock?.subscribe((event: any) => {
      if (this.gamePaused && this.isGameActive()) {
        event.cancel = true;
      }
    });

    this.worldRef.beforeEvents.playerInteractWithBlock.subscribe((event) => {
      if (this.gamePaused && this.isGameActive()) {
        event.cancel = true;
      }
    });

    this.worldRef.beforeEvents.itemUse.subscribe((event) => {
      if (this.gamePaused && this.isGameActive()) {
        event.cancel = true;
      }
    });

    (this.worldRef.beforeEvents as any).itemUseOn?.subscribe((event: any) => {
      if (this.gamePaused && this.isGameActive()) {
        event.cancel = true;
      }
    });
  }

  private ensureDefaults(): void {
    this.setBooleanProperty(DYNAMIC_KEYS.gameActive, this.getBooleanProperty(DYNAMIC_KEYS.gameActive, false));
    this.setBooleanProperty(DYNAMIC_KEYS.gamePaused, this.getBooleanProperty(DYNAMIC_KEYS.gamePaused, false));
    this.setBooleanProperty(DYNAMIC_KEYS.debugMode, this.getBooleanProperty(DYNAMIC_KEYS.debugMode, false));
    this.setBooleanProperty(DYNAMIC_KEYS.teamsFormed, this.getBooleanProperty(DYNAMIC_KEYS.teamsFormed, false));
    this.setNumberProperty(DYNAMIC_KEYS.currentRound, this.getNumberProperty(DYNAMIC_KEYS.currentRound, 1));
    this.setNumberProperty(
      DYNAMIC_KEYS.roundStartTick,
      this.getNumberProperty(DYNAMIC_KEYS.roundStartTick, system.currentTick)
    );
    this.setNumberProperty(DYNAMIC_KEYS.pausedAtTick, this.getNumberProperty(DYNAMIC_KEYS.pausedAtTick, 0));
    this.setNumberProperty(DYNAMIC_KEYS.crimsonScore, this.getNumberProperty(DYNAMIC_KEYS.crimsonScore, 0));
    this.setNumberProperty(DYNAMIC_KEYS.azureScore, this.getNumberProperty(DYNAMIC_KEYS.azureScore, 0));
    if (typeof this.worldRef.getDynamicProperty(DYNAMIC_KEYS.activeChallenges) !== "string") {
      this.worldRef.setDynamicProperty(DYNAMIC_KEYS.activeChallenges, "[]");
    }
    if (typeof this.worldRef.getDynamicProperty(DYNAMIC_KEYS.completedChallenges) !== "string") {
      this.worldRef.setDynamicProperty(DYNAMIC_KEYS.completedChallenges, "[]");
    }
  }

  private persistRoundState(): void {
    this.setNumberProperty(DYNAMIC_KEYS.currentRound, this.currentRound);
    this.setNumberProperty(DYNAMIC_KEYS.roundStartTick, this.roundStartTick);
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
    const players = this.worldRef.getAllPlayers();

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
    const players = this.worldRef.getAllPlayers();
    players.forEach((p) => this.hudManager.updateTimer(p));
  }

  private applyPauseEffects(): void {
    if (this.pauseEffectHandle !== undefined && typeof system.clearRun === "function") {
      system.clearRun(this.pauseEffectHandle);
    }

    this.pauseEffectHandle = system.runInterval(() => {
      const players = this.worldRef.getAllPlayers();
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

    const players = this.worldRef.getAllPlayers();
    players.forEach((p) => {
      try {
        p.removeEffect("slowness");
        p.removeEffect("mining_fatigue");
      } catch (err) {
        this.debugLogger?.warn("Failed to clear pause effects", p.nameTag, err);
      }
    });
  }

  private updatePauseHUD(paused: boolean): void {
    const players = this.worldRef.getAllPlayers();
    players.forEach((p) => this.hudManager.setPaused(p, paused));
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
      subtitle = "§9§lAZURE WINS!";
      winnerLabel = "Azure";
    }

    const players = this.worldRef.getAllPlayers();
    players.forEach((p) => {
      try {
        p.onScreenDisplay.setTitle("§6§lGAME OVER!", {
          subtitle,
          fadeInDuration: 0,
          stayDuration: 100,
          fadeOutDuration: 10,
        });
      } catch (err) {
        this.debugLogger?.warn("Failed to show game over title", p.nameTag, err);
      }
      this.hudManager.clearHUD(p);
    });

    this.worldRef.sendMessage(
      `§6[LOOT RUSH] §fGame over! §cCrimson: ${crimsonScore} §f| §9Azure: ${azureScore}. §eWinner: ${winnerLabel}`
    );
    this.audioManager?.playVictorySounds(players);
  }

  private setBooleanProperty(key: string, value: boolean): void {
    this.worldRef.setDynamicProperty(key, value);
  }

  private getBooleanProperty(key: string, fallback: boolean): boolean {
    const val = this.worldRef.getDynamicProperty(key);
    return typeof val === "boolean" ? val : fallback;
  }

  private setNumberProperty(key: string, value: number): void {
    this.worldRef.setDynamicProperty(key, value);
  }

  private getNumberProperty(key: string, fallback: number): number {
    const val = this.worldRef.getDynamicProperty(key);
    return typeof val === "number" ? val : fallback;
  }
}
