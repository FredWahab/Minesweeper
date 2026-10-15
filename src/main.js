
/* ==========================================================================
   Minesweeper - Application Entry Point

   Connects:
   - Game state and rules
   - User interface
   - Canvas rendering
   - Mouse and touchscreen input
   - Audio
   - Responsive sizing and orientation changes
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


/* ==========================================================================
   2. Game State Events
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
      audio.play('win');
      ui.showGameOverDialog(true);
      break;

    case 'lose':
      audio.play('lose');
      ui.showGameOverDialog(false);
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

      scheduleResize();
      break;

    case 'timer':
      // ui.update() already refreshed the timer.
      break;
  }

  renderer.draw();
}


/* ==========================================================================
   3. Responsive Canvas Sizing
   ========================================================================== */

/**
 * Resize on the next animation frame.
 *
 * This allows the browser to update CSS layout before the
 * Canvas renderer measures its available space.
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
    renderer.resize();
  });
}


/* ==========================================================================
   4. Orientation Handling
   ========================================================================== */

/**
 * Check whether the screen orientation has changed.
 *
 * The existing game is preserved and transposed if necessary.
 * Active games pause automatically after rotation.
 */
function handleOrientationChange() {
  if (!game) {
    return;
  }

  const orientation = getScreenOrientation();

  if (orientation !== game.orientation) {
    // Pause before rearranging an active board.
    if (!game.firstClick && !game.gameOver) {
      game.pauseGame();
    }

    game.changeOrientation(orientation);
  }

  scheduleResize();
}


/**
 * Defer orientation processing until the viewport dimensions
 * have updated.
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
   5. Initialize Application
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
   6. Interface Callbacks
   ========================================================================== */

/**
 * Start a new game at the currently selected difficulty.
 */
ui.onNewGame = () => {
  game.newGame();
};


/**
 * Start a new game when the difficulty changes.
 */
ui.onDifficultyChange = (difficulty) => {
  game.newGame(difficulty);
};


/* ==========================================================================
   7. Resize and Orientation Listeners
   ========================================================================== */

/**
 * ResizeObserver detects changes to the actual board container,
 * including changes caused by mobile browser UI.
 */
const resizeObserver = new ResizeObserver(() => {
  scheduleResize();
});

resizeObserver.observe(ui.boardContainer);


/**
 * Window resizing can also indicate a phone rotation.
 */
window.addEventListener(
  'resize',
  scheduleOrientationCheck
);


/**
 * Some mobile browsers provide an explicit orientation event.
 */
window.addEventListener(
  'orientationchange',
  scheduleOrientationCheck
);


/**
 * Pause active games when the page becomes hidden.
 *
 * This prevents the timer from continuing while the player
 * is in another application or browser tab.
 */
document.addEventListener('visibilitychange', () => {
  if (
    document.hidden &&
    game &&
    !game.firstClick &&
    !game.gameOver
  ) {
    game.pauseGame();
  }
});


/* ==========================================================================
   8. Initial Render
   ========================================================================== */

ui.update();
scheduleResize();


/* ==========================================================================
   9. Development Cleanup
   ========================================================================== */

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    if (resizeFrame !== null) {
      cancelAnimationFrame(resizeFrame);
    }

    if (orientationFrame !== null) {
      cancelAnimationFrame(orientationFrame);
    }

    resizeObserver.disconnect();

    window.removeEventListener(
      'resize',
      scheduleOrientationCheck
    );

    window.removeEventListener(
      'orientationchange',
      scheduleOrientationCheck
    );

    input.destroy();
    game.destroy();
    audio.destroy();
  });
}
