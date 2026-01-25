import { Player, world } from "@minecraft/server";

export class AudioManager {
  constructor(private readonly worldRef = world) {}

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

  playTimerWarningSounds(players: Player[]): void {
    players.forEach((player) => this.playSound(player, "note.bass"));
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

  private playSound(player: Player, soundId: string): void {
    try {
      player.playSound(soundId);
    } catch {
      // Sound playback is not critical for initial scaffolding.
    }
    void this.worldRef;
  }
}
