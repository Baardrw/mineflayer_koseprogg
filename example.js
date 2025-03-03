const mineflayer = require("mineflayer");
const {
  pathfinder,
  Movements,
  goals: {
    GoalNearXZ,
    GoalNear,
    GoalLookAtBlock,
    GoalPlaceBlock,
    GoalFollow,
    GoalBlock,
  },
} = require("mineflayer-pathfinder");
const toolPlugin = require("mineflayer-tool").plugin;
const collectBlock = require("mineflayer-collectblock").plugin;
const Vec3 = require("vec3").Vec3;

// ===== Bot Configuration =====
// Simply edit these values to connect to your own server
const BOT_CONFIG = {
  host: "localhost",
  port: 25565,
  username: "ExampleBot",
  version: false, // Set a specific version or false to auto-detect
  auth: "offline", // Use 'microsoft' for premium accounts
  hideErrors: false,
};

console.log("Creating bot...");
const bot = mineflayer.createBot(BOT_CONFIG);

// Load plugins
bot.loadPlugin(pathfinder);
bot.loadPlugin(toolPlugin);
bot.loadPlugin(collectBlock);

// Global variables
let minecraftData = null;
let connectedToServer = false;

// ===== Bot Events =====
bot.once("spawn", () => {
  console.log("Bot spawned!");
  bot.chat("Hello, I am a Mineflayer bot!");

  connectedToServer = true;

  // Configure bot movement
  const defaultMove = new Movements(bot);
  defaultMove.allow1by1towers = false; // Don't build 1x1 towers when climbing
  defaultMove.canDig = true; // Allow the bot to dig blocks in its way
  defaultMove.scafoldingBlocks = []; // Don't use special blocks for scaffolding

  bot.pathfinder.setMovements(defaultMove);

  // Initialize Minecraft data
  minecraftData = require("minecraft-data")(bot.version);
});

// Handle errors
bot.on("error", (err) => {
  console.error("Bot error:", err);
});

bot.on("kicked", (reason) => {
  console.log("Bot was kicked from the server:", reason);
});

bot.on("end", () => {
  console.log("Bot disconnected from the server");
});

// ===== Movement Functions =====

/**
 * Makes the bot go to specific coordinates
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate (use -1 to only move in X and Z)
 * @param {number} z - Z coordinate
 * @returns {Promise<boolean>} - Whether the movement was successful
 */
async function setPosition(x, y, z) {
  console.log(`Moving to: ${x}, ${y}, ${z}`);

  // Clear current pathfinding goal
  bot.pathfinder.setGoal(null);

  // Create goal based on whether a Y coordinate was specified
  const goal = y === -1 ? new GoalNearXZ(x, z, 1) : new GoalNear(x, y, z, 1);

  try {
    await bot.pathfinder.goto(goal);
    return true;
  } catch (error) {
    console.error("Failed to reach destination:", error);
    return false;
  }
}

/**
 * Makes the bot follow a player
 * @param {string} username - The username of the player to follow
 * @param {number} distance - How close to get to the player
 */
async function followPlayer(username, distance = 3) {
  const player = bot.players[username];

  if (!player || !player.entity) {
    bot.chat(`I can't see ${username}`);
    return false;
  }

  const goal = new GoalFollow(player.entity, distance);
  bot.pathfinder.setGoal(goal, true); // true means dynamic goal that updates with player movement

  // Wait a bit while following before returning
  await new Promise((resolve) => setTimeout(resolve, 5000));
  return true;
}

// ===== Block Finding and Collection =====

/**
 * Finds blocks of a specific type within a certain distance
 * @param {string} blockName - The name of the block to find
 * @param {number} maxDistance - Maximum search distance
 * @param {number} count - Maximum number of blocks to find
 * @returns {Array<Vec3>} - Array of block positions
 */
function findBlocks(blockName, maxDistance = 64, count = 10) {
  // Check if block exists in this version
  if (!minecraftData.blocksByName[blockName]) {
    console.log(`Block "${blockName}" not found in this Minecraft version`);
    return [];
  }

  const blockId = minecraftData.blocksByName[blockName].id;

  const options = {
    matching: blockId,
    maxDistance: maxDistance,
    count: count,
  };

  return bot.findBlocks(options);
}

