import { world, Player, ItemStack, system } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { ChallengeManager } from "./ChallengeManager";
import { PropertyStore } from "./PropertyStore";
import { DYNAMIC_KEYS } from "../config/constants";
import { DebugLogger } from "./DebugLogger";
import { ChallengeRecord } from "../types";

export class BookManager {
  private readonly debugLogger: DebugLogger;
  private readonly bookItemId = "minecraft:writable_book";
  private bookUseHandler?: (_arg: any) => void;

  constructor(
    private readonly propertyStore: PropertyStore,
    // eslint-disable-next-line no-unused-vars
    private readonly challengeManager: ChallengeManager
  ) {
    this.debugLogger = new DebugLogger(propertyStore);
  }

  /**
   * Gives the challenges book to all players
   */
  giveBookToAllPlayers(): void {
    const players = world.getAllPlayers();
    players.forEach((player) => this.giveBookToPlayer(player));
    this.debugLogger?.log("Gave challenges book to all players");
  }

  /**
   * Gives the challenges book to a specific player
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
        if (item?.typeId === this.bookItemId && item.nameTag === "§6Challenges Book") {
          // Player already has the book
          return;
        }
      }

      // Create the book item
      const book = new ItemStack(this.bookItemId, 1);
      book.nameTag = "§6Challenges Book";
      book.setLore(["§7Right-click to view challenges"]);

      // Give the book to the player
      container.addItem(book);
      player.sendMessage("§6[LOOT RUSH] §fYou received a Challenges Book! Use it to view challenges.");
    } catch (err) {
      this.debugLogger?.warn("Failed to give book to player", player.nameTag, err);
    }
  }

  /**
   * Registers the event handler for book usage
   */
  registerBookHandler(): void {
    if (this.bookUseHandler) {
      // Already registered
      return;
    }

    this.bookUseHandler = (event: any) => {
      const player = event.source as Player;
      const item = event.itemStack;

      // Check if the item is our challenges book
      if (item?.typeId === this.bookItemId && item.nameTag === "§6Challenges Book") {
        // Cancel the default book opening behavior
        event.cancel = true;

        // Show the challenges form
        system.run(() => {
          this.showChallengesForm(player);
        });
      }
    };

    world.beforeEvents.itemUse.subscribe(this.bookUseHandler);
    this.debugLogger?.log("Registered book interaction handler");
  }

  /**
   * Unregisters the book event handler
   */
  unregisterBookHandler(): void {
    // Note: Minecraft API doesn't provide a direct way to unsubscribe from events
    // We'll rely on the conditional check in the handler
    this.bookUseHandler = undefined;
    this.debugLogger?.log("Unregistered book interaction handler");
  }

  /**
   * Shows the challenges form to a player
   */
  private async showChallengesForm(player: Player): Promise<void> {
    try {
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
      form.title("§6Loot Rush Challenges");
      form.body("§7Current challenges for this round:\n");

      // Add buttons for each challenge
      activeChallenges.forEach((challenge) => {
        const buttonText = this.formatChallengeButton(challenge);
        form.button(buttonText);
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
    let prefix: string;
    let suffix = "";

    if (challenge.state === "completed" && challenge.completedBy) {
      // Show which team completed it
      const teamName = challenge.completedBy === "crimson" ? "§cCrimson" : "§bAzure";
      prefix = "§a✓";
      suffix = ` §8(Claimed by ${teamName}§8)`;
    } else if (challenge.state === "locked") {
      // Locked state
      prefix = "§e⏳";
      suffix = " §8(In Progress)";
    } else {
      // Available
      prefix = "§f○";
      suffix = " §8(Open)";
    }

    const points = `§e${challenge.points}pts`;
    const itemName = challenge.name || challenge.title;
    const count = challenge.count > 1 ? `${challenge.count}x ` : "";

    return `${prefix} ${count}${itemName} §7- ${points}${suffix}`;
  }
}
