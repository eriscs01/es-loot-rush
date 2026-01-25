# Loot Rush Behavior Pack - Technical Requirements

## Phase 0: Code Architecture & Organization

### Task 0.1: Define class structure for code organization

To maintain clean, modular, and maintainable code, implement the following class-based architecture:

#### **GameStateManager**

- **Purpose**: Manages overall game state, rounds, timer, and game flow
- **Responsibilities**:
  - Initialize and manage world dynamic properties
  - Track game lifecycle (active, paused, ended)
  - Handle round progression and transitions
  - Manage timer and tick counting
  - Coordinate between other managers
- **Key methods**:
  - `startGame()`, `endGame()`, `pauseGame()`, `resumeGame()`
  - `getCurrentRound()`, `getRemainingTime()`
  - `transitionToNextRound()`, `forceRound(roundNumber)`
  - `getGameConfig()` - Access configuration settings

#### **TeamManager**

- **Purpose**: Handles all team-related functionality
- **Responsibilities**:
  - Team formation and player assignment
  - Team roster management
  - Player name tag coloring
  - Team score tracking and updates
  - Player join/leave handling
- **Key methods**:
  - `formTeams()`, `clearTeams()`
  - `assignPlayerToTeam(player, team)`
  - `getPlayerTeam(player)`
  - `applyTeamColor(player)`
  - `getTeamScore(team)`, `setTeamScore(team, points)`
  - `addPoints(team, points)`

#### **ChallengeManager**

- **Purpose**: Manages challenge selection, state, and validation
- **Responsibilities**:
  - Challenge pool storage and management
  - Challenge selection algorithm
  - Challenge state tracking (available, completed, locked)
  - Challenge validation logic
  - Handle "any" type challenges (any wood, any meat, etc.)
- **Key methods**:
  - `selectChallenges()` - Select based on configured counts
  - `isChallengeAvailable(challengeId)`
  - `lockChallenge(challengeId)`
  - `resetChallenges()`
  - `validateChallenge(challenge, items)`
  - `getActiveChallenges()`, `getCompletedChallenges()`

#### **ChestManager**

- **Purpose**: Handles bounty chest placement, monitoring, and protection
- **Responsibilities**:
  - Chest placement and location storage
  - Chest content monitoring
  - Chest protection (breaking, explosions, access control)
  - Chest inventory clearing
  - Challenge completion detection
- **Key methods**:
  - `placeChests(centerLocation)`
  - `getChestLocation(team)`
  - `monitorChests()` - Polling loop
  - `validateChestContents(team)`
  - `clearChest(team)`
  - `protectChest(location)`

#### **HUDManager**

- **Purpose**: Manages all HUD display updates via title prefix system
- **Responsibilities**:
  - Format and send HUD updates
  - Timer display with color coding
  - Challenge list formatting
  - Score display
  - Round information display
- **Key methods**:
  - `updateHUD(player)` - Updates all HUD elements
  - `updateTimer(player)`
  - `updateChallenges(player)`
  - `updateScores(player)`
  - `updateRoundInfo(player)`
  - `clearHUD(player)`

#### **CommandHandler**

- **Purpose**: Registers and handles all custom commands
- **Responsibilities**:
  - Command registration in startup event
  - Command validation and prerequisite checking
  - Delegate to appropriate managers
  - Return success/failure status
  - Error messaging to command executors
- **Key methods**:
  - `registerCommands()`
  - `handleTeamUp(origin)`
  - `handleStart(origin)`
  - `handleEnd(origin)`
  - `handleReset(origin)`
  - `handleConfig(origin, args)` - Configuration commands

#### **ConfigManager**

- **Purpose**: Manages game configuration and constants
- **Responsibilities**:
  - Store and retrieve configuration values
  - Provide default configuration
  - Validate configuration changes
  - Persist configuration to dynamic properties
- **Key methods**:
  - `getConfig(key)`, `setConfig(key, value)`
  - `loadConfig()`, `saveConfig()`
  - `resetToDefaults()`
  - `validateConfig(config)`
- **Configuration values**:
  - `easyChallengeCount` (default: 3)
  - `mediumChallengeCount` (default: 2)
  - `hardChallengeCount` (default: 1)
  - `totalRounds` (default: 4)
  - `roundDurationTicks` (default: 18000 = 15 minutes)

#### **AudioManager** (Optional)

- **Purpose**: Centralized sound effect management
- **Responsibilities**:
  - Play sounds for specific game events
  - Handle sound timing and coordination
- **Key methods**:
  - `playTeamFormationSounds()`, `playChallengeSounds()`
  - `playTimerWarningSounds()`, `playVictorySounds()`

#### **Class Interaction Flow**:

```
CommandHandler
    ↓
GameStateManager ← coordinates → TeamManager
    ↓                             ↓
ChallengeManager ← validates → ChestManager
    ↓
HUDManager (displays state from all managers)
    ↓
ConfigManager (provides settings to all managers)
```

- **Implementation notes**:
  - Each class should be in its own file (e.g., `scripts/managers/GameStateManager.ts`)
  - Use dependency injection where appropriate
  - Managers should communicate through GameStateManager when possible
  - All managers should access ConfigManager for settings
  - Keep managers focused on single responsibility

## Phase 1: Core Setup & Data Structures

### Task 1.1: Initialize world dynamic properties for game state

- **APIs**: `world.setDynamicProperty()`, `world.getDynamicProperty()`
- **Implemented by**: `GameStateManager` and `ConfigManager`
- **Properties to store**:
  - `lootRush:gameActive` (boolean)
  - `lootRush:teamsFormed` (boolean)
  - `lootRush:currentRound` (number, 1-4 by default, configurable)
  - `lootRush:roundStartTick` (number)
  - `lootRush:crimsonScore` (number) - Red team
  - `lootRush:azureScore` (number) - Blue team
  - `lootRush:activeChallenges` (JSON string array of challenge IDs)
  - `lootRush:completedChallenges` (JSON string array)
  - `lootRush:config` (JSON string of configuration object)
- **Validation**: Check property limits (max 16KB per property)

### Task 1.2: Create challenge data structure

- **Implemented by**: `ChallengeManager`

```javascript
const CHALLENGES = {
  easy: [
    { id: 'stone_age', name: 'Stone Age Stockpile', item: 'minecraft:cobblestone', count: 64, points: 10 },
    // ... all easy challenges
  ],
  medium: [...],
  hard: [...]
}
```

- **Requirements**:
  - Each challenge needs: id, display name, required item type ID, count, point value
  - Support for "any" variants (e.g., "any wood", "any meat")
  - Store in constants file for easy reference
  - Access configuration for challenge counts per difficulty

### Task 1.3: Set up team data storage

- **Implemented by**: `TeamManager`

- **Team names**: "Crimson Crusaders" (Red), "Azure Architects" (Blue)
- **Dynamic Properties**:
  - `lootRush:crimsonPlayers` (JSON string array of player names/IDs)
  - `lootRush:azurePlayers` (JSON string array)
