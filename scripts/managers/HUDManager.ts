import { Player, system } from "@minecraft/server";
import { ConfigManager } from "./ConfigManager";
import { PropertyStore } from "./PropertyStore";
import { TeamManager } from "./TeamManager";
import { DYNAMIC_KEYS } from "../config/constants";
import { DebugLogger } from "./DebugLogger";

export class HUDManager {
  private playerQueues: Map<string, string[]> = new Map();
  private processingPlayers: Set<string> = new Set();
  private readonly debugLogger: DebugLogger;

  constructor(
    private readonly propertyStore: PropertyStore,
    private readonly configManager: ConfigManager,
    private readonly teamManager: TeamManager
  ) {
    void configManager;
    void teamManager;
    this.debugLogger = new DebugLogger(propertyStore);
  }

  updateTimer(player: Player): void {
    if (!this.isGameActive()) return;
    return;
    const remainingTicks = this.getRemainingTicks();
    const formatted = this.formatTime(remainingTicks);
    this.setTitle(player, `update:eslr:timer:Timer ${formatted}`);
    this.debugLogger?.debug(`HUD timer update for ${player.nameTag}: ${formatted}`);
  }

  updateScore(player: Player, team: string, score: number): void {
    if (!this.isGameActive()) return;
    const teamLabel = team === "crimson" ? "§cCrimson Crusaders" : "§bAzure Architects";
    this.setTitle(player, `update:eslr:score${team}:${teamLabel} - ${score}`);
    this.debugLogger?.log(`HUD score update for ${player.nameTag}: ${team} ${score}`);
  }

  updateScores(player: Player): void {
    if (!this.isGameActive()) return;
    const crimson = this.teamManager?.getTeamScore("crimson") ?? 0;
    const azure = this.teamManager?.getTeamScore("azure") ?? 0;
    this.setTitle(player, `update:eslr:scorecrimson:§cCrimson Crusaders - ${crimson}`);
    this.setTitle(player, `update:eslr:scoreazure:§bAzure Architects - ${azure}`);
    this.debugLogger?.log(`HUD score update for ${player.nameTag}: Crimson ${crimson}, Azure ${azure}`);
  }

  updateRoundInfo(player: Player): void {
    if (!this.isGameActive()) return;
    const totalRounds = this.configManager?.getConfigValue("totalRounds") ?? 0;
    const currentRound = this.getCurrentRound();
    this.setTitle(player, `update:eslr:round:§6Round ${currentRound} of ${totalRounds}`);
    this.debugLogger?.log(`HUD round update for ${player.nameTag}: ${currentRound}/${totalRounds}`);
  }

  setPaused(player: Player, paused: boolean): void {
    if (!this.isGameActive()) return;
    if (paused) {
      this.setTitle(player, "update:eslr:timer:Timer §c§lPAUSED");
      this.debugLogger?.log(`HUD paused for ${player.nameTag}`);
      return;
    }
    this.updateTimer(player);
  }

  clearHUD(player: Player): void {
    const prefixes = [
      "update:eslr:round:",
      "update:eslr:timer:",
      "update:eslr:scorecrimson:",
      "update:eslr:scoreazure:",
    ];
    system.run(() => {
      prefixes.forEach((prefix) => this.setTitle(player, prefix));
    });
    this.debugLogger?.log(`HUD cleared for ${player.nameTag}`);
  }

  private setTitle(player: Player, text: string): void {
    const playerId = player.id;

    if (!this.playerQueues.has(playerId)) {
      this.playerQueues.set(playerId, []);
    }

    this.playerQueues.get(playerId)!.push(text);
    this.processQueue(player);
  }

  private async processQueue(player: Player): Promise<void> {
    const playerId = player.id;

    if (this.processingPlayers.has(playerId)) return;
    this.processingPlayers.add(playerId);

    const queue = this.playerQueues.get(playerId);
    const text = queue?.shift();

    if (!text) {
      this.processingPlayers.delete(playerId);
      return;
    }

    try {
      console.log(`${system.currentTick} setTitle ${text}`);
      player.onScreenDisplay.setTitle(text, {
        stayDuration: 1,
        fadeInDuration: 0,
        fadeOutDuration: 0,
      });
      await system.waitTicks(1);
    } catch (err) {
      this.debugLogger?.warn("Failed to set HUD title", player.nameTag, err);
    }

    this.processingPlayers.delete(playerId);

    // Process next item if queue has more
    if (queue && queue.length > 0) {
      this.processQueue(player);
    }
  }

  private isGameActive(): boolean {
    return this.propertyStore.getBoolean(DYNAMIC_KEYS.gameActive, false);
  }

  private getCurrentRound(): number {
    return this.propertyStore.getNumber(DYNAMIC_KEYS.currentRound, 1);
  }

  private getRemainingTicks(): number {
    const roundDuration = this.configManager?.getConfigValue("roundDurationTicks") ?? 0;
    const startTick = this.propertyStore.getNumber(DYNAMIC_KEYS.roundStartTick, system.currentTick);
    const elapsed = Math.max(system.currentTick - startTick, 0);
    return Math.max(roundDuration - elapsed, 0);
  }

  private formatTime(remainingTicks: number): string {
    const secondsTotal = Math.floor(remainingTicks / 20);
    const minutes = Math.floor(secondsTotal / 60);
    const seconds = secondsTotal % 60;

    const color = remainingTicks < 1200 ? "§c" : remainingTicks < 2400 ? "§6" : "§e";
    const timeStr = `${minutes}:${seconds.toString().padStart(2, "0")}`;
    return `${color}${timeStr}`;
  }
}
