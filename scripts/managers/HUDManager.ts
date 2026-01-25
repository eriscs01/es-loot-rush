import { Player, world } from "@minecraft/server";

export class HUDManager {
  constructor(private readonly worldRef = world) {}

  updateHUD(player: Player): void {
    this.updateTimer(player);
    this.updateChallenges(player);
    this.updateScores(player);
    this.updateRoundInfo(player);
    void this.worldRef;
  }

  updateTimer(player: Player): void {
    void player;
  }

  updateChallenges(player: Player): void {
    void player;
  }

  updateScores(player: Player): void {
    void player;
  }

  updateRoundInfo(player: Player): void {
    void player;
  }

  clearHUD(player: Player): void {
    void player;
  }
}