- **In-memory cache**: Map<string, 'crimson'|'azure'> for quick player lookup
- **Functions needed**:
  - `assignPlayerToTeam(player, team)`
  - `getPlayerTeam(player)`
  - `clearTeams()`
- **Player name coloring**:
  - Apply `§c` prefix for Crimson players
  - Apply `§9` prefix for Azure players
  - Update display names via `player.nameTag` property

### Task 1.4: Implement bounty chest location registration and placement

- **Implemented by**: `ChestManager`
- **Dynamic Properties**:
  - `lootRush:chestCrimsonLocation` (JSON string: `{x, y, z}`)
  - `lootRush:chestAzureLocation` (JSON string: `{x, y, z}`)
  - `lootRush:spawnLocation` (JSON string: `{x, y, z}`)
- **Placement logic**:
  - Calculate center point from all players' average position
  - Place Crimson chest at offset (-3, 0, 0) - Left/West
  - Place Azure chest at offset (+3, 0, 0) - Right/East
  - Both at same Y level as center
- **APIs**:
  - `dimension.getBlock(location).setType('minecraft:chest')`
  - `block.setPermutation()` for facing direction
- **Chest naming**: Set custom name via BlockInventoryComponent
  - Crimson: `§c§lCRIMSON BOUNTY`
  - Azure: `§9§lAZURE BOUNTY`
- **Store spawn point**: Save center coordinates for respawn

### Task 1.5: Make bounty chests unbreakable

- **Implemented by**: `ChestManager`
- **APIs**: `world.beforeEvents.playerBreakBlock.subscribe()`
- **Logic**:
  - Check if block location matches stored chest locations
  - If match: `event.cancel = true`
  - Send message: `§cThis chest is protected!`
- **Additional protection**:
  - `world.beforeEvents.explosion` - prevent explosion damage
  - Store chest locations for comparison

### Task 1.6: Set player respawn points

- **Implemented by**: `TeamManager`
- **APIs**: `player.setSpawnPoint(spawnPoint)`
- **Trigger**: On team formation completion (after reveal animation)
- **Location**: Use stored `lootRush:spawnLocation`
- **Apply to**: All players when teams are formed
- **Dimension**: Ensure overworld dimension reference

## Phase 2: Team Formation & Game Flow

### Task 2.0: Create team formation command with reveal animation

- **APIs**: `@minecraft/server` - Custom Commands API
- **Implemented by**: `CommandHandler` (delegates to `TeamManager`)
- **Command Registration** (in `system.beforeEvents.startup`):

```javascript
import { CommandPermissionLevel, CustomCommandStatus, system } from "@minecraft/server";

system.beforeEvents.startup.subscribe(({ customCommandRegistry }) => {
  customCommandRegistry.registerCommand(
    {
      name: "lr:teamup",
      description: "Forms teams and places bounty chests",
      permissionLevel: CommandPermissionLevel.GameDirectors,
      cheatsRequired: false,
    },
    (origin) => teamFormationHandler(origin)
  );
});
```

- **Command**: `lr:teamup` (can also use `/teamup` without namespace in chat)
- **Permission**: `CommandPermissionLevel.GameDirectors` (Operator level 1+, includes command blocks)
- **Prerequisites**:
  - Minimum 2 players in world
  - Game not already active
  - Teams not already formed
- **Flow**:
  1. **Team Assignment** (Immediate):
     - Get all online players
     - Shuffle players randomly (Fisher-Yates algorithm)
     - Split into two equal teams (handle odd number)
     - Store in `crimsonPlayers` and `azurePlayers` properties
     - Set `teamsFormed` to true
  2. **Reveal Animation** (10 seconds total):
     - **Phase 1**: Shuffling display (10 seconds)
       - Title: `§6Your team is...`
       - Subtitle: Alternates every **10 ticks** between:
         - `§cCrimson Crusaders` (tick 0-9)
         - `§9Azure Architects` (tick 10-19)
         - Repeat cycle
       - Total duration: 200 ticks (10 seconds)
     - **Phase 2**: Final reveal (4.5 seconds)
       - Title: Actual assigned team with color
         - `§c§lCRIMSON CRUSADERS` or
         - `§9§lAZURE ARCHITECTS`
       - Duration: 90 ticks (4.5 seconds)
  3. **Post-Reveal Actions**:
     - Apply player name tag colors (Task 1.3)
     - Calculate spawn location (average of all player positions)
     - Place bounty chests (Task 1.4)
     - Set all player spawn points (Task 1.6)
     - Send confirmation message: `§aTeams formed! Bounty chests placed!`
     - Display team rosters in chat

- **Implementation**:

```javascript
async function teamFormationSequence(players) {
  // 1. Assign teams
  const shuffled = shuffle(players);
  const mid = Math.floor(shuffled.length / 2);
  const crimson = shuffled.slice(0, mid);
  const azure = shuffled.slice(mid);

  // 2. Start shuffle animation (10 tick intervals)
  for (let tick = 0; tick < 200; tick += 10) {
    const team = Math.floor(tick / 10) % 2 === 0 ? "§cCrimson Crusaders" : "§9Azure Architects";
    players.forEach((p) => {
      p.onScreenDisplay.setTitle("§6Your team is...", team, {
        fadeInDuration: 0,
        stayDuration: 10,
        fadeOutDuration: 0,
      });
    });
    // Play shuffle sound
    players.forEach((p) => p.playSound("note.pling"));
    await system.runTimeout(() => {}, 10);
  }

  // 3. Reveal actual teams
  crimson.forEach((p) => {
    p.onScreenDisplay.setTitle("§c§lCRIMSON CRUSADERS", null, {
      fadeInDuration: 0,
      stayDuration: 90,
      fadeOutDuration: 10,
    });
    p.playSound("ui.toast.challenge_complete");
  });
  azure.forEach((p) => {
    p.onScreenDisplay.setTitle("§9§lAZURE ARCHITECTS", null, {
      fadeInDuration: 0,
      stayDuration: 90,
      fadeOutDuration: 10,
    });
    p.playSound("ui.toast.challenge_complete");
  });

  // 4. Post-reveal actions (after 3 more seconds)
  system.runTimeout(() => {
    applyNameColors();
    placeChests();
    setSpawnPoints();
    announceTeams();
  }, 60);
}
```

- **Return Status**: Use `CustomCommandStatus` enum
  - Success: `return { status: CustomCommandStatus.Success }`
  - Error: `return { status: CustomCommandStatus.Failure, message: 'Error message' }`

- **Validation**:
  - Check `teamsFormed` is false
  - Check minimum player count (2+)
  - Prevent re-running if teams exist

### Task 2.1: Create challenge start command

- **Command Registration**:
- **Implemented by**: `CommandHandler` (delegates to `GameStateManager`)

```javascript
system.beforeEvents.startup.subscribe(({ customCommandRegistry }) => {
  customCommandRegistry.registerCommand(
    {
      name: "lr:start",
      description: "Starts the Loot Rush challenge",
      permissionLevel: CommandPermissionLevel.GameDirectors,
      cheatsRequired: false,
    },
    (origin) => startGameHandler(origin)
  );
});
```

