## Loot Rush Mechanics

### **Core Rules**

- **Duration**: Configurable (default: 1 hour total, 4 rounds × 15 minutes)
- **Teams**: 2 teams competing simultaneously
  - **Crimson Crusaders** (Red Team)
  - **Azure Architects** (Blue Team)
- **Win Condition**: Highest total points after all rounds

### **Game Configuration**

The game can be configured using admin commands before starting:

- **Challenge Distribution**:
  - Easy challenges per round (default: 6, max: 10)
  - Medium challenges per round (default: 3, max: 10)
  - Hard challenges per round (default: 1, max: 10)
  - **Total challenges per round**: Maximum of 10 (combined across all difficulties)
- **Game Length**:
  - Total rounds (default: 4)
  - Round duration in minutes (default: 15 minutes)
- **Round Progression**:
  - Auto next round (default: false) - Automatically start next round when all challenges are completed

**Configuration Commands** (must be set before game starts):

- `lr:config` - View current settings
- `lr:configset <key> <value>` - Modify a setting
- `lr:configreset` - Reset to defaults

**Example**: To create a shorter game with more challenges and auto-progression:

```
lr:configset totalRounds 3
lr:configset roundDurationTicks 12000
lr:configset easyChallengeCount 5
lr:configset mediumChallengeCount 3
lr:configset hardChallengeCount 2
lr:configset autoNextRound true
```

**Important**: The total number of challenges (easy + medium + hard) cannot exceed 10 per round due to HUD display limitations. If your configuration exceeds this limit, only the first 10 challenges will be displayed and tracked.

### **Setup Phase**

**Team Formation (`lr:teamup`)**

1. Admin executes team formation command
2. All online players are randomly shuffled and split into two teams
3. Team reveal animation:
   - 10 seconds of shuffling display (teams alternate rapidly)
   - 4.5 seconds showing final team assignment
4. Bounty chests automatically placed at spawn (3 blocks apart)
5. Player spawn points set to center location
6. Player name tags colored (Red for Crimson, Blue for Azure)

**Game Start (`lr:start`)**

1. Admin starts the challenge timer
2. Round 1 begins with random challenges (default: 6 total)
3. HUD displays round info, timer, challenges, and scores
4. Countdown starts (default: 15 minutes)

### **Round Structure**

Each round (default duration: 15 minutes):

1. New **Challenge List** appears (random challenges based on configuration)
2. Previous challenges are voided—items in chests no longer count
3. Teams race to complete new challenges first
4. First team to deposit required items gets the points
5. Completed challenges become locked for both teams
6. Chest is automatically cleared upon challenge completion
7. Round ends when timer expires OR when all challenges are completed (if auto next round is enabled)

**Configuration affects**:

- Number of challenges per difficulty level
- Total number of rounds in the game
- Duration of each round
- Whether rounds automatically advance when all challenges are completed

### **HUD Display**

**Custom HUD shows:**

- **Round Info**: Current round and total (e.g., "Round 2 of 4")
- **Timer**: Countdown in MM:SS format
  - Yellow text: Normal (>2 minutes)
  - Gold text: Warning (1-2 minutes)
  - Red text: Critical (<1 minute)
- **Challenge List**: Up to 10 active challenges with status (displayed in top-right corner)
  - ○ White: Available
  - ✓ Green: Completed (shows which team)
  - Each challenge displayed on its own line for clarity
- **Scores**: Current team points
  - Red: Crimson Crusaders score
  - Blue: Azure Architects score

**Update System**: HUD refreshes every second automatically

### **Point System by Difficulty**

**Easy (10-20 points)**

- Common blocks: 32 cobblestone, 16 oak logs, 4 iron ore
- Basic food: 8 bread, 8 cooked meat

**Medium (25-45 points)**

- Mob drops: 4 gunpowder, 3 ender pearls, 4 spider eyes
- Processed materials: 2 iron blocks, diamond pickaxe, 4 bookshelves

**Hard (50-75 points)**

- Rare items: enchanted book, golden apple, name tag
- Village loot: 8 emeralds, totem of undying, bell
- Ocean items: heart of the sea, trident, nautilus shell

### **Deposit System**

- Each team has designated **Bounty Chest** at spawn (color-coded)
  - **Crimson Bounty** (West, -3 blocks from center)
  - **Azure Bounty** (East, +3 blocks from center)
