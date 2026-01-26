import { Player, system, Vector3, world } from "@minecraft/server";
import { ConfigManager } from "./ConfigManager";
import { DebugLogger } from "./DebugLogger";
import { TeamId } from "../types";
import { DYNAMIC_KEYS, DYNAMIC_PROPERTY_LIMIT_BYTES } from "../config/constants";
import { removeColorCode } from "../utils/text";

export class TeamManager {
  private playerTeamCache = new Map<string, TeamId>();
  private crimsonPlayers: string[] = [];
  private azurePlayers: string[] = [];
  private spawnHandler?: (event: { player: Player }) => void;

  constructor(
    private readonly worldRef = world,
    private readonly configManager: ConfigManager,
    private readonly debugLogger?: DebugLogger
  ) {}

  registerJoinHandlers(): void {
    if (this.spawnHandler) return;

    this.spawnHandler = (event) => {
      const player = event.player;
      if (!this.isTeamsFormed()) return;
      this.applyTeamColor(player);
      const spawnLoc = this.getStoredSpawn();
      if (spawnLoc) {
        this.setSpawnPointForPlayer(player, spawnLoc);
      }
    };

    const spawnHandler = this.spawnHandler;
    system.run(() => {
      this.worldRef.afterEvents.playerSpawn.subscribe(spawnHandler);
    });
  }

  unregisterJoinHandlers(): void {
    if (!this.spawnHandler) return;
    const spawnHandler = this.spawnHandler;
    system.run(() => {
      this.worldRef.afterEvents.playerSpawn.unsubscribe(spawnHandler);
    });
    this.spawnHandler = undefined;
  }

  formTeams(players: Player[]): void {
    const shuffled = [...players];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    const midpoint = Math.floor(shuffled.length / 2);
    const crimson = shuffled.slice(0, midpoint);
    const azure = shuffled.slice(midpoint);

    crimson.forEach((p) => this.assignPlayerToTeam(p, "crimson"));
    azure.forEach((p) => this.assignPlayerToTeam(p, "azure"));
    this.debugLogger?.log(`Formed teams: crimson=${crimson.length}, azure=${azure.length}`);
    this.persistRosters();
  }

  clearTeams(): void {
    this.playerTeamCache.clear();
    this.crimsonPlayers = [];
    this.azurePlayers = [];
    this.worldRef.setDynamicProperty(DYNAMIC_KEYS.crimsonPlayers, "[]");
    this.worldRef.setDynamicProperty(DYNAMIC_KEYS.azurePlayers, "[]");
    this.debugLogger?.log("Cleared teams and rosters");
  }

  assignPlayerToTeam(player: Player, team: TeamId): void {
    const id = player.nameTag ?? player.id;
    this.playerTeamCache.set(removeColorCode(id), team);

    this.debugLogger?.log(`[TeamManager] Assigned player ${id} to team ${team}`);

    if (team === "crimson") {
      this.crimsonPlayers = [...new Set([...this.crimsonPlayers, id])];
    } else {
      this.azurePlayers = [...new Set([...this.azurePlayers, id])];
    }
    this.persistRosters();
  }

  getPlayerTeam(player: Player): TeamId | undefined {
    const id = removeColorCode(player.nameTag ?? player.id);
    const cacheEntries = Array.from(this.playerTeamCache.entries())
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ");
    this.debugLogger?.log(`[TeamManager] playerId ${id}, playerTeamCache contents: { ${cacheEntries} }`);
    return this.playerTeamCache.get(id);
  }

  applyTeamColor(player: Player): void {
    const team = this.getPlayerTeam(player);
    if (!team) return;

    const prefix = team === "crimson" ? "§c" : "§b";
    player.nameTag = `${prefix}${player.nameTag ?? player.id}`;
  }

  private isTeamsFormed(): boolean {
    const formed = this.worldRef.getDynamicProperty(DYNAMIC_KEYS.teamsFormed);
    return formed === true;
  }

