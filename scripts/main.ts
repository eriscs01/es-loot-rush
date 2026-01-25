import { world } from "@minecraft/server";
import { GameStateManager } from "./managers/GameStateManager";
import { TeamManager } from "./managers/TeamManager";
import { ChallengeManager } from "./managers/ChallengeManager";
import { ChestManager } from "./managers/ChestManager";
import { HUDManager } from "./managers/HUDManager";
import { CommandHandler } from "./managers/CommandHandler";
import { ConfigManager } from "./managers/ConfigManager";
import { AudioManager } from "./managers/AudioManager";
import { DebugLogger } from "./managers/DebugLogger";

const debugLogger = new DebugLogger(world);
const configManager = new ConfigManager(world, debugLogger);
const teamManager = new TeamManager(world, configManager, debugLogger);
const challengeManager = new ChallengeManager(configManager, world, debugLogger);
const hudManager = new HUDManager(world, configManager, challengeManager, teamManager, debugLogger);
const audioManager = new AudioManager(world, debugLogger);
const chestManager = new ChestManager(world, challengeManager, teamManager, audioManager, hudManager, debugLogger);

const gameStateManager = new GameStateManager(
  configManager,
  teamManager,
  challengeManager,
  chestManager,
  hudManager,
  audioManager,
  debugLogger,
  world
);

const commandHandler = new CommandHandler(
  gameStateManager,
  teamManager,
  challengeManager,
  chestManager,
  hudManager,
  configManager,
  audioManager,
  debugLogger
);

gameStateManager.initialize();
commandHandler.registerCommands();
