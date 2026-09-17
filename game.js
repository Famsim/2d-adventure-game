"use strict";

/*
  ============================================================
  CHRONICLES OF EMBERWOOD
  Simple 2D Adventure Game
  No external libraries required.
  ============================================================
*/

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const W = canvas.width;
const H = canvas.height;

ctx.imageSmoothingEnabled = false;

// ------------------------------------------------------------
// UI
// ------------------------------------------------------------

const hpUI = document.getElementById("hp");
const xpUI = document.getElementById("xp");
const coinsUI = document.getElementById("coins");
const potionsUI = document.getElementById("potions");

const questText = document.getElementById("quest-text");
const messageBox = document.getElementById("message");

const startScreen = document.getElementById("start-screen");
const startButton = document.getElementById("start-button");

// ------------------------------------------------------------
// Input
// ------------------------------------------------------------

const keys = {};

window.addEventListener("keydown", e => {

  keys[e.code] = true;

  if (
    [
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "Space"
    ].includes(e.code)
  ) {
    e.preventDefault();
  }

  if (e.code === "KeyE" && !e.repeat) {
    interact();
  }

  if (e.code === "KeyQ" && !e.repeat) {
    usePotion();
  }

});

window.addEventListener("keyup", e => {
  keys[e.code] = false;
});

// Mobile buttons

document.querySelectorAll("[data-key]").forEach(button => {

  const key = button.dataset.key;

  const press = e => {
    e.preventDefault();
    keys[key] = true;
  };

  const release = e => {
    e.preventDefault();
    keys[key] = false;
  };

  button.addEventListener("touchstart", press, { passive: false });
  button.addEventListener("touchend", release, { passive: false });
  button.addEventListener("touchcancel", release, { passive: false });

  button.addEventListener("mousedown", press);
  button.addEventListener("mouseup", release);
  button.addEventListener("mouseleave", release);

});

startButton.addEventListener("click", () => {

  startScreen.style.display = "none";

  resetGame();

  showMessage(
    "🌲 Chào mừng đến Emberwood! Hãy tìm trưởng làng."
  );

});

// ------------------------------------------------------------
// Game state
// ------------------------------------------------------------

let running = false;

let world = "village";

let gameTime = 0;

let messageTimer = 0;

let attackCooldown = 0;

let saveTimer = 0;

let player;

let enemies = [];

let particles = [];

let items = [];

let npc;

let boss;

let quest = {
  stage: 0,
  kills: 0
};

// ------------------------------------------------------------
// Player
// ------------------------------------------------------------

function createPlayer() {

  return {

    x: 480,
    y: 300,

    width: 28,
    height: 34,

    speed: 3.2,

    hp: 100,
    maxHp: 100,

    xp: 0,
    level: 1,

    coins: 0,

    potions: 2,

    direction: "down",

    attacking: false,

    invincible: 0

  };

}

// ------------------------------------------------------------
// Reset
// ------------------------------------------------------------

function resetGame() {

  player = createPlayer();

  world = "village";

  quest = {
    stage: 0,
    kills: 0
  };

  createWorld();

  running = true;

  updateUI();

}

// ------------------------------------------------------------
// World generation
// ------------------------------------------------------------

function createWorld() {

  enemies = [];
  items = [];
  particles = [];

  npc = null;
  boss = null;

  if (world === "village") {

    npc = {
      x: 180,
      y: 245,
      type: "elder"
    };

    // Potion shop
    items.push({
      x: 340,
      y: 185,
      type: "potion",
      taken: false
    });

  }

  if (world === "forest") {

    for (let i = 0; i < 6; i++) {

      enemies.push(createEnemy(
        100 + Math.random() * 760,
        100 + Math.random() * 350,
        "slime"
      ));

    }

    for (let i = 0; i < 3; i++) {

      enemies.push(createEnemy(
        150 + Math.random() * 650,
        120 + Math.random() * 300,
        "wolf"
      ));

    }

    items.push({
      x: 760,
      y: 130,
      type: "chest",
      taken: false
    });

  }

  if (world === "dungeon") {

    for (let i = 0; i < 5; i++) {

      enemies.push(createEnemy(
        120 + Math.random() * 700,
        100 + Math.random() * 340,
        "skeleton"
      ));

    }

    boss = {
      x: 720,
      y: 270,
      width: 58,
      height: 65,
      hp: 300,
      maxHp: 300,
      cooldown: 0,
      alive: true
    };

  }

}