  private getStoredSpawn(): Vector3 | undefined {
    const raw = this.worldRef.getDynamicProperty(DYNAMIC_KEYS.spawnLocation);
    if (typeof raw !== "string") return undefined;
    try {
      const parsed = JSON.parse(raw) as Partial<Vector3>;
      if (typeof parsed.x === "number" && typeof parsed.y === "number" && typeof parsed.z === "number") {
        return { x: parsed.x, y: parsed.y, z: parsed.z };
      }
    } catch (err) {
      this.debugLogger?.warn("Failed to parse stored spawn", err);
      return undefined;
    }
    return undefined;
  }

  getTeamScore(team: TeamId): number {
    const key = team === "crimson" ? "lootRush:crimsonScore" : "lootRush:azureScore";
    const value = this.worldRef.getDynamicProperty(key);
    return typeof value === "number" ? value : 0;
  }

  setTeamScore(team: TeamId, points: number): void {
    const key = team === "crimson" ? "lootRush:crimsonScore" : "lootRush:azureScore";
    this.worldRef.setDynamicProperty(key, points);
    this.debugLogger?.log(`Set ${team} score to ${points}`);
  }

  addPoints(team: TeamId, points: number): number {
    const next = this.getTeamScore(team) + points;
    this.setTeamScore(team, next);
    this.debugLogger?.log(`Added ${points} points to ${team}; total ${next}`);
    return next;
  }

  getRoster(team: TeamId): string[] {
    return team === "crimson" ? [...this.crimsonPlayers] : [...this.azurePlayers];
  }

  getRosterCache(): Map<string, TeamId> {
    return new Map(this.playerTeamCache);
  }

  loadRostersFromProperties(): void {
    const crimsonRaw = this.worldRef.getDynamicProperty(DYNAMIC_KEYS.crimsonPlayers);
    const azureRaw = this.worldRef.getDynamicProperty(DYNAMIC_KEYS.azurePlayers);
    try {
      this.crimsonPlayers = typeof crimsonRaw === "string" ? (JSON.parse(crimsonRaw) as string[]) : [];
      this.azurePlayers = typeof azureRaw === "string" ? (JSON.parse(azureRaw) as string[]) : [];
    } catch (err) {
      this.debugLogger?.warn("Failed to parse team rosters", err);
      this.crimsonPlayers = [];
      this.azurePlayers = [];
    }

    this.playerTeamCache.clear();
    this.crimsonPlayers.forEach((id) => this.playerTeamCache.set(removeColorCode(id), "crimson"));
    this.azurePlayers.forEach((id) => this.playerTeamCache.set(removeColorCode(id), "azure"));
  }

  setSpawnPointForPlayer(player: Player, location: Vector3): void {
    try {
      const dimension = this.worldRef.getDimension("overworld");
      player.setSpawnPoint({ ...location, dimension });
    } catch (err) {
      this.debugLogger?.warn("Failed to set spawn point", player.nameTag, err);
    }
  }

  setSpawnPointForAll(players: Player[], location: Vector3): void {
    players.forEach((player) => this.setSpawnPointForPlayer(player, location));
  }

  private persistRosters(): void {
    const crimsonPayload = JSON.stringify(this.crimsonPlayers);
    const azurePayload = JSON.stringify(this.azurePlayers);
    if (crimsonPayload.length <= DYNAMIC_PROPERTY_LIMIT_BYTES) {
      this.worldRef.setDynamicProperty(DYNAMIC_KEYS.crimsonPlayers, crimsonPayload);
    }
    if (azurePayload.length <= DYNAMIC_PROPERTY_LIMIT_BYTES) {
      this.worldRef.setDynamicProperty(DYNAMIC_KEYS.azurePlayers, azurePayload);
    }
  }

  resetPlayerNameTag(player: Player): void {
    try {
      system.run(() => {
        player.nameTag = player.name;
      });
    } catch (err) {
      this.debugLogger?.warn("Failed to reset player name tag", player.nameTag, err);
    }
  }
}
