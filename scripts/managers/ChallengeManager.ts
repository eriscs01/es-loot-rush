import { Container, system, Vector3, world } from "@minecraft/server";
import { ConfigManager } from "./ConfigManager";
import { PropertyStore } from "./PropertyStore";
import { CHALLENGES } from "../config/challenges";
import { DYNAMIC_KEYS } from "../config/constants";
import { ChallengeDefinition, ChallengeRecord, TeamId } from "../types";
import { TeamManager } from "./TeamManager";
import { HUDManager } from "./HUDManager";
import { AudioManager } from "./AudioManager";
import { DebugLogger } from "./DebugLogger";
import { ChestManager } from "./ChestManager";
import { buildChallengeName } from "../utils/text";

export class ChallengeManager {
  private challengePool: ChallengeDefinition[] = [];
  private activeChallenges: ChallengeRecord[] = [];
  private completedChallenges: ChallengeRecord[] = [];
  private monitorHandle?: number;
  private readonly debugLogger: DebugLogger;

  constructor(
    private readonly propertyStore: PropertyStore,
    private readonly configManager: ConfigManager,
    private readonly teamManager: TeamManager,
    private readonly hudManager: HUDManager,
    private readonly audioManager: AudioManager,
    private readonly chestManager: ChestManager
  ) {
    void configManager;
    void teamManager;
    void hudManager;
    void audioManager;
    void chestManager;
    this.challengePool = [...CHALLENGES.easy, ...CHALLENGES.medium, ...CHALLENGES.hard];
    this.debugLogger = new DebugLogger(propertyStore);
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

    this.activeChallenges = selections.map((c) => ({ ...c, state: "available", name: buildChallengeName(c) }));
    this.persistActive();
    this.completedChallenges = [];
    this.persistCompleted();
    this.debugLogger?.log(`Selected challenges: ${selections.map((c) => c.id).join(", ")}`);
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

    if (completed) {
      this.debugLogger?.log(`Challenge ${challengeId} completed by ${team}`);
    }

    return completed;
  }

  monitorCompletion(challenges: ChallengeRecord[]): void {
    if (this.monitorHandle !== undefined) return;

    this.monitorHandle = system.runInterval(() => {
      if (!this.propertyStore.getBoolean(DYNAMIC_KEYS.gameActive, false)) return;

      if (!challenges.length) return;

      const teams: TeamId[] = ["crimson", "azure"];

      for (const team of teams) {
        const loc = this.chestManager.getChestLocation(team);
        if (!loc) return;
        const container = this.chestManager.getContainerAt(loc);
        if (!container) return;

        for (const challenge of challenges) {
          if (
            this.isChallengeAvailable(challenge.id) &&
            this.chestManager.validateChestContents(container, challenge)
          ) {
            this.handleChallengeCompletion(team, challenge, container, loc);
            break;
          }
        }
      }
    }, 10);
    this.debugLogger?.log("Started completion monitoring");
  }

  stopMonitoring(): void {
    if (this.monitorHandle === undefined) return;
    system.clearRun(this.monitorHandle);
    this.monitorHandle = undefined;
    this.debugLogger?.log("Stopped chest monitoring");
  }

  handleChallengeCompletion(
    team: TeamId,
    challenge: ChallengeRecord,
    container: Container,
    chestLocation?: Vector3
  ): boolean {
    const completed = this.completeChallenge(challenge.id, team);
    if (!completed) return false;

    this.teamManager.addPoints(team, challenge.points);
    this.debugLogger?.log(`Challenge ${challenge.id} completed by ${team}`);

    const challengeLabel = `${challenge.title} (${challenge.name})`;
    const teamLabel = team === "crimson" ? "§cCrimson Crusaders" : "§bAzure Architects";
    world.sendMessage(`§6[LOOT RUSH] ${teamLabel} §fcompleted "${challengeLabel}" (+${challenge.points} pts)`);

    const players = world.getAllPlayers();
    const winners = players.filter((p) => this.teamManager.getPlayerTeam(p) === team);
    const others = players.filter((p) => {
      const t = this.teamManager.getPlayerTeam(p);
      return t && t !== team;
    });
    this.audioManager?.playChallengeComplete(winners, others);

    if (chestLocation) {
      try {
        const dim = world.getDimension("overworld");
        dim.spawnParticle("minecraft:totem_particle", chestLocation);
      } catch (err) {
        this.debugLogger?.warn("Failed to spawn completion particle", err);
      }
      this.chestManager.removeChallengeItems(container, challenge);
    }

    const newScore = this.teamManager.getTeamScore(team);

    players.forEach((p) => {
      system.runTimeout(() => {
        this.hudManager.updateScore(p, team, newScore);
      }, 10);
    });

    this.debugLogger?.log(`Challenge ${challenge.id} completed by ${team}; required items consumed`);
    return true;
  }

  resetChallenges(): void {
    this.activeChallenges = [];
    this.completedChallenges = [];
    this.propertyStore.setString(DYNAMIC_KEYS.activeChallenges, "[]");
    this.propertyStore.setString(DYNAMIC_KEYS.completedChallenges, "[]");
  }

  getActiveChallenges(): ChallengeRecord[] {
    this.activeChallenges = this.propertyStore.getJSON<ChallengeRecord[]>(DYNAMIC_KEYS.activeChallenges, []);
    return [...this.activeChallenges];
  }

  getCompletedChallenges(): ChallengeRecord[] {
    this.completedChallenges = this.propertyStore.getJSON<ChallengeRecord[]>(DYNAMIC_KEYS.completedChallenges, []);
    return [...this.completedChallenges];
  }

  private persistActive(): void {
    this.propertyStore.setJSON(DYNAMIC_KEYS.activeChallenges, this.activeChallenges);
  }

  private persistCompleted(): void {
    this.propertyStore.setJSON(DYNAMIC_KEYS.completedChallenges, this.completedChallenges);
  }
}
