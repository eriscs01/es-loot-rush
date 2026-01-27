import { BlockPermutation, Container, ItemStack, Vector3, world } from "@minecraft/server";
import { TeamId } from "../types";
import { DYNAMIC_KEYS } from "../config/constants";
import { PropertyStore } from "./PropertyStore";
import { ChallengeDefinition } from "../types";
import { TeamManager } from "./TeamManager";
import { AudioManager } from "./AudioManager";
import { DebugLogger } from "./DebugLogger";
import { removeColorCode } from "../utils/text";
import { ANY_VARIANTS } from "../config/variants";

export class ChestManager {
  private crimsonChestLocation: Vector3 | undefined;
  private azureChestLocation: Vector3 | undefined;
  private spawnLocation: Vector3 | undefined;
  private didInit = false;
  private readonly debugLogger: DebugLogger;

  constructor(
    private readonly propertyStore: PropertyStore,
    private readonly teamManager: TeamManager,
    private readonly audioManager?: AudioManager
  ) {
    void teamManager;
    void audioManager;
    this.debugLogger = new DebugLogger(propertyStore);
  }

  initialize(): void {
    world.afterEvents.worldLoad.subscribe(() => {
      this.registerProtection();
      this.initializeLocations();
    });
  }

  placeChests(centerLocation: Vector3): void {
    this.spawnLocation = centerLocation;
    const crimsonLoc = centerLocation
      ? { x: centerLocation.x - 3, y: centerLocation.y, z: centerLocation.z }
      : undefined;
    const azureLoc = centerLocation ? { x: centerLocation.x + 3, y: centerLocation.y, z: centerLocation.z } : undefined;

    if (crimsonLoc) {
      this.placeChestBlock(crimsonLoc, "west");
    }
    if (azureLoc) {
      this.placeChestBlock(azureLoc, "east");
    }

    this.crimsonChestLocation = crimsonLoc;
    this.azureChestLocation = azureLoc;
    this.persistLocations();
    this.debugLogger?.log(`Placed chests at crimson=${JSON.stringify(crimsonLoc)} azure=${JSON.stringify(azureLoc)}`);
  }

  getChestLocation(team: TeamId): Vector3 | undefined {
    return team === "crimson" ? this.crimsonChestLocation : this.azureChestLocation;
  }

  validateChestContents(container: Container, challenge: ChallengeDefinition): boolean {
    const filledSlots = container.size - container.emptySlotsCount;
    if (filledSlots === 0) {
      this.debugLogger?.debug(`Validation failed for challenge ${challenge.id}; container empty`);
      return false;
    }

    let total = 0;
    let inspectedFilled = 0;
    const startSlot = container.firstItem() ?? 0;

    for (let i = startSlot; i < container.size && inspectedFilled < filledSlots; i++) {
      const slot = container.getSlot(i);
      if (!slot.hasItem()) continue;
      inspectedFilled++;

      if (this.matchesRequirement(slot.typeId, challenge)) {
        total += slot.amount;
      }

      if (total >= challenge.count) {
        this.debugLogger.log(`Validation passed for challenge ${challenge.id}; total=${total}`);
        return true;
      }
    }
    this.debugLogger.debug(`Validation failed for challenge ${challenge.id}; total=${total}`);
    return false;
  }

  private matchesRequirement(item: ItemStack | string, challenge: ChallengeDefinition): boolean {
    const typeId = typeof item === "string" ? item : item.typeId;

    if (challenge.variant === "any") {
      const allowed = ANY_VARIANTS[challenge.item];
      if (allowed) {
        return allowed.includes(typeId);
      }
    }
    return typeId === challenge.item;
  }

  removeChallengeItems(container: Container, challenge: ChallengeDefinition): void {
    let remaining = challenge.count;
    if (container.emptySlotsCount === container.size) return;

    const targetTypes = challenge.variant === "any" ? (ANY_VARIANTS[challenge.item] ?? []) : [challenge.item];

    while (remaining > 0) {
      let foundIndex: number | undefined;

      for (const typeId of targetTypes) {
        const probe = new ItemStack(typeId, 1);
        const idx = container.find(probe);
        if (idx !== undefined && (foundIndex === undefined || idx < foundIndex)) {
          foundIndex = idx;
        }
      }

      if (foundIndex === undefined) break;

      const slot = container.getSlot(foundIndex);
      if (!slot.hasItem()) {
        slot.setItem(undefined);
        continue;
      }

      const take = Math.min(slot.amount, remaining);
      remaining -= take;

      const newAmount = slot.amount - take;
      if (newAmount > 0) {
        slot.amount = newAmount;
      } else {
        slot.setItem(undefined);
      }
    }

    if (remaining > 0) {
      this.debugLogger?.warn(`Failed to consume full requirement for ${challenge.id}; remaining=${remaining}`);
    } else {
      this.debugLogger?.log(`Consumed items for challenge ${challenge.id}`);
    }
  }

