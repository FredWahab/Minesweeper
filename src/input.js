
/* ==========================================================================
   Minesweeper - Input Controller

   Responsible for:
   - Mouse and touchscreen input
   - Left-click / tap actions
   - Right-click flagging
   - Hover highlighting
   - Preventing unwanted browser gestures
   - Disabling input during pause and game over

   Game rules are managed by game.js.
   Canvas rendering is managed by renderer.js.
   ========================================================================== */


/* ==========================================================================
   1. Input Controller Class
   ========================================================================== */

export class MinesweeperInput {
  constructor(canvas, game, renderer) {
    this.canvas = canvas;
    this.game = game;
    this.renderer = renderer;

    // Track the active pointer to avoid duplicate interactions.
    this.activePointerId = null;

    // Bind handlers once so they can be removed during cleanup.
    this.handlePointerDown = this.handlePointerDown.bind(this);
    this.handlePointerMove = this.handlePointerMove.bind(this);
    this.handlePointerUp = this.handlePointerUp.bind(this);
    this.handlePointerCancel = this.handlePointerCancel.bind(this);
    this.handlePointerLeave = this.handlePointerLeave.bind(this);
    this.handleContextMenu = this.handleContextMenu.bind(this);

    this.attachEvents();
  }


  /* ========================================================================
     2. Event Registration
     ======================================================================== */

  attachEvents() {
    // Prevent touch gestures on the game board.
    // Other page elements retain normal browser behavior.
    this.canvas.style.touchAction = 'none';

    this.canvas.addEventListener(
      'pointerdown',
      this.handlePointerDown
    );

    this.canvas.addEventListener(
      'pointermove',
      this.handlePointerMove
    );

    this.canvas.addEventListener(
      'pointerup',
      this.handlePointerUp
    );

    this.canvas.addEventListener(
      'pointercancel',
      this.handlePointerCancel
    );

    this.canvas.addEventListener(
      'pointerleave',
      this.handlePointerLeave
    );

    // Suppress the browser's right-click menu.
    this.canvas.addEventListener(
      'contextmenu',
      this.handleContextMenu
    );
  }


  /* ========================================================================
     3. Pointer Press
     ======================================================================== */

  /**
   * Record the active pointer.
   *
   * Gameplay actions occur on pointer release, allowing users
   * to cancel a touch by dragging outside the original cell.
   */
  handlePointerDown(event) {
    if (this.game.isPaused || this.game.gameOver) {
      return;
    }

    // Ignore additional fingers or simultaneous pointers.
    if (this.activePointerId !== null) {
      return;
    }

    // Accept primary and secondary mouse buttons.
    if (
      event.pointerType === 'mouse' &&
      event.button !== 0 &&
      event.button !== 2
    ) {
      return;
    }

    this.activePointerId = event.pointerId;

    const cell = this.renderer.getCellFromPointer(event);

    this.pressedCell = cell;

    // Capture touch input so cancellation is handled consistently.
    if (event.pointerType !== 'mouse') {
      this.canvas.setPointerCapture(event.pointerId);
    }
  }


  /* ========================================================================
     4. Pointer Release
     ======================================================================== */

  /**
   * Execute the selected action when a pointer is released.
   */
  handlePointerUp(event) {
    if (event.pointerId !== this.activePointerId) {
      return;
    }

    this.activePointerId = null;

    const releasedCell = this.renderer.getCellFromPointer(event);
    const pressedCell = this.pressedCell;

    this.pressedCell = null;

    // Ignore input if the game became paused or ended.
    if (this.game.isPaused || this.game.gameOver) {
      return;
    }

    // The press and release must occur on the same cell.
    if (
      !pressedCell ||
      !releasedCell ||
      pressedCell.row !== releasedCell.row ||
      pressedCell.col !== releasedCell.col
    ) {
      return;
    }

    const { row, col } = releasedCell;

    // Right-click always toggles a flag.
    if (
      event.pointerType === 'mouse' &&
      event.button === 2
    ) {
      this.game.toggleFlag(row, col);
      return;
    }

    // Flag mode changes the primary click/tap action.
    if (this.game.flagMode) {
      this.game.toggleFlag(row, col);
    } else {
      this.game.reveal(row, col);
    }
  }


  /* ========================================================================
     5. Pointer Movement
     ======================================================================== */

  /**
   * Highlight the cell beneath the mouse pointer.
   *
   * Touchscreens do not use hover highlighting.
   */
  handlePointerMove(event) {
    if (
      event.pointerType !== 'mouse' ||
      this.game.isPaused ||
      this.game.gameOver
    ) {
      return;
    }

    const cell = this.renderer.getCellFromPointer(event);

    if (cell) {
      this.renderer.setHover(cell.row, cell.col);
    } else {
      this.renderer.clearHover();
    }
  }


  /* ========================================================================
     6. Pointer Cancellation
     ======================================================================== */

  /**
   * Cancel a pending interaction.
   *
   * This may occur when the browser interrupts a gesture
   * or the device changes orientation.
   */
  handlePointerCancel(event) {
    if (event.pointerId !== this.activePointerId) {
      return;
    }

    this.activePointerId = null;
    this.pressedCell = null;

    this.renderer.clearHover();
  }


  /**
   * Clear mouse hover when the pointer leaves the board.
   */
  handlePointerLeave(event) {
    if (event.pointerType === 'mouse') {
      this.renderer.clearHover();
    }
  }


  /* ========================================================================
     7. Context Menu Prevention
     ======================================================================== */

  handleContextMenu(event) {
    event.preventDefault();
  }


  /* ========================================================================
     8. Reset and Cleanup
     ======================================================================== */

  /**
   * Cancel any pending pointer interaction.
   *
   * Useful when resetting the game or changing orientation.
   */
  reset() {
    this.activePointerId = null;
    this.pressedCell = null;

    this.renderer.clearHover();
  }


  /**
   * Remove all event listeners when disposing of the controller.
   */
  destroy() {
    this.canvas.removeEventListener(
      'pointerdown',
      this.handlePointerDown
    );

    this.canvas.removeEventListener(
      'pointermove',
      this.handlePointerMove
    );

    this.canvas.removeEventListener(
      'pointerup',
      this.handlePointerUp
    );

    this.canvas.removeEventListener(
      'pointercancel',
      this.handlePointerCancel
    );

    this.canvas.removeEventListener(
      'pointerleave',
      this.handlePointerLeave
    );

    this.canvas.removeEventListener(
      'contextmenu',
      this.handleContextMenu
    );
  }
}
