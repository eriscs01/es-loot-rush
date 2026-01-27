import {
  CommandPermissionLevel,
  CustomCommandParamType,
  CustomCommandOrigin,
  CustomCommandResult,
  CustomCommandStatus,
  system,
  world,
  Vector3,
  Player,
} from "@minecraft/server";
import { GameStateManager } from "./GameStateManager";
import { TeamManager } from "./TeamManager";
import { ChallengeManager } from "./ChallengeManager";
import { ChestManager } from "./ChestManager";
import { HUDManager } from "./HUDManager";
import { ConfigManager } from "./ConfigManager";
import { AudioManager } from "./AudioManager";
import { TeamId } from "../types";
import { DebugLogger } from "./DebugLogger";
import { PropertyStore } from "./PropertyStore";

export class CommandHandler {
  private readonly debugLogger: DebugLogger;

  constructor(
    private readonly propertyStore: PropertyStore,
    private readonly gameStateManager: GameStateManager,
    private readonly teamManager: TeamManager,
    private readonly challengeManager: ChallengeManager,
    private readonly chestManager: ChestManager,
    private readonly hudManager: HUDManager,
    private readonly configManager: ConfigManager,
    private readonly audioManager: AudioManager
  ) {
    void gameStateManager;
    void teamManager;
    void challengeManager;
    void chestManager;
    void hudManager;
    void configManager;
    void audioManager;
    this.debugLogger = new DebugLogger(propertyStore);
  }

  registerCommands(): void {
    system.beforeEvents.startup.subscribe(({ customCommandRegistry }) => {
      customCommandRegistry.registerCommand(
        {
          name: "lr:teamup",
          description: "Forms teams and places bounty chests",
          permissionLevel: CommandPermissionLevel.GameDirectors,
          cheatsRequired: false,
        },
        this.handleTeamUp.bind(this)
      );

      customCommandRegistry.registerCommand(
        {
          name: "lr:start",
          description: "Starts the Loot Rush challenge",
          permissionLevel: CommandPermissionLevel.GameDirectors,
          cheatsRequired: false,
        },
        this.handleStart.bind(this)
      );

      customCommandRegistry.registerCommand(
        {
          name: "lr:end",
          description: "Ends the Loot Rush challenge",
          permissionLevel: CommandPermissionLevel.GameDirectors,
          cheatsRequired: false,
        },
        this.handleEnd.bind(this)
      );

      customCommandRegistry.registerCommand(
        {
          name: "lr:reset",
          description: "Resets Loot Rush state",
          permissionLevel: CommandPermissionLevel.GameDirectors,
          cheatsRequired: false,
        },
        this.handleReset.bind(this)
      );

      customCommandRegistry.registerCommand(
        {
          name: "lr:forceround",
          description: "Jump to specific round",
          permissionLevel: CommandPermissionLevel.GameDirectors,
          cheatsRequired: false,
          mandatoryParameters: [{ name: "round", type: CustomCommandParamType.Integer }],
        },
        this.handleForceRound.bind(this)
      );

      customCommandRegistry.registerEnum("lr:teamid", ["crimson", "azure"]);

      customCommandRegistry.registerCommand(
        {
          name: "lr:setscore",
          description: "Set a team's score",
          permissionLevel: CommandPermissionLevel.GameDirectors,
          cheatsRequired: false,
          mandatoryParameters: [
            { name: "lr:teamid", type: CustomCommandParamType.Enum },
            { name: "points", type: CustomCommandParamType.Integer },
          ],
        },
        this.handleSetScore.bind(this)
      );

      customCommandRegistry.registerCommand(
        {
          name: "lr:pause",
          description: "Pause the game timer and checks",
          permissionLevel: CommandPermissionLevel.GameDirectors,
          cheatsRequired: false,
        },
        this.handlePause.bind(this)
      );

      customCommandRegistry.registerCommand(
        {
          name: "lr:resume",
          description: "Resume the game timer and checks",
          permissionLevel: CommandPermissionLevel.GameDirectors,
          cheatsRequired: false,
        },
        this.handleResume.bind(this)
      );

      customCommandRegistry.registerCommand(
        {
          name: "lr:debug",
          description: "Toggle debug logging for Loot Rush",
          permissionLevel: CommandPermissionLevel.GameDirectors,
          cheatsRequired: false,
          mandatoryParameters: [{ name: "enabled", type: CustomCommandParamType.Boolean }],
        },
        this.handleDebugToggle.bind(this)
      );

      customCommandRegistry.registerCommand(
        {
          name: "lr:config",
          description: "View current Loot Rush configuration",
          permissionLevel: CommandPermissionLevel.GameDirectors,
          cheatsRequired: false,
        },
        this.handleConfigView.bind(this)
      );

      customCommandRegistry.registerEnum("lr:configkey", [
        "easyChallengeCount",
        "mediumChallengeCount",
        "hardChallengeCount",
        "totalRounds",
        "roundDurationTicks",
      ]);
      customCommandRegistry.registerCommand(
        {
          name: "lr:configset",
          description: "Set a Loot Rush configuration value",
          permissionLevel: CommandPermissionLevel.GameDirectors,
          cheatsRequired: false,
          mandatoryParameters: [
            { name: "lr:configkey", type: CustomCommandParamType.Enum },
            { name: "value", type: CustomCommandParamType.Integer },
          ],
        },
        this.handleConfigSet.bind(this)
      );

      customCommandRegistry.registerCommand(
        {
          name: "lr:configreset",
          description: "Reset Loot Rush configuration to defaults",
          permissionLevel: CommandPermissionLevel.GameDirectors,
          cheatsRequired: false,
        },
        this.handleConfigReset.bind(this)
      );
    });
  }

