// Import all example functions from example.js
const {
  setPosition,
  followPlayer,
  findBlocks,
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
} = require("./example.js");

// ====== Example code below ======

// Main function to craft a wooden pickaxe
async function craftWoodenPickaxe() {
  console.log("Crafting a wooden pickaxe");
  bot.chat("I'm going to craft a wooden pickaxe!");

  // Step 1: Check if we already have a wooden pickaxe
  reportInventory();
  let inventory = bot.inventory.items();
  const hasPickaxe = inventory.some((item) => item.name === "wooden_pickaxe");

  if (hasPickaxe) {
    bot.chat("I already have a wooden pickaxe!");
    return;
  }

  // Step 2: Gather logs (we need at least 1)
  bot.chat("Looking for trees...");

  // Find logs - try different types until one is found
  const logTypes = [
    "birch_log",
    "oak_log",
    "spruce_log",
    "jungle_log",
    "acacia_log",
    "dark_oak_log",
  ];
  let logsFound = false;

  for (const logType of logTypes) {
    const logs = findBlocks(logType, 64, 5); // Find up to 5 logs within 64 blocks

    if (logs.length > 0) {
      bot.chat(`Found ${logs.length} ${logType} nearby!`);

      // Mine the logs
      bot.chat("Mining logs...");
      for (const log of logs) {
        await mineBlock(log.x, log.y, log.z);

        // Check if we have enough logs (need at least 1 for planks)
        inventory = bot.inventory.items();
        let logCount = inventory.filter((item) => item.name.includes("_log"))[0]
          ?.count;

        if (logCount >= 3) break; // Need 4 planks for crafting table, 2 for sticks, 3 for pickaxe = 9 total planks = 3 logs
      }

      logsFound = true;
      break;
    }
  }

  if (!logsFound) {
    bot.chat("I couldn't find any logs nearby!");
    return;
  }

  // Step 3: Craft wooden planks (need at least 3 for sticks + pickaxe)
  bot.chat("Crafting wooden planks...");
  // Craft 3 planks of the type we found
  inventory = bot.inventory.items();
  const logType = inventory
    .filter((item) => item.name.includes("_log"))[0]
    .name.split("_")[0];

  console.log(logType);
  await craftItemByName(`${logType}_planks`, 3); // 1 log = 4 planks
  console.log(bot.inventory.items());

  // Step 4: Craft sticks (need 2 for a pickaxe)
  bot.chat("Crafting sticks...");
  await craftItemByName("stick", 4); // 2 planks = 4 sticks

  // Step 5: Find or place a crafting table if needed
  bot.chat("Looking for a crafting table...");
  const craftingTables = findBlocks("crafting_table", 32, 1);

  if (craftingTables.length === 0) {
    bot.chat("No crafting table found nearby. I'll make one!");

    // Craft a crafting table
    await craftItemByName("crafting_table", 1);

    // Find a good place to put it (preferably near the player)
    const players = Object.values(bot.players);
    if (players.length > 1) {
      // Find a non-bot player
      const otherPlayer = players.find(
        (player) => player.username !== bot.username,
      );
      if (otherPlayer && otherPlayer.entity) {
        await placeBlockNearPlayer(otherPlayer.username, "crafting_table");
      } else {
        // Just place it near the bot
        await placeBlockNearPlayer(bot.username, "crafting_table");
      }
    }
  } else {
    // Move to the existing crafting table
    bot.chat("Found a crafting table!");
    await setPosition(
      craftingTables[0].x,
      craftingTables[0].y,
      craftingTables[0].z,
    );
  }

  // Step 6: Finally, craft the wooden pickaxe
  bot.chat("Crafting a wooden pickaxe...");
  await craftItemByName("wooden_pickaxe", 1);

  // Check if we successfully crafted it
  const newInventory = bot.inventory.items();
  const hasPickaxeNow = newInventory.some(
    (item) => item.name === "wooden_pickaxe",
  );

  if (hasPickaxeNow) {
    bot.chat("Successfully crafted a wooden pickaxe!");
  } else {
    bot.chat("Something went wrong, I couldn't craft a wooden pickaxe.");
  }
}

bot.on("spawn", async () => {
  console.log("Bot spawned");
  await craftWoodenPickaxe();
});

// Handle errors
bot.on("error", console.error);