// ------------------------------------------------------------
// Enemy creation
// ------------------------------------------------------------

function createEnemy(x, y, type) {

  const data = {

    slime: {
      hp: 45,
      damage: 8,
      speed: 0.75,
      xp: 15,
      coins: 5,
      color: "#65c466"
    },

    wolf: {
      hp: 70,
      damage: 13,
      speed: 1.15,
      xp: 25,
      coins: 9,
      color: "#9aa5b2"
    },

    skeleton: {
      hp: 90,
      damage: 16,
      speed: 0.85,
      xp: 35,
      coins: 14,
      color: "#d8d4c4"
    }

  }[type];

  return {

    x,
    y,

    width: type === "slime" ? 30 : 32,
    height: type === "slime" ? 25 : 38,

    type,

    hp: data.hp,
    maxHp: data.hp,

    damage: data.damage,

    speed: data.speed,

    xp: data.xp,

    coins: data.coins,

    color: data.color,

    alive: true,

    attackCooldown: 0

  };

}

// ------------------------------------------------------------
// Main loop
// ------------------------------------------------------------

let lastTime = 0;

function loop(time) {

  const dt = Math.min((time - lastTime) / 16.67, 2);

  lastTime = time;

  if (running) {

    gameTime += dt;

    update(dt);

    draw();

  }

  requestAnimationFrame(loop);

}

requestAnimationFrame(loop);

// ------------------------------------------------------------
// Update
// ------------------------------------------------------------

function update(dt) {

  if (!player) return;

  updatePlayer(dt);

  updateEnemies(dt);

  updateBoss(dt);

  updateParticles(dt);

  attackCooldown -= dt;

  if (player.invincible > 0) {
    player.invincible -= dt;
  }

  messageTimer -= dt;

  if (messageTimer <= 0) {
    messageBox.classList.remove("show");
  }

  saveTimer += dt;

  if (saveTimer > 300) {

    saveGame();

    saveTimer = 0;

  }

  checkTransitions();

  updateUI();

}

// ------------------------------------------------------------
// Player movement
// ------------------------------------------------------------

function updatePlayer(dt) {

  let dx = 0;
  let dy = 0;

  if (keys.KeyW || keys.ArrowUp) {
    dy -= 1;
    player.direction = "up";
  }

  if (keys.KeyS || keys.ArrowDown) {
    dy += 1;
    player.direction = "down";
  }

  if (keys.KeyA || keys.ArrowLeft) {
    dx -= 1;
    player.direction = "left";
  }

  if (keys.KeyD || keys.ArrowRight) {
    dx += 1;
    player.direction = "right";
  }

  if (dx !== 0 || dy !== 0) {

    const length = Math.sqrt(dx * dx + dy * dy);

    dx /= length;
    dy /= length;

    player.x += dx * player.speed * dt;
    player.y += dy * player.speed * dt;

  }

  // Boundaries

  player.x = Math.max(25, Math.min(W - 25, player.x));
  player.y = Math.max(65, Math.min(H - 30, player.y));

  // Attack

  if (keys.Space && attackCooldown <= 0) {

    attack();

    attackCooldown = 18;

  }

}

// ------------------------------------------------------------
// Attack
// ------------------------------------------------------------