- **Command**: `lr:start` (can also use `/start` without namespace in chat)
- **Permission**: `CommandPermissionLevel.GameDirectors`
- **Prerequisites**:
  - Teams must be formed (`teamsFormed` === true)
  - Game not already active
  - Bounty chests must be placed
- **Actions**:
  1. Validate prerequisites
  2. Set `gameActive` to true
  3. Reset scores to 0
  4. Set `currentRound` to 1
  5. Store current tick as `roundStartTick`
  6. Select first round challenges (Task 2.4) - uses configured challenge counts
  7. Announce game start to all players
  8. Start timer (Task 2.2)
  9. Initialize HUD display (Task 4.1)
  10. Play start sound: `'raid.horn'`

- **Validation messages**:
  - No teams: `§cTeams must be formed first! Use lr:teamup`
  - Already active: `§cGame is already in progress!`
  - No chests: `§cBounty chests not found! Re-run teamup.`

### Task 2.2: Implement round timer

- **APIs**: `system.runInterval()` + tick counting
- **Implemented by**: `GameStateManager`
- **Duration**: Configurable via `roundDurationTicks` (default: 18,000 ticks = 15 minutes at 20 ticks/second)
- **Storage**: Store `roundStartTick` in dynamic property
- **Calculation**:

```javascript
const config = ConfigManager.getConfig("roundDurationTicks");
const elapsed = system.currentTick - roundStartTick;
const remaining = Math.max(0, config - elapsed);
```

- **Events**: Trigger round transition when `remaining === 0`
- **HUD Integration**: Update via HUD prefix system (Task 4.1)
- **Trigger**: Started by `lr:start` command only

### Task 2.3: Build round transition logic

- **Implemented by**: `GameStateManager`
- **Trigger**: When timer reaches configured round duration
- **Actions**:
  1. Increment `currentRound` (max from config, default 4)
  2. Clear `activeChallenges` array
  3. Clear `completedChallenges` array
  4. Reset `roundStartTick` to current tick
  5. Call challenge selection (Task 2.4)
  6. Announce new round to all players
  7. Update HUD via title prefix (Task 4.1)
  8. Play round transition sound: `'raid.horn'`
- **End game check**: If round > configured max rounds, trigger Task 2.5
- **Does NOT require command**: Automatic progression

### Task 2.4: Implement challenge selection algorithm

- **Implemented by**: `ChallengeManager`
- **Algorithm**:

```javascript
function selectChallenges() {
  const config = ConfigManager.getConfig();
  const easy = getRandomChallenges(CHALLENGES.easy, config.easyChallengeCount);
  const medium = getRandomChallenges(CHALLENGES.medium, config.mediumChallengeCount);
  const hard = getRandomChallenges(CHALLENGES.hard, config.hardChallengeCount);
  return [...easy, ...medium, ...hard];
}
```

- **Requirements**:
  - Use `Math.random()` for selection
  - Ensure no duplicates within round
  - Store selected IDs in `activeChallenges` dynamic property
  - Return array of challenge objects
  - Use configured counts from `ConfigManager`:
    - `easyChallengeCount` (default: 3)
    - `mediumChallengeCount` (default: 2)
    - `hardChallengeCount` (default: 1)
- **Trigger**: Called by start command and round transitions

### Task 2.5: Create game end detection and winner announcement

- **Implemented by**: `GameStateManager`
- **Trigger**: After final round (determined by `totalRounds` config) or manual end command
- **Actions**:
  1. Set `gameActive` to false
  2. Compare `crimsonScore` vs `azureScore`
  3. Determine winner with tie handling
  4. Display winner announcement:
     - Title: `§6§lGAME OVER!`
     - Subtitle: `§c§lCRIMSON WINS!` or `§9§lAZURE WINS!` or `§e§lTIE GAME!`
     - Duration: 100 ticks (5 seconds)
  5. Send final scores to chat
  6. Clear HUD displays
  7. Play victory sound: `'ui.toast.challenge_complete'`
  8. Optional: Fireworks at winning team's chest
- **APIs**: `world.sendMessage()`, `player.onScreenDisplay.setTitle()`
- **Keep teams**: Don't clear `teamsFormed` or player assignments

## Phase 3: Challenge Management

### Task 3.1: Implement challenge state tracking

- **Implemented by**: `ChallengeManager`
- **Data structure** (in-memory):

```javascript
const challengeStates = new Map(); // challengeId -> 'available'|'locked'
```

- **Dynamic property**: `lootRush:completedChallenges` (JSON array)
- **Functions**:
  - `isChallengeAvailable(challengeId)` - check if not in completed list
  - `lockChallenge(challengeId)` - add to completed list
  - `resetChallenges()` - clear on round transition (NOT on game end)

### Task 3.2: Build chest monitoring system

- **Implemented by**: `ChestManager`
- **APIs**:
  - `system.runInterval()` every 10 ticks to check chest contents
  - `world.getDimension().getBlock(location)`
  - `BlockInventoryComponent.container`
- **Polling frequency**: 10 ticks (0.5 seconds)
- **Requirements**:
  - Only run when `gameActive === true`
  - Check both chest locations
  - Get Container component
  - Read all slots
  - Call validation (Task 3.3) on content change
- **Optimization**: Skip if game not active

### Task 3.3: Create item validation function

- **Implemented by**: `ChallengeManager` (called by `ChestManager`)

```javascript
function validateDeposit(container, challenge) {
  let count = 0;
  for (let slot = 0; slot < container.size; slot++) {
    const item = container.getItem(slot);
    if (item && matchesRequirement(item, challenge)) {
      count += item.amount;
    }
  }
  return count >= challenge.count;
}
```

- **APIs**: `Container.getItem()`, `ItemStack.typeId`, `ItemStack.amount`
- **Handle "any" types**: Check item ID against allowed list
- **Return**: boolean or item count

### Task 3.4: Implement challenge completion logic with chest clearing

- **Implemented by**: `ChestManager` (coordinates with `ChallengeManager` and `TeamManager`)

- **Flow**:
  1. Validate items in chest (Task 3.3)
  2. Check challenge still available (Task 3.1)
  3. Award points to team
  4. Lock challenge for both teams
  5. **Clear entire chest inventory**
  6. Trigger announcement (Task 3.5)
- **APIs**:
  - `Container.setItem(slot, undefined)` for each slot to clear
  - Loop through all 27 slots
  - Update `crimsonScore`/`azureScore` dynamic properties
- **Clearing implementation**:

```javascript
for (let i = 0; i < container.size; i++) {
  container.setItem(i, undefined);
}
```

- **Atomic operation**: Ensure no race conditions

### Task 3.5: Add challenge announcement system

- **Implemented by**: `HUDManager` and coordination with `GameStateManager`

- **APIs**:
  - `world.sendMessage()` for chat
  - Update HUD via title prefix system
- **Format**:
  - Chat: `§6[LOOT RUSH] §cCrimson Crusaders completed "Stone Age Stockpile" (+10 pts)`
  - HUD: Update via title prefix (Task 4.1)
- **Timing**: Immediate on completion

## Phase 4: UI & Feedback (Custom HUD with Title Prefix System)

