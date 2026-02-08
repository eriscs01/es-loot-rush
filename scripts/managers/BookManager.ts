import { world, Player, ItemStack, system, ItemUseBeforeEvent } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { ChallengeManager } from "./ChallengeManager";
import { PropertyStore } from "./PropertyStore";
import { DYNAMIC_KEYS } from "../config/constants";
import { DebugLogger } from "./DebugLogger";
import { ChallengeRecord } from "../types";
import { MinecraftItemTypes } from "@minecraft/vanilla-data";

export class BookManager {
  private readonly debugLogger: DebugLogger;
  private readonly bookItemId = MinecraftItemTypes.Paper;
  private readonly bookItemTag = "§6Challenge Codex";
  private bookUseHandler?: (_event: ItemUseBeforeEvent) => void;

  constructor(
    private readonly propertyStore: PropertyStore,
    // Used in showChallengesForm() to get active challenges
    // eslint-disable-next-line no-unused-vars
    private readonly challengeManager: ChallengeManager
  ) {
    this.debugLogger = new DebugLogger(propertyStore);
  }

  /**
   * Removes the challenge codex from all players
   */
  removeBooksFromAllPlayers(): void {
    const players = world.getAllPlayers();
    let removedCount = 0;

    players.forEach((player) => {
      try {
        if (this.removeBookFromPlayer(player)) {
          removedCount++;
        }
      } catch (err) {
        this.debugLogger?.warn("Failed to remove book from player", player.nameTag, err);
      }
    });

    this.debugLogger?.log(`Removed challenge codex from ${removedCount}/${players.length} players`);
  }

  /**
   * Removes the challenge codex from a specific player
   * @returns true if codex was found and removed, false otherwise
   */
  removeBookFromPlayer(player: Player): boolean {
    try {
      const inventory = player.getComponent("inventory");
      if (!inventory?.container) {
        return false;
      }

      const container = inventory.container;
      for (let i = 0; i < container.size; i++) {
        const item = container.getItem(i);
        if (item?.typeId === this.bookItemId && item.nameTag === this.bookItemTag) {
          // Remove the book
          system.run(() => container.setItem(i, undefined));
          return true;
        }
      }
      return false;
    } catch (err) {
      this.debugLogger?.warn("Failed to remove book from player", player.nameTag, err);
      return false;
    }
  }

  /**
   * Gives the challenge codex to all players
   */
  giveBookToAllPlayers(): void {
    const players = world.getAllPlayers();
    let successCount = 0;
    let failCount = 0;

    players.forEach((player) => {
      try {
        system.run(() => this.giveBookToPlayer(player));
        successCount++;
      } catch (err) {
        failCount++;
        this.debugLogger?.warn("Failed to give book to player", player.nameTag, err);
      }
    });
    this.unregisterBookHandler();
    this.registerBookHandler();

    this.debugLogger?.log(`Gave challenge codex to ${successCount}/${players.length} players (${failCount} failed)`);
  }

  /**
   * Gives the challenge codex to a specific player
   */
  giveBookToPlayer(player: Player): void {
    try {
      const inventory = player.getComponent("inventory");
      if (!inventory?.container) {
        this.debugLogger?.warn("Failed to get inventory for player", player.nameTag);
        return;
      }

      // Check if player already has the book
      const container = inventory.container;
      for (let i = 0; i < container.size; i++) {
        const item = container.getItem(i);
        if (item?.typeId === this.bookItemId && item.nameTag === this.bookItemTag) {
          // Player already has the book
          return;
        }
      }

      // Create the book item
      const book = new ItemStack(this.bookItemId, 1);
      book.nameTag = this.bookItemTag;
      book.setLore(["§7Right-click to view challenges"]);

      // Give the book to the player
      container.addItem(book);
      player.sendMessage("§6[LOOT RUSH] §fYou received a Challenge Codex! Use it to view challenges.");
    } catch (err) {
      this.debugLogger?.warn("Failed to give book to player", player.nameTag, err);
    }
  }

  /**
   * Registers the event handler for book usage
   */
  registerBookHandler(): void {
    system.run(() => {
      if (this.bookUseHandler) {
        // Already registered
        return;
      }

      this.bookUseHandler = (event: ItemUseBeforeEvent) => {
        system.run(async () => {
          const player = event.source as Player;
          const item = event.itemStack;

          // Check if the item is our challenge codex
          if (item?.typeId === this.bookItemId && item.nameTag === this.bookItemTag) {
            // Show the challenges form
            await this.showChallengesForm(player);
          }
        });
      };

      world.beforeEvents.itemUse.subscribe(this.bookUseHandler);
      this.debugLogger?.log("Registered book interaction handler");
    });
  }

  /**
   * Unregisters the book event handler
   * Note: The Minecraft API doesn't provide a direct way to unsubscribe from events.
   * The handler will remain registered but will be inactive when bookUseHandler is undefined.
   */
  unregisterBookHandler(): void {
    if (this.bookUseHandler) {
      world.beforeEvents.itemUse.unsubscribe(this.bookUseHandler);
    }
    this.bookUseHandler = undefined;
    this.debugLogger?.log("Unregistered book interaction handler");
  }

  /**
   * Shows the challenges form to a player
   */
  private async showChallengesForm(player: Player): Promise<void> {
    try {
      // Check if teams are formed (game setup has started)
      const teamsFormed = this.propertyStore.getBoolean(DYNAMIC_KEYS.teamsFormed, false);

      if (!teamsFormed) {
        player.sendMessage("§6[LOOT RUSH] §cTeams haven't been formed yet. Use the book after teams are formed.");
        return;
      }

      const gameActive = this.propertyStore.getBoolean(DYNAMIC_KEYS.gameActive, false);

      if (!gameActive) {
        player.sendMessage("§6[LOOT RUSH] §cNo active game. Challenges are not available.");
        return;
      }

      const activeChallenges = this.challengeManager.getActiveChallenges();

      if (activeChallenges.length === 0) {
        player.sendMessage("§6[LOOT RUSH] §cNo challenges available.");
        return;
      }

      const form = new ActionFormData();
      form.title("Challenge Codex");
      form.body("Current challenges for this round:");

      // Add buttons for each challenge
      activeChallenges.forEach((challenge) => {
        const buttonText = this.formatChallengeButton(challenge);
        form.button(buttonText, `textures/items/${challenge.items[0].replace("minecraft:", "")}`);
      });

      // Show the form
      const response = await form.show(player);

      // The form is display-only, so we don't need to handle the response
      // Players just view the challenges
      if (response.canceled) {
        this.debugLogger?.log(`Player ${player.nameTag} closed the challenges form`);
      }
    } catch (err) {
      this.debugLogger?.warn("Failed to show challenges form", player.nameTag, err);
      player.sendMessage("§6[LOOT RUSH] §cFailed to display challenges.");
    }
  }

  /**
   * Formats a challenge for display in the form button
   */
  private formatChallengeButton(challenge: ChallengeRecord): string {
    let suffix = "";

    if (challenge.state === "completed" && challenge.completedBy) {
      // Show which team completed it
      const teamName = challenge.completedBy === "crimson" ? "§cCrimson" : "§bAzure";
      suffix = `§r(${teamName}§r)`;
    } else {
      // Available
      suffix = "(Open)";
    }

    const points = `${challenge.points}pts`;
    // ChallengeRecord has both 'name' (formatted item name) and 'title' (challenge category)
    // Use 'name' for display as it's the full formatted item description
    const itemName = challenge.name;

    return `${itemName} - ${points} ${suffix}`;
  }
}