  handleTeamUp(origin: CustomCommandOrigin): CustomCommandResult {
    const players = world.getAllPlayers();
    if (players.length < 2) {
      return { status: CustomCommandStatus.Failure, message: "§cNeed at least 2 players to form teams." };
    }

    if (this.gameStateManager.isGameActive()) {
      return {
        status: CustomCommandStatus.Failure,
        message: "§cCannot form teams while game is active. Use lr:end first.",
      };
    }

    if (this.gameStateManager.isTeamsFormed()) {
      return { status: CustomCommandStatus.Failure, message: "§cTeams already formed. Use lr:reset to reform." };
    }

    this.teamManager.clearTeams();
    this.teamManager.formTeams(players);
    void this.runTeamFormationSequence(players);
    void origin;
    return { status: CustomCommandStatus.Success, message: "Team formation sequence started" };
  }

  handleStart(origin: CustomCommandOrigin): CustomCommandResult {
    if (!this.gameStateManager.isTeamsFormed()) {
      return { status: CustomCommandStatus.Failure, message: "§cTeams must be formed first! Use lr:teamup." };
    }
    if (this.gameStateManager.isGameActive()) {
      return { status: CustomCommandStatus.Failure, message: "§cGame is already in progress!" };
    }

    const chestSpawn = this.chestManager.getSpawnLocation();
    if (!chestSpawn) {
      return { status: CustomCommandStatus.Failure, message: "§cBounty chests not found! Re-run teamup." };
    }

    this.teamManager.setTeamScore("crimson", 0);
    this.teamManager.setTeamScore("azure", 0);
    this.challengeManager.resetChallenges();

    this.gameStateManager.startGame();
    const active = this.challengeManager.selectChallenges();
    const players = world.getAllPlayers();
    const durationInMins = this.configManager.getConfigValue("roundDurationTicks") / 20 / 60;
    world.sendMessage(`§6[LOOT RUSH] §fGame started!`);
    world.sendMessage(`Round 1 with ${active.length} challenges. Duration: ${durationInMins} minutes.`);
    this.audioManager.playStartHorn(players);
    void origin;
    return { status: CustomCommandStatus.Success, message: "Game started" };
  }

  private computeCenter(players: { location: Vector3 }[]): Vector3 {
    const total = players.reduce(
      (acc, p) => {
        acc.x += p.location.x;
        acc.y += p.location.y;
        acc.z += p.location.z;
        return acc;
      },
      { x: 0, y: 0, z: 0 }
    );
    const count = Math.max(players.length, 1);
    return {
      x: Math.floor(total.x / count),
      y: Math.floor(total.y / count),
      z: Math.floor(total.z / count),
    };
  }