### Task 4.1: Create custom HUD display using title prefix system

- **Approach**: Follow `gem_indicator.json` pattern with custom update prefix
- **Implemented by**: `HUDManager`
- **Resource Pack**: Create `loot_rush_hud.json` in `ui/` folder
- **Update Prefixes**:
  - `update:lr:round:` - Round information
  - `update:lr:timer:` - Round timer
  - `update:lr:challenges:` - Challenge list
  - `update:lr:scores:` - Team scores

- **Resource Pack Implementation** (`ui/loot_rush_hud.json`):

```json
{
  "namespace": "loot_rush_hud",

  "challenge_display": {
    "type": "stack_panel",
    "orientation": "vertical",
    "anchor_from": "top_left",
    "anchor_to": "top_left",
    "offset": [10, 20],
    "controls": [
      {
        "round_label": {
          "$update_string": "update:lr:round:",
          "type": "label",
          "text": "#text",
          "controls": [
            {
              "data_control": {
                "type": "panel",
                "size": [0, 0],
                "bindings": [
                  {
                    "binding_name": "#hud_title_text_string"
                  },
                  {
                    "binding_name": "#hud_title_text_string",
                    "binding_name_override": "#preserved_text",
                    "binding_condition": "visibility_changed"
                  },
                  {
                    "binding_type": "view",
                    "source_property_name": "(not (#hud_title_text_string = #preserved_text) and not ((#hud_title_text_string - $update_string) = #hud_title_text_string))",
                    "target_property_name": "#visible"
                  }
                ]
              }
            }
          ],
          "bindings": [
            {
              "binding_type": "view",
              "source_control_name": "data_control",
              "resolve_sibling_scope": true,
              "source_property_name": "('§z' + (#preserved_text - $update_string))",
              "target_property_name": "#text"
            }
          ]
        }
      },
      {
        "timer_label": {
          "$update_string": "update:lr:timer:",
          "type": "label",
          "text": "#text",
          "color": "$timer_color",
          "controls": [
            {
              "data_control": {
                "type": "panel",
                "size": [0, 0],
                "bindings": [
                  {
                    "binding_name": "#hud_title_text_string"
                  },
                  {
                    "binding_name": "#hud_title_text_string",
                    "binding_name_override": "#preserved_text",
                    "binding_condition": "visibility_changed"
                  },
                  {
                    "binding_type": "view",
                    "source_property_name": "(not (#hud_title_text_string = #preserved_text) and not ((#hud_title_text_string - $update_string) = #hud_title_text_string))",
                    "target_property_name": "#visible"
                  }
                ]
              }
            }
          ],
          "bindings": [
            {
              "binding_type": "view",
              "source_control_name": "data_control",
              "resolve_sibling_scope": true,
              "source_property_name": "('§z' + (#preserved_text - $update_string))",
              "target_property_name": "#text"
            }
          ]
        }
      },
      {
        "score_display": {
          "$update_string": "update:lr:scores:",
          "type": "label",
          "text": "#text",
          "controls": [
            {
              "data_control": {
                "type": "panel",
                "size": [0, 0],
                "bindings": [
                  {
                    "binding_name": "#hud_title_text_string"
                  },
                  {
                    "binding_name": "#hud_title_text_string",
                    "binding_name_override": "#preserved_text",
                    "binding_condition": "visibility_changed"
                  },
                  {
                    "binding_type": "view",
                    "source_property_name": "(not (#hud_title_text_string = #preserved_text) and not ((#hud_title_text_string - $update_string) = #hud_title_text_string))",
                    "target_property_name": "#visible"
                  }
                ]
              }
            }
          ],
          "bindings": [
            {
              "binding_type": "view",
              "source_control_name": "data_control",
              "resolve_sibling_scope": true,
              "source_property_name": "('§z' + (#preserved_text - $update_string))",
              "target_property_name": "#text"
            }
          ]
        }
      }
    ]
  },

  "challenge_list_display": {
    "type": "stack_panel",
    "orientation": "vertical",
    "anchor_from": "top_right",
    "anchor_to": "top_right",
    "offset": [-10, 20],
    "controls": [
      {
        "challenges_header": {
          "$update_string": "update:lr:challenges:header:",
          "type": "label",
          "text": "#text",
          "controls": [
            {
              "data_control": {
                "type": "panel",
                "size": [0, 0],
                "bindings": [
                  {
                    "binding_name": "#hud_title_text_string"
                  },
                  {
                    "binding_name": "#hud_title_text_string",
                    "binding_name_override": "#preserved_text",
                    "binding_condition": "visibility_changed"
                  },
                  {
                    "binding_type": "view",
                    "source_property_name": "(not (#hud_title_text_string = #preserved_text) and not ((#hud_title_text_string - $update_string) = #hud_title_text_string))",
                    "target_property_name": "#visible"
                  }
                ]
              }
            }
          ],
          "bindings": [
            {
              "binding_type": "view",
              "source_control_name": "data_control",
              "resolve_sibling_scope": true,
              "source_property_name": "('§z' + (#preserved_text - $update_string))",
              "target_property_name": "#text"
            }
          ]
        }
      },
      {
        "challenge_slot_0": {
          "$update_string": "update:lr:challenge:0:",
          "type": "label",
          "text": "#text",
          "controls": [
            {
              "data_control": {
                "type": "panel",
                "size": [0, 0],
                "bindings": [
                  {
                    "binding_name": "#hud_title_text_string"
                  },
                  {
                    "binding_name": "#hud_title_text_string",
                    "binding_name_override": "#preserved_text",
                    "binding_condition": "visibility_changed"
                  },
                  {
                    "binding_type": "view",
                    "source_property_name": "(not (#hud_title_text_string = #preserved_text) and not ((#hud_title_text_string - $update_string) = #hud_title_text_string))",
                    "target_property_name": "#visible"
                  }
                ]
              }
            }
          ],
          "bindings": [
            {
              "binding_type": "view",
              "source_control_name": "data_control",
              "resolve_sibling_scope": true,
              "source_property_name": "('§z' + (#preserved_text - $update_string))",
              "target_property_name": "#text"
            }
          ]
        }
      },
      {
        "challenge_slot_1": {
          "$update_string": "update:lr:challenge:1:",
          "type": "label",
          "text": "#text",
          "controls": [
            {
              "data_control": {
                "type": "panel",
                "size": [0, 0],
                "bindings": [
                  {
                    "binding_name": "#hud_title_text_string"
                  },
                  {
                    "binding_name": "#hud_title_text_string",
                    "binding_name_override": "#preserved_text",
                    "binding_condition": "visibility_changed"
                  },
                  {
                    "binding_type": "view",
                    "source_property_name": "(not (#hud_title_text_string = #preserved_text) and not ((#hud_title_text_string - $update_string) = #hud_title_text_string))",
                    "target_property_name": "#visible"
                  }
                ]
              }
            }
          ],
          "bindings": [
            {
              "binding_type": "view",
              "source_control_name": "data_control",
              "resolve_sibling_scope": true,
              "source_property_name": "('§z' + (#preserved_text - $update_string))",
              "target_property_name": "#text"
            }
          ]
        }
      },
      {
        "challenge_slot_2": {
          "$update_string": "update:lr:challenge:2:",
          "type": "label",
          "text": "#text",
          "controls": [
            {
              "data_control": {
                "type": "panel",
                "size": [0, 0],
                "bindings": [
                  {
                    "binding_name": "#hud_title_text_string"
                  },
                  {
                    "binding_name": "#hud_title_text_string",
                    "binding_name_override": "#preserved_text",
                    "binding_condition": "visibility_changed"
                  },
                  {
                    "binding_type": "view",
                    "source_property_name": "(not (#hud_title_text_string = #preserved_text) and not ((#hud_title_text_string - $update_string) = #hud_title_text_string))",
                    "target_property_name": "#visible"
                  }
                ]
              }
            }
          ],
          "bindings": [
            {
              "binding_type": "view",
              "source_control_name": "data_control",
              "resolve_sibling_scope": true,
              "source_property_name": "('§z' + (#preserved_text - $update_string))",
              "target_property_name": "#text"
            }
          ]
        }
      },
      {
        "challenge_slot_3": {
          "$update_string": "update:lr:challenge:3:",
          "type": "label",
          "text": "#text",
          "controls": [
            {
              "data_control": {
                "type": "panel",
                "size": [0, 0],
                "bindings": [
                  {
                    "binding_name": "#hud_title_text_string"
                  },
                  {
                    "binding_name": "#hud_title_text_string",
                    "binding_name_override": "#preserved_text",
                    "binding_condition": "visibility_changed"
                  },
                  {
                    "binding_type": "view",
                    "source_property_name": "(not (#hud_title_text_string = #preserved_text) and not ((#hud_title_text_string - $update_string) = #hud_title_text_string))",
                    "target_property_name": "#visible"
                  }
                ]
              }
            }
          ],
          "bindings": [
            {
              "binding_type": "view",
              "source_control_name": "data_control",
              "resolve_sibling_scope": true,
              "source_property_name": "('§z' + (#preserved_text - $update_string))",
              "target_property_name": "#text"
            }
          ]
        }
      },
      {
        "challenge_slot_4": {
          "$update_string": "update:lr:challenge:4:",
          "type": "label",
          "text": "#text",
          "controls": [
            {
              "data_control": {
                "type": "panel",
                "size": [0, 0],
                "bindings": [
                  {
                    "binding_name": "#hud_title_text_string"
                  },
                  {
                    "binding_name": "#hud_title_text_string",
                    "binding_name_override": "#preserved_text",
                    "binding_condition": "visibility_changed"
                  },
                  {
                    "binding_type": "view",
                    "source_property_name": "(not (#hud_title_text_string = #preserved_text) and not ((#hud_title_text_string - $update_string) = #hud_title_text_string))",
                    "target_property_name": "#visible"
                  }
                ]
              }
            }
          ],
          "bindings": [
            {
              "binding_type": "view",
              "source_control_name": "data_control",
              "resolve_sibling_scope": true,
              "source_property_name": "('§z' + (#preserved_text - $update_string))",
              "target_property_name": "#text"
            }
          ]
        }
      },
      {
        "challenge_slot_5": {
          "$update_string": "update:lr:challenge:5:",
          "type": "label",
          "text": "#text",
          "controls": [
            {
              "data_control": {
                "type": "panel",
                "size": [0, 0],
                "bindings": [
                  {
                    "binding_name": "#hud_title_text_string"
                  },
                  {
                    "binding_name": "#hud_title_text_string",
                    "binding_name_override": "#preserved_text",
                    "binding_condition": "visibility_changed"
                  },
                  {
                    "binding_type": "view",
                    "source_property_name": "(not (#hud_title_text_string = #preserved_text) and not ((#hud_title_text_string - $update_string) = #hud_title_text_string))",
                    "target_property_name": "#visible"
                  }
                ]
              }
            }
          ],
          "bindings": [
            {
              "binding_type": "view",
              "source_control_name": "data_control",
              "resolve_sibling_scope": true,
              "source_property_name": "('§z' + (#preserved_text - $update_string))",
              "target_property_name": "#text"
            }
          ]
        }
      },
      {
        "challenge_slot_6": {
          "$update_string": "update:lr:challenge:6:",
          "type": "label",
          "text": "#text",
          "controls": [
            {
              "data_control": {
                "type": "panel",
                "size": [0, 0],
                "bindings": [
                  {
                    "binding_name": "#hud_title_text_string"
                  },
                  {
                    "binding_name": "#hud_title_text_string",
                    "binding_name_override": "#preserved_text",
                    "binding_condition": "visibility_changed"
                  },
                  {
                    "binding_type": "view",
                    "source_property_name": "(not (#hud_title_text_string = #preserved_text) and not ((#hud_title_text_string - $update_string) = #hud_title_text_string))",
                    "target_property_name": "#visible"
                  }
                ]
              }
            }
          ],
          "bindings": [
            {
              "binding_type": "view",
              "source_control_name": "data_control",
              "resolve_sibling_scope": true,
              "source_property_name": "('§z' + (#preserved_text - $update_string))",
              "target_property_name": "#text"
            }
          ]
        }
      },
      {
        "challenge_slot_7": {
          "$update_string": "update:lr:challenge:7:",
          "type": "label",
          "text": "#text",
          "controls": [
            {
              "data_control": {
                "type": "panel",
                "size": [0, 0],
                "bindings": [
                  {
                    "binding_name": "#hud_title_text_string"
                  },
                  {
                    "binding_name": "#hud_title_text_string",
                    "binding_name_override": "#preserved_text",
                    "binding_condition": "visibility_changed"
                  },
                  {
                    "binding_type": "view",
                    "source_property_name": "(not (#hud_title_text_string = #preserved_text) and not ((#hud_title_text_string - $update_string) = #hud_title_text_string))",
                    "target_property_name": "#visible"
                  }
                ]
              }
            }
          ],
          "bindings": [
            {
              "binding_type": "view",
              "source_control_name": "data_control",
              "resolve_sibling_scope": true,
              "source_property_name": "('§z' + (#preserved_text - $update_string))",
              "target_property_name": "#text"
            }
          ]
        }
      },
      {
        "challenge_slot_8": {
          "$update_string": "update:lr:challenge:8:",
          "type": "label",
          "text": "#text",
          "controls": [
            {
              "data_control": {
                "type": "panel",
                "size": [0, 0],
                "bindings": [
                  {
                    "binding_name": "#hud_title_text_string"
                  },
                  {
                    "binding_name": "#hud_title_text_string",
                    "binding_name_override": "#preserved_text",
                    "binding_condition": "visibility_changed"
                  },
                  {
                    "binding_type": "view",
                    "source_property_name": "(not (#hud_title_text_string = #preserved_text) and not ((#hud_title_text_string - $update_string) = #hud_title_text_string))",
                    "target_property_name": "#visible"
                  }
                ]
              }
            }
          ],
          "bindings": [
            {
              "binding_type": "view",
              "source_control_name": "data_control",
              "resolve_sibling_scope": true,
              "source_property_name": "('§z' + (#preserved_text - $update_string))",
              "target_property_name": "#text"
            }
          ]
        }
      },
      {
        "challenge_slot_9": {
          "$update_string": "update:lr:challenge:9:",
          "type": "label",
          "text": "#text",
          "controls": [
            {
              "data_control": {
                "type": "panel",
                "size": [0, 0],
                "bindings": [
                  {
                    "binding_name": "#hud_title_text_string"
                  },
                  {
                    "binding_name": "#hud_title_text_string",
                    "binding_name_override": "#preserved_text",
                    "binding_condition": "visibility_changed"
                  },
                  {
                    "binding_type": "view",
                    "source_property_name": "(not (#hud_title_text_string = #preserved_text) and not ((#hud_title_text_string - $update_string) = #hud_title_text_string))",
                    "target_property_name": "#visible"
                  }
                ]
              }
            }
          ],
          "bindings": [
            {
              "binding_type": "view",
              "source_control_name": "data_control",
              "resolve_sibling_scope": true,
              "source_property_name": "('§z' + (#preserved_text - $update_string))",
              "target_property_name": "#text"
            }
          ]
        }
      }
    ]
  }
}
```

