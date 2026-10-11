
import './style.css';

// -----------------------------------------------------------------------------
// 1. Interface
// -----------------------------------------------------------------------------

document.querySelector('#app').innerHTML = `
  <div class="game">
    <h1>Minesweeper</h1>

    <div class="game-controls">
      <button
        id="flagCounter"
        type="button"
        title="Switch to Flag mode"
        aria-pressed="false"
      >🚩 40</button>

      <button
        id="timer"
        type="button"
        title="Pause game"
        aria-pressed="false"
      >⏱️ 00:00</button>

      <button
        id="soundButton"
        type="button"
        title="Mute sound"
        aria-label="Mute sound"
      >🔊</button>
    </div>

    <canvas id="gameCanvas"></canvas>

    <!-- Pause popup: uses the existing win/loss popup styling. -->
    <div id="pauseOverlay" class="game-over-overlay hidden">
      <div class="game-over-popup">
        <h2>Paused</h2>
        <button id="resumeButton" type="button">Resume Game</button>
      </div>
    </div>

    <!-- Win/loss popup. -->
    <div id="gameOverOverlay" class="game-over-overlay hidden">
      <div class="game-over-popup">
        <h2 id="gameOverMessage">You Win!</h2>
        <button id="gameOverOkButton" type="button">OK</button>
      </div>
    </div>

    <div class="difficulty-controls">
      <button id="newGameButton" type="button">New Game</button>

      <label for="difficultySelect">Difficulty:</label>
      <select id="difficultySelect">
        <option value="beginner">Beginner</option>
        <option value="intermediate" selected>Intermediate</option>
        <option value="expert">Expert</option>
      </select>
    </div>
  </div>
`;

// Cache DOM references once rather than searching repeatedly.
const canvas = document.querySelector('#gameCanvas');
const ctx = canvas.getContext('2d');

const flagCounter = document.querySelector('#flagCounter');
const timerDisplay = document.querySelector('#timer');
const soundButton = document.querySelector('#soundButton');

const newGameButton = document.querySelector('#newGameButton');
const difficultySelect = document.querySelector('#difficultySelect');

const pauseOverlay = document.querySelector('#pauseOverlay');
const resumeButton = document.querySelector('#resumeButton');

const gameOverOverlay = document.querySelector('#gameOverOverlay');
const gameOverMessage = document.querySelector('#gameOverMessage');
const gameOverOkButton = document.querySelector('#gameOverOkButton');

// -----------------------------------------------------------------------------
// 2. Configuration and game state
// -----------------------------------------------------------------------------

const difficulties = {
  beginner: { rows: 9, cols: 9, mines: 10 },
  intermediate: { rows: 16, cols: 16, mines: 40 },
  expert: { rows: 16, cols: 30, mines: 99 }
};

// Each cell occupies 40 logical Canvas pixels.
const cellSize = 40;

const numberColors = [
  null,       // 0: empty
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

// Board data.
const board = [];
let flagsRemaining = mineCount;

// Gameplay state.
let gameOver = false;
let firstClick = true;
let flagMode = false;
let isPaused = false;

// Mouse hover state.
let hoveredRow = -1;
let hoveredCol = -1;

// Timer state.
let secondsElapsed = 0;
let timerInterval = null;

// Audio state.
let soundMuted = false;
let audioContext = null;

// -----------------------------------------------------------------------------
// 3. Interface updates
// -----------------------------------------------------------------------------

function updateFlagCounter() {
  flagCounter.textContent = `🚩 ${flagsRemaining}`;
}

function updateFlagMode() {
  flagCounter.classList.toggle('active', flagMode);
  flagCounter.setAttribute('aria-pressed', String(flagMode));

  flagCounter.title = flagMode
    ? 'Switch to Reveal mode'
    : 'Switch to Flag mode';

  canvas.style.cursor = flagMode ? 'crosshair' : 'default';
}

function updateTimer() {
  const minutes = Math.floor(secondsElapsed / 60);
  const seconds = secondsElapsed % 60;

  const formattedMinutes = String(minutes).padStart(2, '0');
  const formattedSeconds = String(seconds).padStart(2, '0');

  timerDisplay.textContent = `⏱️ ${formattedMinutes}:${formattedSeconds}`;
}

function updatePauseButton() {
  timerDisplay.classList.toggle('active', isPaused);
  timerDisplay.setAttribute('aria-pressed', String(isPaused));

  timerDisplay.title = isPaused ? 'Resume game' : 'Pause game';
}

// -----------------------------------------------------------------------------
// 4. Timer and pause controls
// -----------------------------------------------------------------------------

function startTimer() {
  // Prevent multiple intervals from running simultaneously.
  if (timerInterval !== null || isPaused || gameOver) return;

  timerInterval = setInterval(() => {
    secondsElapsed++;
    updateTimer();
  }, 1000);
}

function stopTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
}