- Chests are unbreakable and protected from explosions
- Players can only access their own team's chest
- Items must be placed in chest to register
- Automatic validation checks chest contents every half second
- Completed challenges announced immediately to both teams via chat
- **Chest auto-clears** all items upon successful challenge completion

### **Strategic Elements**

- Teams must prioritize high-value vs. achievable challenges
- Resource management across rounds (save rare finds or use immediately?)
- Split team for parallel gathering or focus together?
- Exploration vs. exploitation trade-offs each round
- Configuration affects number of available challenges per round
- Challenge completion race—first team wins the points
- Adapt strategy based on configured round duration and total rounds

### **Sample Round**

**Default Configuration (Round 1 Challenges):**

- Stone Age Stockpile: 32 Cobblestone (10 pts) ✓ Crimson - 10 pts awarded, locked
- Miner's First Strike: 8 Coal (12 pts) ✓ Azure - 12 pts awarded, locked
- Iron Seeker: 4 Iron Ore (18 pts) - Still available
- Creeper's Gift: 4 Gunpowder (35 pts) - Still available
- Iron Forged: 2 Iron Blocks (32 pts) - Still available
- Golden Delicacy: 1 Golden Apple (60 pts) - Still available

**Total Available: 179 points** (6 Easy + 3 Medium + 1 Hard = 10 challenges)

**With Custom Configuration** (e.g., 6 Easy, 3 Medium, 1 Hard):

- 10 total challenges displayed in HUD
- More challenges available per round
- Higher total points possible
- More strategic choices for teams

**Note**: If you configure more than 10 total challenges, only the first 10 selected will be displayed and tracked. Configure your challenge counts to total 10 or fewer for optimal gameplay.

### **Admin Commands**

All commands require **GameDirectors** permission (Operator level 1+):

**Game Control**:

- `lr:teamup` - Form teams with reveal animation and chest placement
- `lr:start` - Start the challenge timer and first round
- `lr:end` - End the current game (keeps teams intact)
- `lr:reset` - Complete reset (clears teams and all game state)

**Configuration** (use before starting game):

- `lr:config` - View current configuration settings
- `lr:configset <key> <value>` - Set a configuration value
  - Keys: `easyChallengeCount`, `mediumChallengeCount`, `hardChallengeCount`, `totalRounds`, `roundDurationTicks`, `autoNextRound`
  - **Recommended**: Keep total challenges (easy + medium + hard) at 10 or fewer
- `lr:configreset` - Reset all settings to defaults

**Game Management**:

- `lr:pause` - Pause the game timer
- `lr:resume` - Resume the game timer
- `lr:forceround <1-N>` - Jump to a specific round
- `lr:setscore <crimson|azure> <points>` - Manually adjust team score

**Debug & Utilities**:

- `lr:debug <true|false>` - Toggle debug logging
- `lr:givebook` - Give challenges book to all players

### **Game Flow**

1. **Configuration** (Optional): Admin adjusts settings via `lr:configset`
2. **Setup**: Admin runs `lr:teamup` to form teams and place chests
3. **Start**: Admin runs `lr:start` to begin Round 1
4. **Rounds**: Auto-transitions every round based on configured duration
5. **End**: After final round, winner announced automatically
6. **Rematch**: Teams persist—run `lr:start` again or `lr:reset` for new teams

### **Audio Feedback**

- **Team shuffle**: random.click each shuffle during animation
- **Team reveal**: Challenge complete sound
- **Round start**: Raid horn
- **Challenge completed**: Level up sound (winning team), none (other team)
- **Round transition**: Raid horn
- **Timer warnings**:
  - 60 seconds: Note bell at pitch 1.0
  - 30 seconds: Note bell at pitch 2.0
  - 10 seconds: Note xylobone at pitch 2.0 (every second)
- **Chest access denied**: Note bass
- **Game end**: Challenge complete sound + fireworks

### **Visual Effects**

- **Challenge completion**: Totem particles at bounty chest
- **Team name colors**: Red (Crimson), Blue (Azure) in name tags
- **Game end**: Fireworks at winning team's chest

## Challenge Pool (Overworld Only)

### **Easy Challenges (10-20 points)**

