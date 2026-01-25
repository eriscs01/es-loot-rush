import { system, world } from "@minecraft/server";
import { ConfigManager } from "./ConfigManager";
import { TeamManager } from "./TeamManager";
import { ChallengeManager } from "./ChallengeManager";
import { ChestManager } from "./ChestManager";
import { HUDManager } from "./HUDManager";
import { AudioManager } from "./AudioManager";
import { DebugLogger } from "./DebugLogger";
import { GameConfig } from "../types";
import { BACKUP_PREFIX, BACKUP_TIMESTAMP, DYNAMIC_KEYS } from "../config/constants";

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
    this.deferInitialization();
  }

  private deferInitialization(): void {
    const anyWorld = this.worldRef as unknown as {
      afterEvents?: { worldInitialize?: { subscribe: (cb: (ev: any) => void) => void } };
      beforeEvents?: { worldInitialize?: { subscribe: (cb: (ev: any) => void) => void } };
    };

    const subscriber =
      anyWorld.afterEvents?.worldInitialize?.subscribe ?? anyWorld.beforeEvents?.worldInitialize?.subscribe;

    if (subscriber) {
      subscriber(() => this.finishInitialization());
    } else {
      system.runTimeout(() => this.finishInitialization(), 0);
    }
  }

  private finishInitialization(): void {
    if (this.initialized) return;
    this.initialized = true;
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

  backupState(): { saved: number; timestamp: number } {
    const keys = Object.values(DYNAMIC_KEYS);
    let saved = 0;

    keys.forEach((key) => {
      try {
        const value = this.worldRef.getDynamicProperty(key);
        this.worldRef.setDynamicProperty(this.getBackupKey(key), JSON.stringify(value ?? null));
        saved += 1;
      } catch (err) {
        this.debugLogger?.warn("Failed to backup property", key, err);
      }
    });

    const timestamp = system.currentTick;
    this.worldRef.setDynamicProperty(BACKUP_TIMESTAMP, timestamp);
    this.debugLogger?.log(`Backup saved at tick ${timestamp} (${saved} properties)`);

    return { saved, timestamp };
  }

  restoreState(): { restored: number; timestamp: number } {
    const keys = Object.values(DYNAMIC_KEYS);
    let restored = 0;

    keys.forEach((key) => {
      const backupKey = this.getBackupKey(key);
      const raw = this.worldRef.getDynamicProperty(backupKey);
      if (typeof raw !== "string") return;
      try {
        const parsed = JSON.parse(raw) as unknown;
        this.setFromBackup(key, parsed);
        restored += 1;
      } catch (err) {
        this.debugLogger?.warn("Failed to restore property", key, err);
      }
    });

    this.reloadStateFromProperties();
    const timestamp = this.getNumberProperty(BACKUP_TIMESTAMP, 0);
    this.debugLogger?.log(`Restored state from backup tick ${timestamp}; restored=${restored}`);
    return { restored, timestamp };
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
    const challenges = this.challengeManager.selectChallenges();

    const players = this.worldRef.getAllPlayers();
    this.worldRef.sendMessage(`§6[LOOT RUSH] §fRound ${this.currentRound} begins!`);
    players.forEach((p) => {
      this.hudManager.updateRoundInfo(p);
      this.hudManager.updateTimer(p);
      this.hudManager.updateChallenges(p, challenges);
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
      // Backup copies stored as strings for safety
      const backupKeys = Object.values(DYNAMIC_KEYS).map((key) => `${BACKUP_PREFIX}${key.replace(/^lootRush:/, "")}`);
      backupKeys.forEach((backupKey) => propertyRegistry.registerString(backupKey, 16000));
      propertyRegistry.registerNumber(BACKUP_TIMESTAMP);
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
      subtitle = "§b§lAZURE WINS!";
      winnerLabel = "Azure";
    }

    const players = this.worldRef.getAllPlayers();
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

    this.worldRef.sendMessage(
      `§6[LOOT RUSH] §fGame over! §cCrimson: ${crimsonScore} §f| §bAzure: ${azureScore}. §eWinner: ${winnerLabel}`
    );
    try {
      const dim = this.worldRef.getDimension("overworld");
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

  private getBackupKey(key: string): string {
    const suffix = key.replace(/^lootRush:/, "");
    return `${BACKUP_PREFIX}${suffix}`;
  }

  private setFromBackup(key: string, value: unknown): void {
    const booleanKeys = new Set<string>([
      DYNAMIC_KEYS.gameActive,
      DYNAMIC_KEYS.teamsFormed,
      DYNAMIC_KEYS.gamePaused,
      DYNAMIC_KEYS.debugMode,
    ]);
    const numberKeys = new Set<string>([
      DYNAMIC_KEYS.currentRound,
      DYNAMIC_KEYS.roundStartTick,
      DYNAMIC_KEYS.pausedAtTick,
      DYNAMIC_KEYS.crimsonScore,
      DYNAMIC_KEYS.azureScore,
    ]);
    const stringKeys = new Set<string>([
      DYNAMIC_KEYS.activeChallenges,
      DYNAMIC_KEYS.completedChallenges,
      DYNAMIC_KEYS.config,
      DYNAMIC_KEYS.crimsonPlayers,
      DYNAMIC_KEYS.azurePlayers,
      DYNAMIC_KEYS.chestCrimsonLocation,
      DYNAMIC_KEYS.chestAzureLocation,
      DYNAMIC_KEYS.spawnLocation,
    ]);

    if (booleanKeys.has(key)) {
      this.worldRef.setDynamicProperty(key, Boolean(value));
      return;
    }
    if (numberKeys.has(key)) {
      const parsed = typeof value === "number" ? value : Number(value);
      this.worldRef.setDynamicProperty(key, Number.isFinite(parsed) ? parsed : 0);
      return;
    }
    if (stringKeys.has(key)) {
      const payload = typeof value === "string" ? value : JSON.stringify(value ?? {});
      this.worldRef.setDynamicProperty(key, payload);
      return;
    }
    try {
      this.worldRef.setDynamicProperty(key, JSON.stringify(value ?? {}));
    } catch (err) {
      this.debugLogger?.warn("Failed to stringify backup value", key, err);
    }
  }

  private reloadStateFromProperties(): void {
    this.gameActive = this.getBooleanProperty(DYNAMIC_KEYS.gameActive, false);
    this.gamePaused = this.getBooleanProperty(DYNAMIC_KEYS.gamePaused, false);
    this.currentRound = this.getNumberProperty(DYNAMIC_KEYS.currentRound, 1);
    this.roundStartTick = this.getNumberProperty(DYNAMIC_KEYS.roundStartTick, system.currentTick);
    this.pausedAtTick = this.getNumberProperty(DYNAMIC_KEYS.pausedAtTick, 0);
    this.resetTimerWarnings();

    this.configManager.loadConfig();
    this.teamManager.loadRostersFromProperties();
    this.challengeManager.getActiveChallenges();
    this.challengeManager.getCompletedChallenges();
    this.chestManager.reloadFromProperties();

    this.stopRoundTimer();
    if (this.gameActive) {
      this.startRoundTimer();
    }

    if (this.gamePaused && this.gameActive) {
      this.applyPauseEffects();
    } else {
      this.clearPauseEffects();
    }

    if (this.gameActive && !this.gamePaused) {
      this.chestManager.monitorChests();
    } else {
      this.chestManager.stopMonitoring();
    }

    if (this.isTeamsFormed()) {
      this.teamManager.registerJoinHandlers();
    } else {
      this.teamManager.unregisterJoinHandlers();
    }

    const spawn = this.chestManager.getSpawnLocation();
    const players = this.worldRef.getAllPlayers();
    const activeChallenges = this.challengeManager.getActiveChallenges();

    players.forEach((p) => {
      this.teamManager.applyTeamColor(p);
      if (spawn) {
        this.teamManager.setSpawnPointForPlayer(p, spawn);
      }
      if (this.gameActive) {
        this.hudManager.updateRoundInfo(p);
        this.hudManager.updateTimer(p);
        this.hudManager.updateScores(p);
        this.hudManager.updateChallenges(p, activeChallenges);
        this.hudManager.setPaused(p, this.gamePaused);
      } else {
        this.hudManager.clearHUD(p);
      }
    });
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