function pauseGame() {
  // A game cannot be paused before its first reveal or after it ends.
  if (firstClick || gameOver || isPaused) return;

  isPaused = true;
  stopTimer();

  // Clear hover state so no tile remains highlighted after resuming.
  hoveredRow = -1;
  hoveredCol = -1;

  updatePauseButton();
  draw();

  pauseOverlay.classList.remove('hidden');
}

function resumeGame() {
  if (!isPaused) return;

  isPaused = false;

  pauseOverlay.classList.add('hidden');
  updatePauseButton();

  draw();
  startTimer();
}

function togglePause() {
  if (isPaused) {
    resumeGame();
  } else {
    pauseGame();
  }
}

// -----------------------------------------------------------------------------
// 5. Win/loss popups
// -----------------------------------------------------------------------------

function showGameOverPopup(won) {
  gameOverMessage.textContent = won ? 'You Win!' : 'You Lose!';
  gameOverOverlay.classList.remove('hidden');
}

function hideGameOverPopup() {
  gameOverOverlay.classList.add('hidden');
}

// -----------------------------------------------------------------------------
// 6. Audio
// -----------------------------------------------------------------------------

// Sounds are synthesized with the Web Audio API.
// No external sound files are required.

function playSound(frequency = 600, duration = 0.05) {
  if (soundMuted) return;

  if (!audioContext) {
    audioContext = new AudioContext();
  }

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

  if (!audioContext) {
    audioContext = new AudioContext();
  }

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

  // Play four ascending notes.
  [523, 659, 784, 1047].forEach((frequency, index) => {
    setTimeout(() => playSound(frequency, 0.15), index * 150);
  });
}

// -----------------------------------------------------------------------------
// 7. Board creation and mine placement
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

// Guarantee that the first revealed cell and its neighbors are safe.
// Any mines in that area are relocated elsewhere on the board.
function relocateMine(row, col) {
  const safeCells = new Set();

  // Identify the 3x3 protected area around the first reveal.
  for (let r = -1; r <= 1; r++) {
    for (let c = -1; c <= 1; c++) {
      const newRow = row + r;
      const newCol = col + c;

      if (
        newRow >= 0 &&
        newRow < rows &&
        newCol >= 0 &&
        newCol < cols
      ) {
        safeCells.add(newRow * cols + newCol);
      }
    }
  }

  // Remove mines from the protected area.
  let minesToMove = 0;

  for (const index of safeCells) {
    const safeRow = Math.floor(index / cols);
    const safeCol = index % cols;

    if (board[safeRow][safeCol].isMine) {
      board[safeRow][safeCol].isMine = false;
      minesToMove++;
    }
  }

  // Collect eligible destination cells outside the protected area.
  const availableCells = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (
        !safeCells.has(r * cols + c) &&
        !board[r][c].isMine
      ) {
        availableCells.push(board[r][c]);
      }
    }
  }

  // Relocate mines randomly without duplicating destinations.
  for (let i = 0; i < minesToMove; i++) {
    const randomIndex = Math.floor(Math.random() * availableCells.length);
    const [cell] = availableCells.splice(randomIndex, 1);

    cell.isMine = true;
  }

  // Mine positions changed, so adjacent counts must be recalculated.
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
// 8. Game rules
// -----------------------------------------------------------------------------