/**
 * Finds and reports blocks of a specific type
 * @param {string} blockName - The name of the block to find
 * @param {number} maxDistance - Maximum search distance
 * @param {number} count - Maximum number of blocks to find
 */
async function findAndReportBlocks(blockName, maxDistance = 64, count = 5) {
  const blocks = findBlocks(blockName, maxDistance, count);

  if (blocks.length === 0) {
    bot.chat(`No ${blockName} blocks found within ${maxDistance} blocks`);
    return false;
  }

  bot.chat(`Found ${blocks.length} ${blockName} blocks:`);
  blocks.forEach((blockPos) => {
    const distance = Math.round(bot.entity.position.distanceTo(blockPos));
    bot.chat(
      `- ${blockName} at (${blockPos.x}, ${blockPos.y}, ${blockPos.z}), ${distance} blocks away`,
    );
  });

  return true;
}

/**
 * Mines and collects blocks of a specific type
 * @param {string} blockName - The name of the block to collect
 * @param {number} maxDistance - Maximum search distance
 * @param {number} count - Maximum number of blocks to collect
 */
async function collectBlocks(blockName, maxDistance = 32, count = 5) {
  if (!minecraftData.blocksByName[blockName]) {
    bot.chat(`Block "${blockName}" not found in this Minecraft version`);
    return false;
  }

  const blockId = minecraftData.blocksByName[blockName].id;
  const blocks = findBlocks(blockName, maxDistance, count);

  if (blocks.length === 0) {
    bot.chat(`No ${blockName} blocks found within ${maxDistance} blocks`);
    return false;
  }

  bot.chat(
    `Found ${blocks.length} ${blockName} blocks. Starting collection...`,
  );

  let collected = 0;
  for (const blockPos of blocks) {
    bot.chat(
      `Mining ${blockName} at (${blockPos.x}, ${blockPos.y}, ${blockPos.z})`,
    );

    const success = await mineBlock(blockPos.x, blockPos.y, blockPos.z);
    if (success) {
      collected++;
      bot.chat(`Collected ${collected}/${blocks.length} ${blockName} blocks`);
    }
  }

  bot.chat(
    `Collection complete. Collected ${collected}/${blocks.length} ${blockName} blocks`,
  );
  return collected > 0;
}

/**
 * Mines and collects a specific block
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} z - Z coordinate
 * @returns {Promise<boolean>} - Whether the block was successfully mined
 */
async function mineBlock(x, y, z) {
  const blockPos = new Vec3(x, y, z);
  const block = bot.blockAt(blockPos);

  if (!block || block.name === "air") {
    console.log("No block at specified position");
    return false;
  }

  console.log(`Mining block: ${block.displayName} at (${x}, ${y}, ${z})`);

  // Equip the appropriate tool
  try {
    await bot.tool.equipForBlock(block);
  } catch (error) {
    console.log(`Failed to equip appropriate tool: ${error.message}`);
  }

  const heldItem = bot.heldItem;
  if (heldItem && !block.canHarvest(heldItem.type)) {
    console.log(
      `Cannot harvest ${block.displayName} with ${heldItem.displayName}`,
    );
    return false;
  }

  // Move to the block
  try {
    const goal = new GoalLookAtBlock(blockPos, bot.world);
    await bot.pathfinder.goto(goal);
  } catch (error) {
    console.log(`Failed to reach the block: ${error.message}`);
    return false;
  }

  // Ensure we still have the right tool equipped
  await bot.tool.equipForBlock(block);

  if (!bot.canDigBlock(block)) {
    console.log(`Cannot dig ${block.displayName}`);
    return false;
  }

  // Dig the block
  try {
    await bot.dig(block);
  } catch (error) {
    console.log(`Error mining block: ${error.message}`);
    return false;
  }

  // Wait a moment for the block to drop as an item
  await new Promise((resolve) => setTimeout(resolve, 300));

  // Try to collect nearby items
  const nearbyEntities = Object.values(bot.entities);
  const items = nearbyEntities.filter(
    (entity) =>
      entity.name === "item" &&
      entity.position.distanceTo(bot.entity.position) < 10,
  );

  for (const item of items) {
    try {
      const goal = new GoalNear(
        item.position.x,
        item.position.y,
        item.position.z,
        1,
      );
      await bot.pathfinder.goto(goal);
      // Just getting close is usually enough as items are auto-collected
    } catch (error) {
      console.log(`Failed to collect item: ${error.message}`);
    }
  }

  return true;
}

