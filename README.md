# Minecraft Bot Development with Mineflayer

Welcome to the Mineflayer crash course! This guide will help you create your own Minecraft bots using the Mineflayer library.

## Getting Started

### Running with Node.js

**Prerequisites:**
- Node.js v18 or newer
- NPM (included with Node.js)

**Installation and execution:**

```bash
npm install
node your_code.js
```

### Running with Docker

**Build the Docker image:**
```bash
docker build -t my-bot .
```

**Run the Docker container:**
```bash
docker run --network="host" my-bot
```

## Mineflayer Guide: Tips, Tricks, and Example Functions

### Introduction to Mineflayer

Mineflayer is a powerful JavaScript library for creating Minecraft bots that interact with the game world. It leverages an event-driven architecture, enabling your bot to respond to in-game events. When you create a bot, it connects to a Minecraft server, listens for events like player movements, chat messages, and block updates, and lets you programmatically respond to these events.

**How Mineflayer works:**

1. Connects to a Minecraft server
2. Receives data about the world and entities
3. Maintains an internal representation of the game state
4. Provides an API to interact with the world

### Essential Tips and Tricks

#### Translating Names to Minecraft IDs

A common challenge is converting between human-readable names and internal Minecraft IDs:

```javascript
// Initialize Minecraft data with your bot's version
const minecraftData = require('minecraft-data')(bot.version)

// Convert block name to ID
function getBlockId(blockName) {
  const block = minecraftData.blocksByName[blockName]
  if (!block) {
    console.log(`Block "${blockName}" not found!`)
    return null
  }
  return block.id
}

// Convert item name to ID
function getItemId(itemName) {
  const item = minecraftData.itemsByName[itemName]
  if (!item) {
    console.log(`Item "${itemName}" not found!`)
    return null
  }
  return item.id
}

// Example usage
const diamondBlockId = getBlockId('diamond_block')
const diamondItemId = getItemId('diamond')
```

**Important:** Blocks and items have different IDs - don't confuse them!

#### Working with Positions and Vectors

Always use `Vec3` for positions to keep your code clean and consistent:

```javascript
const Vec3 = require('vec3').Vec3
const position = new Vec3(0, 64, 0)

// Offset a position
const blockAbove = position.offset(0, 1, 0)

// Calculate distance
const distance = position.distanceTo(bot.entity.position)

// Vector operations
const direction = position.minus(bot.entity.position).normalize()
```

### Error Handling with Promises

Most Mineflayer actions return [promises](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise), so ensure proper error handling is in place:

```javascript
async function safeDigBlock(block) {
  try {
    await bot.tool.equipForBlock(block)
    await bot.dig(block)
    return true
  } catch (error) {
    console.log(`Failed to dig block: ${error.message}`)
    return false
  }
}
```

#### Creating Custom Chat Commands

Efficiently parse user commands:

```javascript
bot.on('chat', (username, message) => {
  if (username === bot.username) return

  const args = message.split(' ')
  const command = args[0]

  switch (command) {
    case 'come':
      // Handle "come" command
      followPlayer(username)
      break
    case 'find':
      // Handle "find" command with args[1] as the block name
      if (args.length > 1) findBlocks(args[1])
      break
    // Add more commands...
  }
})
```

## Bot Function Reference

Below are the key example functions from your Mineflayer bot and their purpose:

### Movement Functions

#### `setPosition(x, y, z)`

Navigates to specific coordinates using pathfinding.

- When `y` is set to `-1`, the bot only navigates in the X and Z dimensions.
- Returns a `Promise` that resolves when destination is reached.

#### `followPlayer(username, distance = 3)`

Makes the bot follow a specific player, maintaining the given distance.

- Uses dynamic pathfinding that adjusts as the player moves.
- Perfect for creating companion bots.

### Block Interaction

#### `findBlocks(blockName, maxDistance = 64, count = 10)`

Searches for blocks of a specific type within a radius.

- Returns `Vec3` positions of found blocks.
- Useful for resource gathering and navigation.

#### `mineBlock(x, y, z)`

Navigates to and mines a specific block, attempting to collect dropped items.

- Automatically selects the appropriate tool.
- Handles navigation, block breaking, and item collection.

#### `collectBlocks(blockName, maxDistance = 32, count = 10)`

Locates and collects multiple blocks of the specified type.

- Combines finding, navigating, and mining in one function.
- Great for gathering resources efficiently.

### Inventory Management

#### `reportInventory()`

Lists all items in the bot's inventory.

#### `countItemInInventory(itemName)`

Counts how many of a specific item the bot has.

- Useful for crafting decisions and resource management.

### Crafting and Building

#### `craftItemByName(itemName, count = 1)`

Crafts items automatically, finding recipes and using crafting tables if needed.

- Handles recipe lookup and table navigation.
- Works with both inventory crafting and crafting tables.

#### `placeBlockNearPlayer(playerName, blockName)`

Places a block near a specific player.

- Finds a suitable location near the player.
- Navigates and places the block safely.

### Furnace Operations

#### `furnaceInfo(x, y, z)`

Inspects a furnace, reporting its contents and status.

- Shows input, fuel, output, and progress.

#### `useFurnace(x, y, z, inputItemName, fuelItemName)`

Automates furnace operation by adding input and fuel, then waiting for output.

- Complete smelting automation.
- Monitors progress and collects the output.

### Combat Functions

#### `attackEntity(entityType, maxDistance = 16)`

Finds and attacks the nearest entity of the specified type.

- Equips the best available weapon.
- Navigates to within attacking range.

These functions demonstrate core Mineflayer capabilities and can be used as building blocks for more complex behaviors. Use them as inspiration for your own bots!
