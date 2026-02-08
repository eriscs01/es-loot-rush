---
page_type: minecraft_addon
author: eriscs01
description: Loot Rush - A competitive team-based challenge game for Minecraft Bedrock Edition
languages:
  - typescript
products:
  - minecraft
---

# Loot Rush - Competitive Team Challenge Game

**Loot Rush** is a fast-paced, team-based competitive addon for Minecraft Bedrock Edition where two teams race against the clock to complete resource gathering challenges. Teams compete across multiple timed rounds, earning points by being the first to deposit required items into their bounty chests.

## 🎮 Game Overview

- **Teams**: 2 teams (Crimson Crusaders vs Azure Architects)
- **Duration**: Configurable (default: 4 rounds × 15 minutes = 1 hour)
- **Win Condition**: Highest total points after all rounds
- **Gameplay**: Teams race to complete randomly selected challenges each round
- **Strategy**: Balance risk vs. reward, prioritize challenges, and manage resources

## ✨ Features

### Core Mechanics

- **Dynamic Challenge System**: Challenges rotate each round with configurable difficulty distribution
- **First-Come-First-Served**: Only the first team to complete a challenge gets the points
- **Real-time HUD**: Custom on-screen display showing round info, timer, challenges, and scores
- **Team-Based Competition**: Automatic team formation with color-coded name tags
- **Protected Bounty Chests**: Team-specific deposit locations with access control
- **Round Transitions**: Automatic progression through configurable number of rounds

### Configurable Gameplay

- **Challenge Distribution**: Customize easy/medium/hard challenge counts per round (max 10 total)
- **Game Length**: Adjust total rounds and round duration
- **Difficulty Scaling**: Balance gameplay from beginner-friendly to expert mode
- **Flexible Settings**: All configurations adjustable before game start

### Visual & Audio Feedback

- **HUD Elements**:
  - Round counter and timer with color-coded warnings
  - Challenge status indicators (available, completed, team ownership)
  - Team scores with color coding (red/blue)
- **Sound Effects**:
  - Team shuffle animations with audio
  - Round transitions and timer warnings
  - Challenge completion notifications
  - Victory celebrations with fireworks
- **Visual Effects**:
  - Particle effects for challenge completion
  - Color-coded team name tags
  - Victory fireworks display

## 📋 Requirements

- **Minecraft Bedrock**: Version 1.21.130 or higher
- **Required Packs**:
  - Loot Rush Behavior Pack (BP)
  - Loot Rush Resource Pack (RP)
- **Permissions**: Operator level 1+ for admin commands
- **Minimum Players**: 2 (supports uneven team sizes)

## 🚀 Installation

1. **Download the Addon**:
   - Download both the behavior pack and resource pack files
2. **Install Packs**:
   - Copy behavior pack to: `<minecraft>/development_behavior_packs/`
   - Copy resource pack to: `<minecraft>/development_resource_packs/`
3. **Create World**:
   - Create a new world in Minecraft
   - Under "Behavior Packs", activate "Loot Rush - Behavior Pack"
   - Under "Resource Packs", activate "Loot Rush - Resource Pack"
   - Enable "Cheats" and "Education Edition" (if needed)
4. **World Settings**:
   - Recommended: Creative or Survival mode
   - Set world spawn point where you want the game area
   - Ensure enough space around spawn for both teams

## 🎯 How to Play

### For Admins (Game Setup)

1. **Optional: Configure Game Settings** (before starting):

   ```
   lr:config                                # View current settings
   lr:configset easyChallengeCount 5        # Set easy challenges per round
   lr:configset mediumChallengeCount 3      # Set medium challenges per round
   lr:configset hardChallengeCount 2        # Set hard challenges per round
   lr:configset totalRounds 4               # Set number of rounds
   lr:configset roundDurationTicks 18000    # Set round duration (15 min)
   ```

   **Note**: Total challenges (easy + medium + hard) should not exceed 10 for optimal HUD display.