  private async runTeamFormationSequence(players: Player[]): Promise<void> {
    // Shuffle animation: 200 ticks total, swap subtitle every 10 ticks
    await this.playShuffleAnimation(players);

    // Final reveal
    const crimsonIds = this.teamManager.getRoster("crimson");
    players.forEach((p) => {
      const isCrimson = crimsonIds.includes(p.nameTag ?? p.id);
      const title = isCrimson ? "§c§lCRIMSON CRUSADERS" : "§b§lAZURE ARCHITECTS";
      try {
        p.onScreenDisplay.setTitle(title, {
          fadeInDuration: 0,
          stayDuration: 90,
          fadeOutDuration: 10,
        });
        this.audioManager.playTeamReveal([p]);
      } catch (err) {
        this.debugLogger.warn("Failed to show reveal title", p.nameTag, err);
      }
    });

    // Post reveal actions after 60 ticks (3 seconds)
    await this.delayTicks(60);
    players.forEach((p) => this.teamManager.applyTeamColor(p));
    const center = this.computeCenter(players);
    const dim = world.getDimension("overworld");
    this.chestManager.placeChests(center, dim);
    this.teamManager.setSpawnPointForAll(players, center);
    this.gameStateManager.setTeamsFormed(true);
    players.forEach((p) => this.hudManager.clearHUD(p));

    const crimsonList = this.teamManager.getRoster("crimson");
    const azureList = this.teamManager.getRoster("azure");
    const crimsonRoster = crimsonList.join(", ") || "(none)";
    const azureRoster = azureList.join(", ") || "(none)";
    world.sendMessage(`§aTeams formed! Bounty chests placed!`);
    world.sendMessage(`§cCrimson Crusaders (${crimsonList.length}): §f${crimsonRoster}`);
    world.sendMessage(`§bAzure Architects (${azureList.length}): §f${azureRoster}`);
  }

  private async playShuffleAnimation(players: Player[]): Promise<void> {
    const totalTicks = 200;
    const step = 10;
    for (let tick = 0; tick < totalTicks; tick += step) {
      const teamText = Math.floor(tick / step) % 2 === 0 ? "§cCrimson Crusaders" : "§bAzure Architects";
      players.forEach((p) => {
        try {
          system.run(() => {
            p.onScreenDisplay.setTitle("§6Your team is...", {
              subtitle: teamText,
              fadeInDuration: 0,
              stayDuration: step,
              fadeOutDuration: 0,
            });
          });
        } catch (err) {
          this.debugLogger.warn("Failed to show shuffle title", p.nameTag, err);
        }
      });
      this.audioManager.playTeamShuffleTick(players);
      await this.delayTicks(step);
    }
  }

  private delayTicks(ticks: number): Promise<void> {
    return new Promise((resolve) => {
      system.runTimeout(resolve, ticks);
    });
  }

  handleEnd(origin: CustomCommandOrigin): CustomCommandResult {
    this.gameStateManager.endGame(true);
    void origin;
    return { status: CustomCommandStatus.Success, message: "Game ended" };
  }

  handleReset(origin: CustomCommandOrigin): CustomCommandResult {
    system.run(() => {
      this.gameStateManager.resetGame();
    });
    void origin;
    return { status: CustomCommandStatus.Success, message: "State reset. Use lr:teamup to form teams." };
  }

  handleForceRound(origin: CustomCommandOrigin, round: number): CustomCommandResult {
    if (!this.gameStateManager.isGameActive()) {
      return { status: CustomCommandStatus.Failure, message: "§cGame must be active to force a round." };
    }

    const totalRounds = this.configManager.getConfigValue("totalRounds");

    if (!Number.isInteger(round) || round < 1 || round > totalRounds) {
      return {
        status: CustomCommandStatus.Failure,
        message: `§cInvalid round. Enter a value between 1 and ${totalRounds}.`,
      };
    }

    this.gameStateManager.forceRound(round);
    void origin;
    return { status: CustomCommandStatus.Success, message: `Forced to round ${round}.` };
  }

  handleSetScore(origin: CustomCommandOrigin, teamArg: string, pointsArg: number): CustomCommandResult {
    const team = teamArg === "crimson" || teamArg === "azure" ? (teamArg as TeamId) : undefined;
    const points = pointsArg ? pointsArg : NaN;

    if (!team) {
      return {
        status: CustomCommandStatus.Failure,
        message: "§cInvalid team. Use 'crimson' or 'azure'.",
      };
    }
    if (!Number.isInteger(points)) {
      return { status: CustomCommandStatus.Failure, message: "§cPoints must be an integer." };
    }

    this.teamManager.setTeamScore(team, points);
    const players = world.getAllPlayers();
    players.forEach((p) => this.hudManager.updateScores(p));
    void origin;
    return { status: CustomCommandStatus.Success, message: `Set ${team} score to ${points}.` };
  }