function attack() {

  player.attacking = true;

  setTimeout(() => {
    player.attacking = false;
  }, 120);

  const range = 65;

  enemies.forEach(enemy => {

    if (!enemy.alive) return;

    const distance = Math.hypot(
      enemy.x - player.x,
      enemy.y - player.y
    );

    if (distance <= range) {

      let damage = 25 + player.level * 5;

      enemy.hp -= damage;

      spawnHit(enemy.x, enemy.y);

      if (enemy.hp <= 0) {

        enemy.alive = false;

        player.xp += enemy.xp;
        player.coins += enemy.coins;

        quest.kills++;

        showMessage(
          `⚔️ Hạ ${enemy.type}! +${enemy.xp} XP +${enemy.coins} 🪙`
        );

        checkLevel();

        if (quest.stage === 1 && quest.kills >= 5) {

          quest.stage = 2;

          showMessage(
            "✨ Bạn đã hạ đủ quái! Hãy quay về gặp trưởng làng."
          );

        }

      }

    }

  });

  if (boss && boss.alive) {

    const distance = Math.hypot(
      boss.x - player.x,
      boss.y - player.y
    );

    if (distance <= range + 15) {

      const damage = 20 + player.level * 5;

      boss.hp -= damage;

      spawnHit(boss.x, boss.y);

      if (boss.hp <= 0) {

        boss.alive = false;

        player.xp += 200;
        player.coins += 100;

        quest.stage = 4;

        showMessage(
          "🏆 BOSS BỊ ĐÁNH BẠI! Emberwood đã được cứu!"
        );

        saveGame();

      }

    }

  }

}

// ------------------------------------------------------------
// Enemies
// ------------------------------------------------------------

function updateEnemies(dt) {

  enemies.forEach(enemy => {

    if (!enemy.alive) return;

    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;

    const distance = Math.hypot(dx, dy);

    if (distance < 280 && distance > 38) {

      enemy.x += (dx / distance) * enemy.speed * dt;
      enemy.y += (dy / distance) * enemy.speed * dt;

    }

    enemy.attackCooldown -= dt;

    if (distance <= 42 && enemy.attackCooldown <= 0) {

      damagePlayer(enemy.damage);

      enemy.attackCooldown = 65;

    }

    enemy.x = Math.max(35, Math.min(W - 35, enemy.x));
    enemy.y = Math.max(75, Math.min(H - 35, enemy.y));

  });

}

// ------------------------------------------------------------
// Boss
// ------------------------------------------------------------

function updateBoss(dt) {

  if (!boss || !boss.alive) return;

  const dx = player.x - boss.x;
  const dy = player.y - boss.y;

  const distance = Math.hypot(dx, dy);

  if (distance < 400 && distance > 75) {

    boss.x += (dx / distance) * 0.55 * dt;
    boss.y += (dy / distance) * 0.55 * dt;

  }

  boss.cooldown -= dt;

  if (distance < 85 && boss.cooldown <= 0) {

    damagePlayer(25);

    boss.cooldown = 80;

  }

}

// ------------------------------------------------------------
// Damage
// ------------------------------------------------------------

function damagePlayer(amount) {

  if (player.invincible > 0) return;

  player.hp -= amount;

  player.invincible = 40;

  spawnHit(player.x, player.y);

  showMessage(`💥 Bạn mất ${amount} HP!`);

  if (player.hp <= 0) {

    player.hp = player.maxHp;

    player.x = 480;
    player.y = 300;

    world = "village";

    quest.stage = Math.max(quest.stage, 0);

    createWorld();

    showMessage(
      "☠️ Bạn đã gục ngã... Trưởng làng đã đưa bạn về làng."
    );

  }

}

// ------------------------------------------------------------
// Interaction
// ------------------------------------------------------------

function interact() {

  if (!player) return;

  // NPC

  if (npc) {

    const distance = Math.hypot(
      npc.x - player.x,
      npc.y - player.y
    );

    if (distance < 70) {

      talkToElder();

      return;

    }

  }

  // Items

  items.forEach(item => {

    if (item.taken) return;

    const distance = Math.hypot(
      item.x - player.x,
      item.y - player.y
    );

    if (distance < 55) {

      if (item.type === "potion") {

        item.taken = true;

        player.potions++;

        showMessage(
          "🧪 Bạn nhặt được một Potion!"
        );

      }

      if (item.type === "chest") {

        item.taken = true;

        player.coins += 50;
        player.potions += 2;

        showMessage(
          "🎁 Mở rương! +50 🪙 và +2 🧪"
        );

      }

    }

  });

}

// ------------------------------------------------------------
// NPC
// ------------------------------------------------------------

