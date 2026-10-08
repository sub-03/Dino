const canvas = document.querySelector('#game-canvas');
const context = canvas.getContext('2d');
const scoreElement = document.querySelector('#score');
const bestScoreElement = document.querySelector('#best-score');
const finalScoreElement = document.querySelector('#final-score');
const speedMeterFill = document.querySelector('#speed-meter-fill');
const startOverlay = document.querySelector('#start-overlay');
const pauseOverlay = document.querySelector('#pause-overlay');
const gameoverOverlay = document.querySelector('#gameover-overlay');
const startButton = document.querySelector('#start-button');
const resumeButton = document.querySelector('#resume-button');
const restartButton = document.querySelector('#restart-button');
const pauseButton = document.querySelector('#pause-button');
const mobilePauseButton = document.querySelector('#mobile-pause-button');
const jumpButton = document.querySelector('#jump-button');
const slideButton = document.querySelector('#slide-button');
const scoreLabel = document.querySelector('#score-label');
const livesElement = document.querySelector('#lives');
const collectElement = document.querySelector('#collect-count');
const targetElement = document.querySelector('#target-status');
const powerupElement = document.querySelector('#powerup-status');
const unlockElement = document.querySelector('#unlock-status');

const WORLD_WIDTH = 960;
const WORLD_HEIGHT = 540;
const GROUND_Y = 410;
const PLAYER_X = 150;
const PLAYER_WIDTH = 54;
const PLAYER_HEIGHT = 67;
const PLAYER_SPRITE_FRAME_COUNT = 5;
const PLAYER_SPRITE_FRAME_WIDTH = 124;
const PLAYER_SPRITE_FRAME_HEIGHT = 199;
const GRAVITY = 1650;
const JUMP_VELOCITY = -650;
const MAX_LIVES = 3;
const TARGET_DISTANCE = 500;
const TARGET_SEEDS = 20;

let bestScore = Number(localStorage.getItem('sprout-sprint-best') || 0);
let gameState = 'ready';
let score = 0;
let speed = 280;
let worldTime = 0;
let lastTime = 0;
let spawnTimer = 0;
let nextSpawn = 1.25;
let animationFrame;
let obstacles = [];
let particles = [];
let collectibles = [];
let powerups = [];
let lives = MAX_LIVES;
let seeds = 0;
let jumpCount = 0;
let isSliding = false;
let activePowerup = null;
let powerupTime = 0;
let eventType = 'clear';
let eventTimer = 0;
let unlockedScene = bestScore >= 500 ? 1 : 0;
let unlockedCharacter = bestScore >= 800 ? 1 : 0;
const playerSprite = new Image();
playerSprite.src = './wani2-sheet.png';
const player = { y: GROUND_Y - PLAYER_HEIGHT, velocityY: 0, grounded: true, runTime: 0 };

bestScoreElement.textContent = formatScore(bestScore);

function formatScore(value) {
  return Math.floor(value).toString().padStart(5, '0');
}

