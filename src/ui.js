
/* ==========================================================================
   Minesweeper - User Interface

   Builds and manages:
   - Game title and status controls
   - Canvas container
   - New Game and difficulty controls
   - Sound and Flag mode
   - Pause and game-over dialogs
   - Portfolio footer
   ========================================================================== */

import { ASSETS } from './config.js';

export class MinesweeperUI {
  constructor(rootElement, game, audio) {
    this.root = rootElement;
    this.game = game;
    this.audio = audio;

    this.activeDialog = null;

    this.onNewGame = null;
    this.onDifficultyChange = null;

    this.buildInterface();
    this.cacheElements();
    this.attachEvents();
    this.update();
  }

  /* ========================================================================
     1. Build Interface
     ======================================================================== */

  buildInterface() {
    this.root.innerHTML = `
      <main class="game">

        <section class="board-container"
                 aria-label="Minesweeper game board">
          <canvas
            id="gameCanvas"
            aria-label="Minesweeper grid"
          ></canvas>
        </section>

        <div class="game-sidebar">

          <header class="game-header">
            <h1>Minesweeper</h1>
          </header>

          <section class="status-panel"
                   aria-label="Game status and controls">

            <div class="game-controls">

              <button
                id="flagCounter"
                class="status-button"
                type="button"
                title="Switch to Flag mode"
                aria-label="Switch to Flag mode"
                aria-pressed="false"
              >
                <img
                  src="${ASSETS.flag}"
                  alt=""
                  class="control-icon"
                >
                <span id="flagCount">40</span>
              </button>

              <button
                id="timer"
                class="status-button"
                type="button"
                title="Pause game"
                aria-label="Pause game"
                aria-pressed="false"
              >
                <span class="timer-icon" aria-hidden="true">⏱</span>
                <span id="timerValue">00:00</span>
              </button>

              <button
                id="soundButton"
                class="icon-button"
                type="button"
                title="Mute sound"
                aria-label="Mute sound"
                aria-pressed="false"
              >
                <img
                  id="soundIcon"
                  src="${ASSETS.soundOn}"
                  alt=""
                  class="control-icon"
                >
              </button>

            </div>
          </section>

          <section class="control-panel"
                   aria-label="Game setup">

            <div class="difficulty-controls">

              <button
                id="newGameButton"
                type="button"
              >
                New Game
              </button>

              <label for="difficultySelect">
                Difficulty:
              </label>

              <select
                id="difficultySelect"
                aria-label="Difficulty"
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="expert">Expert</option>
              </select>

            </div>
          </section>

          <footer class="game-footer">
            Made by:
            <a
              href="https://fredwahab.com"
              target="_blank"
              rel="noopener noreferrer"
            >fredwahab.com</a>
          </footer>

        </div>

        <!-- Pause dialog -->
        <div
          id="pauseOverlay"
          class="game-over-overlay hidden"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pauseTitle"
        >
          <div class="game-over-popup">

            <h2 id="pauseTitle">Paused</h2>

            <p class="pause-message">
              Your game is paused.
            </p>

            <button
              id="resumeButton"
              type="button"
            >
              Resume Game
            </button>

          </div>
        </div>

        <!-- Win/loss dialog -->
        <div
          id="gameOverOverlay"
          class="game-over-overlay hidden"
          role="dialog"
          aria-modal="true"
          aria-labelledby="gameOverMessage"
        >
          <div class="game-over-popup">

            <h2 id="gameOverMessage">
              You Win!
            </h2>

            <button
              id="gameOverOkButton"
              type="button"
            >
              OK
            </button>

          </div>
        </div>

      </main>
    `;
  }

  /* ========================================================================
     2. Cache DOM Elements
     ======================================================================== */

  cacheElements() {
    const find = (selector) => this.root.querySelector(selector);

    this.canvas = find('#gameCanvas');
    this.boardContainer = find('.board-container');

    this.flagCounter = find('#flagCounter');
    this.flagCount = find('#flagCount');

    this.timerButton = find('#timer');
    this.timerValue = find('#timerValue');

    this.soundButton = find('#soundButton');
    this.soundIcon = find('#soundIcon');

    this.newGameButton = find('#newGameButton');
    this.difficultySelect = find('#difficultySelect');

    this.pauseOverlay = find('#pauseOverlay');
    this.resumeButton = find('#resumeButton');

    this.gameOverOverlay = find('#gameOverOverlay');
    this.gameOverMessage = find('#gameOverMessage');
    this.gameOverOkButton = find('#gameOverOkButton');
  }

