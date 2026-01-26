import { BlockPermutation, Container, Dimension, Vector3, system, world } from "@minecraft/server";
import { TeamId } from "../types";
import { DYNAMIC_KEYS } from "../config/constants";
import { PropertyStore } from "./PropertyStore";
import { ChallengeManager, ChallengeRecord } from "./ChallengeManager";
import { TeamManager } from "./TeamManager";
import { AudioManager } from "./AudioManager";
import { DebugLogger } from "./DebugLogger";
import { removeColorCode } from "../utils/text";

export class ChestManager {
  private crimsonChestLocation: Vector3 | undefined;
  private azureChestLocation: Vector3 | undefined;
  private spawnLocation: Vector3 | undefined;
  private monitorHandle?: number;
  private nameRefreshHandle?: number;
  private didInit = false;
  private readonly debugLogger: DebugLogger;

  constructor(
    private readonly propertyStore: PropertyStore,
    private readonly challengeManager: ChallengeManager,
    private readonly teamManager: TeamManager,
    private readonly audioManager?: AudioManager
  ) {
    void challengeManager;
    void teamManager;
    void audioManager;
    this.debugLogger = new DebugLogger(propertyStore);
    this.registerProtection();
    this.deferLoadLocations();
  }

  placeChests(centerLocation: Vector3, dimension?: Dimension): void {
    this.spawnLocation = centerLocation;
    const dim = dimension ?? world.getDimension("overworld");
    const crimsonLoc = centerLocation
      ? { x: centerLocation.x - 3, y: centerLocation.y, z: centerLocation.z }
      : undefined;
    const azureLoc = centerLocation ? { x: centerLocation.x + 3, y: centerLocation.y, z: centerLocation.z } : undefined;

    if (crimsonLoc) {
      this.placeChestBlock(dim, crimsonLoc, "§c§lCRIMSON BOUNTY", "west");
    }
    if (azureLoc) {
      this.placeChestBlock(dim, azureLoc, "§b§lAZURE BOUNTY", "east");
    }

    this.crimsonChestLocation = crimsonLoc;
    this.azureChestLocation = azureLoc;
    this.persistLocations();
    this.startNameRefresh();
    this.debugLogger?.log(`Placed chests at crimson=${JSON.stringify(crimsonLoc)} azure=${JSON.stringify(azureLoc)}`);
  }

  getChestLocation(team: TeamId): Vector3 | undefined {
    return team === "crimson" ? this.crimsonChestLocation : this.azureChestLocation;
  }

  monitorChests(): void {
    if (this.monitorHandle !== undefined) return;
    this.monitorHandle = system.runInterval(() => this.pollChests(), 10);
    this.debugLogger?.log("Started chest monitoring");
  }

  stopMonitoring(): void {
    if (this.monitorHandle === undefined) return;
    if (typeof system.clearRun === "function") {
      system.clearRun(this.monitorHandle);
    }
    this.monitorHandle = undefined;
    this.debugLogger?.log("Stopped chest monitoring");
  }

  validateChestContents(_team: TeamId): boolean {
    // Validation logic deferred to Task 1.4 and Task 1.5.
    return false;
  }

  clearChest(team: TeamId): void {
    const loc = this.getChestLocation(team);
    if (!loc) return;
    const dim = world.getDimension("overworld");
    const container = this.getContainerAt(dim, loc);
    if (!container) return;
    for (let i = 0; i < container.size; i++) {
      container.setItem(i, undefined);
    }
    this.debugLogger?.log(`Cleared chest for team ${team}`);
  }

  clearChestReferences(): void {
    this.crimsonChestLocation = undefined;
    this.azureChestLocation = undefined;
    this.spawnLocation = undefined;
    this.propertyStore.setString(DYNAMIC_KEYS.chestCrimsonLocation, "{}");
    this.propertyStore.setString(DYNAMIC_KEYS.chestAzureLocation, "{}");
    this.propertyStore.setString(DYNAMIC_KEYS.spawnLocation, "{}");
    this.stopNameRefresh();
    this.debugLogger?.log("Cleared stored chest and spawn locations");
  }