2. **Form Teams**:

   ```
   lr:teamup
   ```

   - All online players randomly split into two teams
   - Team reveal animation plays (10 seconds shuffling, 4.5 seconds reveal)
   - Bounty chests placed at spawn (-3 and +3 blocks from center)
   - Player name tags colored (red/blue)

3. **Start the Game**:

   ```
   lr:start
   ```

   - Round 1 begins with random challenges
   - Timer starts counting down
   - HUD activates for all players

4. **Manage Game** (optional commands):

   ```
   lr:pause                    # Pause the timer
   lr:resume                   # Resume the timer
   lr:forceround 2             # Jump to round 2
   lr:setscore crimson 100     # Adjust team score
   lr:debug true               # Enable debug logging
   ```

5. **End Game**:
   ```
   lr:end                      # End current game (keeps teams)
   lr:reset                    # Complete reset (clears teams and state)
   ```

**Game Progression**: Rounds automatically transition based on configured duration. After the final round, the winner is announced automatically. Teams persist between games—run `lr:start` again for a rematch or `lr:reset` for new teams.

### For Players

1. **Check Your Team**: Look at your name tag color (red = Crimson, blue = Azure)

2. **Review Challenges**: Check the HUD in the top-right corner for active challenges
   - ○ White circle = Available challenge
   - ✓ Green checkmark = Completed (shows team name)

3. **Gather Resources**: Explore, mine, fight mobs, and collect required items

4. **Deposit Items**:
   - Return to spawn and locate your team's bounty chest
   - **Crimson Bounty** (red, west side, -3 blocks from center)
   - **Azure Bounty** (blue, east side, +3 blocks from center)
   - Place required items in your team's chest

5. **Complete Challenges**:
   - When you deposit enough items, the challenge automatically completes
   - Points awarded to your team immediately
   - Chest auto-clears all items
   - Challenge locks for both teams

6. **Strategy Tips**:
   - Prioritize high-value challenges your team can complete
   - Split up for parallel gathering or work together for safety
   - Watch timer warnings (yellow → gold → red)
   - Adapt to each round's new challenge set

## 🎲 Challenge Types

### Easy Challenges (10-20 points)

Common blocks and basic resources:

- 32 Cobblestone, 16 Logs, 8 Bread, 8 Coal, 8 Wool, etc.

### Medium Challenges (25-45 points)

Mob drops and processed materials:

- 4 Gunpowder, 3 Ender Pearls, 2 Iron Blocks, Diamond Pickaxe, etc.

### Hard Challenges (50-75 points)

Rare items and special loot:

- Enchanted Book, Golden Apple, 8 Emeralds, Totem of Undying, Trident, etc.

**Default Configuration**: 6 Easy + 3 Medium + 1 Hard = 10 challenges per round (~200-350 points available)

**How Points Work**:

- Only the **first team** to complete a challenge earns the points
- Completed challenges lock for both teams
- Points accumulate across all rounds
- Team with highest total score wins after final round

## 🎛️ Configuration

### Pre-Game Configuration

Configure before running `lr:start`:

| Setting           | Command                                 | Default | Range      | Description                      |
| ----------------- | --------------------------------------- | ------- | ---------- | -------------------------------- |
| Easy Challenges   | `lr:configset easyChallengeCount <n>`   | 6       | 0-10       | Easy challenges per round        |
| Medium Challenges | `lr:configset mediumChallengeCount <n>` | 3       | 0-10       | Medium challenges per round      |
| Hard Challenges   | `lr:configset hardChallengeCount <n>`   | 1       | 0-10       | Hard challenges per round        |
| Total Rounds      | `lr:configset totalRounds <n>`          | 4       | 1-10       | Number of rounds in game         |
| Round Duration    | `lr:configset roundDurationTicks <n>`   | 18000   | 1200-72000 | Ticks per round (18000 = 15 min) |

### Recommended Configurations

**Beginner Friendly** (easier, more challenges):

```
lr:configset easyChallengeCount 8
lr:configset mediumChallengeCount 2
lr:configset hardChallengeCount 0
```