  clearChestReferences(): void {
    this.crimsonChestLocation = undefined;
    this.azureChestLocation = undefined;
    this.spawnLocation = undefined;
    this.propertyStore.setString(DYNAMIC_KEYS.chestCrimsonLocation, "{}");
    this.propertyStore.setString(DYNAMIC_KEYS.chestAzureLocation, "{}");
    this.propertyStore.setString(DYNAMIC_KEYS.spawnLocation, "{}");
    this.debugLogger?.log("Cleared stored chest and spawn locations");
  }

  getSpawnLocation(): Vector3 | undefined {
    return this.spawnLocation;
  }

  private initializeLocations(): void {
    if (this.didInit) return;
    this.didInit = true;
    this.crimsonChestLocation = this.propertyStore.getJSON<Vector3>(
      DYNAMIC_KEYS.chestCrimsonLocation,
      undefined as any
    );
    this.azureChestLocation = this.propertyStore.getJSON<Vector3>(DYNAMIC_KEYS.chestAzureLocation, undefined as any);
    this.spawnLocation = this.propertyStore.getJSON<Vector3>(DYNAMIC_KEYS.spawnLocation, undefined as any);
    this.debugLogger?.log("ChestManager locations loaded after world initialize");
  }

  private registerProtection(): void {
    world.beforeEvents.playerBreakBlock.subscribe((event) => {
      if (this.isProtectedLocation(event.block.location).isProtected) {
        event.cancel = true;
        event.player.sendMessage("§cThis chest is protected!");
      }
    });

    world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
      const loc = event.block.location;
      const { isProtected, teamId: chestTeam } = this.isProtectedLocation(loc);
      if (!isProtected) return;
      this.debugLogger?.log(`[ChestManager] Player attempted to interact with chest at ${JSON.stringify(loc)}`);

      const teamsFormed = this.propertyStore.getBoolean(DYNAMIC_KEYS.teamsFormed, false);
      if (!teamsFormed) return;

      const playerTeam = this.teamManager.getPlayerTeam(event.player);
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

  private isProtectedLocation(location: Vector3): { isProtected: boolean; teamId?: TeamId } {
    const isCrimson = this.crimsonChestLocation && this.sameLocation(this.crimsonChestLocation, location);
    const isAzure = this.azureChestLocation && this.sameLocation(this.azureChestLocation, location);
    const isProtected = Boolean(isCrimson || isAzure);
    const teamId: TeamId | undefined = isAzure ? "azure" : isCrimson ? "crimson" : undefined;
    return { isProtected, teamId };
  }

  private sameLocation(a: Vector3, b: Vector3): boolean {
    return a.x === b.x && a.y === b.y && a.z === b.z;
  }

  private persistLocations(): void {
    this.propertyStore.setJSON(DYNAMIC_KEYS.chestCrimsonLocation, this.crimsonChestLocation ?? {});
    this.propertyStore.setJSON(DYNAMIC_KEYS.chestAzureLocation, this.azureChestLocation ?? {});
    this.propertyStore.setJSON(DYNAMIC_KEYS.spawnLocation, this.spawnLocation ?? {});
  }

  private placeChestBlock(location: Vector3, facing: "east" | "west"): void {
    try {
      const block = world.getDimension("overworld").getBlock(location);
      if (!block) return;
      block.setType("minecraft:chest");
      const permutation = block.permutation.withState("minecraft:cardinal_direction", facing);
      block.setPermutation(permutation as BlockPermutation);
    } catch (err) {
      this.debugLogger?.warn("Failed to place chest block", err);
    }
  }

  getContainerAt(location: Vector3): Container | undefined {
    try {
      const block = world.getDimension("overworld").getBlock(location);
      const inventory = block?.getComponent("inventory") as { container?: Container } | undefined;
      return inventory?.container;
    } catch (err) {
      this.debugLogger?.warn("Failed to read chest container", location, err);
      return undefined;
    }
  }
}
