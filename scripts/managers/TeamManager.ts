import { Player, Vector3, world } from "@minecraft/server";
import { ConfigManager } from "./ConfigManager";
import { TeamId } from "../types";
import { DYNAMIC_KEYS, DYNAMIC_PROPERTY_LIMIT_BYTES } from "../config/constants";

export class TeamManager {
  private playerTeamCache = new Map<string, TeamId>();
  private crimsonPlayers: string[] = [];
  private azurePlayers: string[] = [];

  constructor(
    private readonly worldRef = world,
    private readonly configManager: ConfigManager
  ) {}

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
    this.persistRosters();
  }

  clearTeams(): void {
    this.playerTeamCache.clear();
    this.crimsonPlayers = [];
    this.azurePlayers = [];
    this.worldRef.setDynamicProperty(DYNAMIC_KEYS.crimsonPlayers, "[]");
    this.worldRef.setDynamicProperty(DYNAMIC_KEYS.azurePlayers, "[]");
  }

  assignPlayerToTeam(player: Player, team: TeamId): void {
    const id = player.nameTag ?? player.id;
    this.playerTeamCache.set(id, team);

    if (team === "crimson") {
      this.crimsonPlayers = [...new Set([...this.crimsonPlayers, id])];
    } else {
      this.azurePlayers = [...new Set([...this.azurePlayers, id])];
    }
    this.persistRosters();
  }

  getPlayerTeam(player: Player): TeamId | undefined {
    const id = player.nameTag ?? player.id;
    return this.playerTeamCache.get(id);
  }

  applyTeamColor(player: Player): void {
    const team = this.getPlayerTeam(player);
    if (!team) return;

    const prefix = team === "crimson" ? "§c" : "§9";
    player.nameTag = `${prefix}${player.nameTag ?? player.id}`;
  }

  getTeamScore(team: TeamId): number {
    const key = team === "crimson" ? "lootRush:crimsonScore" : "lootRush:azureScore";
    const value = this.worldRef.getDynamicProperty(key);
    return typeof value === "number" ? value : 0;
  }

  setTeamScore(team: TeamId, points: number): void {
    const key = team === "crimson" ? "lootRush:crimsonScore" : "lootRush:azureScore";
    this.worldRef.setDynamicProperty(key, points);
  }

  addPoints(team: TeamId, points: number): number {
    const next = this.getTeamScore(team) + points;
    this.setTeamScore(team, next);
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
    } catch {
      this.crimsonPlayers = [];
      this.azurePlayers = [];
    }

    this.playerTeamCache.clear();
    this.crimsonPlayers.forEach((id) => this.playerTeamCache.set(id, "crimson"));
    this.azurePlayers.forEach((id) => this.playerTeamCache.set(id, "azure"));
  }

  setSpawnPointForPlayer(player: Player, location: Vector3): void {
    try {
      const dimension = this.worldRef.getDimension("overworld");
      player.setSpawnPoint({ ...location, dimension });
    } catch {
      // Spawn point setting can fail if player not in overworld; ignore for now.
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
}
