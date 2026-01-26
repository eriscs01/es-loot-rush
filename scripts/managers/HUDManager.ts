import { Player, system, world } from "@minecraft/server";
import { ConfigManager } from "./ConfigManager";
import { ChallengeRecord } from "./ChallengeManager";
import { TeamManager } from "./TeamManager";
import { DYNAMIC_KEYS } from "../config/constants";
import { DebugLogger } from "./DebugLogger";

export class HUDManager {
  private playerQueues: Map<string, string[]> = new Map();
  private processingPlayers: Set<string> = new Set();

  constructor(
    private readonly worldRef = world,
    private readonly configManager: ConfigManager,
    private readonly teamManager: TeamManager,
    private readonly debugLogger?: DebugLogger
  ) {}

  updateTimer(player: Player): void {
    if (!this.isGameActive()) return;
    return;
    const remainingTicks = this.getRemainingTicks();
    const formatted = this.formatTime(remainingTicks);
    this.setTitle(player, `update:eslr:timer:Timer ${formatted}`);
    this.debugLogger?.debug(`HUD timer update for ${player.nameTag}: ${formatted}`);
  }

  completeChallenge(player: Player, challengeIndex: number, challenge: ChallengeRecord, completedByTeam: string): void {
    if (!this.isGameActive()) return;

    const completedBy =
      completedByTeam === "crimson" ? "§cCrimson" : completedByTeam === "azure" ? "§bAzure" : undefined;
    const ownerLabel = completedBy ? ` §7(${completedBy}§7)` : " §7(Claimed)";
    const line = `§a✓ ${challenge.name} ${ownerLabel}`;

    this.setTitle(player, `update:eslr:chlist${challengeIndex}:${line}`);
    this.debugLogger?.log(`Challenge ${challenge.id} marked complete in HUD for ${player.nameTag}`);
  }

  updateChallenges(player: Player, challenges: ChallengeRecord[]): void {
    if (!this.isGameActive()) return;

    // Header
    this.setTitle(player, "update:eslr:chheader:§6§lCHALLENGES");

    for (let i = 0; i < 10; i++) {
      const challenge = challenges[i];
      if (!challenge) {
        this.setTitle(player, `update:eslr:chlist${i}:`);
        continue;
      }

      const claimed = challenge.state === "completed";
      const completedBy =
        challenge.completedBy === "crimson" ? "§cCrimson" : challenge.completedBy ? "§bAzure" : undefined;
      const statusPrefix = claimed ? "§a✓" : "§f○";
      const pointsLabel = `§e(${challenge.points}pts)`;
      const ownerLabel = claimed && completedBy ? ` §7(${completedBy}§7)` : " §7(Claimed)";
      const suffix = claimed ? ownerLabel : pointsLabel;
      const line = `${statusPrefix} ${challenge.name} ${suffix}`;
      this.setTitle(player, `update:eslr:chlist${i}:${line}`);
    }
    this.debugLogger?.log(`HUD challenges update for ${player.nameTag}: count=${challenges.length}`);
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
      "update:eslr:chheader:",
      "update:eslr:chlist0:",
      "update:eslr:chlist1:",
      "update:eslr:chlist2:",
      "update:eslr:chlist3:",
      "update:eslr:chlist4:",
      "update:eslr:chlist5:",
      "update:eslr:chlist6:",
      "update:eslr:chlist7:",
      "update:eslr:chlist8:",
      "update:eslr:chlist9:",
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

    if (!this.processingPlayers.has(playerId)) {
      this.processQueue(player);
    }
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
    const active = this.worldRef.getDynamicProperty(DYNAMIC_KEYS.gameActive);
    return active === true;
  }

  private getCurrentRound(): number {
    const stored = this.worldRef.getDynamicProperty(DYNAMIC_KEYS.currentRound);
    return typeof stored === "number" ? stored : 1;
  }

  private getRemainingTicks(): number {
    const roundDuration = this.configManager?.getConfigValue("roundDurationTicks") ?? 0;
    const startTickRaw = this.worldRef.getDynamicProperty(DYNAMIC_KEYS.roundStartTick);
    const startTick = typeof startTickRaw === "number" ? startTickRaw : system.currentTick;
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
