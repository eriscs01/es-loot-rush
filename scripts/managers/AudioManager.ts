import { Player, world } from "@minecraft/server";
import { DebugLogger } from "./DebugLogger";

export class AudioManager {
  constructor(
    private readonly worldRef = world,
    private readonly debugLogger?: DebugLogger
  ) {}

  private readonly timerWarningSounds: {
    at60: { soundId: string; pitch?: number };
    at30: { soundId: string; pitch?: number };
    at10: { soundId: string; pitch?: number };
  } = {
    at60: { soundId: "note.bell", pitch: 1.0 },
    at30: { soundId: "note.bell", pitch: 2.0 },
    at10: { soundId: "note.xylobone", pitch: 2.0 },
  };

  playTeamFormationSounds(players: Player[]): void {
    players.forEach((player) => this.playSound(player, "note.pling"));
  }

  playTeamShuffleTick(players: Player[]): void {
    players.forEach((player) => this.playSound(player, "random.click"));
  }

  playTeamReveal(players: Player[]): void {
    players.forEach((player) => this.playSound(player, "ui.toast.challenge_complete"));
  }

  playChallengeComplete(winners: Player[], others: Player[]): void {
    winners.forEach((player) => this.playSound(player, "random.levelup"));
    // Explicitly silent for opposing team
    void others;
  }

  playTimerWarning60(players: Player[]): void {
    const cfg = this.timerWarningSounds.at60;
    players.forEach((player) => this.playSound(player, cfg.soundId, cfg.pitch));
  }

  playTimerWarning30(players: Player[]): void {
    const cfg = this.timerWarningSounds.at30;
    players.forEach((player) => this.playSound(player, cfg.soundId, cfg.pitch));
  }

  playTimerWarning10(players: Player[]): void {
    const cfg = this.timerWarningSounds.at10;
    players.forEach((player) => this.playSound(player, cfg.soundId, cfg.pitch));
  }

  playVictorySounds(players: Player[]): void {
    players.forEach((player) => this.playSound(player, "random.levelup"));
  }

  playStartHorn(players: Player[]): void {
    players.forEach((player) => this.playSound(player, "raid.horn"));
  }

  playAccessDenied(players: Player[]): void {
    players.forEach((player) => this.playSound(player, "note.bass"));
  }

  playInvalidDeposit(players: Player[]): void {
    players.forEach((player) => this.playSound(player, "note.bass"));
  }

  private playSound(player: Player, soundId: string, pitch?: number): void {
    try {
      player.playSound(soundId, typeof pitch === "number" ? { pitch } : undefined);
    } catch (err) {
      this.debugLogger?.warn("Failed to play sound", soundId, player.nameTag, err);
    }
    void this.worldRef;
  }
}