function revealCell(row, col) {
  // Ignore coordinates outside the board.
  if (row < 0 || row >= rows || col < 0 || col >= cols) return;

  const cell = board[row][col];

  // Revealed and flagged cells cannot be revealed again.
  if (cell.isRevealed || cell.isFlagged) return;

  cell.isRevealed = true;

  // Revealing a mine ends the game.
  if (cell.isMine) {
    gameOver = true;
    stopTimer();

    playLossSound();
    revealAllMines();
    showGameOverPopup(false);

    return;
  }

  // Empty cells recursively reveal their neighbors.
  // Numbered cells form the boundary of the revealed area.
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
  // Winning requires revealing every non-mine cell.
  // Flags are optional.
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cell = board[row][col];

      if (!cell.isMine && !cell.isRevealed) {
        return false;
      }
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

  // Reset the board.
  board.length = 0;
  flagsRemaining = mineCount;

  // Reset gameplay state.
  gameOver = false;
  firstClick = true;
  flagMode = false;
  isPaused = false;

  // Reset hover and timer state.
  hoveredRow = -1;
  hoveredCol = -1;
  secondsElapsed = 0;

  // Generate a fresh board.
  createBoard();
  placeMines(mineCount);
  countAdjacentMines();

  // Reset controls and close any open popups.
  updateTimer();
  updateFlagCounter();
  updateFlagMode();
  updatePauseButton();

  pauseOverlay.classList.add('hidden');
  hideGameOverPopup();

  draw();
}

// -----------------------------------------------------------------------------
// 9. Responsive Canvas sizing
// -----------------------------------------------------------------------------

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;

  const availableWidth = window.innerWidth - 32;
  const availableHeight = window.innerHeight - 220;

  // Scale the displayed board to fit without changing its aspect ratio.
  const scale = Math.min(
    1,
    availableWidth / canvasWidth,
    availableHeight / canvasHeight
  );

  const displayWidth = Math.floor(canvasWidth * scale);
  const displayHeight = Math.floor(canvasHeight * scale);

  // Maintain full logical drawing resolution for sharp graphics.
  canvas.width = Math.round(canvasWidth * dpr);
  canvas.height = Math.round(canvasHeight * dpr);

  canvas.style.width = `${displayWidth}px`;
  canvas.style.height = `${displayHeight}px`;
  canvas.style.aspectRatio = `${cols} / ${rows}`;

  canvas.style.setProperty('--board-width', `${canvasWidth}px`);

  // Scale the drawing context for high-density screens.
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  draw();
}

// -----------------------------------------------------------------------------
// 10. Canvas rendering
// -----------------------------------------------------------------------------

function draw() {
  // Board background.
  ctx.fillStyle = '#252545';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cell = board[row][col];

      const x = col * cellSize;
      const y = row * cellSize;

      const isLightTile = (row + col) % 2 === 0;

      // Revealed cells are gray; hidden cells are green.
      if (cell.isRevealed) {
        ctx.fillStyle = isLightTile ? '#c3c2c2' : '#a7a6a6';
      } else {
        ctx.fillStyle = isLightTile ? '#AAD751' : '#94bf44';
      }

      // Highlight hovered cells only during active gameplay.
      if (
        !gameOver &&
        !isPaused &&
        !cell.isRevealed &&
        !cell.isFlagged &&
        row === hoveredRow &&
        col === hoveredCol
      ) {
        ctx.fillStyle = '#C6ED7C';
      }

      ctx.fillRect(x + 1, y + 1, cellSize - 2, cellSize - 2);

      // Draw adjacent mine counts.
      if (
        cell.isRevealed &&
        !cell.isMine &&
        cell.adjacentMines > 0
      ) {
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

      // Draw revealed mines.
      if (cell.isRevealed && cell.isMine) {
        ctx.font = '24px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.fillText(
          '💣',
          x + cellSize / 2,
          y + cellSize / 2
        );
      }

      // Draw flags on hidden cells.
      if (cell.isFlagged && !cell.isRevealed) {
        ctx.fillStyle = 'white';
        ctx.font = '24px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.fillText(
          '🚩',
          x + cellSize / 2,
          y + cellSize / 2
        );
      }
    }
  }
}

