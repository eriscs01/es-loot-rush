import { world } from "@minecraft/server";
import { GameStateManager } from "./managers/GameStateManager";
import { TeamManager } from "./managers/TeamManager";
import { ChallengeManager } from "./managers/ChallengeManager";
import { ChestManager } from "./managers/ChestManager";
import { HUDManager } from "./managers/HUDManager";
import { CommandHandler } from "./managers/CommandHandler";
import { ConfigManager } from "./managers/ConfigManager";
import { AudioManager } from "./managers/AudioManager";

const configManager = new ConfigManager(world);
const teamManager = new TeamManager(world, configManager);
const challengeManager = new ChallengeManager(configManager);
const chestManager = new ChestManager(world, configManager);
const hudManager = new HUDManager(world);
const audioManager = new AudioManager(world);

const gameStateManager = new GameStateManager(
  configManager,
  teamManager,
  challengeManager,
  chestManager,
  hudManager,
  audioManager,
  world
);

const commandHandler = new CommandHandler(
  gameStateManager,
  teamManager,
  challengeManager,
  chestManager,
  hudManager,
  configManager,
  audioManager
);

gameStateManager.initialize();
commandHandler.registerCommands();