- **Script Side** (Update HUD via setTitle):

```javascript
function updateHUD(player) {
  if (!gameActive) return;

  const config = ConfigManager.getConfig();
  const currentRound = GameStateManager.getCurrentRound();
  const totalRounds = config.totalRounds;

  // Update round info (top-left)
  player.onScreenDisplay.setTitle(`update:lr:round:§6Round ${currentRound} of ${totalRounds}`);

  // Update timer (top-left)
  const timeStr = getFormattedTime();
  player.onScreenDisplay.setTitle(`update:lr:timer:${timeStr}`);

  // Update scores (top-left)
  const scores = `§cCrimson: ${crimsonScore} §9Azure: ${azureScore}`;
  player.onScreenDisplay.setTitle(`update:lr:scores:${scores}`);

  // Update challenge list header (top-right)
  player.onScreenDisplay.setTitle(`update:lr:challenges:header:§6§lCHALLENGES`);

  // Update individual challenge slots (top-right)
  const challenges = ChallengeManager.getActiveChallenges();
  for (let i = 0; i < 10; i++) {
    if (i < challenges.length) {
      const challenge = challenges[i];
      const status = ChallengeManager.isCompleted(challenge.id)
        ? `§a✓ ${challenge.name} §7(Claimed)`
        : `§f○ ${challenge.name} §e(${challenge.points}pts)`;
      player.onScreenDisplay.setTitle(`update:lr:challenge:${i}:${status}`);
    } else {
      // Clear unused slots
      player.onScreenDisplay.setTitle(`update:lr:challenge:${i}:`);
    }
  }
}

// Run every 20 ticks
system.runInterval(() => {
  if (gameActive) {
    world.getAllPlayers().forEach(updateHUD);
  }
}, 20);
```

