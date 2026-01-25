import { Player, world } from "@minecraft/server";
import { ConfigManager } from "./ConfigManager";
import { TeamId } from "../types";

export class TeamManager {
  private playerTeamCache = new Map<string, TeamId>();
  private crimsonPlayers: string[] = [];
  private azurePlayers: string[] = [];

  constructor(
    private readonly worldRef = world,
    private readonly configManager: ConfigManager
  ) {}

  formTeams(players: Player[]): void {
    // Placeholder assignment; full logic will follow in team formation task.
    const midpoint = Math.floor(players.length / 2);
    const crimson = players.slice(0, midpoint);
    const azure = players.slice(midpoint);

    crimson.forEach((p) => this.assignPlayerToTeam(p, "crimson"));
    azure.forEach((p) => this.assignPlayerToTeam(p, "azure"));
  }

  clearTeams(): void {
    this.playerTeamCache.clear();
    this.crimsonPlayers = [];
    this.azurePlayers = [];
  }

  assignPlayerToTeam(player: Player, team: TeamId): void {
    const id = player.nameTag ?? player.id;
    this.playerTeamCache.set(id, team);

    if (team === "crimson") {
      this.crimsonPlayers = [...new Set([...this.crimsonPlayers, id])];
    } else {
      this.azurePlayers = [...new Set([...this.azurePlayers, id])];
    }
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
}
