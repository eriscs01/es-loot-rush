import { world } from "@minecraft/server";
import { ConfigManager } from "./ConfigManager";
import { CHALLENGES } from "../config/challenges";
import { DYNAMIC_KEYS, DYNAMIC_PROPERTY_LIMIT_BYTES } from "../config/constants";

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

  constructor(
    private readonly configManager: ConfigManager,
    private readonly worldRef = world
  ) {
    this.challengePool = [...CHALLENGES.easy, ...CHALLENGES.medium, ...CHALLENGES.hard];
  }

  setChallengePool(pool: ChallengeDefinition[]): void {
    this.challengePool = [...pool];
  }

  selectChallenges(): ChallengeRecord[] {
    const config = this.configManager.getConfig();
    const pick = (pool: ChallengeDefinition[], count: number): ChallengeDefinition[] => {
      const shuffled = [...pool];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled.slice(0, Math.max(0, Math.min(count, shuffled.length)));
    };

    const selections: ChallengeDefinition[] = [
      ...pick(CHALLENGES.easy, config.easyChallengeCount),
      ...pick(CHALLENGES.medium, config.mediumChallengeCount),
      ...pick(CHALLENGES.hard, config.hardChallengeCount),
    ];

    this.activeChallenges = selections.map((c) => ({ ...c, state: "available" }));
    this.persistActive();
    return this.getActiveChallenges();
  }

  isChallengeAvailable(challengeId: string): boolean {
    return this.activeChallenges.some((c) => c.id === challengeId && c.state === "available");
  }

  lockChallenge(challengeId: string): void {
    this.activeChallenges = this.activeChallenges.map((c) => (c.id === challengeId ? { ...c, state: "locked" } : c));
    this.persistActive();
  }

  resetChallenges(): void {
    this.activeChallenges = [];
    this.completedChallenges = [];
    this.worldRef.setDynamicProperty(DYNAMIC_KEYS.activeChallenges, "[]");
    this.worldRef.setDynamicProperty(DYNAMIC_KEYS.completedChallenges, "[]");
  }

  validateChallenge(challenge: ChallengeDefinition, items: unknown): boolean {
    // Validation will be implemented in Task 1.2 and Task 1.4.
    void challenge;
    void items;
    return false;
  }

  getActiveChallenges(): ChallengeRecord[] {
    const raw = this.worldRef.getDynamicProperty(DYNAMIC_KEYS.activeChallenges);
    if (typeof raw === "string") {
      try {
        const parsed = JSON.parse(raw) as ChallengeRecord[];
        this.activeChallenges = parsed;
      } catch {
        this.activeChallenges = [];
      }
    }
    return [...this.activeChallenges];
  }

  getCompletedChallenges(): ChallengeRecord[] {
    const raw = this.worldRef.getDynamicProperty(DYNAMIC_KEYS.completedChallenges);
    if (typeof raw === "string") {
      try {
        const parsed = JSON.parse(raw) as ChallengeRecord[];
        this.completedChallenges = parsed;
      } catch {
        this.completedChallenges = [];
      }
    }
    return [...this.completedChallenges];
  }

  private persistActive(): void {
    const payload = JSON.stringify(this.activeChallenges);
    if (payload.length <= DYNAMIC_PROPERTY_LIMIT_BYTES) {
      this.worldRef.setDynamicProperty(DYNAMIC_KEYS.activeChallenges, payload);
    }
  }
}
