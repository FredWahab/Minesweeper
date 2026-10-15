
/* ==========================================================================
   Minesweeper - Application Entry Point

   Connects:
   - Game state and rules
   - User interface
   - Canvas rendering
   - Mouse and touchscreen input
   - Keyboard pause/resume
   - Audio
   - Responsive sizing and orientation changes
   - Victory and loss animation sequencing
   ========================================================================== */

import './style.css';

import {
  getScreenOrientation
} from './config.js';

import { MinesweeperGame } from './game.js';
import { MinesweeperUI } from './ui.js';
import { MinesweeperRenderer } from './renderer.js';
import { MinesweeperInput } from './input.js';
import { MinesweeperAudio } from './audio.js';


/* ==========================================================================
   1. Application References
   ========================================================================== */

const root = document.querySelector('#app');

let game;
let ui;
let renderer;
let input;
let audio;

let resizeFrame = null;
let orientationFrame = null;

// Pending game-over dialog after a victory or explosion.
let gameOverTimeout = null;


/* ==========================================================================
   2. Game-Over Animation Management
   ========================================================================== */

/**
 * Cancel a pending game-over dialog and any active
 * victory or loss animation.
 */
function cancelGameOverSequence() {
  if (gameOverTimeout !== null) {
    clearTimeout(gameOverTimeout);
    gameOverTimeout = null;
  }

  if (renderer) {
    renderer.stopExplosion();
    renderer.stopVictory();
  }
}


/**
 * Show the game-over dialog after the animation.
 *
 * A zero duration displays the dialog immediately,
 * which supports reduced-motion preferences.
 */
function scheduleGameOverDialog(won, duration) {
  if (duration <= 0) {
    ui.showGameOverDialog(won);
    return;
  }

  gameOverTimeout = setTimeout(() => {
    gameOverTimeout = null;

    // Prevent a stale dialog after restarting.
    if (!game.gameOver || game.won !== won) {
      return;
    }

    ui.showGameOverDialog(won);
  }, duration);
}


/**
 * Start the loss explosion.
 */
function handleLoss() {
  audio.play('lose');

  const duration = renderer.startExplosion();

  scheduleGameOverDialog(false, duration);
}


/**
 * Start the victory celebration.
 */
function handleVictory() {
  audio.play('win');

  const duration = renderer.startVictory();

  scheduleGameOverDialog(true, duration);
}


/**
 * Complete an interrupted animation.
 *
 * A resize or orientation change can reset the
 * canvas while an animation is playing.
 */
function finishInterruptedGameOver() {
  if (gameOverTimeout === null) {
    return;
  }

  clearTimeout(gameOverTimeout);
  gameOverTimeout = null;

  renderer.stopExplosion();
  renderer.stopVictory();

  if (game.gameOver) {
    ui.showGameOverDialog(game.won);
  }
}


/* ==========================================================================
   3. Game State Events
   ========================================================================== */

/**
 * Handle notifications sent by the game controller.
 */
function handleGameEvent(eventName) {
  if (!ui || !renderer) {
    return;
  }

  ui.update();

  switch (eventName) {
    case 'newGame':
      cancelGameOverSequence();
      renderer.cancelAnimations();

      ui.hideDialogs();

      if (input) {
        input.reset();
      }

      scheduleResize();
      break;

    case 'reveal':
      audio.play('reveal');
      break;

    case 'flag':
      audio.play('flag');
      break;

    case 'win':
      handleVictory();
      break;

    case 'lose':
      handleLoss();
      break;

    case 'paused':
      ui.showPauseDialog();
      break;

    case 'resumed':
      ui.hidePauseDialog();
      break;

    case 'orientationChanged':
      if (input) {
        input.reset();
      }

      finishInterruptedGameOver();
      scheduleResize();
      break;

    case 'timer':
      // ui.update() already refreshed the timer.
      break;
  }

  renderer.draw();
}


/* ==========================================================================
   4. Responsive Canvas Sizing
   ========================================================================== */

/**
 * Resize on the next animation frame.
 *
 * This allows the browser to update CSS layout
 * before measuring the available canvas space.
 */
