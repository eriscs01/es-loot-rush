import { Container, ItemStack, world } from "@minecraft/server";
import { ConfigManager } from "./ConfigManager";
import { CHALLENGES } from "../config/challenges";
import { DYNAMIC_KEYS, DYNAMIC_PROPERTY_LIMIT_BYTES } from "../config/constants";
import { ANY_VARIANTS } from "../config/variants";
import { TeamId } from "../types";

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
  completedBy?: TeamId;
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
    const maxSlots = 10;
    const pick = (pool: ChallengeDefinition[], count: number): ChallengeDefinition[] => {
      const shuffled = [...pool];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled.slice(0, Math.max(0, Math.min(count, shuffled.length)));
    };

    const requested: ChallengeDefinition[] = [
      ...pick(
        this.challengePool.filter((c) => c.difficulty === "easy"),
        config.easyChallengeCount
      ),
      ...pick(
        this.challengePool.filter((c) => c.difficulty === "medium"),
        config.mediumChallengeCount
      ),
      ...pick(
        this.challengePool.filter((c) => c.difficulty === "hard"),
        config.hardChallengeCount
      ),
    ];

    const uniqueById = new Map<string, ChallengeDefinition>();
    for (const candidate of requested) {
      if (uniqueById.size >= maxSlots) break;
      if (!uniqueById.has(candidate.id)) {
        uniqueById.set(candidate.id, candidate);
      }
    }

    const selections = Array.from(uniqueById.values());

    this.activeChallenges = selections.map((c) => ({ ...c, state: "available" }));
    this.persistActive();
    this.completedChallenges = [];
    this.persistCompleted();
    return this.getActiveChallenges();
  }

  isChallengeAvailable(challengeId: string): boolean {
    return this.activeChallenges.some((c) => c.id === challengeId && c.state === "available");
  }

  lockChallenge(challengeId: string): void {
    this.activeChallenges = this.activeChallenges.map((c) => (c.id === challengeId ? { ...c, state: "locked" } : c));
    this.persistActive();
  }

  completeChallenge(challengeId: string, team: TeamId): ChallengeRecord | undefined {
    let completed: ChallengeRecord | undefined;

    if (!this.isChallengeAvailable(challengeId)) {
      return undefined;
    }

    // Lock first to prevent concurrent completion attempts on the same challenge
    this.lockChallenge(challengeId);

    this.activeChallenges = this.activeChallenges.map((c) => {
      if (c.id !== challengeId) return c;
      completed = { ...c, state: "completed", completedBy: team };
      return completed;
    });

    if (completed) {
      this.persistActive();
      this.completedChallenges = [...this.completedChallenges, completed];
      this.persistCompleted();
    }

    return completed;
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

  getAvailableChallenges(): ChallengeRecord[] {
    return this.getActiveChallenges().filter((c) => c.state === "available");
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

  private persistCompleted(): void {
    const payload = JSON.stringify(this.completedChallenges);
    if (payload.length <= DYNAMIC_PROPERTY_LIMIT_BYTES) {
      this.worldRef.setDynamicProperty(DYNAMIC_KEYS.completedChallenges, payload);
    }
  }

  validateDeposit(container: Container, challenge: ChallengeDefinition): boolean {
    let total = 0;
    for (let i = 0; i < container.size; i++) {
      const item = container.getItem(i);
      if (!item) continue;
      if (this.matchesRequirement(item, challenge)) {
        total += item.amount;
      }
      if (total >= challenge.count) {
        return true;
      }
    }
    return false;
  }

  private matchesRequirement(item: ItemStack, challenge: ChallengeDefinition): boolean {
    if (challenge.variant === "any") {
      const allowed = ANY_VARIANTS[challenge.item];
      if (allowed) {
        return allowed.includes(item.typeId);
      }
    }
    return item.typeId === challenge.item;
  }
}