// ===== Inventory Management =====

/**
 * Reports the bot's inventory in chat
 */
function reportInventory() {
  const items = getInventory();

  if (items.length === 0) {
    bot.chat("My inventory is empty");
    return;
  }

  bot.chat("My inventory contains:");
  items.forEach((item) => {
    bot.chat(`- ${item.count}x ${item.displayName}`);
  });
}

/**
 * Gets all items in the bot's inventory
 * @returns {Array} - Array of Item objects
 */
function getInventory() {
  return bot.inventory.items();
}

/**
 * Counts how many of a specific item the bot has
 * @param {string} itemName - The name of the item to count
 * @returns {number} - The number of items of that type
 */
function countItemInInventory(itemName) {
  if (!minecraftData.itemsByName[itemName]) {
    console.log(`Item "${itemName}" not found in this Minecraft version`);
    return 0;
  }

  const itemId = minecraftData.itemsByName[itemName].id;
  const items = getInventory().filter((item) => item.type === itemId);

  return items.reduce((total, item) => total + item.count, 0);
}

/**
 * Finds a crafting table near the bot
 * @param {number} maxDistance - Maximum search distance
 * @returns {Block|null} - The crafting table block or null if none found
 */
function findCraftingTable(maxDistance = 64) {
  const craftingTableId = minecraftData.blocksByName["crafting_table"].id;
  const options = {
    matching: craftingTableId,
    maxDistance: maxDistance,
    count: 1,
  };

  console.log("Crafting Table ID:", craftingTableId);
  const craftingTablePos = bot.findBlocks(options)[0];

  console.log("Crafting Table Pos:", craftingTablePos);

  return craftingTablePos != null ? bot.blockAt(craftingTablePos) : null;
}

// ===== Crafting and Block Placement =====

/**
 * Crafts an item by name
 * @param {string} itemName - The name of the item to craft
 * @param {number} count - How many to craft
 */
async function craftItemByName(itemName, count = 1) {
  if (!minecraftData.itemsByName[itemName]) {
    bot.chat(`Item "${itemName}" not found in this Minecraft version`);
    return false;
  }

  const itemId = minecraftData.itemsByName[itemName].id;

  // Find a crafting table if needed
  let craftingTable = null;
  const recipes = bot.recipesFor(itemId, null, 1, null);

  if (recipes.length === 0) {
    const recipesWithTable = bot.recipesFor(itemId, null, 1, true);
    if (recipesWithTable.length > 0) {
      craftingTable = findCraftingTable();
      console.log("Found crafting table:", craftingTable);
      if (!craftingTable) {
        bot.chat(`I need a crafting table to craft ${itemName}`);
        return false;
      }
    } else {
      bot.chat(`I don't know how to craft ${itemName}`);
      return false;
    }
  }

  // If we need a crafting table, go to it
  if (craftingTable) {
    bot.chat(`Moving to crafting table to craft ${count}x ${itemName}`);
    try {
      const goal = new GoalLookAtBlock(craftingTable.position, bot.world);
      await bot.pathfinder.goto(goal);
    } catch (error) {
      bot.chat(`Failed to reach crafting table: ${error.message}`);
      return false;
    }
  } else {
    bot.chat(`Crafting ${count}x ${itemName}`);
  }

  // Get updated recipes with the potentially found crafting table
  const availableRecipes = bot.recipesFor(itemId, null, 1, craftingTable);

  if (availableRecipes.length === 0) {
    bot.chat(`I can't craft ${itemName} right now`);
    return false;
  }

  // Craft the item
  try {
    await bot.craft(availableRecipes[0], count, craftingTable);
    bot.chat(`Successfully crafted ${count}x ${itemName}`);
    return true;
  } catch (error) {
    bot.chat(`Failed to craft ${itemName}: ${error.message}`);
    return false;
  }
}

/**
 * Places a block near a player
 * @param {string} playerName - The name of the player
 * @param {string} blockName - The name of the block to place
 */
