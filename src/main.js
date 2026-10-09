
import './style.css';

// -----------------------------------------------------------------------------
// Interface
// -----------------------------------------------------------------------------

document.querySelector('#app').innerHTML = `
  <div class="game">
    <h1>Minesweeper</h1>

    <div class="game-controls">
      <span id="flagCounter">🚩 40</span>
      <span id="timer">⏱️ 0</span>
      <button id="soundButton" title="Mute sound" aria-label="Mute sound">🔊</button>
    </div>

    <canvas id="gameCanvas"></canvas>

    <div id="gameOverOverlay" class="game-over-overlay hidden">
      <div class="game-over-popup">
        <h2 id="gameOverMessage">You Win!</h2>
        <button id="gameOverOkButton">OK</button>
      </div>
    </div>

    <div class="difficulty-controls">
      <button id="newGameButton">New Game</button>
      <label for="difficultySelect">Difficulty:</label>
      <select id="difficultySelect">
        <option value="beginner">Beginner</option>
        <option value="intermediate" selected>Intermediate</option>
        <option value="expert">Expert</option>
      </select>
    </div>
  </div>
`;

const canvas = document.querySelector('#gameCanvas');
const ctx = canvas.getContext('2d');
const flagCounter = document.querySelector('#flagCounter');
const timerDisplay = document.querySelector('#timer');
const soundButton = document.querySelector('#soundButton');
const newGameButton = document.querySelector('#newGameButton');
const difficultySelect = document.querySelector('#difficultySelect');
const gameOverOverlay = document.querySelector('#gameOverOverlay');
const gameOverMessage = document.querySelector('#gameOverMessage');
const gameOverOkButton = document.querySelector('#gameOverOkButton');

// -----------------------------------------------------------------------------
// Configuration and game state
// -----------------------------------------------------------------------------

const difficulties = {
  beginner: { rows: 9, cols: 9, mines: 10 },
  intermediate: { rows: 16, cols: 16, mines: 40 },
  expert: { rows: 16, cols: 30, mines: 99 }
};

const cellSize = 40; // Logical pixels per cell, before responsive display scaling.

const numberColors = [
  null,       // 0: no number
  '#0000FF',  // 1: blue
  '#008000',  // 2: green
  '#FF0000',  // 3: red
  '#000080',  // 4: dark blue
  '#800000',  // 5: maroon
  '#008080',  // 6: teal
  '#000000',  // 7: black
  '#808080'   // 8: gray
];

let currentDifficulty = 'intermediate';
let rows = difficulties[currentDifficulty].rows;
let cols = difficulties[currentDifficulty].cols;
let mineCount = difficulties[currentDifficulty].mines;
let canvasWidth = cols * cellSize;
let canvasHeight = rows * cellSize;

const board = [];
let flagsRemaining = mineCount;
let gameOver = false;
let firstClick = true;
let hoveredRow = -1;
let hoveredCol = -1;

let secondsElapsed = 0;
let timerInterval = null;
let soundMuted = false;
let audioContext = null;

// -----------------------------------------------------------------------------
// Status displays and timer
// -----------------------------------------------------------------------------

function updateFlagCounter() {
  flagCounter.textContent = `🚩 ${flagsRemaining}`;
}

function updateTimer() {
  timerDisplay.textContent = `⏱️ ${secondsElapsed}`;
}

function startTimer() {
  if (timerInterval !== null) return;

  timerInterval = setInterval(() => {
    secondsElapsed++;
    updateTimer();
  }, 1000);
}

function stopTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
}

function showGameOverPopup(won) {
  gameOverMessage.textContent = won ? 'You Win!' : 'You Lose!';
  gameOverOverlay.classList.remove('hidden');
}

function hideGameOverPopup() {
  gameOverOverlay.classList.add('hidden');
}

// -----------------------------------------------------------------------------
// Audio (generated with the Web Audio API; no sound files required)
// -----------------------------------------------------------------------------

