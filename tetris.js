const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#00f5ff', // I - cyan
  '#f5a623', // O - orange
  '#7b68ee', // T - purple
  '#00e676', // S - green
  '#ff1744', // Z - red
  '#2979ff', // J - blue
  '#ff9100', // L - amber
];

const SHAPES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                   // T
  [[0,4,4],[4,4,0],[0,0,0]],                   // S
  [[5,5,0],[0,5,5],[0,0,0]],                   // Z
  [[6,0,0],[6,6,6],[0,0,0]],                   // J
  [[0,0,7],[7,7,7],[0,0,0]],                   // L
];

const POINTS = [0, 100, 300, 500, 800];
const SPEEDS = [800, 700, 600, 500, 400, 300, 250, 200, 150, 100];

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const holdCanvas = document.getElementById('hold-canvas');
const holdCtx = holdCanvas.getContext('2d');

const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const messageEl = document.getElementById('message');

let board, piece, nextPiece, holdPiece, canHold, score, lines, level, gameOver, paused, animId, dropTimer, lastTime;
let shake = 0;
let impactCells = [];

function createBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
}

function randomPiece() {
  const id = Math.floor(Math.random() * 7) + 1;
  const shape = SHAPES[id].map(row => [...row]);
  return {
    id,
    shape,
    x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2),
    y: 0,
  };
}

