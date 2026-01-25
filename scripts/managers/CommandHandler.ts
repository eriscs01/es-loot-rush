import {
  CommandPermissionLevel,
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

export class CommandHandler {
  constructor(
    private readonly gameStateManager: GameStateManager,
    private readonly teamManager: TeamManager,
    private readonly challengeManager: ChallengeManager,
    private readonly chestManager: ChestManager,
    private readonly hudManager: HUDManager,
    private readonly configManager: ConfigManager,
    private readonly audioManager: AudioManager
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
    players.forEach((p) => {
      this.hudManager.updateRoundInfo(p);
      this.hudManager.updateTimer(p);
      this.hudManager.updateScores(p);
      this.hudManager.updateChallenges(p);
    });
    const durationInMins = this.configManager.getConfigValue("roundDurationTicks") / 20;
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
    const azureIds = this.teamManager.getRoster("azure");
    players.forEach((p) => {
      const isCrimson = crimsonIds.includes(p.nameTag ?? p.id);
      const title = isCrimson ? "§c§lCRIMSON CRUSADERS" : "§9§lAZURE ARCHITECTS";
      try {
        p.onScreenDisplay.setTitle(title, {
          fadeInDuration: 0,
          stayDuration: 90,
          fadeOutDuration: 10,
        });
        this.audioManager.playTeamReveal([p]);
      } catch {
        /* ignore */
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

    const crimsonRoster = this.teamManager.getRoster("crimson").join(", ") || "(none)";
    const azureRoster = this.teamManager.getRoster("azure").join(", ") || "(none)";
    world.sendMessage(`§aTeams formed! Bounty chests placed!`);
    world.sendMessage(`§cCrimson Crusaders: §f${crimsonRoster}`);
    world.sendMessage(`§9Azure Architects: §f${azureRoster}`);
  }

  private async playShuffleAnimation(players: Player[]): Promise<void> {
    const totalTicks = 200;
    const step = 10;
    for (let tick = 0; tick < totalTicks; tick += step) {
      const teamText = Math.floor(tick / step) % 2 === 0 ? "§cCrimson Crusaders" : "§9Azure Architects";
      players.forEach((p) => {
        try {
          p.onScreenDisplay.setTitle("§6Your team is...", {
            subtitle: teamText,
            fadeInDuration: 0,
            stayDuration: step,
            fadeOutDuration: 0,
          });
        } catch {
          /* ignore */
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