- **Challenge List Format**:

```javascript
function formatChallengeList() {
  let text = "";
  activeChallenges.forEach((challenge) => {
    const status = isCompleted(challenge.id)
      ? `§a✓ ${challenge.name} §7(Team)`
      : `§f○ ${challenge.name} §e${challenge.points}pts`;
    text += status + "\n";
  });
  return text;
}
```

- **Timer Format**:

```javascript
function getFormattedTime() {
  const elapsed = system.currentTick - roundStartTick;
  const remaining = Math.max(0, 18000 - elapsed);
  const minutes = Math.floor(remaining / 1200);
  const seconds = Math.floor((remaining % 1200) / 20);
  const timeStr = `${minutes}:${seconds.toString().padStart(2, "0")}`;

  // Color based on time remaining
  const color = remaining < 600 ? "§c" : remaining < 1200 ? "§6" : "§e";
  return `${color}${timeStr}`;
}
```

- **Update Frequency**: Every 20 ticks (1 second)
- **Only update when `gameActive === true`**

### Task 4.2: Modify hud_screen.json to include custom HUD

- **File**: Resource Pack `ui/hud_screen.json`
- **Modification**: Add both loot_rush_hud panels to controls

```json
{
  "loot_rush_left_display@loot_rush_hud.challenge_display": {
    "ignored": "(not $loot_rush_active)"
  },
  "loot_rush_right_display@loot_rush_hud.challenge_list_display": {
    "ignored": "(not $loot_rush_active)"
  }
}
```

- **Visibility**: Control via game state variable

### Task 4.3: Implement challenge completion notifications

- **APIs**:
  - `world.sendMessage()` for all players
  - `player.playSound('random.levelup')` for completing team
  - `player.playSound('note.bass')` for opposing team
- **Message format**: Include team color, challenge name, points
- **Visual**: Particle effect at chest location
- **APIs**: `dimension.spawnParticle('minecraft:totem_particle', location)`
- **Also update HUD**: Trigger immediate HUD refresh

### Task 4.4: Build scoreboard for team points (Optional)

- **APIs**:
  - `world.scoreboard.addObjective()`
  - `objective.setScore(participant, score)`
- **Objective name**: "lootRush"
- **Display slot**: Sidebar (optional, since HUD shows scores)
- **Participants**:
  - "§cCrimson"
  - "§9Azure"
- **Update**: After each challenge completion
- **Note**: May be redundant with HUD display

### Task 4.5: Timer warning sounds

- **Implementation**: Check time remaining every second
- **Warning thresholds**:
  - 60 seconds: Play `'note.pling'`
  - 30 seconds: Play `'note.harp'` with higher pitch
  - 10 seconds: Play `'note.bass'` every second
- **Update timer color**: As shown in Task 4.1

## Phase 5: Admin & Testing

### Task 5.1: Create admin commands using Custom Commands API

- **Command Registration** (all in `system.beforeEvents.startup`):

