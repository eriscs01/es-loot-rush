import { world, Vector3, Entity, DisplaySlotId } from "@minecraft/server";
import { PropertyStore } from "./PropertyStore";
import { TeamId } from "../types";
import { DebugLogger } from "./DebugLogger";
import { DYNAMIC_KEYS } from "../config/constants";

export class ScoreboardManager {
  private readonly debugLogger: DebugLogger;
  private readonly objectiveName = "eslr_teams";
  private crimsonDummy?: Entity;
  private azureDummy?: Entity;

  constructor(private readonly propertyStore: PropertyStore) {
    this.debugLogger = new DebugLogger(propertyStore);
  }

  /**
   * Initialize the scoreboard with two teams
   */
  initializeScoreboard(): void {
    try {
      // Remove existing scoreboard if it exists
      const existing = world.scoreboard.getObjective(this.objectiveName);
      if (existing) {
        world.scoreboard.removeObjective(existing);
      }

      // Create new scoreboard objective
      const objective = world.scoreboard.addObjective(this.objectiveName, "§6§lLOOT RUSH");

      // Set display slot to sidebar
      objective.setScore("§cCrimson Crusaders", 0);
      objective.setScore("§bAzure Architects", 0);

      world.scoreboard.setObjectiveAtDisplaySlot(DisplaySlotId.Sidebar, {
        objective: objective,
      });

      this.debugLogger?.log("Scoreboard initialized successfully");
    } catch (err) {
      this.debugLogger?.warn("Failed to initialize scoreboard", err);
    }
  }

  /**
   * Summon dummy entities at spawn point to represent teams in the scoreboard
   */
  summonDummies(spawnLocation: Vector3): void {
    try {
      const dimension = world.getDimension("overworld");

      // Remove existing dummies if they exist
      this.removeDummies();

      // Summon crimson dummy slightly offset from spawn
      const crimsonLoc = { x: spawnLocation.x - 0.5, y: spawnLocation.y, z: spawnLocation.z };
      this.crimsonDummy = dimension.spawnEntity("minecraft:armor_stand", crimsonLoc);
      this.crimsonDummy.nameTag = "§cCrimson Crusaders";
      this.crimsonDummy.setProperty("minecraft:variant", 0);

      // Summon azure dummy slightly offset from spawn
      const azureLoc = { x: spawnLocation.x + 0.5, y: spawnLocation.y, z: spawnLocation.z };
      this.azureDummy = dimension.spawnEntity("minecraft:armor_stand", azureLoc);
      this.azureDummy.nameTag = "§bAzure Architects";
      this.azureDummy.setProperty("minecraft:variant", 0);

      // Add dummies to scoreboard
      this.addDummiesToScoreboard();

      this.debugLogger?.log("Dummies summoned at spawn location");
    } catch (err) {
      this.debugLogger?.warn("Failed to summon dummies", err);
    }
  }

  /**
   * Add dummy entities to the scoreboard
   */
  private addDummiesToScoreboard(): void {
    try {
      const objective = world.scoreboard.getObjective(this.objectiveName);
      if (!objective) {
        this.debugLogger?.warn("Scoreboard objective not found");
        return;
      }

      if (this.crimsonDummy && this.crimsonDummy.isValid) {
        objective.addScore(this.crimsonDummy, 0);
      }

      if (this.azureDummy && this.azureDummy.isValid) {
        objective.addScore(this.azureDummy, 0);
      }

      this.debugLogger?.log("Dummies added to scoreboard");
    } catch (err) {
      this.debugLogger?.warn("Failed to add dummies to scoreboard", err);
    }
  }

  /**
   * Update team score on the scoreboard
   */
  updateScore(team: TeamId, score: number): void {
    try {
      const objective = world.scoreboard.getObjective(this.objectiveName);
      if (!objective) {
        this.debugLogger?.warn("Scoreboard objective not found");
        return;
      }

      const dummy = team === "crimson" ? this.crimsonDummy : this.azureDummy;
      if (dummy && dummy.isValid) {
        objective.setScore(dummy, score);
        this.debugLogger?.log(`Updated ${team} score to ${score}`);
      } else {
        // Fallback to using participant name if dummy is not valid
        const displayName = team === "crimson" ? "§cCrimson Crusaders" : "§bAzure Architects";
        objective.setScore(displayName, score);
        this.debugLogger?.log(`Updated ${team} score to ${score} (fallback)`);
      }
    } catch (err) {
      this.debugLogger?.warn(`Failed to update ${team} score`, err);
    }
  }

  /**
   * Update both team scores
   */
  updateScores(crimsonScore: number, azureScore: number): void {
    this.updateScore("crimson", crimsonScore);
    this.updateScore("azure", azureScore);
  }

  /**
   * Show the scoreboard
   */
  showScoreboard(): void {
    try {
      const objective = world.scoreboard.getObjective(this.objectiveName);
      if (!objective) {
        this.initializeScoreboard();
        return;
      }

      world.scoreboard.setObjectiveAtDisplaySlot(DisplaySlotId.Sidebar, {
        objective: objective,
      });

      this.debugLogger?.log("Scoreboard shown");
    } catch (err) {
      this.debugLogger?.warn("Failed to show scoreboard", err);
    }
  }

  /**
   * Hide the scoreboard
   */
  hideScoreboard(): void {
    try {
      world.scoreboard.clearObjectiveAtDisplaySlot(DisplaySlotId.Sidebar);
      this.debugLogger?.log("Scoreboard hidden");
    } catch (err) {
      this.debugLogger?.warn("Failed to hide scoreboard", err);
    }
  }

  /**
   * Reset scoreboard (clear and reinitialize)
   */
  resetScoreboard(): void {
    try {
      this.hideScoreboard();
      this.removeDummies();

      const objective = world.scoreboard.getObjective(this.objectiveName);
      if (objective) {
        world.scoreboard.removeObjective(objective);
      }

      this.debugLogger?.log("Scoreboard reset");
    } catch (err) {
      this.debugLogger?.warn("Failed to reset scoreboard", err);
    }
  }

  /**
   * Remove dummy entities
   */
  removeDummies(): void {
    try {
      if (this.crimsonDummy && this.crimsonDummy.isValid) {
        this.crimsonDummy.remove();
      }
      if (this.azureDummy && this.azureDummy.isValid) {
        this.azureDummy.remove();
      }
      this.crimsonDummy = undefined;
      this.azureDummy = undefined;

      this.debugLogger?.log("Dummies removed");
    } catch (err) {
      this.debugLogger?.warn("Failed to remove dummies", err);
    }
  }

  /**
   * Get spawn location from property store
   */
  private getStoredSpawn(): Vector3 | undefined {
    return this.propertyStore.getJSON<Vector3>(DYNAMIC_KEYS.spawnLocation, undefined as any);
  }
}