function talkToElder() {

  if (quest.stage === 0) {

    quest.stage = 1;

    showMessage(
      "🧙 Trưởng làng: Quái vật đang tấn công khu rừng! Hãy hạ 5 con quái."
    );

  }

  else if (quest.stage === 1) {

    showMessage(
      `🧙 Trưởng làng: Bạn đã hạ ${quest.kills}/5 con quái.`
    );

  }

  else if (quest.stage === 2) {

    quest.stage = 3;

    showMessage(
      "🧙 Trưởng làng: Tốt lắm! Cánh cửa phía đông đã mở. Hãy vào hầm ngục!"
    );

  }

  else if (quest.stage === 3) {

    showMessage(
      "🧙 Trưởng làng: Hãy đánh bại Chúa tể Bóng Tối."
    );

  }

  else if (quest.stage === 4) {

    showMessage(
      "🏆 Trưởng làng: Emberwood sẽ luôn nhớ đến người hùng của chúng ta!"
    );

  }

}

// ------------------------------------------------------------
// Potions
// ------------------------------------------------------------

function usePotion() {

  if (!player) return;

  if (player.potions <= 0) {

    showMessage("❌ Bạn không còn Potion.");

    return;

  }

  if (player.hp >= player.maxHp) {

    showMessage("❤️ Máu của bạn đang đầy.");

    return;

  }

  player.potions--;

  const heal = 40;

  player.hp = Math.min(
    player.maxHp,
    player.hp + heal
  );

  showMessage(
    `🧪 Hồi ${heal} HP!`
  );

}

// ------------------------------------------------------------
// Level
// ------------------------------------------------------------

function checkLevel() {

  const needed = player.level * 100;

  if (player.xp >= needed) {

    player.xp -= needed;

    player.level++;

    player.maxHp += 20;

    player.hp = player.maxHp;

    showMessage(
      `⭐ LÊN CẤP ${player.level}! Máu tối đa +20`
    );

  }

}

// ------------------------------------------------------------
// World transitions
// ------------------------------------------------------------

function checkTransitions() {

  if (world === "village") {

    // East gate

    if (player.x > W - 35) {

      if (quest.stage >= 1) {

        world = "forest";

        player.x = 50;

        createWorld();

        showMessage(
          "🌲 Bạn bước vào khu rừng Emberwood."
        );

      } else {

        player.x = W - 40;

        showMessage(
          "🚧 Trưởng làng chưa cho phép bạn vào rừng."
        );

      }

    }

  }

  else if (world === "forest") {

    if (player.x < 30) {

      world = "village";

      player.x = W - 50;

      createWorld();

      showMessage(
        "🏘️ Bạn trở về làng."
      );

    }

    // Dungeon entrance

    if (
      player.x > W - 100 &&
      player.y < 150 &&
      quest.stage >= 2
    ) {

      world = "dungeon";

      player.x = 100;
      player.y = 300;

      createWorld();

      showMessage(
        "🏰 Bạn tiến vào Hầm ngục Bóng Tối!"
      );

    }

  }

  else if (world === "dungeon") {

    if (player.x < 30) {

      world = "forest";

      player.x = W - 50;

      player.y = 300;

      createWorld();

      showMessage(
        "🌲 Bạn rời khỏi hầm ngục."
      );

    }

  }

}

// ------------------------------------------------------------
// Save
// ------------------------------------------------------------

function saveGame() {

  if (!player) return;

  const data = {

    player: {
      hp: player.hp,
      maxHp: player.maxHp,
      xp: player.xp,
      level: player.level,
      coins: player.coins,
      potions: player.potions
    },

    quest

  };

  localStorage.setItem(
    "emberwood-save",
    JSON.stringify(data)
  );

}

// ------------------------------------------------------------
// Load
// ------------------------------------------------------------

function loadGame() {

  const raw = localStorage.getItem(
    "emberwood-save"
  );

  if (!raw) return false;

  try {

    const data = JSON.parse(raw);

    player = createPlayer();

    Object.assign(
      player,
      data.player
    );

    quest = data.quest || {
      stage: 0,
      kills: 0
    };

    world = "village";

    createWorld();

    running = true;

    startScreen.style.display = "none";

    showMessage(
      "💾 Đã tải lại game!"
    );

    return true;

  } catch {

    return false;

  }

}