async function placeBlockNearPlayer(playerName, blockName) {
  const player = bot.players[playerName];

  if (!player || !player.entity) {
    bot.chat(`I can't see ${playerName}`);
    return false;
  }

  if (!minecraftData.blocksByName[blockName]) {
    bot.chat(`Block "${blockName}" not found in this Minecraft version`);
    return false;
  }

  // Check if we have the block in our inventory
  const blockId = minecraftData.blocksByName[blockName].id;
  const itemId = minecraftData.itemsByName[blockName]?.id || blockId;

  const item = bot.inventory.items().find((item) => item.type === itemId);
  if (!item) {
    bot.chat(`I don't have any ${blockName} in my inventory`);
    return false;
  }

  // Go near the player
  try {
    await followPlayer(playerName, 3);
  } catch (error) {
    bot.chat(`Failed to reach ${playerName}: ${error.message}`);
    return false;
  }

  // Find a suitable place to put the block
  const playerPos = player.entity.position.floored();
  const offsets = [
    new Vec3(1, 0, 0),
    new Vec3(-1, 0, 0),
    new Vec3(0, 0, 1),
    new Vec3(0, 0, -1),
  ];

  let placeBlock = null;
  let placeVector = null;

  for (const offset of offsets) {
    const blockPos = playerPos.plus(offset);
    const block = bot.blockAt(blockPos);

    if (block.name === "air") {
      // We need a reference block to place against
      const refPos = blockPos.offset(0, -1, 0);
      const refBlock = bot.blockAt(refPos);

      if (refBlock.name !== "air") {
        placeBlock = refBlock;
        placeVector = new Vec3(0, 1, 0);
        break;
      }
    }
  }

  if (!placeBlock) {
    bot.chat("I couldn't find a suitable place to put the block");
    return false;
  }

  // Equip the block
  await bot.equip(item, "hand");

  // Place the block
  try {
    await bot.placeBlock(placeBlock, placeVector);
    bot.chat(`Placed ${blockName} near ${playerName}`);
    return true;
  } catch (error) {
    bot.chat(`Failed to place ${blockName}: ${error.message}`);
    return false;
  }
}

/**
 * Places a block at a specific position
 * @param {number} x - X coordinate of reference block
 * @param {number} y - Y coordinate of reference block
 * @param {number} z - Z coordinate of reference block
 * @param {number} face_x - X component of face vector
 * @param {number} face_y - Y component of face vector
 * @param {number} face_z - Z component of face vector
 * @param {object} item - The item to place
 */
async function placeBlock(x, y, z, face_x, face_y, face_z, item) {
  const blockPos = new Vec3(x, y, z);
  const block = bot.blockAt(blockPos);

  if (!block || block.name === "air") {
    console.log("Cannot place block on air");
    return false;
  }

  const faceVector = new Vec3(face_x, face_y, face_z);

  // Check if bot has the item in inventory
  const inventory = bot.inventory.items();
  const mcItem = inventory.find((invItem) => invItem.type === item.type);

  if (!mcItem) {
    console.log("Bot does not have the required item in inventory");
    return false;
  }

  // Go to the block
  try {
    const goal = new GoalPlaceBlock(
      block.position.plus(faceVector),
      bot.world,
      {
        range: 4,
      },
    );
    await bot.pathfinder.goto(goal);
  } catch (error) {
    console.log(`Failed to reach placement position: ${error.message}`);
    return false;
  }

  // Place the block
  try {
    await bot.equip(mcItem, "hand");
    await bot.placeBlock(block, faceVector);
    return true;
  } catch (error) {
    console.log(`Error placing block: ${error.message}`);
    return false;
  }
}

// ===== Furnace Operations =====

/**
 * Gets info about a furnace at the specified position
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} z - Z coordinate
 * @returns {Promise<Furnace|null>} - The furnace object or null if failed
 */
