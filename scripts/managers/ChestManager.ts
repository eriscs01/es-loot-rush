import { BlockPermutation, Dimension, Vector3, world } from "@minecraft/server";
import { ConfigManager } from "./ConfigManager";
import { TeamId } from "../types";
import { DYNAMIC_KEYS, DYNAMIC_PROPERTY_LIMIT_BYTES } from "../config/constants";

export class ChestManager {
  private crimsonChestLocation: Vector3 | undefined;
  private azureChestLocation: Vector3 | undefined;
  private spawnLocation: Vector3 | undefined;

  constructor(
    private readonly worldRef = world,
    private readonly configManager: ConfigManager
  ) {
    this.registerProtection();
    this.loadLocationsFromProperties();
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
  }

  getChestLocation(team: TeamId): Vector3 | undefined {
    return team === "crimson" ? this.crimsonChestLocation : this.azureChestLocation;
  }

  monitorChests(): void {
    // Monitoring loop will be implemented during challenge validation tasks.
  }

  validateChestContents(team: TeamId): boolean {
    // Validation logic deferred to Task 1.4 and Task 1.5.
    return false;
  }

  clearChest(team: TeamId): void {
    void team;
  }

  protectChest(location: Vector3): void {
    void location;
  }

  getSpawnLocation(): Vector3 | undefined {
    return this.spawnLocation;
  }

  private registerProtection(): void {
    this.worldRef.beforeEvents.playerBreakBlock.subscribe((event) => {
      if (this.isProtectedLocation(event.block.location)) {
        event.cancel = true;
        event.player.sendMessage("§cThis chest is protected!");
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
    } catch {
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
    } catch {
      // Ignore placement errors (e.g., invalid location)
    }
  }
}
