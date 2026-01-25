import { ConfigManager } from "./ConfigManager";

export type ChallengeState = "available" | "completed" | "locked";

export interface ChallengeDefinition {
  id: string;
  name: string;
  item: string;
  count: number;
  points: number;
  difficulty: "easy" | "medium" | "hard";
  variant?: "any";
}

export interface ChallengeRecord extends ChallengeDefinition {
  state: ChallengeState;
}

export class ChallengeManager {
  private challengePool: ChallengeDefinition[] = [];
  private activeChallenges: ChallengeRecord[] = [];
  private completedChallenges: ChallengeRecord[] = [];

  constructor(private readonly configManager: ConfigManager) {}

  setChallengePool(pool: ChallengeDefinition[]): void {
    this.challengePool = [...pool];
  }

  selectChallenges(): ChallengeRecord[] {
    // Selection will be implemented with weighted logic; placeholder returns empty list.
    this.activeChallenges = [];
    return this.activeChallenges;
  }

  isChallengeAvailable(challengeId: string): boolean {
    return this.activeChallenges.some((c) => c.id === challengeId && c.state === "available");
  }

  lockChallenge(challengeId: string): void {
    this.activeChallenges = this.activeChallenges.map((c) => (c.id === challengeId ? { ...c, state: "locked" } : c));
  }

  resetChallenges(): void {
    this.activeChallenges = [];
    this.completedChallenges = [];
  }

  validateChallenge(challenge: ChallengeDefinition, items: unknown): boolean {
    // Validation will be implemented in Task 1.2 and Task 1.4.
    void challenge;
    void items;
    return false;
  }

  getActiveChallenges(): ChallengeRecord[] {
    return [...this.activeChallenges];
  }

  getCompletedChallenges(): ChallengeRecord[] {
    return [...this.completedChallenges];
  }
}