async function furnaceInfo(x, y, z) {
  const furnacePos = new Vec3(x, y, z);
  const furnaceBlock = bot.blockAt(furnacePos);

  if (!furnaceBlock) {
    console.log("Furnace block not found");
    return null;
  }

  const furnaceTypes = ["furnace", "lit_furnace"]
    .map((name) => minecraftData.blocksByName[name]?.id)
    .filter((id) => id !== undefined);

  if (!furnaceTypes.includes(furnaceBlock.type)) {
    console.log(`Block is not a furnace, it is: ${furnaceBlock.displayName}`);
    return null;
  }

  // Go to the furnace
  try {
    const goal = new GoalLookAtBlock(furnacePos, bot.world);
    await bot.pathfinder.goto(goal);
  } catch (error) {
    console.log(`Failed to reach furnace: ${error.message}`);
    return null;
  }

  // Open the furnace
  try {
    const furnace = await bot.openFurnace(furnaceBlock);
    return furnace;
  } catch (error) {
    console.log(`Failed to open furnace: ${error.message}`);
    return null;
  }
}

/**
 * Uses a furnace to smelt items
 * @param {number} x - X coordinate of the furnace
 * @param {number} y - Y coordinate of the furnace
 * @param {number} z - Z coordinate of the furnace
 * @param {string} inputItemName - Name of item to smelt
 * @param {string} fuelItemName - Name of fuel to use
 * @returns {Promise<boolean>} - Whether the operation was successful
 */
async function useFurnace(x, y, z, inputItemName, fuelItemName) {
  const furnace = await furnaceInfo(x, y, z);

  if (!furnace) {
    bot.chat("Failed to access furnace");
    return false;
  }

  const inputId = minecraftData.itemsByName[inputItemName]?.id;
  const fuelId = minecraftData.itemsByName[fuelItemName]?.id;

  if (!inputId || !fuelId) {
    bot.chat("Invalid item names");
    furnace.close();
    return false;
  }

  // Find items in inventory
  const inputItem = bot.inventory.items().find((item) => item.type === inputId);
  const fuelItem = bot.inventory.items().find((item) => item.type === fuelId);

  if (!inputItem) {
    bot.chat(`I don't have any ${inputItemName} to smelt`);
    furnace.close();
    return false;
  }

  if (!fuelItem) {
    bot.chat(`I don't have any ${fuelItemName} to use as fuel`);
    furnace.close();
    return false;
  }

  // Add fuel if needed
  if (!furnace.fuelItem() || furnace.fuel === 0) {
    bot.chat(`Adding ${fuelItemName} as fuel`);
    try {
      await furnace.putFuel(fuelItem.type, null, 1);
    } catch (error) {
      bot.chat(`Failed to add fuel: ${error.message}`);
      furnace.close();
      return false;
    }
  }

  // Add input
  bot.chat(`Adding ${inputItemName} to smelt`);
  try {
    await furnace.putInput(inputItem.type, null, 1);
  } catch (error) {
    bot.chat(`Failed to add input: ${error.message}`);
    furnace.close();
    return false;
  }

  // Wait for smelting to complete
  bot.chat("Waiting for smelting to complete...");
  furnace.on("update", () => {
    console.log(
      `Fuel: ${Math.round(furnace.fuel * 100)}%, Progress: ${Math.round(
        furnace.progress * 100,
      )}%`,
    );
  });

  // Check every second if smelting is complete
  while (furnace.inputItem() && furnace.progress < 1) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  // Collect the output
  if (furnace.outputItem()) {
    bot.chat("Collecting the output");
    try {
      const outputItem = await furnace.takeOutput();
      bot.chat(`Got ${outputItem.displayName}`);
    } catch (error) {
      bot.chat(`Failed to collect output: ${error.message}`);
      furnace.close();
      return false;
    }
  } else {
    bot.chat("No output to collect");
  }

  furnace.close();
  return true;
}

// ===== Combat Functions =====

/**
 * Makes the bot attack a specific entity
 * @param {string} entityType - The type of entity to attack
 * @param {number} maxDistance - Maximum search distance
 */