// -----------------------------------------------------------------------------
// 11. Mouse and touch input
// -----------------------------------------------------------------------------

function getCellFromMouse(event) {
  const rect = canvas.getBoundingClientRect();

  const mouseX = event.clientX - rect.left;
  const mouseY = event.clientY - rect.top;

  // Convert displayed CSS pixels into logical board coordinates.
  const scaleX = canvasWidth / rect.width;
  const scaleY = canvasHeight / rect.height;

  const col = Math.floor((mouseX * scaleX) / cellSize);
  const row = Math.floor((mouseY * scaleY) / cellSize);

  return { row, col };
}

function handleClick(event) {
  // Gameplay is disabled after game over and while paused.
  if (gameOver || isPaused) return;

  // In Flag mode, normal clicks toggle flags instead of revealing cells.
  if (flagMode) {
    toggleFlag(event);
    return;
  }

  const { row, col } = getCellFromMouse(event);

  if (row < 0 || row >= rows || col < 0 || col >= cols) return;

  const cell = board[row][col];

  // Start the timer only when a valid hidden, unflagged cell is revealed.
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

  // Check for victory after revealing cells.
  if (!gameOver && checkWin()) {
    gameOver = true;
    stopTimer();

    playWinSound();
    showGameOverPopup(true);
  }

  draw();
}

function toggleFlag(event) {
  // Prevent the browser's context menu on right-click.
  event.preventDefault();

  if (gameOver || isPaused) return;

  const { row, col } = getCellFromMouse(event);

  if (row < 0 || row >= rows || col < 0 || col >= cols) return;

  const cell = board[row][col];

  // Revealed cells cannot be flagged.
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
// 12. Event listeners
// -----------------------------------------------------------------------------

// Sound toggle.
soundButton.addEventListener('click', () => {
  soundMuted = !soundMuted;

  soundButton.textContent = soundMuted ? '🔇' : '🔊';
  soundButton.title = soundMuted ? 'Unmute sound' : 'Mute sound';
  soundButton.setAttribute('aria-label', soundButton.title);
});

// Reveal/Flag mode toggle.
flagCounter.addEventListener('click', () => {
  flagMode = !flagMode;
  updateFlagMode();
});

// Clicking the clock pauses or resumes the game.
timerDisplay.addEventListener('click', togglePause);

// Resume button inside the pause popup.
resumeButton.addEventListener('click', resumeGame);

// Board interaction.
canvas.addEventListener('click', handleClick);
canvas.addEventListener('contextmenu', toggleFlag);

// Mouse hover highlighting.
canvas.addEventListener('mousemove', (event) => {
  if (isPaused) return;

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

// Start a new game.
newGameButton.addEventListener('click', newGame);

// Dismiss the win/loss popup.
gameOverOkButton.addEventListener('click', hideGameOverPopup);

// Change difficulty and generate a new board.
difficultySelect.addEventListener('change', () => {
  currentDifficulty = difficultySelect.value;

  const settings = difficulties[currentDifficulty];

  rows = settings.rows;
  cols = settings.cols;
  mineCount = settings.mines;

  canvasWidth = cols * cellSize;
  canvasHeight = rows * cellSize;

  newGame();
  resizeCanvas();
});

// Keep the board responsive when the browser window changes size.
window.addEventListener('resize', resizeCanvas);

// -----------------------------------------------------------------------------
// 13. Initial game setup
// -----------------------------------------------------------------------------

createBoard();
placeMines(mineCount);
countAdjacentMines();

updateTimer();
updateFlagCounter();
updateFlagMode();
updatePauseButton();

resizeCanvas();