// ------------------------------------------------------------
// UI
// ------------------------------------------------------------

function updateUI() {

  if (!player) return;

  hpUI.textContent = Math.max(
    0,
    Math.floor(player.hp)
  );

  xpUI.textContent =
    `${player.xp} / ${player.level * 100}`;

  coinsUI.textContent =
    player.coins;

  potionsUI.textContent =
    player.potions;

  let text = "";

  if (quest.stage === 0) {

    text =
      "Hãy nói chuyện với trưởng làng.";

  }

  else if (quest.stage === 1) {

    text =
      `Hạ quái vật: ${quest.kills}/5`;

  }

  else if (quest.stage === 2) {

    text =
      "Quay về gặp trưởng làng.";

  }

  else if (quest.stage === 3) {

    text =
      "Tiến vào hầm ngục và đánh bại Boss.";

  }

  else {

    text =
      "🏆 Emberwood đã được cứu!";

  }

  questText.textContent = text;

}

// ------------------------------------------------------------
// Messages
// ------------------------------------------------------------

function showMessage(text) {

  messageBox.textContent = text;

  messageBox.classList.add("show");

  messageTimer = 160;

}

// ------------------------------------------------------------
// Particles
// ------------------------------------------------------------

function spawnHit(x, y) {

  for (let i = 0; i < 7; i++) {

    particles.push({

      x,
      y,

      vx: (Math.random() - 0.5) * 4,
      vy: (Math.random() - 0.5) * 4,

      life: 25,

      size: 3 + Math.random() * 4

    });

  }

}

function updateParticles(dt) {

  particles.forEach(p => {

    p.x += p.vx * dt;
    p.y += p.vy * dt;

    p.life -= dt;

  });

  particles =
    particles.filter(p => p.life > 0);

}

// ------------------------------------------------------------
// Drawing
// ------------------------------------------------------------

function draw() {

  ctx.clearRect(0, 0, W, H);

  drawBackground();

  if (world === "village") {

    drawVillage();

  }

  else if (world === "forest") {

    drawForest();

  }

  else if (world === "dungeon") {

    drawDungeon();

  }

  drawItems();

  drawNPC();

  drawEnemies();

  drawBoss();

  drawPlayer();

  drawParticles();

}

// ------------------------------------------------------------
// Background
// ------------------------------------------------------------

function drawBackground() {

  if (world === "village") {

    ctx.fillStyle = "#6f9d55";

  }

  else if (world === "forest") {

    ctx.fillStyle = "#315d3b";

  }

  else {

    ctx.fillStyle = "#22252e";

  }

  ctx.fillRect(0, 0, W, H);

}

// ------------------------------------------------------------
// Village
// ------------------------------------------------------------

function drawVillage() {

  // Paths

  ctx.fillStyle = "#c5a76b";

  ctx.fillRect(0, 250, W, 80);
  ctx.fillRect(430, 0, 100, H);

  // Houses

  drawHouse(80, 90);
  drawHouse(650, 90);

  // Fountain

  ctx.fillStyle = "#777f91";
  ctx.fillRect(390, 205, 90, 45);

  ctx.fillStyle = "#6ab7d9";
  ctx.fillRect(400, 215, 70, 25);

  // Trees

  for (let i = 0; i < 14; i++) {

    const x =
      (i * 137) % W;

    const y =
      70 + ((i * 83) % 400);

    if (
      x > 350 &&
      x < 570
    ) continue;

    drawTree(x, y);

  }

  // Gate

  ctx.fillStyle = "#7b4b27";

  ctx.fillRect(
    W - 40,
    220,
    40,
    120
  );

  ctx.fillStyle = "#ffd35a";

  ctx.font = "bold 14px Arial";

  ctx.fillText(
    "RỪNG →",
    W - 125,
    205
  );

}

// ------------------------------------------------------------
// Forest
// ------------------------------------------------------------

