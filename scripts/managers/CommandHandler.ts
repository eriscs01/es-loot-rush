import {
  CommandPermissionLevel,
  CustomCommandOrigin,
  CustomCommandResult,
  CustomCommandStatus,
  system,
} from "@minecraft/server";
import { GameStateManager } from "./GameStateManager";
import { TeamManager } from "./TeamManager";
import { ChallengeManager } from "./ChallengeManager";
import { ChestManager } from "./ChestManager";
import { HUDManager } from "./HUDManager";
import { ConfigManager } from "./ConfigManager";
import { AudioManager } from "./AudioManager";

export class CommandHandler {
  constructor(
    private readonly gameStateManager: GameStateManager,
    private readonly teamManager: TeamManager,
    private readonly challengeManager: ChallengeManager,
    private readonly chestManager: ChestManager,
    private readonly hudManager: HUDManager,
    private readonly configManager: ConfigManager,
    private readonly audioManager?: AudioManager
  ) {}

  registerCommands(): void {
    system.beforeEvents.startup.subscribe(({ customCommandRegistry }) => {
      customCommandRegistry.registerCommand(
        {
          name: "lr:teamup",
          description: "Forms teams and places bounty chests",
          permissionLevel: CommandPermissionLevel.GameDirectors,
          cheatsRequired: false,
        },
        (origin) => this.handleTeamUp(origin)
      );

      customCommandRegistry.registerCommand(
        {
          name: "lr:start",
          description: "Starts the Loot Rush challenge",
          permissionLevel: CommandPermissionLevel.GameDirectors,
          cheatsRequired: false,
        },
        (origin) => this.handleStart(origin)
      );

      customCommandRegistry.registerCommand(
        {
          name: "lr:end",
          description: "Ends the Loot Rush challenge",
          permissionLevel: CommandPermissionLevel.GameDirectors,
          cheatsRequired: false,
        },
        (origin) => this.handleEnd(origin)
      );

      customCommandRegistry.registerCommand(
        {
          name: "lr:reset",
          description: "Resets Loot Rush state",
          permissionLevel: CommandPermissionLevel.GameDirectors,
          cheatsRequired: false,
        },
        (origin) => this.handleReset(origin)
      );

      customCommandRegistry.registerCommand(
        {
          name: "lr:config",
          description: "Updates Loot Rush configuration",
          permissionLevel: CommandPermissionLevel.GameDirectors,
          cheatsRequired: false,
        },
        (origin, args) => this.handleConfig(origin, args)
      );
    });
  }

  handleTeamUp(origin: CustomCommandOrigin): CustomCommandResult {
    void this.teamManager;
    void this.chestManager;
    void this.hudManager;
    void this.audioManager;
    void origin;
    return { status: CustomCommandStatus.Success, message: "Team formation scaffold ready" };
  }

  handleStart(origin: CustomCommandOrigin): CustomCommandResult {
    this.gameStateManager.startGame();
    void origin;
    return { status: CustomCommandStatus.Success, message: "Game start scaffold ready" };
  }

  handleEnd(origin: CustomCommandOrigin): CustomCommandResult {
    this.gameStateManager.endGame();
    void origin;
    return { status: CustomCommandStatus.Success, message: "Game end scaffold ready" };
  }

  handleReset(origin: CustomCommandOrigin): CustomCommandResult {
    this.gameStateManager.endGame();
    this.teamManager.clearTeams();
    this.challengeManager.resetChallenges();
    void origin;
    return { status: CustomCommandStatus.Success, message: "Reset scaffold ready" };
  }

  handleConfig(origin: CustomCommandOrigin, args?: string[]): CustomCommandResult {
    void origin;
    void args;
    this.configManager.saveConfig();
    return { status: CustomCommandStatus.Success, message: "Config scaffold ready" };
  }
}
