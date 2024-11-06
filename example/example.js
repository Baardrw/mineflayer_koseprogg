const mineflayer = require('mineflayer')
const {
  pathfinder,
  Movements,
  goals: { GoalNearXZ, GoalNear, GoalLookAtBlock, GoalPlaceBlock }
} = require('mineflayer-pathfinder')
const toolPlugin = require('mineflayer-tool').plugin
const collectBlock = require('mineflayer-collectblock').plugin
const Vec3 = require('vec3').Vec3

// === // Configuring bot // === //
const bot = mineflayer.createBot({
  host: 'localhost',
  port: 25565,
  username: 'ExampleBot',
  hideErrors: false
})

console.log('Bot created')
bot.loadPlugin(pathfinder)
bot.loadPlugin(toolPlugin)
bot.loadPlugin(collectBlock)
bot.loadPlugin(toolPlugin)

let minecraftData = null

// === // Bot Events // === //
// Some smart configs for the bot, just copy these
bot.once('spawn', () => {
  bot.chat('Hello, I am MinerosBot')
  const defaultMove = new Movements(bot)
  defaultMove.allow1by1towers = false
  bot.pathfinder.setMovements(defaultMove)
  bot.pathfinder.thinkTimeout = 10000
  minecraftData = require('minecraft-data')(bot.version)

  main()
})

/*
    Makes the bot go to a position
*/
async function setPosition (x, y, z) {
  console.log('Movind to: ' + x + ' ' + y + ' ' + z)

  // Clears pathfinders current goal
  bot.pathfinder.setGoal(null)
  let goal = null

  // If y is -1.0 then the bot will only move in the x and z axis
  if (y == -1.0) {
    goal = new GoalNearXZ(x, z, 1)
  } else {
    goal = new GoalNear(x, y, z, 1)
  }

  // If the promise resolves return true else return false
  try {
    await bot.pathfinder.goto(goal)
    return true
  } catch (error) {
    return false
  }
}

/* 
    Finds all blocks of a certain type within a certain distance
    Use blockid to specify the block type, returns a list of vec3 positions

    BlockIds can be found here: http://prismarinejs.github.io/minecraft-data/?d=blocks&v=1.20
    Make sure you select the right minecraft version
*/
function findBlocks (blockid, max_distance, count) {
  let options = {
    matching: blockid,
    maxDistance: max_distance,
    count: count
  }

  let blocks = bot.findBlocks(options)
  return blocks
}

/*
    Mines and collects the block at the position x, y, z
    Not using the collect block library because it is doodoo
*/
async function mineBlock (x, y, z) {
  let block = bot.blockAt(new Vec3(x, y, z))
  console.log('Mining block: ' + block.displayName)

  // Check if the block is mineable
  await bot.tool.equipForBlock(block)
  let heldItem = bot.heldItem
  let heldItemType = null
  if (heldItem != null) {
    heldItemType = heldItem.type
  }

  if (!block.canHarvest(heldItemType)) {
    console.log(
      'Cannot harvest block: ' +
        block.displayName +
        ' with ' +
        heldItem.displayName
    )

    return false
  }

  // get To Block
  bot.pathfinder.setGoal(null)
  let goal = new GoalLookAtBlock(block.position, bot.world) // Helps the mining if the bot is looking at the block
  await bot.pathfinder.goto(goal)

  await bot.tool.equipForBlock(block) // pathfinder may have changed the tool
  if (!bot.canDigBlock(block)) {
    console.log('Cannot dig block: ' + block.displayName)
    return false
  }

  // Dig the block
  try {
    await bot.dig(block)
  } catch (error) {
    console.log('Error collecting block: ' + block.displayName)
    return false
  }

  // sleep to let the block drop
  // Not a very good way to do it, but alas I know no other way
  await new Promise(resolve => setTimeout(resolve, 200))

  // Collect the item
  let nearbyentities = bot.entities
  let entities = Object.values(nearbyentities)
  // console.log(entities)

  // Blindly pick up all the entities in a 10 block radius
  for (let i = 0; i < entities.length; i++) {
    let entity = entities[i]
    if (entity.name == 'item') {
      if (entity.position.distanceTo(bot.entity.position) < 10) {
        // Goto the entity position
        bot.pathfinder.setGoal(null)
        let goal = new GoalNear(
          entity.position.x,
          entity.position.y,
          entity.position.z,
          0.5
        )
        try {
          await bot.pathfinder.goto(goal)
        } catch (error) {
          return false
        }
      }
    }
  }

  return true
}