function playSound(frequency = 600, duration = 0.05) {
  if (soundMuted) return;

  if (!audioContext) audioContext = new AudioContext();

  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();

  oscillator.type = 'sine';
  oscillator.frequency.value = frequency;

  gain.gain.setValueAtTime(0.08, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(
    0.001,
    audioContext.currentTime + duration
  );

  oscillator.connect(gain);
  gain.connect(audioContext.destination);

  oscillator.start();
  oscillator.stop(audioContext.currentTime + duration);
}

function playLossSound() {
  if (soundMuted) return;

  if (!audioContext) audioContext = new AudioContext();

  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const now = audioContext.currentTime;

  oscillator.type = 'sawtooth';
  oscillator.frequency.setValueAtTime(250, now);
  oscillator.frequency.exponentialRampToValueAtTime(60, now + 0.4);

  gain.gain.setValueAtTime(0.12, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

  oscillator.connect(gain);
  gain.connect(audioContext.destination);

  oscillator.start(now);
  oscillator.stop(now + 0.4);
}

function playWinSound() {
  if (soundMuted) return;

  // Ascending notes form a short victory melody.
  [523, 659, 784, 1047].forEach((frequency, index) => {
    setTimeout(() => playSound(frequency, 0.15), index * 150);
  });
}

// -----------------------------------------------------------------------------
// Board creation and mine placement
// -----------------------------------------------------------------------------

function createBoard() {
  for (let row = 0; row < rows; row++) {
    const currentRow = [];

    for (let col = 0; col < cols; col++) {
      currentRow.push({
        isMine: false,
        isRevealed: false,
        isFlagged: false,
        adjacentMines: 0
      });
    }

    board.push(currentRow);
  }
}

function placeMines(numMines) {
  let minesPlaced = 0;

  while (minesPlaced < numMines) {
    const row = Math.floor(Math.random() * rows);
    const col = Math.floor(Math.random() * cols);

    if (!board[row][col].isMine) {
      board[row][col].isMine = true;
      minesPlaced++;
    }
  }
}

function relocateMine(row, col) {
  if (!board[row][col].isMine) return;

  // Move a mine away from the first clicked cell, keeping the mine count intact.
  board[row][col].isMine = false;

  let newRow;
  let newCol;

  do {
    newRow = Math.floor(Math.random() * rows);
    newCol = Math.floor(Math.random() * cols);
  } while (
    board[newRow][newCol].isMine ||
    (newRow === row && newCol === col)
  );

  board[newRow][newCol].isMine = true;
  countAdjacentMines();
}

function countAdjacentMines() {
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cell = board[row][col];

      if (cell.isMine) continue;

      let adjacentMines = 0;

      for (let r = -1; r <= 1; r++) {
        for (let c = -1; c <= 1; c++) {
          const newRow = row + r;
          const newCol = col + c;

          if (
            newRow >= 0 &&
            newRow < rows &&
            newCol >= 0 &&
            newCol < cols &&
            board[newRow][newCol].isMine
          ) {
            adjacentMines++;
          }
        }
      }

      cell.adjacentMines = adjacentMines;
    }
  }
}

// -----------------------------------------------------------------------------
// Game rules
// -----------------------------------------------------------------------------

function revealCell(row, col) {
  if (row < 0 || row >= rows || col < 0 || col >= cols) return;

  const cell = board[row][col];

  if (cell.isRevealed || cell.isFlagged) return;

  cell.isRevealed = true;

  if (cell.isMine) {
    gameOver = true;
    stopTimer();
    playLossSound();
    revealAllMines();
    showGameOverPopup(false);
    return;
  }

  // Empty cells recursively reveal neighboring cells until numbers form a border.
  if (cell.adjacentMines === 0) {
    for (let r = -1; r <= 1; r++) {
      for (let c = -1; c <= 1; c++) {
        if (r === 0 && c === 0) continue;
        revealCell(row + r, col + c);
      }
    }
  }
}

function checkWin() {
  // A win requires revealing every safe cell; flags are not required.
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cell = board[row][col];

      if (!cell.isMine && !cell.isRevealed) return false;
    }
  }

  return true;
}

function revealAllMines() {
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (board[row][col].isMine) {
        board[row][col].isRevealed = true;
      }
    }
  }
}

function newGame() {
  playSound(750, 0.1);
  stopTimer();

  board.length = 0;
  flagsRemaining = mineCount;
  gameOver = false;
  firstClick = true;
  secondsElapsed = 0;

  createBoard();
  placeMines(mineCount);
  countAdjacentMines();

  updateTimer();
  updateFlagCounter();
  hideGameOverPopup();
  draw();
}

// -----------------------------------------------------------------------------
// Canvas sizing and rendering
// -----------------------------------------------------------------------------

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;

  const availableWidth = window.innerWidth - 32;
  const availableHeight = window.innerHeight - 220;

  // Preserve the board's aspect ratio while fitting the available viewport.
  const scale = Math.min(
    1,
    availableWidth / canvasWidth,
    availableHeight / canvasHeight
  );

  const displayWidth = Math.floor(canvasWidth * scale);
  const displayHeight = Math.floor(canvasHeight * scale);

  // Internal resolution remains full size for sharp canvas text and graphics.
  canvas.width = Math.round(canvasWidth * dpr);
  canvas.height = Math.round(canvasHeight * dpr);

  canvas.style.width = `${displayWidth}px`;
  canvas.style.height = `${displayHeight}px`;
  canvas.style.aspectRatio = `${cols} / ${rows}`;
  canvas.style.setProperty('--board-width', `${canvasWidth}px`);

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  draw();
}

