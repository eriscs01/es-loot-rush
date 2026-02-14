import { Player, system } from "@minecraft/server";
import { DebugLogger } from "./DebugLogger";
import { PropertyStore } from "./PropertyStore";

export class AudioManager {
  private readonly debugLogger: DebugLogger;

  constructor(propertyStore: PropertyStore) {
    this.debugLogger = new DebugLogger(propertyStore);
  }

  private readonly timerWarningSounds: {
    at60: { soundId: string; pitch?: number };
    at30: { soundId: string; pitch?: number };
    at10: { soundId: string; pitch?: number };
  } = {
    at60: { soundId: "note.bell", pitch: 1.0 },
    at30: { soundId: "note.bell", pitch: 2.0 },
    at10: { soundId: "note.bell", pitch: 2.0 },
  };

  playTeamFormationSounds(players: Player[]): void {
    players.forEach((player) => this.playSound(player, "mob.wither.spawn"));
  }

  playTeamShuffleTick(players: Player[]): void {
    players.forEach((player) => this.playSound(player, "random.click"));
  }

  playChallengeComplete(winners: Player[]): void {
    winners.forEach((player) => this.playSound(player, "random.levelup"));
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
    players.forEach((player) => this.playSound(player, "challenge.complete"));
  }

  playStartHorn(players: Player[]): void {
    players.forEach((player) => this.playSound(player, "horn.call.1"));
  }

  playAccessDenied(players: Player[]): void {
    players.forEach((player) => this.playSound(player, "note.bass"));
  }

  playBookOpen(player: Player): void {
    this.playSound(player, "item.book.open_flip2");
  }

  playBookClose(player: Player): void {
    this.playSound(player, "item.book.close_put1");
  }

  private playSound(player: Player, soundId: string, pitch?: number): void {
    try {
      system.run(() => {
        player.playSound(soundId, typeof pitch === "number" ? { pitch } : undefined);
      });
    } catch (err) {
      this.debugLogger?.warn("Failed to play sound", soundId, player.nameTag, err);
    }
  }
}