/*
    Returns a list of all the items in the bots inventory.
*/
function getInventory () {
  return bot.inventory.items()
}

/*
    x, y, z: The position to place the block
    face_x, face_y, face_z: The face vector of where to place the block
    item: The item to place. This is the Item object, again see api docs for more info
*/
async function placeBlock (x, y, z, face_x, face_y, face_z, item) {
  let result = response.template

  let block_pose = new Vec3(x, y, z)
  let block = bot.blockAt(block_pose)
  console.log('Placing block: ' + block.displayName)

  if (block.name == 'air') {
    console.log('Cannot place block on air block')
    return false
  }

  let faceVector = new Vec3(face_x, face_y, face_z)

  // Check if bot has the item in inventory
  let inventory = bot.inventory.items()
  let mcItem = inventory.find(invItem => invItem.type == item.type)

  if (mcItem == null) {
    console.log('Bot does not have item in inventory')
    return false
  }

  // Get to block
  bot.pathfinder.setGoal(null)
  let goal = new GoalPlaceBlock(block.position.plus(faceVector), bot.world, {
    range: 4,
    half: 'top'
  })

  try {
    await bot.pathfinder.goto(goal)
  } catch (error) {
    return false
  }

  // Place the block
  try {
    await bot.equip(mcItem, 'hand')
    await bot.placeBlock(block, faceVector)
  } catch (error) {
    console.log('Error placing block')
    return false
  }

  return true
}

/*
    item_id: numeric id of the item to craft
    crafting_table_x, crafting_table_y, crafting_table_z: The position of the crafting table
    count: The amount of items to craft
*/
async function craftItem (item_id, crafting_table_x, crafting_table_y, crafting_table_z, count) {

    let craftingTable = bot.blockAt(
      new Vec3(
        crafting_table_x,
        crafting_table_y,
        crafting_table_z
      )
    )

  let recipes = bot.recipesAll(item_id, null, craftingTable)
  if (recipes.length == 0) {
    console.log('No recipes found')
    return false
  }

  for (let i = 0; i < recipes.length; i++) {
    try {
      await bot.craft(recipes[i], count, craftingTable)
      return true
    } catch (error) {
        console.log('Error crafting item')
    }
  }
  return false
}


/* 
    Returns a promise containing the Furnace object at the position x, y, z
    The furnace object contains all the infor about the furnace

    tbh: I dont know shit about js, so if you know what the fuck to do about a promise then good on you
*/
async function furnaceInfo (x, y, z) {

    let furnaceBlock = bot.blockAt(
      new Vec3(
        x,
        y,
        z
      )
    )

    if (furnaceBlock == null) {
      console.log('Furnace block not found')
      return null
    } else if (furnaceBlock.type != minecraftData.blocksByName['furnace'].id) {
      console.log('Block is not a furnace, it is: ' + furnaceBlock.displayName)
      return null
    }

    // Look at furnace
    bot.pathfinder.setGoal(null)
    let goal = new GoalLookAtBlock(furnaceBlock.position, bot.world)

    try {
      await bot.pathfinder.goto(goal)
    } catch (error) {
      console.log('Error looking at furnace')
      return null
    }

    console.log('Opening furnace')
    let furnacePromise = bot.openFurnace(furnaceBlock)

    return furnacePromise
  }

