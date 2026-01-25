import { Player, system, world } from "@minecraft/server";
import { ConfigManager } from "./ConfigManager";
import { ChallengeRecord } from "./ChallengeManager";
import { TeamManager } from "./TeamManager";
import { DYNAMIC_KEYS } from "../config/constants";
import { DebugLogger } from "./DebugLogger";

export class HUDManager {
  constructor(
    private readonly worldRef = world,
    private readonly configManager: ConfigManager,
    private readonly teamManager: TeamManager,
    private readonly debugLogger?: DebugLogger
  ) {}

  updateTimer(player: Player): void {
    if (!this.isGameActive()) return;
    const remainingTicks = this.getRemainingTicks();
    const formatted = this.formatTime(remainingTicks);
    this.setTitle(player, `update:lr:timer:${formatted}`);
    this.debugLogger?.log(`HUD timer update for ${player.nameTag}: ${formatted}`);
  }

  updateChallenges(player: Player, challenges: ChallengeRecord[]): void {
    if (!this.isGameActive()) return;

    this.debugLogger?.log(`HUD challenges update for ${player.nameTag}: count=${challenges.length}`);

    // Header
    this.setTitle(player, "update:lr:challenges:header:§6§lCHALLENGES");

    for (let i = 0; i < 10; i++) {
      const challenge = challenges[i];
      if (!challenge) {
        this.setTitle(player, `update:lr:challenge:${i}:`);
        continue;
      }

      const claimed = challenge.state === "completed";
      const completedBy =
        challenge.completedBy === "crimson" ? "§cCrimson" : challenge.completedBy ? "§9Azure" : undefined;
      const statusPrefix = claimed ? "§a✓" : "§f○";
      const pointsLabel = `§e(${challenge.points}pts)`;
      const ownerLabel = claimed && completedBy ? ` §7(${completedBy})` : " §7(Claimed)";
      const suffix = claimed ? ownerLabel : pointsLabel;
      const line = `${statusPrefix} ${challenge.name} ${suffix}`;
      this.setTitle(player, `update:lr:challenge:${i}:${line}`);
    }
  }

  updateScores(player: Player): void {
    if (!this.isGameActive()) return;
    const crimson = this.teamManager?.getTeamScore("crimson") ?? 0;
    const azure = this.teamManager?.getTeamScore("azure") ?? 0;
    const scores = `§cCrimson: ${crimson} §9Azure: ${azure}`;
    this.setTitle(player, `update:lr:scores:${scores}`);
    this.debugLogger?.log(`HUD score update for ${player.nameTag}: ${scores}`);
  }

  updateRoundInfo(player: Player): void {
    if (!this.isGameActive()) return;
    const totalRounds = this.configManager?.getConfigValue("totalRounds") ?? 0;
    const currentRound = this.getCurrentRound();
    this.setTitle(player, `update:lr:round:§6Round ${currentRound} of ${totalRounds}`);
    this.debugLogger?.log(`HUD round update for ${player.nameTag}: ${currentRound}/${totalRounds}`);
  }

  setPaused(player: Player, paused: boolean): void {
    if (!this.isGameActive()) return;
    if (paused) {
      this.setTitle(player, "update:lr:timer:§c§lPAUSED");
      this.debugLogger?.log(`HUD paused for ${player.nameTag}`);
      return;
    }
    this.updateTimer(player);
  }

  clearHUD(player: Player): void {
    const prefixes = ["update:lr:round:", "update:lr:timer:", "update:lr:scores:", "update:lr:challenges:header:"];

    prefixes.forEach((prefix) => this.setTitle(player, prefix));
    for (let i = 0; i < 10; i++) {
      this.setTitle(player, `update:lr:challenge:${i}:`);
    }
    this.debugLogger?.log(`HUD cleared for ${player.nameTag}`);
  }

  private setTitle(player: Player, text: string): void {
    try {
      player.onScreenDisplay.setTitle(text);
    } catch (err) {
      this.debugLogger?.warn("Failed to set HUD title", player.nameTag, err);
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