  handlePause(origin: CustomCommandOrigin): CustomCommandResult {
    if (!this.gameStateManager.isGameActive()) {
      return { status: CustomCommandStatus.Failure, message: "§cGame is not active." };
    }
    this.gameStateManager.pauseGame();
    this.chestManager.stopMonitoring();
    void origin;
    return { status: CustomCommandStatus.Success, message: "Game paused." };
  }

  handleResume(origin: CustomCommandOrigin): CustomCommandResult {
    if (!this.gameStateManager.isGameActive()) {
      return { status: CustomCommandStatus.Failure, message: "§cGame is not active." };
    }
    this.gameStateManager.resumeGame();
    this.chestManager.monitorChests();
    void origin;
    return { status: CustomCommandStatus.Success, message: "Game resumed." };
  }

  handleDebugToggle(origin: CustomCommandOrigin, enabled: boolean): CustomCommandResult {
    this.debugLogger.setEnabled(enabled);
    const statusText = enabled ? "enabled" : "disabled";
    this.debugLogger.log(`Debug command toggled: ${statusText}`);
    void origin;
    return { status: CustomCommandStatus.Success, message: `Debug logging ${statusText}.` };
  }

  handleConfigView(origin: CustomCommandOrigin): CustomCommandResult {
    const current = this.configManager.getConfig();
    const defaults = this.configManager.getDefaults();

    const lines = [
      "§6=== Loot Rush Configuration ===",
      `§eEasy Challenges: §f${current.easyChallengeCount} §7(default: ${defaults.easyChallengeCount})`,
      `§eMedium Challenges: §f${current.mediumChallengeCount} §7(default: ${defaults.mediumChallengeCount})`,
      `§eHard Challenges: §f${current.hardChallengeCount} §7(default: ${defaults.hardChallengeCount})`,
      `§eTotal Rounds: §f${current.totalRounds} §7(default: ${defaults.totalRounds})`,
      `§eRound Duration: §f${current.roundDurationTicks} ticks §7(${Math.floor(current.roundDurationTicks / 20)}s)`,
    ];

    world.sendMessage(lines.join("\n"));
    void origin;
    return { status: CustomCommandStatus.Success };
  }

  handleConfigSet(origin: CustomCommandOrigin, keyArg: string, value: number): CustomCommandResult {
    if (this.gameStateManager.isGameActive()) {
      return {
        status: CustomCommandStatus.Failure,
        message: "§cCannot change config during an active game. Use lr:end first.",
      };
    }

    const key = keyArg as keyof ReturnType<ConfigManager["getConfig"]> | undefined;

    if (!key || value === undefined) {
      return {
        status: CustomCommandStatus.Failure,
        message:
          "§cUsage: lr:config:set <key> <value>. Keys: easyChallengeCount, mediumChallengeCount, hardChallengeCount, totalRounds, roundDurationTicks",
      };
    }

    if (!Number.isInteger(value)) {
      return { status: CustomCommandStatus.Failure, message: "§cValue must be an integer." };
    }

    const limits: Record<string, { min: number; max: number }> = {
      easyChallengeCount: { min: 0, max: 10 },
      mediumChallengeCount: { min: 0, max: 10 },
      hardChallengeCount: { min: 0, max: 10 },
      totalRounds: { min: 1, max: 10 },
      roundDurationTicks: { min: 1200, max: 72000 },
    };

    const limit = limits[key as string];
    if (!limit) {
      return {
        status: CustomCommandStatus.Failure,
        message:
          "§cInvalid key. Valid keys: easyChallengeCount, mediumChallengeCount, hardChallengeCount, totalRounds, roundDurationTicks",
      };
    }

    if (value < limit.min || value > limit.max) {
      return {
        status: CustomCommandStatus.Failure,
        message: `§cInvalid value for ${key}. Must be between ${limit.min} and ${limit.max}.`,
      };
    }

    this.configManager.setConfig(key, value as never);
    this.configManager.saveConfig();
    void origin;
    return { status: CustomCommandStatus.Success, message: `§aConfiguration updated: ${key} = ${value}` };
  }

  handleConfigReset(origin: CustomCommandOrigin): CustomCommandResult {
    if (this.gameStateManager.isGameActive()) {
      return {
        status: CustomCommandStatus.Failure,
        message: "§cCannot reset config during an active game. Use lr:end first.",
      };
    }
    this.configManager.resetToDefaults();
    this.configManager.saveConfig();
    void origin;
    return { status: CustomCommandStatus.Success, message: "§aConfiguration reset to defaults." };
  }
}