**Balanced** (default-style gameplay):

```
lr:configset easyChallengeCount 5
lr:configset mediumChallengeCount 3
lr:configset hardChallengeCount 2
```

**Expert Mode** (harder challenges):

```
lr:configset easyChallengeCount 3
lr:configset mediumChallengeCount 3
lr:configset hardChallengeCount 4
```

**Speed Round** (short game):

```
lr:configset totalRounds 2
lr:configset roundDurationTicks 12000
lr:configset easyChallengeCount 4
lr:configset mediumChallengeCount 1
```

### Reset Configuration

```
lr:configreset   # Reset all settings to defaults
```

## 🕹️ Admin Commands

All commands require **GameDirectors** permission (Operator level 1+):

### Game Control

| Command     | Description                                          |
| ----------- | ---------------------------------------------------- |
| `lr:teamup` | Form teams with reveal animation and chest placement |
| `lr:start`  | Start the challenge timer and first round            |
| `lr:end`    | End the current game (keeps teams intact)            |
| `lr:reset`  | Complete reset (clears teams and all game state)     |

### Configuration (Before Start)

| Command                      | Description                         |
| ---------------------------- | ----------------------------------- |
| `lr:config`                  | View current configuration settings |
| `lr:configset <key> <value>` | Set a configuration value           |
| `lr:configreset`             | Reset all settings to defaults      |

**Valid keys**: `easyChallengeCount`, `mediumChallengeCount`, `hardChallengeCount`, `totalRounds`, `roundDurationTicks`

### Game Management

| Command                               | Description                     |
| ------------------------------------- | ------------------------------- |
| `lr:pause`                            | Pause the game timer            |
| `lr:resume`                           | Resume the game timer           |
| `lr:forceround <1-N>`                 | Jump to a specific round number |
| `lr:setscore crimson\|azure <points>` | Manually adjust team score      |

### Debug & Utilities

| Command                | Description                         |
| ---------------------- | ----------------------------------- |
| `lr:debug true\|false` | Toggle debug logging                |
| `lr:givebook`          | Give challenges book to all players |

## 🔧 Development

This addon is built with TypeScript and uses the Minecraft Bedrock Script API.

### Prerequisites

- Node.js (LTS version)
- npm (comes with Node.js)
- Visual Studio Code (recommended)

### Setup Development Environment

1. Clone the repository:

   ```bash
   git clone https://github.com/eriscs01/es-loot-rush.git
   cd es-loot-rush
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Build and deploy:

   ```bash
   npm run local-deploy
   ```

4. For development with auto-rebuild:
   ```bash
   npm run local-deploy -- --watch
   ```

### Project Structure

```
es-loot-rush/
├── behavior_packs/ES-Loot-Rush/    # Behavior pack files
│   ├── manifest.json                # Pack manifest
│   └── scripts/                     # Compiled JavaScript
├── resource_packs/ES-Loot-Rush/    # Resource pack files
│   ├── manifest.json                # Pack manifest
│   └── ui/                          # HUD definitions
├── scripts/                         # TypeScript source code
│   ├── main.ts                      # Entry point
│   ├── managers/                    # Game managers
│   ├── config/                      # Challenge and config data
│   └── types.ts                     # Type definitions
├── mechanics.md                     # Detailed mechanics documentation
└── README.md                        # This file
```

### Build Commands

```bash
npm run build             # Build TypeScript to JavaScript
npm run local-deploy      # Build and deploy to Minecraft folder
npm run watch             # Watch mode for development
npm run lint              # Run ESLint
npm run mcaddon           # Create distributable .mcaddon file
```

## 📝 License

This project is open source. See the repository for license details.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

## 📚 Additional Resources

- **Detailed Mechanics**: See `mechanics.md` for comprehensive game mechanics documentation
- **Minecraft Bedrock Script API**: [Official Documentation](https://learn.microsoft.com/minecraft/creator/)
- **Support**: Open an issue on the GitHub repository

---

**Enjoy Loot Rush! May the best team win! 🏆**