function furnaceUpdate (x,y,z) {

    let furnaceBlock = bot.blockAt(
      new Vec3(
        x,
        y,
        z
      )
    )

    if (furnaceBlock == null) {
        console.log('Furnace block not found')
        return null
    } else if (furnaceBlock.type != minecraftData.blocksByName['furnace'].id) {
        console.log('Block is not a furnace, it is: ' + furnaceBlock.displayName)
        return null
    }

    let furnacePromise = bot.openFurnace(furnaceBlock)
    furnacePromise
      .then(furnace => {
        if (furnace == null) {
          console.log('Error opening furnace')
          return false
        }

        let oldInputItem = furnace.inputItem()
        let oldFuelItem = furnace.fuelItem()
        let oldOutputItem = furnace.outputItem()

        evaluateFurnaceAction(
          request.furnace.input_item,
          oldInputItem,
          furnace.takeInput,
          furnace.putInput
        )

        evaluateFurnaceAction(
          request.furnace.output_item,
          oldOutputItem,
          furnace.takeOutput,
          null
        )

        if (!request.ignore_fuel) {
          evaluateFurnaceAction(
            request.furnace.fuel_item,
            oldFuelItem,
            furnace.takeFuel,
            furnace.putFuel
          )
        }
      })
      .catch(error => {
        console.log('Error opening furnace')
        result.success = false
        response.send(result)
        return
      })

    result.success = true
    response.send(result)
    return
  }

// === // Ros Node // === //

class MinerosBot {
  

}

// Util functions
function itemToItemMsg (item) {
  let itemMsg = rclnodejs.createMessageObject('mineros_inter/msg/Item')
  if (item == null) {
    return itemMsg
  }

  itemMsg.id = item.type
  itemMsg.count = item.count
  itemMsg.slot = item.slot
  itemMsg.metadata = item.metadata
  itemMsg.display_name = item.displayName
  return itemMsg
}

function recipeItemToItemMsg (recipeItem) {
  let itemMsg = rclnodejs.createMessageObject('mineros_inter/msg/Item')
  if (recipeItem == null) {
    return
  }

  itemMsg.id = recipeItem.id
  itemMsg.count = recipeItem.count
  itemMsg.slot = recipeItem.slot
  itemMsg.metadata = recipeItem.metadata
  itemMsg.display_name = recipeItem.displayName
  return itemMsg
}

function recipeToRecipeMsg (recipe) {
  let recipeMsg = rclnodejs.createMessageObject('mineros_inter/msg/Recipe')
  recipeMsg.output_item = recipeItemToItemMsg(recipe.result)
  recipeMsg.input_items = []
  let items = []

  for (let row = 0; row < recipe.inShape.length; row++) {
    let rowItems = recipe.inShape[row]
    for (let col = 0; col < rowItems.length; col++) {
      let item = rowItems[col]
      items.push(item)
    }
  }

  const itemIds = items.map(item => item.id)
  const uniqueItemIds = [...new Set(itemIds)]

  for (let i = 0; i < uniqueItemIds.length; i++) {
    if (uniqueItemIds[i] == -1) {
      continue
    }
    let itemMsg = rclnodejs.createMessageObject('mineros_inter/msg/Item')
    itemMsg.id = uniqueItemIds[i]
    itemMsg.count = itemIds.filter(id => id == uniqueItemIds[i]).length
    itemMsg.metadata = 0
    itemMsg.display_name = items.find(
      item => item.id == uniqueItemIds[i]
    ).displayName
    recipeMsg.input_items.push(itemMsg)
  }

  return recipeMsg
}

function itemEquals (itemMsg, mcItem) {
  return itemMsg.id == mcItem.type && itemMsg.count == mcItem.count
}

function evaluateFurnaceAction (requestItem, oldItem, takeAction, putAction) {
  if (requestItem != null && !itemEquals(requestItem, oldItem)) {
    if (oldItem.count > 0) {
      takeAction()
    }
    if (requestItem.count > 0) {
      if (putAction == null) {
        console.log('Put action is null')
        return
      }
      putAction(requestItem.id, null, requestItem.count)
    }
  }
}

async function main () {
  await rclnodejs.init()
  const minerosBot = new MinerosBot()

  minerosBot.node.spin()
}
