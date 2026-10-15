
/* ==========================================================================
   Minesweeper - Game Controller

   Responsible for:
   - Game initialization and difficulty changes
   - Portrait and landscape board dimensions
   - Preserving progress during orientation changes
   - Timer management
   - Pause and resume
   - Revealing and flagging cells
   - Win and loss detection
   - Notifying the interface of state changes

   Board rules are handled separately by board.js.
   ========================================================================== */

import {
  DIFFICULTIES,
  DEFAULT_DIFFICULTY,
  getBoardDimensions,
  getScreenOrientation
} from './config.js';

import {
  createBoard,
  placeMines,
  protectFirstClick,
  revealCell,
  toggleCellFlag,
  checkWin,
  revealAllMines
} from './board.js';


/* ==========================================================================
   1. Game Class
   ========================================================================== */

export class MinesweeperGame {
  constructor(onStateChange = () => {}) {
    this.onStateChange = onStateChange;

    this.difficulty = DEFAULT_DIFFICULTY;
    this.orientation = getScreenOrientation();

    this.timerInterval = null;

    this.newGame(this.difficulty);
  }


  /* ========================================================================
     2. Game Initialization
     ======================================================================== */

  /**
   * Create a new board using the current screen orientation.
   *
   * All gameplay state is reset.
   */
  newGame(difficulty = this.difficulty) {
    this.stopTimer();

    if (!DIFFICULTIES[difficulty]) {
      difficulty = DEFAULT_DIFFICULTY;
    }

    this.difficulty = difficulty;
    this.orientation = getScreenOrientation();

    const settings = getBoardDimensions(
      difficulty,
      this.orientation
    );

    this.rows = settings.rows;
    this.cols = settings.cols;
    this.mineCount = settings.mines;

    this.board = createBoard(this.rows, this.cols);
    placeMines(this.board, this.mineCount);

    this.flagsRemaining = this.mineCount;
    this.firstClick = true;
    this.gameOver = false;
    this.won = false;
    this.isPaused = false;
    this.flagMode = false;

    this.secondsElapsed = 0;

    this.notify('newGame');
  }


  /* ========================================================================
     3. Orientation Changes
     ======================================================================== */

  /**
   * Adapt the existing board to a new screen orientation.
   *
   * Wide boards are transposed between landscape and portrait.
   * Square boards retain their existing arrangement.
   *
   * Mines, flags, revealed cells, and adjacency counts are
   * preserved because the original cell objects are reused.
   *
   * Returns true when the orientation changes.
   */
  changeOrientation(
    newOrientation = getScreenOrientation()
  ) {
    if (newOrientation === this.orientation) {
      return false;
    }

    const previousRows = this.rows;
    const previousCols = this.cols;

    const settings = getBoardDimensions(
      this.difficulty,
      newOrientation
    );

    // Transpose only when the dimensions actually change.
    if (
      settings.rows !== previousRows ||
      settings.cols !== previousCols
    ) {
      const transposedBoard = Array.from(
        { length: previousCols },
        (_, col) =>
          Array.from(
            { length: previousRows },
            (_, row) => this.board[row][col]
          )
      );

      this.board = transposedBoard;
      this.rows = settings.rows;
      this.cols = settings.cols;
    }

    this.orientation = newOrientation;

    this.notify('orientationChanged');

    return true;
  }


  /* ========================================================================
     4. Timer Management
     ======================================================================== */

  /**
   * Start or resume the timer after the first reveal.
   */
  startTimer() {
    if (
      this.timerInterval !== null ||
      this.isPaused ||
      this.gameOver ||
      this.firstClick
    ) {
      return;
    }

    this.timerInterval = setInterval(() => {
      this.secondsElapsed++;
      this.notify('timer');
    }, 1000);
  }


  /**
   * Stop the timer without resetting elapsed time.
   */
  stopTimer() {
    if (this.timerInterval !== null) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }


  /**
   * Format elapsed time as MM:SS.
   */
  getFormattedTime() {
    const minutes = Math.floor(this.secondsElapsed / 60);
    const seconds = this.secondsElapsed % 60;

    return (
      String(minutes).padStart(2, '0') +
      ':' +
      String(seconds).padStart(2, '0')
    );
  }


  /* ========================================================================
     5. Pause and Resume
     ======================================================================== */

  /**
   * Pause an active game and stop the timer.
   */
  pauseGame() {
    if (
      this.firstClick ||
      this.gameOver ||
      this.isPaused
    ) {
      return false;
    }

    this.isPaused = true;
    this.stopTimer();

    this.notify('paused');

    return true;
  }


  /**
   * Resume the game without resetting progress.
   */
  resumeGame() {
    if (!this.isPaused) {
      return false;
    }

    this.isPaused = false;
    this.startTimer();

    this.notify('resumed');

    return true;
  }


  /**
   * Toggle between paused and active gameplay.
   */
  togglePause() {
    return this.isPaused
      ? this.resumeGame()
      : this.pauseGame();
  }


  /* ========================================================================
     6. Reveal and Flag Modes
     ======================================================================== */

  /**
   * Toggle the primary click/touch action.
   */
  toggleFlagMode() {
    if (this.isPaused || this.gameOver) {
      return false;
    }

    this.flagMode = !this.flagMode;

    this.notify('flagMode');

    return true;
  }


  /* ========================================================================
     7. Revealing Cells
     ======================================================================== */

  /**
   * Reveal a selected cell.
   *
   * Returns:
   * - null: no action
   * - reveal: one or more cells revealed
   * - win: all safe cells revealed
   * - lose: a mine was revealed
   */
  reveal(row, col) {
    if (this.isPaused || this.gameOver) {
      return null;
    }

    if (
      row < 0 ||
      row >= this.rows ||
      col < 0 ||
      col >= this.cols
    ) {
      return null;
    }

    const cell = this.board[row][col];

    if (cell.isRevealed || cell.isFlagged) {
      return null;
    }

    // First reveal is guaranteed to open a safe region.
    if (this.firstClick) {
      protectFirstClick(this.board, row, col);
      this.firstClick = false;
      this.startTimer();
    }

    const result = revealCell(this.board, row, col);

    if (result.hitMine) {
      this.gameOver = true;
      this.won = false;

      this.stopTimer();
      revealAllMines(this.board);

      this.notify('lose');

      return 'lose';
    }

    if (checkWin(this.board)) {
      this.gameOver = true;
      this.won = true;

      this.stopTimer();

      this.notify('win');

      return 'win';
    }

    this.notify('reveal');

    return 'reveal';
  }


  /* ========================================================================
     8. Flagging Cells
     ======================================================================== */

  /**
   * Place or remove a flag.
   *
   * Returns:
   * -  1: flag placed
   * - -1: flag removed
   * -  0: no action
   */
  toggleFlag(row, col) {
    if (this.isPaused || this.gameOver) {
      return 0;
    }

    const change = toggleCellFlag(
      this.board,
      row,
      col,
      this.flagsRemaining
    );

    if (change !== 0) {
      this.flagsRemaining -= change;
      this.notify('flag');
    }

    return change;
  }


  /* ========================================================================
     9. State Notifications
     ======================================================================== */

  /**
   * Notify the application about a game state change.
   */
  notify(eventName) {
    this.onStateChange(eventName, this);
  }


  /* ========================================================================
     10. Cleanup
     ======================================================================== */

  destroy() {
    this.stopTimer();
  }
}