function resizeCanvas() {
  const ratio = window.devicePixelRatio || 1;
  canvas.width = WORLD_WIDTH * ratio;
  canvas.height = WORLD_HEIGHT * ratio;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function resetGame() {
  score = 0;
  speed = 280;
  worldTime = 0;
  spawnTimer = 0;
  nextSpawn = 1.25;
  obstacles = [];
  particles = [];
  collectibles = [];
  powerups = [];
  lives = MAX_LIVES;
  seeds = 0;
  jumpCount = 0;
  isSliding = false;
  activePowerup = null;
  powerupTime = 0;
  eventType = 'clear';
  eventTimer = 0;
  player.y = GROUND_Y - PLAYER_HEIGHT;
  player.velocityY = 0;
  player.grounded = true;
  player.runTime = 0;
  updateHud();
}

function startGame() {
  resetGame();
  gameState = 'running';
  startOverlay.classList.add('is-hidden');
  pauseOverlay.classList.add('is-hidden');
  gameoverOverlay.classList.add('is-hidden');
  pauseButton.disabled = false;
  mobilePauseButton.disabled = false;
  lastTime = performance.now();
  cancelAnimationFrame(animationFrame);
  animationFrame = requestAnimationFrame(gameLoop);
}

function endGame() {
  gameState = 'gameover';
  const finalValue = Math.floor(score);
  if (finalValue > bestScore) {
    bestScore = finalValue;
    localStorage.setItem('sprout-sprint-best', bestScore);
    bestScoreElement.textContent = formatScore(bestScore);
  }
  finalScoreElement.textContent = finalValue;
  pauseButton.disabled = true;
  mobilePauseButton.disabled = true;
  gameoverOverlay.classList.remove('is-hidden');
  burstParticles(PLAYER_X + 30, player.y + 35, '#e8795d', 16);
}

function loseLife(obstacle) {
  if (activePowerup === 'shield' || activePowerup === 'invincible') return;
  lives -= 1;
  burstParticles(obstacle.x, GROUND_Y - obstacle.height, '#e8795d', 18);
  obstacles = obstacles.filter((item) => item !== obstacle);
  if (lives <= 0) endGame();
  else {
    player.velocityY = -360;
    activePowerup = 'shield';
    powerupTime = 1.8;
  }
}

function togglePause() {
  if (gameState === 'running') {
    gameState = 'paused';
    pauseOverlay.classList.remove('is-hidden');
    pauseButton.setAttribute('aria-label', '繼續遊戲');
    mobilePauseButton.querySelector('small').textContent = '繼續';
  } else if (gameState === 'paused') {
    gameState = 'running';
    pauseOverlay.classList.add('is-hidden');
    pauseButton.setAttribute('aria-label', '暫停遊戲');
    mobilePauseButton.querySelector('small').textContent = '暫停';
    lastTime = performance.now();
    animationFrame = requestAnimationFrame(gameLoop);
  }
}

function jump() {
  if (gameState === 'ready' || gameState === 'gameover') {
    startGame();
    return;
  }
  if (gameState !== 'running' || isSliding || (!player.grounded && jumpCount >= 2)) return;
  player.velocityY = JUMP_VELOCITY;
  player.grounded = false;
  jumpCount += 1;
  burstParticles(PLAYER_X + 20, GROUND_Y - 4, '#f5c96a', 7);
}

function setSliding(value) {
  if (gameState === 'running' && player.grounded) isSliding = value;
}

function spawnObstacle() {
  const roll = Math.random();
  const tall = roll > .55;
  obstacles.push({
    x: WORLD_WIDTH + 30,
    width: roll < .18 ? 70 : tall ? 35 : 52,
    height: roll < .18 ? 72 : tall ? 55 : 31,
    kind: roll < .18 ? 'flying' : tall ? 'thorn' : 'stone',
    wobble: Math.random() * Math.PI * 2
  });
  if (Math.random() < .48) spawnCollectible(WORLD_WIDTH + 110);
  if (Math.random() < .14) spawnPowerup(WORLD_WIDTH + 180);
  nextSpawn = Math.max(.75, 1.4 - (speed - 280) / 800) + Math.random() * .72;
}

function spawnCollectible(x) {
  collectibles.push({ x, y: GROUND_Y - 90 - Math.random() * 105, type: Math.random() < .7 ? 'seed' : 'star', spin: 0 });
}

function spawnPowerup(x) {
  const types = ['shield', 'magnet', 'slow', 'invincible'];
  powerups.push({ x, y: GROUND_Y - 100 - Math.random() * 90, type: types[Math.floor(Math.random() * types.length)], spin: 0 });
}

function burstParticles(x, y, color, count) {
  for (let index = 0; index < count; index += 1) {
    particles.push({ x, y, color, life: .45 + Math.random() * .35, velocityX: (Math.random() - .5) * 100, velocityY: -Math.random() * 140 - 25, size: 2 + Math.random() * 3 });
  }
}

function update(delta) {
  worldTime += delta;
  score += delta * (speed / 32);
  speed = Math.min(540, 280 + worldTime * 8);
  eventTimer += delta;
  if (eventTimer > 10) { eventTimer = 0; eventType = ['clear', 'rain', 'night', 'wind'][Math.floor(Math.random() * 4)]; }
  if (activePowerup) {
    powerupTime -= delta;
    if (powerupTime <= 0) activePowerup = null;
  }
  player.runTime += delta * (speed / 38);
  const movementSpeed = activePowerup === 'slow' ? speed * .56 : speed;
  player.velocityY += GRAVITY * delta;
  player.y += player.velocityY * delta;
  if (player.y >= GROUND_Y - PLAYER_HEIGHT) {
    if (!player.grounded) burstParticles(PLAYER_X + 20, GROUND_Y - 3, '#f5c96a', 5);
    player.y = GROUND_Y - PLAYER_HEIGHT;
    player.velocityY = 0;
    player.grounded = true;
    jumpCount = 0;
  }

  spawnTimer += delta;
  if (spawnTimer >= nextSpawn) {
    spawnTimer = 0;
    spawnObstacle();
  }
  obstacles.forEach((obstacle) => { obstacle.x -= movementSpeed * delta; obstacle.wobble += delta * 3; });
  obstacles = obstacles.filter((obstacle) => obstacle.x + obstacle.width > -30);
  collectibles.forEach((item) => { item.x -= movementSpeed * delta; item.spin += delta * 5; });
  collectibles = collectibles.filter((item) => item.x > -40);
  powerups.forEach((item) => { item.x -= movementSpeed * delta; item.spin += delta * 4; });
  powerups = powerups.filter((item) => item.x > -40);
  particles.forEach((particle) => { particle.life -= delta; particle.x += particle.velocityX * delta; particle.y += particle.velocityY * delta; particle.velocityY += 330 * delta; });
  particles = particles.filter((particle) => particle.life > 0);

  const playerBox = { x: PLAYER_X + 10, y: player.y + (isSliding ? 30 : 8), width: 40, height: isSliding ? 35 : 57 };
  for (const obstacle of obstacles) {
    const obstacleY = obstacle.kind === 'flying' ? GROUND_Y - 120 : GROUND_Y - obstacle.height;
    const obstacleBox = { x: obstacle.x + 5, y: obstacleY + 5, width: obstacle.width - 10, height: obstacle.height - 5 };
    if (playerBox.x < obstacleBox.x + obstacleBox.width && playerBox.x + playerBox.width > obstacleBox.x && playerBox.y < obstacleBox.y + obstacleBox.height && playerBox.y + playerBox.height > obstacleBox.y) {
      loseLife(obstacle);
      break;
    }
  }
  collectItems(playerBox);
  updateHud();
}

function collectItems(playerBox) {
  const collect = (item) => {
    const magnetRange = activePowerup === 'magnet' ? 85 : 0;
    return playerBox.x - magnetRange < item.x + 26 && playerBox.x + playerBox.width + magnetRange > item.x - 2 && playerBox.y - magnetRange < item.y + 26 && playerBox.y + playerBox.height + magnetRange > item.y - 2;
  };
  collectibles = collectibles.filter((item) => {
    if (!collect(item)) return true;
    if (item.type === 'seed') seeds += 1;
    score += item.type === 'star' ? 25 : 10;
    burstParticles(item.x, item.y, item.type === 'star' ? '#f5c96a' : '#98cf88', 8);
    return false;
  });
  powerups = powerups.filter((item) => {
    if (!collect(item)) return true;
    activePowerup = item.type;
    powerupTime = item.type === 'magnet' ? 7 : 5;
    burstParticles(item.x, item.y, '#ffffff', 12);
    return false;
  });
}

function updateHud() {
  scoreElement.textContent = formatScore(score);
  speedMeterFill.style.width = `${12 + ((speed - 280) / 260) * 88}%`;
  if (scoreLabel) scoreLabel.textContent = `距離 ${formatScore(score)} / ${TARGET_DISTANCE}`;
  if (livesElement) livesElement.textContent = '♥'.repeat(lives) + '♡'.repeat(MAX_LIVES - lives);
  if (collectElement) collectElement.textContent = `${seeds} / ${TARGET_SEEDS}`;
  if (targetElement) targetElement.textContent = score >= TARGET_DISTANCE && seeds >= TARGET_SEEDS ? '完成！' : `${Math.min(TARGET_DISTANCE, Math.floor(score))}m · ${seeds} 顆種子`;
  if (powerupElement) powerupElement.textContent = activePowerup ? `${activePowerup} ${Math.ceil(powerupTime)}s` : '無';
  if (unlockElement) unlockElement.textContent = bestScore < 500 ? '500 分解鎖黃昏草原' : bestScore < 800 ? '800 分解鎖風行者' : '場景與角色已解鎖';
  if (bestScore >= 500) unlockedScene = 1;
  if (bestScore >= 800) unlockedCharacter = 1;
}

function draw() {
  drawSky();
  drawBackground();
  drawGround();
  obstacles.forEach(drawObstacle);
  collectibles.forEach(drawCollectible);
  powerups.forEach(drawPowerup);
  drawPlayer();
  drawParticles();
  drawWeather();
}

function drawSky() {
  const gradient = context.createLinearGradient(0, 0, 0, WORLD_HEIGHT);
  gradient.addColorStop(0, unlockedScene ? '#b9c8df' : '#c9dfd0');
  gradient.addColorStop(.62, unlockedScene ? '#ddd4cb' : '#e9e9cf');
  gradient.addColorStop(1, unlockedScene ? '#c99372' : '#f1d8ae');
  context.fillStyle = gradient;
  context.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  context.globalAlpha = .34;
  context.fillStyle = '#fff8dc';
  context.beginPath();
  context.arc(760, 112, 72, 0, Math.PI * 2);
  context.fill();
  context.globalAlpha = 1;
}

function drawBackground() {
  const hillOffset = (worldTime * speed * .08) % 420;
  context.fillStyle = '#a3c49c';
  for (let x = -420 - hillOffset; x < WORLD_WIDTH + 420; x += 420) {
    context.beginPath();
    context.moveTo(x, GROUND_Y);
    context.quadraticCurveTo(x + 145, 293, x + 280, GROUND_Y);
    context.fill();
  }
  const cloudOffset = (worldTime * speed * .025) % 310;
  context.fillStyle = 'rgba(255, 251, 224, .6)';
  for (let x = -250 - cloudOffset; x < WORLD_WIDTH + 300; x += 310) drawCloud(x, 105 + (x % 3) * 22, 1 + (x % 2) * .2);
  context.fillStyle = '#7faa7b';
  for (let x = -70 - ((worldTime * speed * .18) % 160); x < WORLD_WIDTH + 160; x += 160) {
    context.beginPath();
    context.moveTo(x, GROUND_Y);
    context.quadraticCurveTo(x + 50, 346, x + 110, GROUND_Y);
    context.fill();
  }
}

function drawCloud(x, y, scale) {
  context.beginPath();
  context.ellipse(x, y, 36 * scale, 13 * scale, 0, 0, Math.PI * 2);
  context.ellipse(x + 23 * scale, y - 8 * scale, 25 * scale, 16 * scale, 0, 0, Math.PI * 2);
  context.ellipse(x - 25 * scale, y - 4 * scale, 23 * scale, 13 * scale, 0, 0, Math.PI * 2);
  context.fill();
}

function drawGround() {
  context.fillStyle = '#527d61';
  context.fillRect(0, GROUND_Y, WORLD_WIDTH, WORLD_HEIGHT - GROUND_Y);
  context.fillStyle = '#75a06d';
  context.fillRect(0, GROUND_Y, WORLD_WIDTH, 6);
  const offset = (worldTime * speed) % 44;
  context.strokeStyle = 'rgba(212, 226, 170, .4)';
  context.lineWidth = 2;
  for (let x = -44 + offset; x < WORLD_WIDTH; x += 44) {
    context.beginPath(); context.moveTo(x, GROUND_Y + 26); context.lineTo(x + 19, GROUND_Y + 19); context.stroke();
    context.beginPath(); context.moveTo(x + 22, GROUND_Y + 60); context.lineTo(x + 35, GROUND_Y + 53); context.stroke();
  }
}

function drawPlayer() {
  const bob = player.grounded ? Math.sin(player.runTime * 2) * 2 : 0;
  const x = PLAYER_X;
  const y = player.y + bob;
  const legSwing = player.grounded ? Math.sin(player.runTime * 3) * 5 : 0;
  context.save();
  context.translate(x, y);
  if (isSliding) context.scale(1.22, .62);
  if (activePowerup === 'shield' || activePowerup === 'invincible') {
    context.strokeStyle = activePowerup === 'invincible' ? '#f5c96a' : '#98cf88';
    context.lineWidth = 4;
    context.beginPath(); context.arc(29, 35, 38 + Math.sin(worldTime * 8) * 2, 0, Math.PI * 2); context.stroke();
  }
  context.fillStyle = 'rgba(38, 53, 45, .18)';
  context.beginPath(); context.ellipse(27, PLAYER_HEIGHT + 4, 30, 6, 0, 0, Math.PI * 2); context.fill();
  if (playerSprite.complete && playerSprite.naturalWidth > 0) {
    const spriteWidth = isSliding ? 74 : 66;
    const spriteHeight = isSliding ? 44 : 66;
    const runFrameSpeed = 1.7;
    const frameIndex = isSliding ? 0 : player.grounded ? Math.floor((player.runTime * runFrameSpeed) % PLAYER_SPRITE_FRAME_COUNT) : 2;
    const sourceX = frameIndex * PLAYER_SPRITE_FRAME_WIDTH;
    const sourceY = 0;
    context.drawImage(
      playerSprite,
      sourceX,
      sourceY,
      PLAYER_SPRITE_FRAME_WIDTH,
      PLAYER_SPRITE_FRAME_HEIGHT,
      -6,
      -4,
      spriteWidth,
      spriteHeight
    );
  } else {
    context.fillStyle = '#f3b48b';
    context.beginPath(); context.ellipse(30, 35, 23, 29, -.08, 0, Math.PI * 2); context.fill();
    context.fillStyle = unlockedCharacter ? '#765c82' : '#df765a';
    context.beginPath(); context.moveTo(10, 24); context.quadraticCurveTo(8, 2, 30, 1); context.quadraticCurveTo(52, 4, 51, 27); context.quadraticCurveTo(42, 14, 28, 16); context.quadraticCurveTo(17, 17, 10, 24); context.fill();
    context.fillStyle = unlockedCharacter ? '#6db6c5' : '#f5c96a';
    context.beginPath(); context.ellipse(28, 9, 13, 7, -.15, 0, Math.PI * 2); context.fill();
    context.fillStyle = '#26352d';
    context.beginPath(); context.arc(42, 32, 3, 0, Math.PI * 2); context.fill();
    context.strokeStyle = '#26352d'; context.lineWidth = 2; context.lineCap = 'round';
    context.beginPath(); context.arc(45, 40, 5, 0, Math.PI * .7); context.stroke();
    context.strokeStyle = unlockedCharacter ? '#765c82' : '#df765a'; context.lineWidth = 6;
    context.beginPath(); context.moveTo(14, 39); context.lineTo(2, 48); context.stroke();
    context.strokeStyle = '#2f604b'; context.lineWidth = 7;
    context.beginPath(); context.moveTo(20, 57); context.lineTo(15 + legSwing, 67); context.stroke();
    context.beginPath(); context.moveTo(39, 57); context.lineTo(44 - legSwing, 67); context.stroke();
  }
  context.restore();
}

function drawObstacle(obstacle) {
  const x = obstacle.x;
  const y = obstacle.kind === 'flying' ? GROUND_Y - 120 : GROUND_Y - obstacle.height;
  context.save();
  context.translate(x, y);
  if (obstacle.kind === 'flying') {
    context.fillStyle = '#765c82';
    context.beginPath(); context.ellipse(35, 28, 30, 17, 0, 0, Math.PI * 2); context.fill();
    context.fillStyle = '#e9b56f';
    context.beginPath(); context.arc(43, 24, 5, 0, Math.PI * 2); context.fill();
    context.strokeStyle = '#765c82'; context.lineWidth = 5;
    context.beginPath(); context.moveTo(13, 25); context.quadraticCurveTo(2, 8, 4, 0); context.moveTo(55, 25); context.quadraticCurveTo(67, 8, 68, 0); context.stroke();
  } else if (obstacle.kind === 'thorn') {
    context.fillStyle = '#3b664d';
    context.beginPath(); context.moveTo(4, obstacle.height); context.lineTo(12, 16); context.lineTo(21, 30); context.lineTo(28, 4); context.lineTo(36, obstacle.height); context.closePath(); context.fill();
    context.strokeStyle = '#8eb477'; context.lineWidth = 3;
    context.beginPath(); context.moveTo(13, obstacle.height - 4); context.lineTo(20, 28); context.moveTo(27, obstacle.height - 4); context.lineTo(28, 14); context.stroke();
    context.fillStyle = '#df765a'; context.beginPath(); context.arc(20, 18 + Math.sin(obstacle.wobble) * 2, 5, 0, Math.PI * 2); context.fill();
  } else {
    context.fillStyle = '#776b5b';
    context.beginPath(); context.moveTo(2, obstacle.height); context.lineTo(7, 12); context.lineTo(23, 2); context.lineTo(45, 12); context.lineTo(51, obstacle.height); context.closePath(); context.fill();
    context.fillStyle = '#aa9478';
    context.beginPath(); context.moveTo(8, 14); context.lineTo(23, 5); context.lineTo(39, 13); context.lineTo(25, 19); context.closePath(); context.fill();
  }
  context.restore();
}

function drawCollectible(item) {
  context.save();
  context.translate(item.x, item.y);
  context.rotate(Math.sin(item.spin) * .12);
  context.fillStyle = item.type === 'star' ? '#f5c96a' : '#98cf88';
  if (item.type === 'star') {
    context.beginPath();
    for (let index = 0; index < 10; index += 1) {
      const angle = -Math.PI / 2 + index * Math.PI / 5;
      const radius = index % 2 ? 8 : 16;
      const pointX = Math.cos(angle) * radius;
      const pointY = Math.sin(angle) * radius;
      if (index === 0) context.moveTo(pointX, pointY); else context.lineTo(pointX, pointY);
    }
    context.closePath(); context.fill();
  } else {
    context.beginPath(); context.ellipse(0, 0, 9, 15, -.5, 0, Math.PI * 2); context.fill();
    context.strokeStyle = '#527d61'; context.lineWidth = 2; context.beginPath(); context.moveTo(0, 12); context.lineTo(10, 21); context.stroke();
  }
  context.restore();
}

function drawPowerup(item) {
  const colors = { shield: '#6db6c5', magnet: '#df765a', slow: '#8d7bc1', invincible: '#f5c96a' };
  context.save();
  context.translate(item.x, item.y);
  context.rotate(item.spin);
  context.fillStyle = colors[item.type];
  context.beginPath(); context.arc(0, 0, 17, 0, Math.PI * 2); context.fill();
  context.fillStyle = '#fff8dc'; context.font = '700 14px Manrope'; context.textAlign = 'center'; context.textBaseline = 'middle';
  context.fillText(item.type === 'shield' ? 'S' : item.type === 'magnet' ? 'M' : item.type === 'slow' ? 'T' : '★', 0, 1);
  context.restore();
}

function drawWeather() {
  if (eventType === 'night') {
    context.fillStyle = 'rgba(37, 48, 79, .32)'; context.fillRect(0, 0, WORLD_WIDTH, GROUND_Y);
    context.fillStyle = '#f5c96a'; context.beginPath(); context.arc(780, 105, 28, 0, Math.PI * 2); context.fill();
  }
  if (eventType === 'rain') {
    context.strokeStyle = 'rgba(218, 241, 242, .6)'; context.lineWidth = 2;
    for (let x = 0; x < WORLD_WIDTH; x += 38) { const y = (worldTime * 250 + x * 3) % GROUND_Y; context.beginPath(); context.moveTo(x, y); context.lineTo(x - 10, y + 24); context.stroke(); }
  }
  if (eventType === 'wind') {
    context.strokeStyle = 'rgba(255, 248, 220, .45)'; context.lineWidth = 2;
    for (let y = 90; y < GROUND_Y; y += 55) { context.beginPath(); context.moveTo(80, y); context.quadraticCurveTo(250, y - 20, 390, y); context.stroke(); }
  }
}

function drawParticles() {
  particles.forEach((particle) => {
    context.globalAlpha = Math.max(0, particle.life * 2);
    context.fillStyle = particle.color;
    context.fillRect(particle.x, particle.y, particle.size, particle.size);
  });
  context.globalAlpha = 1;
}

function gameLoop(timestamp) {
  if (gameState !== 'running') { draw(); return; }
  const delta = Math.min(.034, (timestamp - lastTime) / 1000);
  lastTime = timestamp;
  update(delta);
  draw();
  animationFrame = requestAnimationFrame(gameLoop);
}

function handleKey(event) {
  if (event.code === 'Space' || event.code === 'ArrowUp') { event.preventDefault(); jump(); }
  if (event.code === 'ArrowDown') { event.preventDefault(); setSliding(true); }
  if (event.key.toLowerCase() === 'p') togglePause();
  if (event.key.toLowerCase() === 'r') startGame();
}

startButton.addEventListener('click', startGame);
resumeButton.addEventListener('click', togglePause);
restartButton.addEventListener('click', startGame);
pauseButton.addEventListener('click', togglePause);
mobilePauseButton.addEventListener('click', togglePause);
jumpButton.addEventListener('click', jump);
slideButton.addEventListener('pointerdown', () => setSliding(true));
slideButton.addEventListener('pointerup', () => setSliding(false));
slideButton.addEventListener('pointerleave', () => setSliding(false));
window.addEventListener('keyup', (event) => { if (event.code === 'ArrowDown') setSliding(false); });
window.addEventListener('pointerup', () => setSliding(false));
canvas.addEventListener('pointerdown', (event) => { if (event.button === 2) setSliding(true); });
canvas.addEventListener('contextmenu', (event) => event.preventDefault());
window.addEventListener('keydown', handleKey);
window.addEventListener('resize', resizeCanvas);
resizeCanvas();
resetGame();
draw();
