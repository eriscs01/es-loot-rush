export type TeamId = "crimson" | "azure";

export interface GameConfig {
  easyChallengeCount: number;
  mediumChallengeCount: number;
  hardChallengeCount: number;
  totalRounds: number;
  roundDurationTicks: number;
}