function rotate(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function isValid(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      if (shape[r][c]) {
        const nx = ox + c, ny = oy + r;
        if (nx < 0 || nx >= COLS || ny >= ROWS) return false;
        if (ny >= 0 && board[ny][nx]) return false;
      }
  return true;
}

function lock() {
  for (let r = 0; r < piece.shape.length; r++)
    for (let c = 0; c < piece.shape[r].length; c++)
      if (piece.shape[r][c]) {
        if (piece.y + r < 0) { endGame(); return; }
        board[piece.y + r][piece.x + c] = piece.shape[r][c];
      }
  clearLines();
  piece = nextPiece;
  nextPiece = randomPiece();
  canHold = true;
  if (!isValid(piece.shape, piece.x, piece.y)) { endGame(); return; }
  drawNext();
}

function hold() {
  if (!canHold) return;
  canHold = false;
  const id = piece.id;
  if (holdPiece) {
    // Swap current piece with held piece
    piece = {
      id: holdPiece,
      shape: SHAPES[holdPiece].map(row => [...row]),
      x: Math.floor(COLS / 2) - Math.floor(SHAPES[holdPiece][0].length / 2),
      y: 0,
    };
  } else {
    // No held piece yet — take next piece
    piece = nextPiece;
    nextPiece = randomPiece();
    drawNext();
  }
  holdPiece = id;
  drawHold();
  draw();
}

function drawHold() {
  holdCtx.clearRect(0, 0, holdCanvas.width, holdCanvas.height);
  if (!holdPiece) return;
  const s = SHAPES[holdPiece];
  const offX = Math.floor((holdCanvas.width / BLOCK - s[0].length) / 2);
  const offY = Math.floor((holdCanvas.height / BLOCK - s.length) / 2);
  holdCtx.globalAlpha = canHold ? 1 : 0.4;
  for (let r = 0; r < s.length; r++)
    for (let c = 0; c < s[r].length; c++)
      if (s[r][c]) {
        holdCtx.fillStyle = COLORS[s[r][c]];
        holdCtx.fillRect((offX + c) * BLOCK + 1, (offY + r) * BLOCK + 1, BLOCK - 2, BLOCK - 2);
      }
  holdCtx.globalAlpha = 1;
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(c => c !== 0)) {
      board.splice(r, 1);
      board.unshift(Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    lines += cleared;
    score += POINTS[cleared] * level;
    level = Math.floor(lines / 10) + 1;
    scoreEl.textContent = score;
    linesEl.textContent = lines;
    levelEl.textContent = level;
  }
}

function hardDrop() {
  while (isValid(piece.shape, piece.x, piece.y + 1)) piece.y++;
  // Record landing cells for flash effect
  for (let r = 0; r < piece.shape.length; r++)
    for (let c = 0; c < piece.shape[r].length; c++)
      if (piece.shape[r][c])
        impactCells.push({ x: piece.x + c, y: piece.y + r, alpha: 1 });
  shake = 10;
  lock();
}

function drawBlock(context, x, y, colorId, alpha = 1) {
  const color = COLORS[colorId];
  context.globalAlpha = alpha;
  context.fillStyle = color;
  context.fillRect(x * BLOCK + 1, y * BLOCK + 1, BLOCK - 2, BLOCK - 2);
  context.fillStyle = 'rgba(255,255,255,0.15)';
  context.fillRect(x * BLOCK + 1, y * BLOCK + 1, BLOCK - 2, 4);
  context.globalAlpha = 1;
}

function ghostY() {
  let gy = piece.y;
  while (isValid(piece.shape, piece.x, gy + 1)) gy++;
  return gy;
}

function applyShake() {
  if (shake > 0.5) {
    const dx = (Math.random() - 0.5) * shake;
    const dy = Math.random() * shake * 0.5; // bias downward for impact feel
    canvas.style.transform = `translate(${dx}px, ${dy}px)`;
    shake *= 0.72;
  } else {
    shake = 0;
    canvas.style.transform = '';
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Grid lines
  ctx.strokeStyle = '#1a1a3a';
  ctx.lineWidth = 0.5;
  for (let r = 0; r < ROWS; r++) {
    ctx.beginPath(); ctx.moveTo(0, r * BLOCK); ctx.lineTo(canvas.width, r * BLOCK); ctx.stroke();
  }
  for (let c = 0; c < COLS; c++) {
    ctx.beginPath(); ctx.moveTo(c * BLOCK, 0); ctx.lineTo(c * BLOCK, canvas.height); ctx.stroke();
  }

  // Board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (board[r][c]) drawBlock(ctx, c, r, board[r][c]);

  // Ghost
  const gy = ghostY();
  if (gy !== piece.y) {
    for (let r = 0; r < piece.shape.length; r++)
      for (let c = 0; c < piece.shape[r].length; c++)
        if (piece.shape[r][c])
          drawBlock(ctx, piece.x + c, gy + r, piece.shape[r][c], 0.2);
  }

  // Active piece
  for (let r = 0; r < piece.shape.length; r++)
    for (let c = 0; c < piece.shape[r].length; c++)
      if (piece.shape[r][c])
        drawBlock(ctx, piece.x + c, piece.y + r, piece.shape[r][c]);

  // Impact flash — white overlay fading out on landing cells
  for (let i = impactCells.length - 1; i >= 0; i--) {
    const cell = impactCells[i];
    ctx.globalAlpha = cell.alpha;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(cell.x * BLOCK + 1, cell.y * BLOCK + 1, BLOCK - 2, BLOCK - 2);
    ctx.globalAlpha = 1;
    cell.alpha -= 0.07;
    if (cell.alpha <= 0) impactCells.splice(i, 1);
  }

  applyShake();
}

function drawNext() {
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const s = nextPiece.shape;
  const offX = Math.floor((nextCanvas.width / BLOCK - s[0].length) / 2);
  const offY = Math.floor((nextCanvas.height / BLOCK - s.length) / 2);
  for (let r = 0; r < s.length; r++)
    for (let c = 0; c < s[r].length; c++)
      if (s[r][c]) {
        nextCtx.fillStyle = COLORS[s[r][c]];
        nextCtx.fillRect((offX + c) * BLOCK + 1, (offY + r) * BLOCK + 1, BLOCK - 2, BLOCK - 2);
      }
}

function loop(ts = 0) {
  if (gameOver || paused) return;
  const dt = ts - lastTime;
  lastTime = ts;
  dropTimer += dt;
  const speed = SPEEDS[Math.min(level - 1, SPEEDS.length - 1)];
  if (dropTimer >= speed) {
    dropTimer = 0;
    if (isValid(piece.shape, piece.x, piece.y + 1)) piece.y++;
    else lock();
  }
  draw();
  animId = requestAnimationFrame(loop);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#e94560';
  ctx.font = 'bold 28px Courier New';
  ctx.textAlign = 'center';
  ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2 - 20);
  ctx.fillStyle = '#fff';
  ctx.font = '16px Courier New';
  ctx.fillText(`Score: ${score}`, canvas.width / 2, canvas.height / 2 + 16);
  ctx.fillText('Press R to restart', canvas.width / 2, canvas.height / 2 + 44);
}

function init() {
  board = createBoard();
  piece = randomPiece();
  nextPiece = randomPiece();
  score = lines = 0;
  level = 1;
  holdPiece = null;
  canHold = true;
  shake = 0;
  impactCells = [];
  canvas.style.transform = '';
  gameOver = paused = false;
  dropTimer = 0;
  lastTime = 0;
  scoreEl.textContent = 0;
  linesEl.textContent = 0;
  levelEl.textContent = 1;
  messageEl.textContent = '';
  drawNext();
  drawHold();
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.code === 'KeyR') { init(); return; }
  if (gameOver) return;
  if (e.code === 'KeyP') {
    paused = !paused;
    messageEl.textContent = paused ? 'PAUSED' : '';
    if (!paused) { lastTime = performance.now(); animId = requestAnimationFrame(loop); }
    return;
  }
  if (paused) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (isValid(piece.shape, piece.x - 1, piece.y)) piece.x--;
      break;
    case 'ArrowRight':
      if (isValid(piece.shape, piece.x + 1, piece.y)) piece.x++;
      break;
    case 'ArrowDown':
      if (isValid(piece.shape, piece.x, piece.y + 1)) piece.y++;
      else lock();
      break;
    case 'ArrowUp': {
      const rotated = rotate(piece.shape);
      if (isValid(rotated, piece.x, piece.y)) piece.shape = rotated;
      else if (isValid(rotated, piece.x - 1, piece.y)) { piece.shape = rotated; piece.x--; }
      else if (isValid(rotated, piece.x + 1, piece.y)) { piece.shape = rotated; piece.x++; }
      break;
    }
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
    case 'KeyC':
      hold();
      break;
  }
  draw();
});

init();
