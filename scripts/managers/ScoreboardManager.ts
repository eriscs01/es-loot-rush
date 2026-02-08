import { world, DisplaySlotId, system } from "@minecraft/server";
import { PropertyStore } from "./PropertyStore";
import { TeamId } from "../types";
import { DebugLogger } from "./DebugLogger";

export class ScoreboardManager {
  private readonly debugLogger: DebugLogger;
  private readonly objectiveName = "eslr_teams";

  constructor(private readonly propertyStore: PropertyStore) {
    this.debugLogger = new DebugLogger(propertyStore);
  }

  /**
   * Initialize the scoreboard with two teams
   */
  initializeScoreboard(): void {
    try {
      system.run(() => {
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
      });
      this.debugLogger?.log("Scoreboard initialized successfully");
    } catch (err) {
      this.debugLogger?.warn("Failed to initialize scoreboard", err);
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

      const displayName = team === "crimson" ? "§cCrimson Crusaders" : "§bAzure Architects";
      system.run(() => objective.setScore(displayName, score));
      this.debugLogger?.log(`Updated ${team} score to ${score}`);
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

      system.run(() => {
        world.scoreboard.setObjectiveAtDisplaySlot(DisplaySlotId.Sidebar, {
          objective: objective,
        });
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
      system.run(() => world.scoreboard.clearObjectiveAtDisplaySlot(DisplaySlotId.Sidebar));
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

      const objective = world.scoreboard.getObjective(this.objectiveName);
      if (objective) {
        system.run(() => world.scoreboard.removeObjective(objective));
      }

      this.debugLogger?.log("Scoreboard reset");
    } catch (err) {
      this.debugLogger?.warn("Failed to reset scoreboard", err);
    }
  }
}