async function attackEntity(entityType, maxDistance = 16) {
  const entities = Object.values(bot.entities).filter(
    (entity) =>
      entity.name === entityType &&
      entity.position.distanceTo(bot.entity.position) <= maxDistance,
  );

  if (entities.length === 0) {
    bot.chat(`No ${entityType} found within ${maxDistance} blocks`);
    return false;
  }

  // Find the closest entity
  const closestEntity = entities.reduce(
    (closest, entity) => {
      const distance = entity.position.distanceTo(bot.entity.position);
      return distance < closest.distance ? { entity, distance } : closest;
    },
    { entity: null, distance: Infinity },
  ).entity;

  if (!closestEntity) {
    bot.chat(`No ${entityType} found within ${maxDistance} blocks`);
    return false;
  }

  bot.chat(
    `Attacking ${entityType} that is ${Math.round(
      closestEntity.position.distanceTo(bot.entity.position),
    )} blocks away`,
  );

  // Equip best weapon (assuming sword is better)
  const swords = bot.inventory
    .items()
    .filter((item) => item.name.includes("sword"));

  if (swords.length > 0) {
    // Sort swords by material (assuming material is the first part of the name)
    const swordMaterials = [
      "wooden",
      "stone",
      "golden",
      "iron",
      "diamond",
      "netherite",
    ];
    swords.sort((a, b) => {
      const materialA = a.name.split("_")[0];
      const materialB = b.name.split("_")[0];
      return (
        swordMaterials.indexOf(materialB) - swordMaterials.indexOf(materialA)
      );
    });

    await bot.equip(swords[0], "hand");
  }

  // Move to the entity and attack
  try {
    await bot.pathfinder.goto(
      new GoalNear(
        closestEntity.position.x,
        closestEntity.position.y,
        closestEntity.position.z,
        2,
      ),
    );

    // Look at the entity and attack
    await bot.lookAt(closestEntity.position.offset(0, closestEntity.height, 0));
    bot.attack(closestEntity);

    return true;
  } catch (error) {
    bot.chat(`Failed to attack ${entityType}: ${error.message}`);
    return false;
  }
}

module.exports = {
  setPosition,
  followPlayer,
  findBlocks,
  // Add all other functions you want to export
  mineBlock,
  reportInventory,
  craftItemByName,
  placeBlockNearPlayer,
  furnaceInfo,
  useFurnace,
  attackEntity,
  bot,
  minecraftData,
  connectedToServer,
};

// ==== Docker Test ====

// async function testFollowPlayer () {
//   username = 'L_H_Brandt'
//   distance = 3
//   await followPlayer(username, parseInt(distance) || 3)
// }

// function dockerTest () {
//   if (!connectedToServer) {
//     setTimeout(dockerTest, 1000)
//     return
//   }

//   testFollowPlayer()
// }

// dockerTest()

// ===== Test Deck =====
// Does not work in docker

// ===== Menu System =====

// function showMainMenu() {
//   console.log('\n===== Mineflayer Test Harness =====')

//   if (!connectedToServer) {
//     console.log('Bot is not connected to a server')
//     rl.question('Reconnect to server? (y/n): ', (answer) => {
//       if (answer.toLowerCase() === 'y') {
//         startBot()
//       } else {
//         rl.close()
//         process.exit(0)
//       }
//     })
//     return
//   }

//   console.log('Choose a function to test:')
//   console.log('1. Movement - Go to coordinates')
//   console.log('2. Movement - Follow player')
//   console.log('3. Block Finding - Find blocks')
//   console.log('4. Block Interaction - Mine a block')
//   console.log('5. Inventory - Report inventory')
//   console.log('6. Crafting - Craft an item')
//   console.log('7. Block Placement - Place block near player')
//   console.log('8. Furnace - Check furnace info')
//   console.log('9. Furnace - Smelt an item')
//   console.log('10. Combat - Attack entity')
//   console.log('0. Exit')

//   rl.question('Enter your choice: ', (choice) => {
//     switch (choice) {
//       case '1':
//         testGoToCoordinates()
//         break
//       case '2':
//         testFollowPlayer()
//         break
//       case '3':
//         testFindBlocks()
//         break
//       case '4':
//         testMineBlock()
//         break
//       case '5':
//         reportInventory()
//         setTimeout(showMainMenu, 500)
//         break
//       case '6':
//         testCraftItem()
//         break
//       case '7':
//         testPlaceBlock()
//         break
//       case '8':
//         testFurnaceInfo()
//         break
//       case '9':
//         testUseFurnace()
//         break
//       case '10':
//         testAttackEntity()
//         break
//       case '0':
//         rl.close()
//         bot.quit()
//         process.exit(0)
//         break
//       default:
//         console.log('Invalid choice')
//         showMainMenu()
//     }
//   })
// }

