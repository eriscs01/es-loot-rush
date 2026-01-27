import { MinecraftItemTypes } from "@minecraft/vanilla-data";

export type TeamId = "crimson" | "azure";

export type ChallengeDifficulty = "easy" | "medium" | "hard";
export type ChallengeState = "available" | "completed" | "locked";
export interface ChallengeDefinition {
  id: string;
  title: string;
  item: MinecraftItemTypes;
  count: number;
  points: number;
  difficulty: "easy" | "medium" | "hard";
  variant?: "any";
}
export type RawChallengeData = Omit<ChallengeDefinition, "difficulty">;
export interface ChallengeRecord extends ChallengeDefinition {
  name: string;
  state: ChallengeState;
  completedBy?: TeamId;
}

export interface GameConfig {
  easyChallengeCount: number;
  mediumChallengeCount: number;
  hardChallengeCount: number;
  totalRounds: number;
  roundDurationTicks: number;
}