function drawForest() {

  // Grass texture

  ctx.strokeStyle = "#3f7549";

  for (let x = 0; x < W; x += 30) {

    for (let y = 70; y < H; y += 30) {

      ctx.beginPath();

      ctx.moveTo(x, y);
      ctx.lineTo(x + 5, y - 7);

      ctx.stroke();

    }

  }

  // Trees

  for (let i = 0; i < 35; i++) {

    const x =
      20 + ((i * 173) % (W - 40));

    const y =
      80 + ((i * 97) % (H - 110));

    drawTree(x, y);

  }

  // Dungeon gate

  ctx.fillStyle = "#17151b";

  ctx.fillRect(
    W - 105,
    65,
    75,
    105
  );

  ctx.fillStyle = "#8b6b4a";

  ctx.fillRect(
    W - 112,
    165,
    90,
    10
  );

  ctx.fillStyle = "#ffcf58";

  ctx.font = "bold 12px Arial";

  ctx.fillText(
    "HẦM NGỤC",
    W - 108,
    190
  );

}

// ------------------------------------------------------------
// Dungeon
// ------------------------------------------------------------

function drawDungeon() {

  ctx.fillStyle = "#252833";

  ctx.fillRect(0, 0, W, H);

  // Tiles

  ctx.strokeStyle = "#333744";

  for (let x = 0; x < W; x += 48) {

    for (let y = 65; y < H; y += 48) {

      ctx.strokeRect(
        x,
        y,
        48,
        48
      );

    }

  }

  // Torches

  drawTorch(80, 100);
  drawTorch(880, 100);
  drawTorch(80, 440);
  drawTorch(880, 440);

  // Entrance

  ctx.fillStyle = "#0d0d10";

  ctx.fillRect(
    0,
    220,
    60,
    100
  );

}

// ------------------------------------------------------------
// House
// ------------------------------------------------------------

function drawHouse(x, y) {

  ctx.fillStyle = "#d0b181";

  ctx.fillRect(
    x,
    y + 35,
    120,
    90
  );

  ctx.fillStyle = "#7a3d35";

  ctx.beginPath();

  ctx.moveTo(x - 10, y + 40);
  ctx.lineTo(x + 60, y - 10);
  ctx.lineTo(x + 130, y + 40);

  ctx.closePath();

  ctx.fill();

  ctx.fillStyle = "#5b3929";

  ctx.fillRect(
    x + 45,
    y + 75,
    30,
    50
  );

}

// ------------------------------------------------------------
// Tree
// ------------------------------------------------------------

function drawTree(x, y) {

  ctx.fillStyle = "#66452d";

  ctx.fillRect(
    x - 7,
    y,
    14,
    35
  );

  ctx.fillStyle = "#1d4930";

  ctx.beginPath();

  ctx.arc(
    x,
    y - 5,
    26,
    0,
    Math.PI * 2
  );

  ctx.fill();

  ctx.fillStyle = "#2d6840";

  ctx.beginPath();

  ctx.arc(
    x - 15,
    y + 5,
    18,
    0,
    Math.PI * 2
  );

  ctx.arc(
    x + 15,
    y + 5,
    18,
    0,
    Math.PI * 2
  );

  ctx.fill();

}

// ------------------------------------------------------------
// Torch
// ------------------------------------------------------------

function drawTorch(x, y) {

  ctx.fillStyle = "#6c492f";

  ctx.fillRect(
    x,
    y,
    8,
    35
  );

  ctx.fillStyle = "#ff9d22";

  ctx.beginPath();

  ctx.arc(
    x + 4,
    y - 4,
    12 + Math.sin(gameTime / 4) * 3,
    0,
    Math.PI * 2
  );

  ctx.fill();

}

// ------------------------------------------------------------
// NPC
// ------------------------------------------------------------