// async function testGoToCoordinates() {
//   rl.question('Enter X coordinate: ', (x) => {
//     rl.question('Enter Y coordinate (or -1 for XZ only): ', (y) => {
//       rl.question('Enter Z coordinate: ', async (z) => {
//         await setPosition(parseInt(x), parseInt(y), parseInt(z))
//         showMainMenu()
//       })
//     })
//   })
// }

// async function testFollowPlayer() {
//   rl.question('Enter player name to follow: ', async (username) => {
//     rl.question('Enter follow distance (default: 3): ', async (distance) => {
//       await followPlayer(username, parseInt(distance) || 3)
//       showMainMenu()
//     })
//   })
// }

// async function testFindBlocks() {
//   rl.question('Enter block name to find: ', (blockName) => {
//     rl.question('Enter max search distance (default: 64): ', (maxDistance) => {
//       rl.question('Enter max number of blocks to find (default: 5): ', async (count) => {
//         await findAndReportBlocks(
//           blockName,
//           parseInt(maxDistance) || 64,
//           parseInt(count) || 5
//         )
//         showMainMenu()
//       })
//     })
//   })
// }

// async function testMineBlock() {
//   rl.question('Enter X coordinate of block to mine: ', (x) => {
//     rl.question('Enter Y coordinate of block to mine: ', (y) => {
//       rl.question('Enter Z coordinate of block to mine: ', async (z) => {
//         await mineBlock(parseInt(x), parseInt(y), parseInt(z))
//         showMainMenu()
//       })
//     })
//   })
// }

// async function testCraftItem() {
//   rl.question('Enter item name to craft: ', (itemName) => {
//     rl.question('Enter number of items to craft (default: 1): ', async (count) => {
//       await craftItemByName(itemName, parseInt(count) || 1)
//       showMainMenu()
//     })
//   })
// }

// async function testPlaceBlock() {
//   rl.question('Enter player name to place block near: ', (playerName) => {
//     rl.question('Enter block name to place: ', async (blockName) => {
//       await placeBlockNearPlayer(playerName, blockName)
//       showMainMenu()
//     })
//   })
// }

// async function testFurnaceInfo() {
//   rl.question('Enter X coordinate of furnace: ', (x) => {
//     rl.question('Enter Y coordinate of furnace: ', (y) => {
//       rl.question('Enter Z coordinate of furnace: ', async (z) => {
//         let furnace = await furnaceInfo(parseInt(x), parseInt(y), parseInt(z))
//         console.log(furnace)
//         showMainMenu()
//       })
//     })
//   })
// }

// async function testUseFurnace() {
//   rl.question('Enter X coordinate of furnace: ', (x) => {
//     rl.question('Enter Y coordinate of furnace: ', (y) => {
//       rl.question('Enter Z coordinate of furnace: ', (z) => {
//         rl.question('Enter item name to smelt: ', (inputItem) => {
//           rl.question('Enter fuel item name: ', async (fuelItem) => {
//             await useFurnace(
//               parseInt(x),
//               parseInt(y),
//               parseInt(z),
//               inputItem,
//               fuelItem
//             )
//             showMainMenu()
//           })
//         })
//       })
//     })
//   })
// }

// async function testAttackEntity() {
//   rl.question('Enter entity type to attack: ', (entityType) => {
//     rl.question('Enter max attack distance (default: 16): ', async (maxDistance) => {
//       attackEntity(entityType, parseInt(maxDistance) || 16)
//       showMainMenu()
//     })
//   })
// }

// // Run test suite
// // Wait for connectedToServer == true
// const rl = readline.createInterface({
//   input: process.stdin,
//   output: process.stdout
// });

// function main() {
//   if (!connectedToServer) {
//     setTimeout(main, 1000)
//     return
//   }

//   // Run test functions here
//   // testGoToCoordinates()
//   testFollowPlayer()
//   // testFindBlocks()
//   // testMineBlock()
//   // reportInventory()
//   // testCraftItem()
//   // testPlaceBlock()
//   // testFurnaceInfo()
//   // testUseFurnace()
//   // testAttackEntity()
//   // showMainMenu()

// }

// main()
