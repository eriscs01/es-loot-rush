import { PropertyStore } from "./managers/PropertyStore";
import { GameStateManager } from "./managers/GameStateManager";
import { TeamManager } from "./managers/TeamManager";
import { ChallengeManager } from "./managers/ChallengeManager";
import { ChestManager } from "./managers/ChestManager";
import { HUDManager } from "./managers/HUDManager";
import { CommandHandler } from "./managers/CommandHandler";
import { ConfigManager } from "./managers/ConfigManager";
import { AudioManager } from "./managers/AudioManager";
import { ScoreboardManager } from "./managers/ScoreboardManager";

const propertyStore = new PropertyStore();
propertyStore.initialize();

const configManager = new ConfigManager(propertyStore);
const teamManager = new TeamManager(propertyStore);
const audioManager = new AudioManager(propertyStore);
const scoreboardManager = new ScoreboardManager(propertyStore);
const hudManager = new HUDManager(propertyStore, configManager, teamManager, scoreboardManager);
const chestManager = new ChestManager(propertyStore, teamManager, audioManager);
chestManager.initialize();
const challengeManager = new ChallengeManager(
  propertyStore,
  configManager,
  teamManager,
  hudManager,
  audioManager,
  chestManager
);

const gameStateManager = new GameStateManager(
  propertyStore,
  configManager,
  teamManager,
  challengeManager,
  chestManager,
  hudManager,
  audioManager,
  scoreboardManager
);
gameStateManager.initialize();

const commandHandler = new CommandHandler(
  propertyStore,
  gameStateManager,
  teamManager,
  challengeManager,
  chestManager,
  hudManager,
  configManager,
  audioManager,
  scoreboardManager
);
commandHandler.registerCommands();
