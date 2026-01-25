import { system, world } from "@minecraft/server";
import { ConfigManager } from "./ConfigManager";
import { TeamManager } from "./TeamManager";
import { ChallengeManager } from "./ChallengeManager";
import { ChestManager } from "./ChestManager";
import { HUDManager } from "./HUDManager";
import { AudioManager } from "./AudioManager";
import { GameConfig } from "../types";
import { DYNAMIC_KEYS } from "../config/constants";

export class GameStateManager {
  private gameActive = false;
  private gamePaused = false;
  private currentRound = 1;
  private roundStartTick = 0;
  private roundTimerHandle?: number;

  constructor(
    private readonly configManager: ConfigManager,
    private readonly teamManager: TeamManager,
    private readonly challengeManager: ChallengeManager,
    private readonly chestManager: ChestManager,
    private readonly hudManager: HUDManager,
    private readonly audioManager?: AudioManager,
    private readonly worldRef = world
  ) {}

  initialize(): void {
    this.registerDynamicProperties();
    this.configManager.loadConfig();
    this.teamManager.loadRostersFromProperties();
    this.ensureDefaults();
    this.currentRound = this.getNumberProperty(DYNAMIC_KEYS.currentRound, 1);
    this.roundStartTick = this.getNumberProperty(DYNAMIC_KEYS.roundStartTick, system.currentTick);
  }

  startGame(): void {
    this.setBooleanProperty(DYNAMIC_KEYS.gameActive, true);
    this.setBooleanProperty(DYNAMIC_KEYS.teamsFormed, true);
    this.setNumberProperty(DYNAMIC_KEYS.crimsonScore, 0);
    this.setNumberProperty(DYNAMIC_KEYS.azureScore, 0);
    this.gameActive = true;
    this.gamePaused = false;
    this.currentRound = 1;
    this.roundStartTick = system.currentTick;
    this.persistRoundState();
    this.worldRef.setDynamicProperty(DYNAMIC_KEYS.activeChallenges, "[]");
    this.worldRef.setDynamicProperty(DYNAMIC_KEYS.completedChallenges, "[]");
    this.startRoundTimer();
    this.chestManager.monitorChests();
  }

  endGame(announceWinner = false): void {
    this.setBooleanProperty(DYNAMIC_KEYS.gameActive, false);
    this.gameActive = false;
    this.gamePaused = false;
    this.stopRoundTimer();
    this.chestManager.stopMonitoring();
    if (announceWinner) {
      this.announceWinner();
    }
  }

  pauseGame(): void {
    this.gamePaused = true;
  }

  resumeGame(): void {
    this.gamePaused = false;
  }

  getCurrentRound(): number {
    return this.currentRound;
  }

  getRemainingTime(): number {
    const elapsed = system.currentTick - this.roundStartTick;
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
    this.persistRoundState();

    this.challengeManager.resetChallenges();
    this.challengeManager.selectChallenges();

    const players = this.worldRef.getAllPlayers();
    this.worldRef.sendMessage(`§6[LOOT RUSH] §fRound ${this.currentRound} begins!`);
    players.forEach((p) => this.hudManager.updateHUD(p));
    this.audioManager?.playStartHorn(players);
  }

  forceRound(roundNumber: number): void {
    this.currentRound = roundNumber;
    this.roundStartTick = system.currentTick;
    this.persistRoundState();
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
      propertyRegistry.registerBoolean(DYNAMIC_KEYS.teamsFormed);
      propertyRegistry.registerNumber(DYNAMIC_KEYS.currentRound);
      propertyRegistry.registerNumber(DYNAMIC_KEYS.roundStartTick);
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

  private ensureDefaults(): void {
    this.setBooleanProperty(DYNAMIC_KEYS.gameActive, this.getBooleanProperty(DYNAMIC_KEYS.gameActive, false));
    this.setBooleanProperty(DYNAMIC_KEYS.teamsFormed, this.getBooleanProperty(DYNAMIC_KEYS.teamsFormed, false));
    this.setNumberProperty(DYNAMIC_KEYS.currentRound, this.getNumberProperty(DYNAMIC_KEYS.currentRound, 1));
    this.setNumberProperty(
      DYNAMIC_KEYS.roundStartTick,
      this.getNumberProperty(DYNAMIC_KEYS.roundStartTick, system.currentTick)
    );
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
    if (remaining === 0) {
      this.transitionToNextRound();
    }
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
      } catch {
        /* ignore title failures */
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