function scheduleResize() {
  if (!renderer) {
    return;
  }

  if (resizeFrame !== null) {
    cancelAnimationFrame(resizeFrame);
  }

  resizeFrame = requestAnimationFrame(() => {
    resizeFrame = null;

    // Canvas resizing cancels active animations.
    finishInterruptedGameOver();

    renderer.resize();
  });
}


/* ==========================================================================
   5. Orientation Handling
   ========================================================================== */

/**
 * Check whether the screen orientation has changed.
 *
 * The existing game is preserved and transposed
 * if necessary. Active games pause after rotation.
 */
function handleOrientationChange() {
  if (!game) {
    return;
  }

  const orientation = getScreenOrientation();

  if (orientation !== game.orientation) {
    if (!game.firstClick && !game.gameOver) {
      game.pauseGame();
    }

    game.changeOrientation(orientation);
  }

  scheduleResize();
}


/**
 * Defer orientation processing until the viewport
 * dimensions have updated.
 */
function scheduleOrientationCheck() {
  if (orientationFrame !== null) {
    cancelAnimationFrame(orientationFrame);
  }

  orientationFrame = requestAnimationFrame(() => {
    orientationFrame = null;
    handleOrientationChange();
  });
}


/* ==========================================================================
   6. Initialize Application
   ========================================================================== */

audio = new MinesweeperAudio();

game = new MinesweeperGame(handleGameEvent);

ui = new MinesweeperUI(root, game, audio);

renderer = new MinesweeperRenderer(
  ui.canvas,
  game
);

input = new MinesweeperInput(
  ui.canvas,
  game,
  renderer
);


/* ==========================================================================
   7. Interface Callbacks
   ========================================================================== */

/**
 * Start a new game at the selected difficulty.
 */
ui.onNewGame = () => {
  cancelGameOverSequence();
  game.newGame();
};


/**
 * Start a new game when difficulty changes.
 */
ui.onDifficultyChange = (difficulty) => {
  cancelGameOverSequence();
  game.newGame(difficulty);
};


/* ==========================================================================
   8. Keyboard, Resize, and Orientation Listeners
   ========================================================================== */

/**
 * Toggle pause/resume with Spacebar.
 *
 * Ignore interactive controls so Space retains
 * its normal behavior for buttons and form fields.
 */
function handleKeyDown(event) {
  if (event.code !== 'Space' || event.repeat) {
    return;
  }

  const target = event.target;

  if (
    target instanceof Element &&
    target.closest(
      'input, textarea, select, button, a, [contenteditable="true"]'
    )
  ) {
    return;
  }

  if (!game || game.gameOver) {
    return;
  }

  event.preventDefault();
  game.togglePause();
}

document.addEventListener(
  'keydown',
  handleKeyDown
);


const resizeObserver = new ResizeObserver(() => {
  scheduleResize();
});

resizeObserver.observe(ui.boardContainer);


window.addEventListener(
  'resize',
  scheduleOrientationCheck
);


window.addEventListener(
  'orientationchange',
  scheduleOrientationCheck
);


/**
 * Pause active games when the page becomes hidden.
 */
function handleVisibilityChange() {
  if (
    document.hidden &&
    game &&
    !game.firstClick &&
    !game.gameOver
  ) {
    game.pauseGame();
  }
}

document.addEventListener(
  'visibilitychange',
  handleVisibilityChange
);


/* ==========================================================================
   9. Initial Render
   ========================================================================== */

ui.update();
scheduleResize();


/* ==========================================================================
   10. Development Cleanup
   ========================================================================== */

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    cancelGameOverSequence();

    if (resizeFrame !== null) {
      cancelAnimationFrame(resizeFrame);
    }

    if (orientationFrame !== null) {
      cancelAnimationFrame(orientationFrame);
    }

    resizeObserver.disconnect();

    document.removeEventListener(
      'keydown',
      handleKeyDown
    );

    window.removeEventListener(
      'resize',
      scheduleOrientationCheck
    );

    window.removeEventListener(
      'orientationchange',
      scheduleOrientationCheck
    );

    document.removeEventListener(
      'visibilitychange',
      handleVisibilityChange
    );

    input.destroy();
    game.destroy();
    audio.destroy();
  });
}
