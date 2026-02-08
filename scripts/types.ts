import { MinecraftItemTypes } from "@minecraft/vanilla-data";

export type TeamId = "crimson" | "azure";

export type ChallengeDifficulty = "easy" | "medium" | "hard";
export type ChallengeState = "available" | "completed" | "locked";
export interface ChallengeDefinition {
  id: string;
  title: string;
  name: string;
  items: MinecraftItemTypes[];
  count: number;
  points: number;
  difficulty: "easy" | "medium" | "hard";
  variant?: "any";
  icon: string;
}
export interface ChallengeRecord extends ChallengeDefinition {
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
