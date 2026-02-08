import { PropertyStore } from "./managers/PropertyStore";
import { GameStateManager } from "./managers/GameStateManager";
import { TeamManager } from "./managers/TeamManager";
import { ChallengeManager } from "./managers/ChallengeManager";
import { ChestManager } from "./managers/ChestManager";
import { CommandHandler } from "./managers/CommandHandler";
import { ConfigManager } from "./managers/ConfigManager";
import { AudioManager } from "./managers/AudioManager";
import { ScoreboardManager } from "./managers/ScoreboardManager";
import { BookManager } from "./managers/BookManager";

const propertyStore = new PropertyStore();
propertyStore.initialize();

const configManager = new ConfigManager(propertyStore);
const teamManager = new TeamManager(propertyStore);
const audioManager = new AudioManager(propertyStore);
const scoreboardManager = new ScoreboardManager(propertyStore);
const chestManager = new ChestManager(propertyStore, teamManager, audioManager);
chestManager.initialize();
const challengeManager = new ChallengeManager(
  propertyStore,
  configManager,
  teamManager,
  audioManager,
  chestManager,
  scoreboardManager
);

const bookManager = new BookManager(propertyStore, challengeManager);

const gameStateManager = new GameStateManager(
  propertyStore,
  configManager,
  teamManager,
  challengeManager,
  chestManager,
  audioManager,
  scoreboardManager,
  bookManager
);
gameStateManager.initialize();

const commandHandler = new CommandHandler(
  propertyStore,
  gameStateManager,
  teamManager,
  challengeManager,
  chestManager,
  configManager,
  audioManager,
  scoreboardManager,
  bookManager
);
commandHandler.registerCommands();