```javascript
system.beforeEvents.startup.subscribe(({ customCommandRegistry }) => {
  // Team formation
  customCommandRegistry.registerCommand(
    {
      name: "lr:teamup",
      description: "Forms teams and places bounty chests",
      permissionLevel: CommandPermissionLevel.GameDirectors,
      cheatsRequired: false,
    },
    teamFormationHandler
  );

  // Start game
  customCommandRegistry.registerCommand(
    {
      name: "lr:start",
      description: "Starts the Loot Rush challenge",
      permissionLevel: CommandPermissionLevel.GameDirectors,
      cheatsRequired: false,
    },
    startGameHandler
  );

  // End game
  customCommandRegistry.registerCommand(
    {
      name: "lr:end",
      description: "Ends the current game",
      permissionLevel: CommandPermissionLevel.GameDirectors,
      cheatsRequired: false,
    },
    endGameHandler
  );

  // Force round
  customCommandRegistry.registerCommand(
    {
      name: "lr:forceround",
      description: "Jump to specific round",
      permissionLevel: CommandPermissionLevel.GameDirectors,
      mandatoryParameters: [
        {
          name: "round",
          type: CustomCommandParamType.Integer,
        },
      ],
      cheatsRequired: false,
    },
    forceRoundHandler
  );

  // Reset game
  customCommandRegistry.registerCommand(
    {
      name: "lr:reset",
      description: "Reset entire game state",
      permissionLevel: CommandPermissionLevel.GameDirectors,
      cheatsRequired: false,
    },
    resetGameHandler
  );

  // Set score
  customCommandRegistry.registerCommand(
    {
      name: "lr:setscore",
      description: "Set team score",
      permissionLevel: CommandPermissionLevel.GameDirectors,
      mandatoryParameters: [
        {
          name: "team",
          type: CustomCommandParamType.String,
        },
        {
          name: "points",
          type: CustomCommandParamType.Integer,
        },
      ],
      cheatsRequired: false,
    },
    setScoreHandler
  );

  // Pause
  customCommandRegistry.registerCommand(
    {
      name: "lr:pause",
      description: "Pause the game",
      permissionLevel: CommandPermissionLevel.GameDirectors,
      cheatsRequired: false,
    },
    pauseGameHandler
  );

  // Resume
  customCommandRegistry.registerCommand(
    {
      name: "lr:resume",
      description: "Resume the game",
      permissionLevel: CommandPermissionLevel.GameDirectors,
      cheatsRequired: false,
    },
    resumeGameHandler
  );

  // Debug toggle
  customCommandRegistry.registerCommand(
    {
      name: "lr:debug",
      description: "Toggle debug mode",
      permissionLevel: CommandPermissionLevel.GameDirectors,
      mandatoryParameters: [
        {
          name: "enabled",
          type: CustomCommandParamType.Boolean,
        },
      ],
      cheatsRequired: false,
    },
    debugToggleHandler
  );

  // Configuration commands
  customCommandRegistry.registerCommand(
    {
      name: "lr:config",
      description: "View current configuration",
      permissionLevel: CommandPermissionLevel.GameDirectors,
      cheatsRequired: false,
    },
    configViewHandler
  );

  customCommandRegistry.registerCommand(
    {
      name: "lr:config:set",
      description: "Set configuration value",
      permissionLevel: CommandPermissionLevel.GameDirectors,
      mandatoryParameters: [
        {
          name: "key",
          type: CustomCommandParamType.String,
        },
        {
          name: "value",
          type: CustomCommandParamType.Integer,
        },
      ],
      cheatsRequired: false,
    },
    configSetHandler
  );

  customCommandRegistry.registerCommand(
    {
      name: "lr:config:reset",
      description: "Reset configuration to defaults",
      permissionLevel: CommandPermissionLevel.GameDirectors,
      cheatsRequired: false,
    },
    configResetHandler
  );
});
```

- **Permission**: All commands use `CommandPermissionLevel.GameDirectors` (Operator level 1+)
- **Validation**: Parse arguments, check ranges, verify prerequisites
- **Return**: Use `CustomCommandStatus.Success` or `CustomCommandStatus.Failure`

### Task 5.1b: Implement configuration commands

- **Implemented by**: `CommandHandler` (delegates to `ConfigManager`)
- **Commands**:
  - `lr:config` - Display current configuration values
  - `lr:config:set <key> <value>` - Set a configuration value
  - `lr:config:reset` - Reset to default configuration

- **Configurable values**:
  - `easyChallengeCount` - Number of easy challenges per round (default: 3)
  - `mediumChallengeCount` - Number of medium challenges per round (default: 2)
  - `hardChallengeCount` - Number of hard challenges per round (default: 1)
  - `totalRounds` - Total number of rounds in game (default: 4)
  - `roundDurationTicks` - Duration of each round in ticks (default: 18000 = 15 minutes)

- **`lr:config` behavior**:
  - Display all current configuration values in formatted message
  - Show both current value and default value
  - Example output:
    ```
    §6=== Loot Rush Configuration ===
    §eEasy Challenges: §f3 §7(default: 3)
    §eMedium Challenges: §f2 §7(default: 2)
    §eHard Challenges: §f1 §7(default: 1)
    §eTotal Rounds: §f4 §7(default: 4)
    §eRound Duration: §f18000 ticks §7(15:00 minutes)
    ```

- **`lr:config:set <key> <value>` behavior**:
  - Validate key exists in configuration
  - Validate value is appropriate for the key:
    - Challenge counts: 1-10
    - Total rounds: 1-10
    - Duration ticks: 1200-72000 (1 minute to 1 hour)
  - Update configuration in ConfigManager
  - Persist to dynamic properties
  - Send confirmation message
  - **Prevent changes during active game** - must end game first
  - Example: `lr:config:set totalRounds 6`

- **`lr:config:reset` behavior**:
  - Reset all configuration values to defaults
  - Persist to dynamic properties
  - Send confirmation message
  - **Prevent during active game**

- **Validation messages**:
  - Invalid key: `§cInvalid configuration key: <key>. Valid keys: easyChallengeCount, mediumChallengeCount, hardChallengeCount, totalRounds, roundDurationTicks`
  - Invalid value: `§cInvalid value for <key>. Must be between <min> and <max>.`
  - Active game: `§cCannot change configuration during active game. Use lr:end first.`
  - Success: `§aConfiguration updated: <key> = <value>`
  - Reset success: `§aConfiguration reset to defaults.`

### Task 5.2: Implement player join/leave handling with name coloring

- **Implemented by**: `TeamManager`
- **APIs**:
  - `world.afterEvents.playerSpawn.subscribe()` for joins
  - `world.afterEvents.playerLeave.subscribe()` for leaves
- **Actions on join** (if teams formed):
  - Check if player in team roster
  - Apply team color to `player.nameTag`
  - Set spawn point to center
  - Show current game state if active
  - Send HUD updates
- **Actions on join** (if teams NOT formed):
  - Normal spawn behavior
  - No team assignment
- **Name coloring implementation**:

```javascript
function applyTeamColor(player) {
  const team = getPlayerTeam(player);
  if (!team) return;
  const prefix = team === "crimson" ? "§c" : "§9";
  player.nameTag = `${prefix}${player.name}`;
}
```

- **Actions on leave**: Keep in roster for rejoins
- **Late joiners**: Cannot join after teams formed (or assign to smaller team)

### Task 5.3: Add game pause/resume functionality

- **Implemented by**: `GameStateManager`
- **Commands**: `lr:pause`, `lr:resume`
- **Dynamic property**: `lootRush:gamePaused` (boolean), `lootRush:pausedAtTick` (number)
- **Behavior**:
  - **Pause**:
    - Store current tick
    - Set paused flag
    - Stop chest monitoring
    - Update HUD to show "PAUSED"
  - **Resume**:
    - Calculate paused duration
    - Adjust `roundStartTick` to add paused time
    - Clear paused flag
    - Resume normal operation
- **HUD update**: Show "§c§lPAUSED" in timer area

### Task 5.4: Build debug logging

- **APIs**: `console.warn()`, `console.log()`
- **Log events**:
  - Team assignments
  - Challenge validations (passed/failed)
  - Item counts found in chests
  - Score updates
  - Round transitions
  - Chest clearing operations
  - HUD updates (if verbose)
