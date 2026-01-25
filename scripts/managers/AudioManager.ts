import { Player, world } from "@minecraft/server";

export class AudioManager {
  constructor(private readonly worldRef = world) {}

  playTeamFormationSounds(players: Player[]): void {
    players.forEach((player) => this.playSound(player, "note.pling"));
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

  private playSound(player: Player, soundId: string): void {
    try {
      player.playSound(soundId);
    } catch {
      // Sound playback is not critical for initial scaffolding.
    }
    void this.worldRef;
  }
}