function drawNPC() {

  if (!npc) return;

  // Body

  ctx.fillStyle = "#6f4aa8";

  ctx.fillRect(
    npc.x - 13,
    npc.y - 4,
    26,
    35
  );

  // Head

  ctx.fillStyle = "#e5b27d";

  ctx.fillRect(
    npc.x - 11,
    npc.y - 25,
    22,
    22
  );

  // Hair

  ctx.fillStyle = "#e0d6bd";

  ctx.fillRect(
    npc.x - 13,
    npc.y - 29,
    26,
    8
  );

  ctx.fillStyle = "#ffe26b";

  ctx.font = "bold 13px Arial";

  ctx.fillText(
    "🧙",
    npc.x - 9,
    npc.y - 40
  );

  if (
    Math.hypot(
      npc.x - player.x,
      npc.y - player.y
    ) < 90
  ) {

    ctx.fillText(
      "E",
      npc.x - 4,
      npc.y + 48
    );

  }

}

// ------------------------------------------------------------
// Items
// ------------------------------------------------------------

function drawItems() {

  items.forEach(item => {

    if (item.taken) return;

    if (item.type === "potion") {

      ctx.fillStyle = "#d84d72";

      ctx.fillRect(
        item.x - 9,
        item.y - 10,
        18,
        22
      );

      ctx.fillStyle = "#d8d8d8";

      ctx.fillRect(
        item.x - 6,
        item.y - 17,
        12,
        7
      );

      ctx.fillStyle = "#fff";

      ctx.font = "12px Arial";

      ctx.fillText(
        "🧪",
        item.x - 9,
        item.y + 37
      );

    }

    if (item.type === "chest") {

      ctx.fillStyle = "#a86d2e";

      ctx.fillRect(
        item.x - 20,
        item.y - 12,
        40,
        28
      );

      ctx.fillStyle = "#e6bf42";

      ctx.fillRect(
        item.x - 3,
        item.y - 2,
        6,
        9
      );

    }

  });

}

// ------------------------------------------------------------
// Enemies
// ------------------------------------------------------------

function drawEnemies() {

  enemies.forEach(enemy => {

    if (!enemy.alive) return;

    if (enemy.type === "slime") {

      ctx.fillStyle = enemy.color;

      ctx.beginPath();

      ctx.arc(
        enemy.x,
        enemy.y,
        18,
        Math.PI,
        0
      );

      ctx.lineTo(
        enemy.x + 18,
        enemy.y + 10
      );

      ctx.lineTo(
        enemy.x - 18,
        enemy.y + 10
      );

      ctx.closePath();

      ctx.fill();

      // eyes

      ctx.fillStyle = "#111";

      ctx.fillRect(
        enemy.x - 7,
        enemy.y - 2,
        4,
        5
      );

      ctx.fillRect(
        enemy.x + 4,
        enemy.y - 2,
        4,
        5
      );

    }

    else {

      ctx.fillStyle = enemy.color;

      ctx.fillRect(
        enemy.x - 13,
        enemy.y - 17,
        26,
        34
      );

      ctx.fillStyle = "#171717";

      ctx.fillRect(
        enemy.x - 8,
        enemy.y - 8,
        5,
        5
      );

      ctx.fillRect(
        enemy.x + 3,
        enemy.y - 8,
        5,
        5
      );

    }

    // HP bar

    const barWidth = 38;

    ctx.fillStyle = "#36191b";

    ctx.fillRect(
      enemy.x - barWidth / 2,
      enemy.y - 30,
      barWidth,
      5
    );

    ctx.fillStyle = "#e65353";

    ctx.fillRect(
      enemy.x - barWidth / 2,
      enemy.y - 30,
      barWidth * (enemy.hp / enemy.maxHp),
      5
    );

  });

}

// ------------------------------------------------------------
// Boss
// ------------------------------------------------------------