- **Toggle**: `lootRush:debugMode` dynamic property
- **Command**: `lr:debug <true|false>`
- **Output**: Content log (server console)

### Task 5.5: Implement reset command

- **Command**: `lr:reset`
- **Actions**:
  1. Set `gameActive` to false
  2. Set `teamsFormed` to false
  3. Clear all team rosters
  4. Reset scores to 0
  5. Clear challenge lists
  6. Reset round to 0
  7. Remove player name tag colors (reset to default)
  8. Clear HUD displays
  9. Optional: Remove bounty chests
  10. Send confirmation message
- **Use case**: Start fresh with new teams
- **Return**: `CustomCommandStatus.Success`

## Phase 6: Polish & Edge Cases

### Task 6.1: Handle partial item deposits (ignore, chest cleared on completion only)

- **Decision**: Only check if requirement met, ignore partial
- **Implementation**:
  - Validation returns true/false, no partial credit
  - Items remain in chest until challenge completed
  - On completion: full chest clear (Task 3.4)
- **Edge case**: Overfilled chest handled by slot iteration

### Task 6.2: Implement anti-cheat for chest access

- **APIs**: `world.beforeEvents.playerInteractWithBlock.subscribe()`
- **Check**:

```javascript
const playerTeam = getPlayerTeam(player);
const chestTeam = getChestTeam(block.location);
if (playerTeam !== chestTeam) {
  event.cancel = true;
  player.sendMessage("§cYou cannot access the other team's chest!");
  player.playSound("note.bass");
}
```

- **Only enforce when teams formed**

### Task 6.3: Add grace period for simultaneous deposits

- **Problem**: Two teams deposit within same tick
- **Solution**:
  - First completion wins (atomic write to dynamic property)
  - No grace period - first validation pass locks challenge
- **Implementation**: Use tick-accurate checking

### Task 6.4: Create backup/restore system

- **Commands**: `lr:backup`, `lr:restore` (add to Task 5.1)
- **Storage**:
  - Copy all dynamic properties to backup set
  - `lootRush:backup_<propertyName>` format
  - Store backup timestamp
- **Restore**:
  - Copy backup properties back to active
  - Reload game state
  - Reapply team colors
  - Restart current round if game active
- **Use case**: Recover from bugs or rollback

### Task 6.5: Add sound effects and visual feedback

- **Events**:
  - **Team formation shuffle**: `'random.click'` each shuffle (every 10 ticks during animation)
  - **Team reveal**: `'ui.toast.challenge_complete'`
  - **Challenge start**: `'raid.horn'` to all players
  - **Challenge complete**:
    - Winning team: `'random.levelup'`
    - Other team: No sound
    - Particles: `'minecraft:totem_particle'` at chest
  - **Round transition**: `'raid.horn'`
  - **Timer warnings**:
    - 60 seconds: `'note.bell'` at pitch 1.0
    - 30 seconds: `'note.bell'` at pitch 2.0
    - 10 seconds: `'note.xylobone'` at pitch 2.0 (every second)
  - **Invalid deposit**: `'note.bass'`
  - **Chest access denied**: `'note.bass'`
  - **Game end**: `'ui.toast.challenge_complete'` + fireworks

### Task 6.6: Prevent bounty chest name tag clearing

- **Issue**: Chest names may reset on chunk reload
- **Solution**:
  - Reapply names on periodic check
  - Use `system.runInterval()` every 600 ticks (30s)
- **Fallback**: Visual indicators (colored blocks nearby)

### Task 6.7: Handle odd number of players in team formation

- **Solution**: Allow uneven teams (Math.floor for division)
- **Announce**: Include team sizes in roster display
- **Example**: 5 players → 3 Crimson, 2 Azure

### Task 6.8: Prevent team formation during active game

- **Validation**: Check `gameActive` flag
- **Message**: `§cCannot form teams while game is active! Use lr:end first.`
- **Return**: `CustomCommandStatus.Failure`

### Task 6.9: Prevent challenge start without teams

- **Validation**: Check `teamsFormed` flag
- **Message**: `§cTeams must be formed first! Use lr:teamup`
- **Return**: `CustomCommandStatus.Failure`

---

## Command Flow Summary

### Initial Setup Flow:

1. **Admin**: `lr:teamup`
   - Assigns players to teams randomly
   - Shows 1.5-second shuffle animation (5 tick intervals)
   - Reveals actual teams
   - Places bounty chests
   - Sets spawn points
   - Applies name tag colors

2. **Admin**: `lr:start`
   - Validates teams are formed
   - Starts round timer
   - Selects first round challenges
   - Activates HUD display with prefix system
   - Begins chest monitoring

3. **Automatic**: Round transitions every 15 minutes
   - New challenges selected
   - Timer resets
   - Previous challenges voided
   - HUD updates automatically

4. **Automatic**: Game ends after round 4
   - Winner announced
   - Final scores displayed
   - Teams persist for rematch

### Reset Flow:

- **Admin**: `lr:reset` - Complete restart (clears teams)
- **Admin**: `lr:end` - Stop game, keep teams
- **Admin**: `lr:teamup` - Reform teams (requires end/reset first)

---

## HUD Update Prefix Summary

| Prefix                         | Purpose               | Position  | Example                                        |
| ------------------------------ | --------------------- | --------- | ---------------------------------------------- |
| `update:lr:round:`             | Round information     | Top-left  | `update:lr:round:§6Round 2 of 4`               |
| `update:lr:timer:`             | Round timer           | Top-left  | `update:lr:timer:§e12:34`                      |
| `update:lr:scores:`            | Team scores           | Top-left  | `update:lr:scores:§cCrimson: 45 §9Azure: 30`   |
| `update:lr:challenges:header:` | Challenge list header | Top-right | `update:lr:challenges:header:§6§lCHALLENGES`   |
| `update:lr:challenge:0:`       | Challenge slot 0      | Top-right | `update:lr:challenge:0:§f○ Stone Age (10pts)`  |
| `update:lr:challenge:1:`       | Challenge slot 1      | Top-right | `update:lr:challenge:1:§a✓ Iron Man (Claimed)` |
| `update:lr:challenge:2-9:`     | Challenge slots 2-9   | Top-right | Same format as slots 0-1                       |

---

## Dependencies

- @minecraft/server@2.4.0
- Minecraft Bedrock 1.21.130
- Behavior pack manifest with `script` module enabled
- Resource pack with custom HUD files (`loot_rush_hud.json`, modified `hud_screen.json`)

## Testing Checklist

- Minimum 2 players for team testing
- Test team shuffle animation (10 tick intervals, 200 ticks total)
- Verify team reveal animation (90 ticks)
- Verify name colors persist after respawn
- Test chest clearing on completion
- Confirm HUD displays correctly with prefix system
- Test HUD updates (round info, timer, challenges, scores)
- Test odd number of players
- Verify prerequisite checks (teamup before start)
- Test pause/resume affects timer correctly
- Confirm chest access restrictions work
- Verify Custom Commands work with GameDirectors permission
- Test configuration commands (lr:config, lr:config:set, lr:config:reset)
- Verify configuration changes are persisted
- Confirm configuration cannot be changed during active game
