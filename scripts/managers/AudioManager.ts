import { Player, world } from "@minecraft/server";

export class AudioManager {
  constructor(private readonly worldRef = world) {}

  private readonly timerWarningSounds: {
    at60: { soundId: string; pitch?: number };
    at30: { soundId: string; pitch?: number };
    at10: { soundId: string; pitch?: number };
  } = {
    at60: { soundId: "note.pling" },
    at30: { soundId: "note.harp", pitch: 1.4 },
    at10: { soundId: "note.bass" },
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

  playChallengeSounds(players: Player[]): void {
    players.forEach((player) => this.playSound(player, "ui.toast.challenge_complete"));
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

  private playSound(player: Player, soundId: string, pitch?: number): void {
    try {
      player.playSound(soundId, typeof pitch === "number" ? { pitch } : undefined);
    } catch {
      // Sound playback is not critical for initial scaffolding.
    }
    void this.worldRef;
  }
}
