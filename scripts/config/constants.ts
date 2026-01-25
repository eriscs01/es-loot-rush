export const DYNAMIC_KEYS = {
  gameActive: "lootRush:gameActive",
  teamsFormed: "lootRush:teamsFormed",
  gamePaused: "lootRush:gamePaused",
  debugMode: "lootRush:debugMode",
  currentRound: "lootRush:currentRound",
  roundStartTick: "lootRush:roundStartTick",
  pausedAtTick: "lootRush:pausedAtTick",
  crimsonScore: "lootRush:crimsonScore",
  azureScore: "lootRush:azureScore",
  activeChallenges: "lootRush:activeChallenges",
  completedChallenges: "lootRush:completedChallenges",
  config: "lootRush:config",
  crimsonPlayers: "lootRush:crimsonPlayers",
  azurePlayers: "lootRush:azurePlayers",
  chestCrimsonLocation: "lootRush:chestCrimsonLocation",
  chestAzureLocation: "lootRush:chestAzureLocation",
  spawnLocation: "lootRush:spawnLocation",
} as const;

export const DYNAMIC_PROPERTY_LIMIT_BYTES = 16_000; // Safety buffer under 16KB limit