  /* ========================================================================
     3. Update Interface
     ======================================================================== */

  update() {
    this.updateFlagCounter();
    this.updateTimer();
    this.updateFlagMode();
    this.updatePauseButton();
    this.updateSoundButton();

    this.difficultySelect.value = this.game.difficulty;
  }

  updateFlagCounter() {
    this.flagCount.textContent = this.game.flagsRemaining;
  }

  updateTimer() {
    this.timerValue.textContent = this.game.getFormattedTime();
  }

  updateFlagMode() {
    const active = this.game.flagMode;

    this.flagCounter.classList.toggle('active', active);
    this.flagCounter.setAttribute('aria-pressed', String(active));

    const label = active
      ? 'Switch to Reveal mode'
      : 'Switch to Flag mode';

    this.flagCounter.title = label;
    this.flagCounter.setAttribute('aria-label', label);

    this.canvas.style.cursor = active ? 'crosshair' : 'default';
  }

  updatePauseButton() {
    const paused = this.game.isPaused;

    this.timerButton.classList.toggle('active', paused);
    this.timerButton.setAttribute('aria-pressed', String(paused));

    const label = paused ? 'Resume game' : 'Pause game';

    this.timerButton.title = label;
    this.timerButton.setAttribute('aria-label', label);
  }

  updateSoundButton() {
    const muted = this.audio.isMuted();

    this.soundIcon.src = muted
      ? ASSETS.soundOff
      : ASSETS.soundOn;

    const label = muted ? 'Unmute sound' : 'Mute sound';

    this.soundButton.title = label;
    this.soundButton.setAttribute('aria-label', label);
    this.soundButton.setAttribute('aria-pressed', String(muted));
  }

  /* ========================================================================
     4. Dialog Management
     ======================================================================== */

  showPauseDialog() {
    this.hideDialogs();

    this.pauseOverlay.classList.remove('hidden');
    this.activeDialog = 'pause';

    this.resumeButton.focus();
  }

  showGameOverDialog(won) {
    this.hideDialogs();

    this.gameOverMessage.textContent = won
      ? 'You Win!'
      : 'You Lose!';

    this.gameOverOverlay.classList.remove('hidden');
    this.activeDialog = 'gameOver';

    this.gameOverOkButton.focus();
  }

  hidePauseDialog() {
    this.pauseOverlay.classList.add('hidden');

    if (this.activeDialog === 'pause') {
      this.activeDialog = null;
    }
  }

  hideGameOverDialog() {
    this.gameOverOverlay.classList.add('hidden');

    if (this.activeDialog === 'gameOver') {
      this.activeDialog = null;
    }
  }

  hideDialogs() {
    this.hidePauseDialog();
    this.hideGameOverDialog();
  }

  /* ========================================================================
     5. Event Listeners
     ======================================================================== */

  attachEvents() {
    // Flag mode for touchscreen devices.
    this.flagCounter.addEventListener('click', () => {
      this.game.toggleFlagMode();
    });

    // Pause or resume using the timer.
    this.timerButton.addEventListener('click', () => {
      this.game.togglePause();
    });

    // Resume from the pause dialog.
    this.resumeButton.addEventListener('click', () => {
      this.game.resumeGame();
    });

    // New Game.
    this.newGameButton.addEventListener('click', () => {
      if (this.onNewGame) {
        this.onNewGame();
      } else {
        this.game.newGame();
      }
    });

    // Difficulty selection.
    this.difficultySelect.addEventListener('change', () => {
      const difficulty = this.difficultySelect.value;

      if (this.onDifficultyChange) {
        this.onDifficultyChange(difficulty);
      } else {
        this.game.newGame(difficulty);
      }
    });

    // Mute or unmute.
    this.soundButton.addEventListener('click', () => {
      this.audio.toggleMute();
      this.updateSoundButton();
    });

    // Dismiss win/loss dialog.
    this.gameOverOkButton.addEventListener('click', () => {
      this.hideGameOverDialog();
    });
  }
}