  protectChest(location: Vector3): void {
    void location;
  }

  getSpawnLocation(): Vector3 | undefined {
    return this.spawnLocation;
  }

  reloadFromProperties(): void {
    this.loadLocationsFromProperties();
    this.startNameRefresh();
  }

  private deferLoadLocations(): void {
    const anyWorld = world as unknown as {
      afterEvents?: { worldInitialize?: { subscribe: (_cb: (_ev: any) => void) => void } };
      beforeEvents?: { worldInitialize?: { subscribe: (_cb: (_ev: any) => void) => void } };
    };

    const subscriber =
      anyWorld.afterEvents?.worldInitialize?.subscribe ?? anyWorld.beforeEvents?.worldInitialize?.subscribe;

    if (subscriber) {
      subscriber(() => this.initializeLocations());
    } else {
      // Fallback if worldInitialize is unavailable
      system.runTimeout(() => this.initializeLocations(), 0);
    }
  }

  private initializeLocations(): void {
    if (this.didInit) return;
    this.didInit = true;
    this.loadLocationsFromProperties();
    this.startNameRefresh();
    this.debugLogger?.log("ChestManager locations loaded after world initialize");
  }

  private registerProtection(): void {
    world.beforeEvents.playerBreakBlock.subscribe((event) => {
      if (this.isProtectedLocation(event.block.location)) {
        event.cancel = true;
        event.player.sendMessage("§cThis chest is protected!");
      }
    });

    world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
      const loc = event.block.location;
      const isCrimson = this.crimsonChestLocation && this.sameLocation(this.crimsonChestLocation, loc);
      const isAzure = this.azureChestLocation && this.sameLocation(this.azureChestLocation, loc);
      if (!isCrimson && !isAzure) return;
      this.debugLogger?.log(`[ChestManager] Player attempted to interact with chest at ${JSON.stringify(loc)}`);

      const teamsFormed = this.propertyStore.getBoolean(DYNAMIC_KEYS.teamsFormed, false);
      if (!teamsFormed) return;

      const playerTeam = this.teamManager.getPlayerTeam(event.player);
      const chestTeam: TeamId | undefined = isCrimson ? "crimson" : isAzure ? "azure" : undefined;
      this.debugLogger?.log(
        `[ChestManager] Player: ${removeColorCode(event.player.nameTag ?? event.player.id)}, Player team: ${playerTeam}, Chest team: ${chestTeam}`
      );
      if (!playerTeam || !chestTeam) return;
      if (playerTeam !== chestTeam) {
        event.cancel = true;
        event.player.sendMessage("§cYou cannot access the other team's chest!");
        this.audioManager?.playAccessDenied([event.player]);
        this.debugLogger?.log(
          `[ChestManager] Access denied: player team ${playerTeam} tried to access ${chestTeam} chest at ${JSON.stringify(loc)}`
        );
      }
    });

    world.beforeEvents.explosion.subscribe((event) => {
      const protectedLocs = [this.crimsonChestLocation, this.azureChestLocation].filter(Boolean) as Vector3[];
      const remaining = event
        .getImpactedBlocks()
        .filter((block) => !protectedLocs.some((loc) => this.sameLocation(loc, block.location)));
      event.setImpactedBlocks(remaining);
    });
  }

  private isProtectedLocation(location: Vector3): boolean {
    return !!(
      (this.crimsonChestLocation && this.sameLocation(this.crimsonChestLocation, location)) ||
      (this.azureChestLocation && this.sameLocation(this.azureChestLocation, location))
    );
  }

  private sameLocation(a: Vector3, b: Vector3): boolean {
    return a.x === b.x && a.y === b.y && a.z === b.z;
  }

  private persistLocations(): void {
    this.propertyStore.setJSON(DYNAMIC_KEYS.chestCrimsonLocation, this.crimsonChestLocation ?? {});
    this.propertyStore.setJSON(DYNAMIC_KEYS.chestAzureLocation, this.azureChestLocation ?? {});
    this.propertyStore.setJSON(DYNAMIC_KEYS.spawnLocation, this.spawnLocation ?? {});
  }

  private loadLocationsFromProperties(): void {
    this.crimsonChestLocation = this.propertyStore.getJSON<Vector3>(
      DYNAMIC_KEYS.chestCrimsonLocation,
      undefined as any
    );
    this.azureChestLocation = this.propertyStore.getJSON<Vector3>(DYNAMIC_KEYS.chestAzureLocation, undefined as any);
    this.spawnLocation = this.propertyStore.getJSON<Vector3>(DYNAMIC_KEYS.spawnLocation, undefined as any);
  }

  private parseLocation(key: string): Vector3 | undefined {
    return this.propertyStore.getJSON<Vector3>(key, undefined as any);
  }

  private placeChestBlock(dimension: Dimension, location: Vector3, _label: string, facing: "east" | "west"): void {
    try {
      const block = dimension.getBlock(location);
      if (!block) return;
      block.setType("minecraft:chest");
      const permutation = block.permutation.withState("minecraft:cardinal_direction", facing);
      block.setPermutation(permutation as BlockPermutation);
      const container = block.getComponent("inventory") as
        | { container?: { setCustomName: (_label: string) => void } }
        | undefined;
      container?.container?.setCustomName?.(_label);
    } catch (err) {
      this.debugLogger?.warn("Failed to place chest block", _label, err);
    }
  }

  private pollChests(): void {
    if (!this.propertyStore.getBoolean(DYNAMIC_KEYS.gameActive, false)) return;

    const dim = world.getDimension("overworld");
    const challenges = this.challengeManager.getAvailableChallenges();
    if (!challenges.length) return;

    this.checkChestForTeam(dim, "crimson", challenges);
    this.checkChestForTeam(dim, "azure", challenges);
  }

  private checkChestForTeam(dimension: Dimension, team: TeamId, challenges: ChallengeRecord[]): void {
    const loc = this.getChestLocation(team);
    if (!loc) return;
    const container = this.getContainerAt(dimension, loc);
    if (!container) return;

    for (const challenge of challenges) {
      if (this.challengeManager.validateDeposit(container, challenge)) {
        this.challengeManager.handleChallengeCompletion(team, challenge, container, loc);
        break;
      }
    }
  }

  private startNameRefresh(): void {
    if (this.nameRefreshHandle !== undefined || typeof system.runInterval !== "function") return;
    this.nameRefreshHandle = system.runInterval(() => this.refreshChestNames(), 600);
  }

  private stopNameRefresh(): void {
    if (this.nameRefreshHandle === undefined || typeof system.clearRun !== "function") return;
    system.clearRun(this.nameRefreshHandle);
    this.nameRefreshHandle = undefined;
  }

  private refreshChestNames(): void {
    const dim = world.getDimension("overworld");
    const entries: Array<{ loc?: Vector3; label: string }> = [
      { loc: this.crimsonChestLocation, label: "§c§lCRIMSON BOUNTY" },
      { loc: this.azureChestLocation, label: "§b§lAZURE BOUNTY" },
    ];

    entries.forEach(({ loc, label: _label }) => {
      if (!loc) return;
      try {
        const block = dim.getBlock(loc);
        const inventory = block?.getComponent("inventory") as {
          container?: { setCustomName: (_label: string) => void };
        };
        inventory?.container?.setCustomName?.(_label);
      } catch (err) {
        this.debugLogger?.warn("Failed to refresh chest name", loc, err);
      }
    });
  }

  private getContainerAt(dimension: Dimension, location: Vector3): Container | undefined {
    try {
      const block = dimension.getBlock(location);
      const inventory = block?.getComponent("inventory") as { container?: Container } | undefined;
      return inventory?.container;
    } catch (err) {
      this.debugLogger?.warn("Failed to read chest container", location, err);
      return undefined;
    }
  }
}