- **Stone Age Stockpile**: 32 Cobblestone (10 pts)
- **Lumberjack's Load**: 16 Logs (any wood) (12 pts)
- **Farmer's Bounty**: 8 Bread (15 pts)
- **Miner's First Strike**: 8 Coal (12 pts)
- **Wool Gatherer**: 8 Wool (any color) (15 pts)
- **Hunter's Feast**: 8 Cooked Meat (any type) (15 pts)
- **Iron Seeker**: 4 Iron Ore (18 pts)
- **Builder's Cache**: 32 Planks (any wood) (10 pts)
- **Dirt Digger**: 32 Dirt/Grass Blocks (10 pts)
- **Clay Collector**: 8 Clay Balls (15 pts)
- **Sand Hauler**: 16 Sand (12 pts)
- **Flower Power**: 6 Different Flowers (18 pts)
- **Gravel Grab**: 16 Gravel (12 pts)
- **Bone Collector**: 4 Bones (15 pts)
- **String Theory**: 6 String (18 pts)

### **Medium Challenges (25-45 points)**

- **Creeper's Gift**: 4 Gunpowder (35 pts)
- **Enderman's Pearls**: 3 Ender Pearls (40 pts)
- **Spider's Silk**: 4 Spider Eyes (30 pts)
- **Iron Forged**: 2 Iron Blocks (32 pts)
- **Diamond Toolsmith**: 1 Diamond Pickaxe (40 pts)
- **Librarian's Pride**: 4 Bookshelves (35 pts)
- **Redstone Engineer**: 16 Redstone Dust (30 pts)
- **Golden Ingots**: 2 Gold Ingots (38 pts)
- **Slime Hunter**: 2 Slimeballs (42 pts)
- **Enchanter's Start**: 1 Enchanting Table (45 pts)
- **Treasure Map**: 1 Map (40 pts)
- **Melon Merchant**: 8 Melons (28 pts)
- **Pumpkin Patch**: 4 Carved Pumpkins (30 pts)
- **Leather Worker**: 4 Leather (32 pts)
- **Phantom Membrane**: 1 Phantom Membrane (45 pts)

### **Hard Challenges (50-75 points)**

- **Enchanted Knowledge**: 1 Enchanted Book (any) (55 pts)
- **Golden Delicacy**: 1 Golden Apple (60 pts)
- **Village Vault**: 8 Emeralds (65 pts)
- **Mob Tamer**: 1 Name Tag (70 pts)
- **Music Disc Hunter**: 1 Music Disc (any) (65 pts)
- **Diamond Fortune**: 3 Diamonds (60 pts)
- **Totem Raid**: 1 Totem of Undying (75 pts)
- **Horse Trader**: 1 Saddle (55 pts)
- **Ocean's Heart**: 1 Heart of the Sea (70 pts)
- **Trident Bearer**: 1 Trident (75 pts)
- **Bell Ringer**: 1 Bell (50 pts)
- **Nautilus Shell**: 1 Nautilus Shell (60 pts)

### **Round Selection Formula**

Each round randomly selects challenges based on configuration:

**Default Configuration**:

- **6 Easy** (10-20 pts)
- **3 Medium** (25-45 pts)
- **1 Hard** (50-75 pts)
- **Total**: 10 challenges, ~200-350 points available per round

**Customizable via commands**:

- Use `lr:configset easyChallengeCount <number>` to change easy count (0-10)
- Use `lr:configset mediumChallengeCount <number>` to change medium count (0-10)
- Use `lr:configset hardChallengeCount <number>` to change hard count (0-10)
- **Maximum total**: 10 challenges per round (HUD limitation)

**Recommended Configurations**:

- **Beginner Friendly**: 8 Easy, 2 Medium, 0 Hard (10 total)
- **Balanced**: 5 Easy, 3 Medium, 2 Hard (10 total)
- **Expert Mode**: 3 Easy, 3 Medium, 4 Hard (10 total)
- **Speed Round**: 4 Easy, 1 Medium, 0 Hard (5 total, fewer challenges for shorter games)

This ensures balanced difficulty across all rounds while keeping gameplay in the overworld and maintaining a clean HUD display.

### **Requirements**

- **Minecraft Bedrock**: 1.21.130 or higher
- **Required Packs**: Loot Rush Behavior Pack + Resource Pack
- **Permissions**: Operator level 1+ for admin commands
- **Minimum Players**: 2 (supports uneven team sizes)
