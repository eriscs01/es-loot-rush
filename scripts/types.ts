export type TeamId = "crimson" | "azure";

export type ChallengeDifficulty = "easy" | "medium" | "hard";

export interface GameConfig {
  easyChallengeCount: number;
  mediumChallengeCount: number;
  hardChallengeCount: number;
  totalRounds: number;
  roundDurationTicks: number;
}
