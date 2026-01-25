import { system, world } from "@minecraft/server";
import { ConfigManager } from "./ConfigManager";
import { TeamManager } from "./TeamManager";
import { ChallengeManager } from "./ChallengeManager";
import { ChestManager } from "./ChestManager";
import { HUDManager } from "./HUDManager";
import { AudioManager } from "./AudioManager";
import { GameConfig } from "../types";

export class GameStateManager {
  private gameActive = false;
  private gamePaused = false;
  private currentRound = 1;
  private roundStartTick = 0;

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
    this.configManager.loadConfig();
    this.currentRound = 1;
    this.roundStartTick = system.currentTick;
  }

  startGame(): void {
    this.gameActive = true;
    this.gamePaused = false;
    this.currentRound = 1;
    this.roundStartTick = system.currentTick;
  }

  endGame(): void {
    this.gameActive = false;
    this.gamePaused = false;
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
    if (this.currentRound < totalRounds) {
      this.currentRound += 1;
      this.roundStartTick = system.currentTick;
    } else {
      this.endGame();
    }
  }

  forceRound(roundNumber: number): void {
    this.currentRound = roundNumber;
    this.roundStartTick = system.currentTick;
  }

  getGameConfig(): GameConfig {
    return this.configManager.getConfig();
  }

  isGameActive(): boolean {
    return this.gameActive;
  }

  isPaused(): boolean {
    return this.gamePaused;
  }
}
