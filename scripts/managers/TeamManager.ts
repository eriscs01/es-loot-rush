import { Player, PlayerLeaveBeforeEvent, PlayerSpawnAfterEvent, system, Vector3, world } from "@minecraft/server";
import { PropertyStore } from "./PropertyStore";
import { TeamId } from "../types";
import { DYNAMIC_KEYS } from "../config/constants";
import { removeColorCode } from "../utils/text";
import { DebugLogger } from "./DebugLogger";

export class TeamManager {
  private playerTeamCache = new Map<string, TeamId>();
  private crimsonPlayers: string[] = [];
  private azurePlayers: string[] = [];
  private allPlayers: Player[] = [];
  private spawnHandler?: (_arg0: PlayerSpawnAfterEvent) => void;
  private leaveHandler?: (_arg0: PlayerLeaveBeforeEvent) => void;
  private readonly debugLogger: DebugLogger;

  constructor(private readonly propertyStore: PropertyStore) {
    this.debugLogger = new DebugLogger(propertyStore);
  }

  registerPlayerHandlers(): void {
    if (!this.spawnHandler) {
      this.spawnHandler = (event) => {
        if (!event.initialSpawn) return;
        const player = event.player;
        this.allPlayers.push(player);
        const playerId = removeColorCode(player.nameTag ?? player.id);
        this.debugLogger?.log(`[spawnHandler] Player spawned: ${playerId}`);
        if (!this.isTeamsFormed()) {
          this.debugLogger?.log("[spawnHandler] Teams not formed, skipping team color and spawn set.");
          return;
        }
        this.applyTeamColor(player);
        this.debugLogger?.log(`[spawnHandler] Applied team color to: ${playerId}`);
        const spawnLoc = this.getStoredSpawn();
        if (spawnLoc) {
          this.setSpawnPointForPlayer(player, spawnLoc);
          this.debugLogger?.log(
            `[spawnHandler] Set spawn point for ${playerId} to (${spawnLoc.x}, ${spawnLoc.y}, ${spawnLoc.z})`
          );
        } else {
          this.debugLogger?.log(`[spawnHandler] No stored spawn location for ${playerId}`);
        }
      };
      const spawnHandler = this.spawnHandler.bind(this);
      system.run(() => world.afterEvents.playerSpawn.subscribe(spawnHandler));
    }
    if (!this.leaveHandler) {
      this.leaveHandler = (event) => {
        const player = event.player;
        const id = removeColorCode(player.nameTag ?? player.id);
        this.allPlayers = this.allPlayers.filter((p) => {
          const playerId = removeColorCode(p.nameTag ?? p.id);
          return playerId !== id;
        });
        this.debugLogger?.log(`[leaveHandler] Player left: ${id}, remaining players: ${this.allPlayers.length}`);
      };
      const leaveHandler = this.leaveHandler.bind(this);
      system.run(() => world.beforeEvents.playerLeave.subscribe(leaveHandler));
    }
  }

  unregisterPlayerHandlers(): void {
    if (this.spawnHandler) {
      const spawnHandler = this.spawnHandler;
      system.run(() => world.afterEvents.playerSpawn.unsubscribe(spawnHandler));
      this.spawnHandler = undefined;
    }
    if (this.leaveHandler) {
      const leaveHandler = this.leaveHandler;
      system.run(() => world.beforeEvents.playerLeave.unsubscribe(leaveHandler));
      this.leaveHandler = undefined;
    }
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
    this.registerPlayerHandlers();
    this.allPlayers = players;
  }

  clearTeams(): void {
    this.playerTeamCache.clear();
    this.crimsonPlayers = [];
    this.azurePlayers = [];
    this.allPlayers = [];
    this.propertyStore.setString(DYNAMIC_KEYS.crimsonPlayers, "[]");
    this.propertyStore.setString(DYNAMIC_KEYS.azurePlayers, "[]");
    this.debugLogger?.log("Cleared teams and rosters");
  }

  assignPlayerToTeam(player: Player, team: TeamId): void {
    const id = removeColorCode(player.nameTag ?? player.id);
    this.playerTeamCache.set(id, team);

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

  setTeamsFormed(flag: boolean): void {
    this.propertyStore.setBoolean(DYNAMIC_KEYS.teamsFormed, flag);
  }

  isTeamsFormed(): boolean {
    return this.propertyStore.getBoolean(DYNAMIC_KEYS.teamsFormed, false);
  }

  private getStoredSpawn(): Vector3 | undefined {
    return this.propertyStore.getJSON<Vector3>(DYNAMIC_KEYS.spawnLocation, undefined as any);
  }

  getTeamScore(team: TeamId): number {
    const key = team === "crimson" ? DYNAMIC_KEYS.crimsonScore : DYNAMIC_KEYS.azureScore;
    return this.propertyStore.getNumber(key, 0);
  }

  setTeamScore(team: TeamId, points: number): void {
    const key = team === "crimson" ? DYNAMIC_KEYS.crimsonScore : DYNAMIC_KEYS.azureScore;
    this.propertyStore.setNumber(key, points);
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

  loadRostersFromProperties(): void {
    this.crimsonPlayers = this.propertyStore.getJSON<string[]>(DYNAMIC_KEYS.crimsonPlayers, []);
    this.azurePlayers = this.propertyStore.getJSON<string[]>(DYNAMIC_KEYS.azurePlayers, []);

    this.playerTeamCache.clear();
    this.crimsonPlayers.forEach((id) => this.playerTeamCache.set(removeColorCode(id), "crimson"));
    this.azurePlayers.forEach((id) => this.playerTeamCache.set(removeColorCode(id), "azure"));
  }

  setSpawnPointForPlayer(player: Player, location: Vector3): void {
    try {
      const dimension = world.getDimension("overworld");
      player.setSpawnPoint({ ...location, dimension });
    } catch (err) {
      this.debugLogger?.warn("Failed to set spawn point", player.nameTag, err);
    }
  }

  setSpawnPointForAll(players: Player[], location: Vector3): void {
    players.forEach((player) => this.setSpawnPointForPlayer(player, location));
  }

  private persistRosters(): void {
    this.propertyStore.setJSON(DYNAMIC_KEYS.crimsonPlayers, this.crimsonPlayers);
    this.propertyStore.setJSON(DYNAMIC_KEYS.azurePlayers, this.azurePlayers);
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

  getAllPlayers(): Player[] {
    return this.allPlayers;
  }

  getTeamPlayers(teamId: TeamId): Player[] {
    return this.allPlayers.filter((player) => {
      const id = removeColorCode(player.nameTag ?? player.id);
      return this.playerTeamCache.get(id) === teamId;
    });
  }
}
