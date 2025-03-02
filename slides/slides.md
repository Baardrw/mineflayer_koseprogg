---
marp: true
theme: default
paginate: true
backgroundColor: #fff
---

<!-- _class: lead -->

# Building Minecraft Bots with Mineflayer

A quick guide to creating Minecraft bots with JavaScript

![bg right:40% w:500](https://logolook.net/wp-content/uploads/2021/06/Symbol-Minecraft.png)

---

# What is Mineflayer?

Mineflayer is a powerful JavaScript library that lets you create **programmable Minecraft bots**.

![bg right:30% w:300](https://www.the-sun.com/wp-content/uploads/sites/6/2023/01/lv-ai-bot-almost-lands-job-off-platform.jpg?strip=all&quality=100&w=1920&h=1080&crop=1)

---

# How Mineflayer Works

```javascript
const mineflayer = require('mineflayer')

const bot = mineflayer.createBot({
  host: 'localhost', // Server address
  port: 25565, // Server port
  username: 'MyBot', // Bot username
  auth: 'offline' // Auth type
})

bot.on('spawn', () => {
  bot.chat('Hello world!')
})
```

---

# Setting Up Your Development Environment

## Prerequisites:

- Node.js (version 18 or newer)
- NPM (comes with Node.js)
- Code editor (e.g., VS Code)
- Minecraft Java Edition server
- Alternativley you can use the Dockerfile provided

---

# Using the Dockerfile

- To build the Docker image, run:
  ```bash
  docker build -t my-bot .
  ```
- To run the Docker container, run:
  ```bash
  docker run --network="host" my-bot
  ```
- The dockerfile runs your_code.js

---

# Key Concepts in Mineflayer

## Event-Driven Programming

Respond to in-game events using event listeners

```javascript
bot.on('chat', (username, message) => {
  if (username === bot.username) return
  bot.chat(`You said: ${message}`)
})
```

---

## Async/Await

Most Mineflayer actions return promises

```javascript
async function goMining() {
  const block = bot.findBlock({ matching: 'diamond_ore' })
  await bot.pathfinder.goto(block.position)
  await bot.dig(block)
}
```

---

# Working with Minecraft Data

Converting between names and IDs is a common challenge:

```javascript
// Initialize minecraft-data with your bot's version
const minecraftData = require('minecraft-data')(bot.version)

// Get block ID from name
function getBlockId(blockName) {
  const block = minecraftData.blocksByName[blockName]
  if (!block) return null
  return block.id
}

// Get item ID from name
function getItemId(itemName) {
  const item = minecraftData.itemsByName[itemName]
  if (!item) return null
  return item.id
}
```

![bg right:30% w:300](https://www.pngkey.com/png/full/819-8194355_minecraft-pickaxe-diamond-fte-remixit-ftestickers-freet-items.png)

---

# Working with Positions and Vectors

Always use Vec3 for position calculations:

```javascript
const Vec3 = require('vec3').Vec3

// Create a position
const position = new Vec3(0, 64, 0)

// Get position above a block
const blockAbove = position.offset(0, 1, 0)

// Calculate distance
const distance = position.distanceTo(bot.entity.position)

// Get direction vector
const direction = position.minus(bot.entity.position).normalize()
```

![bg right:30% w:300](https://media.entertainmentearth.com/assets/images/a0fb7839592f414983c8fc6290cd5ce8xl.jpg)

---

<!-- _class: lead -->

# Example Functions

I have several example functions that I have stolen from another course that Ive held. They are all in the example.js file. And are all quickly presented in the README.md file.

![bg right:30% w:600](https://i.kym-cdn.com/entries/icons/original/000/044/615/minecraftdirt.jpg)

---


## Lets make some bots

* Many things that you can do with the bot, here are some examples:

1. **Respond to commands** via chat
2. **Gather resources** for you automatically
3. **Craft items** when needed
4. **Build structures** Very Hard
5. **Fight enemies** and protect you
6. **Explore the world** and map it out
7. **Follow you** around 

* To make things easy most of these above things can be done by combining the functions I have in the example.js file.


---


# Thank You!

## Resources:

- Official Docs: https://github.com/PrismarineJS/mineflayer/blob/master/docs/api.md
- Examples: https://github.com/PrismarineJS/mineflayer/tree/master/examples