function draw() {
  ctx.fillStyle = '#252545';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cell = board[row][col];

      const x = col * cellSize;
      const y = row * cellSize;
      const isLightTile = (row + col) % 2 === 0;

      // Revealed cells use a gray checkerboard; hidden cells use green.
      if (cell.isRevealed) {
        ctx.fillStyle = isLightTile ? '#c3c2c2' : '#a7a6a6';
      } else {
        ctx.fillStyle = isLightTile ? '#AAD751' : '#94bf44';
      }

      // Only highlight unrevealed, unflagged cells while the game is active.
      if (
        !gameOver &&
        !cell.isRevealed &&
        !cell.isFlagged &&
        row === hoveredRow &&
        col === hoveredCol
      ) {
        ctx.fillStyle = '#C6ED7C';
      }

      ctx.fillRect(x + 1, y + 1, cellSize - 2, cellSize - 2);

      if (cell.isRevealed && !cell.isMine && cell.adjacentMines > 0) {
        ctx.fillStyle = numberColors[cell.adjacentMines];
        ctx.font = 'bold 20px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(
          cell.adjacentMines,
          x + cellSize / 2,
          y + cellSize / 2
        );
      }

      if (cell.isRevealed && cell.isMine) {
        ctx.font = '24px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('💣', x + cellSize / 2, y + cellSize / 2);
      }

      if (cell.isFlagged && !cell.isRevealed) {
        ctx.fillStyle = 'white';
        ctx.font = '24px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🚩', x + cellSize / 2, y + cellSize / 2);
      }
    }
  }
}

// -----------------------------------------------------------------------------
// Mouse input
// -----------------------------------------------------------------------------

function getCellFromMouse(event) {
  const rect = canvas.getBoundingClientRect();

  const mouseX = event.clientX - rect.left;
  const mouseY = event.clientY - rect.top;

  // Convert displayed CSS pixels back into the board's logical coordinates.
  const scaleX = canvasWidth / rect.width;
  const scaleY = canvasHeight / rect.height;

  const col = Math.floor((mouseX * scaleX) / cellSize);
  const row = Math.floor((mouseY * scaleY) / cellSize);

  return { row, col };
}

function handleClick(event) {
  if (gameOver) return;

  const { row, col } = getCellFromMouse(event);

  if (row < 0 || row >= rows || col < 0 || col >= cols) return;

  const cell = board[row][col];

  if (!cell.isRevealed && !cell.isFlagged) {
    if (firstClick) {
      relocateMine(row, col);
      firstClick = false;
    }

    startTimer();
  }

  if (!cell.isRevealed && !cell.isFlagged && !cell.isMine) {
    playSound();
  }

  revealCell(row, col);

  if (!gameOver && checkWin()) {
    gameOver = true;
    stopTimer();
    playWinSound();
    showGameOverPopup(true);
  }

  draw();
}

function handleRightClick(event) {
  // Suppress the browser's context menu, even after the game ends.
  event.preventDefault();

  if (gameOver) return;

  const { row, col } = getCellFromMouse(event);

  if (row < 0 || row >= rows || col < 0 || col >= cols) return;

  const cell = board[row][col];

  if (cell.isRevealed) return;

  if (cell.isFlagged) {
    cell.isFlagged = false;
    flagsRemaining++;
  } else {
    if (flagsRemaining === 0) return;

    cell.isFlagged = true;
    flagsRemaining--;
  }

  playSound(400, 0.08);
  updateFlagCounter();
  draw();
}

// -----------------------------------------------------------------------------
// Event listeners and startup
// -----------------------------------------------------------------------------

soundButton.addEventListener('click', () => {
  soundMuted = !soundMuted;

  soundButton.textContent = soundMuted ? '🔇' : '🔊';
  soundButton.title = soundMuted ? 'Unmute sound' : 'Mute sound';
  soundButton.setAttribute('aria-label', soundButton.title);
});

canvas.addEventListener('click', handleClick);
canvas.addEventListener('contextmenu', handleRightClick);

canvas.addEventListener('mousemove', (event) => {
  const { row, col } = getCellFromMouse(event);

  if (row !== hoveredRow || col !== hoveredCol) {
    hoveredRow = row;
    hoveredCol = col;
    draw();
  }
});

canvas.addEventListener('mouseleave', () => {
  hoveredRow = -1;
  hoveredCol = -1;
  draw();
});

newGameButton.addEventListener('click', newGame);
gameOverOkButton.addEventListener('click', hideGameOverPopup);

difficultySelect.addEventListener('change', () => {
  currentDifficulty = difficultySelect.value;
  const settings = difficulties[currentDifficulty];

  rows = settings.rows;
  cols = settings.cols;
  mineCount = settings.mines;

  canvasWidth = cols * cellSize;
  canvasHeight = rows * cellSize;

  hoveredRow = -1;
  hoveredCol = -1;

  newGame();
  resizeCanvas();
});

window.addEventListener('resize', resizeCanvas);

// Build and display the initial Intermediate board.
createBoard();
placeMines(mineCount);
countAdjacentMines();
resizeCanvas();