function drawBoss() {

  if (!boss || !boss.alive) return;

  ctx.fillStyle = "#6e283d";

  ctx.fillRect(
    boss.x - 28,
    boss.y - 30,
    56,
    60
  );

  ctx.fillStyle = "#d9b8b8";

  ctx.fillRect(
    boss.x - 20,
    boss.y - 52,
    40,
    30
  );

  // Horns

  ctx.fillStyle = "#e2d2aa";

  ctx.beginPath();

  ctx.moveTo(boss.x - 18, boss.y - 48);
  ctx.lineTo(boss.x - 35, boss.y - 75);
  ctx.lineTo(boss.x - 8, boss.y - 55);

  ctx.fill();

  ctx.beginPath();

  ctx.moveTo(boss.x + 18, boss.y - 48);
  ctx.lineTo(boss.x + 35, boss.y - 75);
  ctx.lineTo(boss.x + 8, boss.y - 55);

  ctx.fill();

  ctx.fillStyle = "#ff3838";

  ctx.fillRect(
    boss.x - 13,
    boss.y - 43,
    7,
    7
  );

  ctx.fillRect(
    boss.x + 6,
    boss.y - 43,
    7,
    7
  );

  // Boss HP

  ctx.fillStyle = "#160d12";

  ctx.fillRect(
    boss.x - 55,
    boss.y - 90,
    110,
    10
  );

  ctx.fillStyle = "#e22d4c";

  ctx.fillRect(
    boss.x - 55,
    boss.y - 90,
    110 * (boss.hp / boss.maxHp),
    10
  );

  ctx.fillStyle = "#fff";

  ctx.font = "bold 13px Arial";

  ctx.fillText(
    "👑 SHADOW LORD",
    boss.x - 55,
    boss.y - 100
  );

}

// ------------------------------------------------------------
// Player
// ------------------------------------------------------------

function drawPlayer() {

  if (
    player.invincible > 0 &&
    Math.floor(player.invincible / 5) % 2 === 0
  ) {
    return;
  }

  // Shadow

  ctx.fillStyle = "rgba(0,0,0,0.3)";

  ctx.beginPath();

  ctx.ellipse(
    player.x,
    player.y + 18,
    18,
    7,
    0,
    0,
    Math.PI * 2
  );

  ctx.fill();

  // Body

  ctx.fillStyle = "#3f75c4";

  ctx.fillRect(
    player.x - 14,
    player.y - 5,
    28,
    32
  );

  // Head

  ctx.fillStyle = "#e6b080";

  ctx.fillRect(
    player.x - 12,
    player.y - 28,
    24,
    23
  );

  // Hair

  ctx.fillStyle = "#3c2a25";

  ctx.fillRect(
    player.x - 13,
    player.y - 32,
    26,
    8
  );

  // Eyes

  ctx.fillStyle = "#111";

  if (player.direction !== "up") {

    ctx.fillRect(
      player.x - 7,
      player.y - 18,
      4,
      4
    );

    ctx.fillRect(
      player.x + 3,
      player.y - 18,
      4,
      4
    );

  }

  // Sword

  ctx.strokeStyle = "#e2e6ef";

  ctx.lineWidth = 5;

  ctx.beginPath();

  if (player.direction === "right") {

    ctx.moveTo(player.x + 10, player.y + 5);
    ctx.lineTo(player.x + 35, player.y - 15);

  }

  else if (player.direction === "left") {

    ctx.moveTo(player.x - 10, player.y + 5);
    ctx.lineTo(player.x - 35, player.y - 15);

  }

  else if (player.direction === "up") {

    ctx.moveTo(player.x + 8, player.y);
    ctx.lineTo(player.x + 8, player.y - 35);

  }

  else {

    ctx.moveTo(player.x + 8, player.y);
    ctx.lineTo(player.x + 30, player.y + 25);

  }

  ctx.stroke();

  // Attack effect

  if (player.attacking) {

    ctx.strokeStyle = "#fff0a0";

    ctx.lineWidth = 4;

    ctx.beginPath();

    ctx.arc(
      player.x,
      player.y,
      48,
      0,
      Math.PI * 1.4
    );

    ctx.stroke();

  }

}

// ------------------------------------------------------------
// Particles
// ------------------------------------------------------------

function drawParticles() {

  particles.forEach(p => {

    ctx.fillStyle = "#ffd65a";

    ctx.fillRect(
      p.x,
      p.y,
      p.size,
      p.size
    );

  });

}

// ------------------------------------------------------------
// Save before leaving
// ------------------------------------------------------------

window.addEventListener("beforeunload", () => {

  saveGame();

});

// Try loading existing save

if (localStorage.getItem("emberwood-save")) {

  startButton.textContent =
    "▶ TIẾP TỤC PHIÊU LƯU";

}
