import { BlockPermutation, Container, Dimension, Vector3, system, world } from "@minecraft/server";
import { TeamId } from "../types";
import { DYNAMIC_KEYS, DYNAMIC_PROPERTY_LIMIT_BYTES } from "../config/constants";
import { ChallengeManager, ChallengeRecord } from "./ChallengeManager";
import { TeamManager } from "./TeamManager";
import { AudioManager } from "./AudioManager";
import { HUDManager } from "./HUDManager";
import { DebugLogger } from "./DebugLogger";

export class ChestManager {
  private crimsonChestLocation: Vector3 | undefined;
  private azureChestLocation: Vector3 | undefined;
  private spawnLocation: Vector3 | undefined;
  private monitorHandle?: number;
  private nameRefreshHandle?: number;

  constructor(
    private readonly worldRef = world,
    private readonly challengeManager: ChallengeManager,
    private readonly teamManager: TeamManager,
    private readonly audioManager?: AudioManager,
    private readonly hudManager?: HUDManager,
    private readonly debugLogger?: DebugLogger
  ) {
    this.registerProtection();
    this.loadLocationsFromProperties();
    this.startNameRefresh();
  }

  placeChests(centerLocation: Vector3, dimension?: Dimension): void {
    this.spawnLocation = centerLocation;
    const dim = dimension ?? this.worldRef.getDimension("overworld");
    const crimsonLoc = centerLocation
      ? { x: centerLocation.x - 3, y: centerLocation.y, z: centerLocation.z }
      : undefined;
    const azureLoc = centerLocation ? { x: centerLocation.x + 3, y: centerLocation.y, z: centerLocation.z } : undefined;

    if (crimsonLoc) {
      this.placeChestBlock(dim, crimsonLoc, "§c§lCRIMSON BOUNTY", "west");
    }
    if (azureLoc) {
      this.placeChestBlock(dim, azureLoc, "§9§lAZURE BOUNTY", "east");
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

  validateChestContents(team: TeamId): boolean {
    // Validation logic deferred to Task 1.4 and Task 1.5.
    return false;
  }

  clearChest(team: TeamId): void {
    const loc = this.getChestLocation(team);
    if (!loc) return;
    const dim = this.worldRef.getDimension("overworld");
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
    this.worldRef.setDynamicProperty(DYNAMIC_KEYS.chestCrimsonLocation, "{}");
    this.worldRef.setDynamicProperty(DYNAMIC_KEYS.chestAzureLocation, "{}");
    this.worldRef.setDynamicProperty(DYNAMIC_KEYS.spawnLocation, "{}");
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

  private registerProtection(): void {
    this.worldRef.beforeEvents.playerBreakBlock.subscribe((event) => {
      if (this.isProtectedLocation(event.block.location)) {
        event.cancel = true;
        event.player.sendMessage("§cThis chest is protected!");
      }
    });

    this.worldRef.beforeEvents.playerInteractWithBlock.subscribe((event) => {
      const loc = event.block.location;
      const isCrimson = this.crimsonChestLocation && this.sameLocation(this.crimsonChestLocation, loc);
      const isAzure = this.azureChestLocation && this.sameLocation(this.azureChestLocation, loc);
      if (!isCrimson && !isAzure) return;

      const teamsFormed = this.worldRef.getDynamicProperty(DYNAMIC_KEYS.teamsFormed) === true;
      if (!teamsFormed) return;

      const playerTeam = this.teamManager.getPlayerTeam(event.player);
      const chestTeam: TeamId | undefined = isCrimson ? "crimson" : isAzure ? "azure" : undefined;
      if (!playerTeam || !chestTeam) return;
      if (playerTeam !== chestTeam) {
        event.cancel = true;
        event.player.sendMessage("§cYou cannot access the other team's chest!");
        this.audioManager?.playAccessDenied([event.player]);
      }
    });

    this.worldRef.beforeEvents.explosion.subscribe((event) => {
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
    const crimsonPayload = JSON.stringify(this.crimsonChestLocation ?? {});
    const azurePayload = JSON.stringify(this.azureChestLocation ?? {});
    const spawnPayload = JSON.stringify(this.spawnLocation ?? {});

    if (crimsonPayload.length <= DYNAMIC_PROPERTY_LIMIT_BYTES) {
      this.worldRef.setDynamicProperty(DYNAMIC_KEYS.chestCrimsonLocation, crimsonPayload);
    }
    if (azurePayload.length <= DYNAMIC_PROPERTY_LIMIT_BYTES) {
      this.worldRef.setDynamicProperty(DYNAMIC_KEYS.chestAzureLocation, azurePayload);
    }
    if (spawnPayload.length <= DYNAMIC_PROPERTY_LIMIT_BYTES) {
      this.worldRef.setDynamicProperty(DYNAMIC_KEYS.spawnLocation, spawnPayload);
    }
  }

  private loadLocationsFromProperties(): void {
    this.crimsonChestLocation = this.parseLocation(DYNAMIC_KEYS.chestCrimsonLocation);
    this.azureChestLocation = this.parseLocation(DYNAMIC_KEYS.chestAzureLocation);
    this.spawnLocation = this.parseLocation(DYNAMIC_KEYS.spawnLocation);
  }

  private parseLocation(key: string): Vector3 | undefined {
    const raw = this.worldRef.getDynamicProperty(key);
    if (typeof raw !== "string") return undefined;
    try {
      const parsed = JSON.parse(raw) as Partial<Vector3>;
      if (typeof parsed.x === "number" && typeof parsed.y === "number" && typeof parsed.z === "number") {
        return { x: parsed.x, y: parsed.y, z: parsed.z };
      }
      return undefined;
    } catch (err) {
      this.debugLogger?.warn("Failed to parse location property", key, err);
      return undefined;
    }
  }

  private placeChestBlock(dimension: Dimension, location: Vector3, name: string, facing: "east" | "west"): void {
    try {
      const block = dimension.getBlock(location);
      if (!block) return;
      block.setType("minecraft:chest");
      const permutation = block.permutation.withState("minecraft:cardinal_direction", facing);
      block.setPermutation(permutation as BlockPermutation);
      const container = block.getComponent("inventory") as
        | { container?: { setCustomName: (label: string) => void } }
        | undefined;
      container?.container?.setCustomName?.(name);
    } catch (err) {
      this.debugLogger?.warn("Failed to place chest block", name, err);
    }
  }

  private pollChests(): void {
    const active = this.worldRef.getDynamicProperty(DYNAMIC_KEYS.gameActive);
    if (!active) return;

    const dim = this.worldRef.getDimension("overworld");
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
        const completed = this.challengeManager.handleChallengeCompletion(team, challenge, loc);
        if (completed) {
          for (let i = 0; i < container.size; i++) {
            container.setItem(i, undefined);
          }
          this.debugLogger?.log(`Challenge ${challenge.id} completed by ${team}; chest cleared`);
        }
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
    const dim = this.worldRef.getDimension("overworld");
    const entries: Array<{ loc?: Vector3; label: string }> = [
      { loc: this.crimsonChestLocation, label: "§c§lCRIMSON BOUNTY" },
      { loc: this.azureChestLocation, label: "§9§lAZURE BOUNTY" },
    ];

    entries.forEach(({ loc, label }) => {
      if (!loc) return;
      try {
        const block = dim.getBlock(loc);
        const inventory = block?.getComponent("inventory") as {
          container?: { setCustomName: (label: string) => void };
        };
        inventory?.container?.setCustomName?.(label);
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
