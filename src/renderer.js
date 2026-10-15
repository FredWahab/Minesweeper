
/* ==========================================================================
   Minesweeper - Canvas Renderer

   Responsible for:
   - Drawing the game board
   - Rendering custom flag and mine assets
   - Displaying adjacent mine counts
   - Highlighting hovered cells
   - Scaling the board for desktop and mobile
   - Supporting high-density displays
   - Converting pointer coordinates to board cells

   Game rules and input handling are managed by other modules.
   ========================================================================== */

import {
  CELL_SIZE,
  NUMBER_COLORS,
  BOARD_COLORS,
  ASSETS
} from './config.js';


/* ==========================================================================
   1. Renderer Class
   ========================================================================== */

export class MinesweeperRenderer {
  constructor(canvas, game) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.game = game;

    // Logical board dimensions.
    this.boardWidth = game.cols * CELL_SIZE;
    this.boardHeight = game.rows * CELL_SIZE;

    // Mouse hover state.
    this.hoveredRow = -1;
    this.hoveredCol = -1;

    // Custom image assets.
    this.images = {
      flag: null,
      mine: null
    };

    this.loadImages();
    this.resize();
  }


  /* ========================================================================
     2. Image Asset Loading
     ======================================================================== */

  /**
   * Load custom flag and mine graphics.
   *
   * If an image fails to load, the renderer uses a
   * Canvas-drawn fallback instead.
   */
  loadImages() {
    const loadImage = (source, key) => {
      const image = new Image();

      image.onload = () => {
        this.images[key] = image;
        this.draw();
      };

      image.onerror = () => {
        console.warn(
          `Unable to load Minesweeper asset: ${source}`
        );
      };

      image.src = source;
    };

    loadImage(ASSETS.flag, 'flag');
    loadImage(ASSETS.mine, 'mine');
  }


  /* ========================================================================
     3. Responsive Canvas Sizing
     ======================================================================== */

  /**
   * Scale the board to the largest size that fits its container.
   *
   * The board is no longer restricted to its original logical
   * dimensions. Smaller boards can expand to use more space.
   *
   * Cells always remain square.
   *
   * Logical drawing coordinates remain based on CELL_SIZE.
   */
  resize() {
    // Update dimensions whenever board orientation changes.
    this.boardWidth = this.game.cols * CELL_SIZE;
    this.boardHeight = this.game.rows * CELL_SIZE;

    const parent = this.canvas.parentElement;
    const parentRect = parent.getBoundingClientRect();

    const availableWidth = parentRect.width;
    const availableHeight = parentRect.height;

    // Wait until the container has measurable dimensions.
    if (availableWidth <= 0 || availableHeight <= 0) {
      return;
    }

    // Largest square cell that fits within the container.
    const cellSize = Math.min(
      availableWidth / this.game.cols,
      availableHeight / this.game.rows
    );

    const displayWidth = cellSize * this.game.cols;
    const displayHeight = cellSize * this.game.rows;

    // High-density display support.
    const dpr = window.devicePixelRatio || 1;

    this.canvas.width = Math.max(
      1,
      Math.round(displayWidth * dpr)
    );

    this.canvas.height = Math.max(
      1,
      Math.round(displayHeight * dpr)
    );

    this.canvas.style.width = `${displayWidth}px`;
    this.canvas.style.height = `${displayHeight}px`;

    this.canvas.style.aspectRatio =
      `${this.game.cols} / ${this.game.rows}`;

    // Map logical board coordinates to physical pixels.
    this.ctx.setTransform(
      this.canvas.width / this.boardWidth,
      0,
      0,
      this.canvas.height / this.boardHeight,
      0,
      0
    );

    this.draw();
  }


  /* ========================================================================
     4. Board Rendering
     ======================================================================== */

  /**
   * Redraw the entire board.
   */
  draw() {
    const ctx = this.ctx;
    const board = this.game.board;

    if (!board) {
      return;
    }

    ctx.clearRect(
      0,
      0,
      this.boardWidth,
      this.boardHeight
    );

    ctx.fillStyle = BOARD_COLORS.background;

    ctx.fillRect(
      0,
      0,
      this.boardWidth,
      this.boardHeight
    );

    for (let row = 0; row < this.game.rows; row++) {
      for (let col = 0; col < this.game.cols; col++) {
        this.drawCell(row, col);
      }
    }
  }


  /**
   * Draw an individual Minesweeper cell.
   */
  drawCell(row, col) {
    const ctx = this.ctx;
    const cell = this.game.board[row][col];

    const x = col * CELL_SIZE;
    const y = row * CELL_SIZE;

    const isLight = (row + col) % 2 === 0;

    // Checkerboard colors.
    if (cell.isRevealed) {
      ctx.fillStyle = isLight
        ? BOARD_COLORS.revealedLight
        : BOARD_COLORS.revealedDark;
    } else {
      ctx.fillStyle = isLight
        ? BOARD_COLORS.hiddenLight
        : BOARD_COLORS.hiddenDark;
    }

    // Hover highlight.
    if (
      !this.game.isPaused &&
      !this.game.gameOver &&
      !cell.isRevealed &&
      !cell.isFlagged &&
      row === this.hoveredRow &&
      col === this.hoveredCol
    ) {
      ctx.fillStyle = BOARD_COLORS.hover;
    }

    // Leave a small border between cells.
    ctx.fillRect(
      x + 1,
      y + 1,
      CELL_SIZE - 2,
      CELL_SIZE - 2
    );

    // Revealed numbered cells.
    if (
      cell.isRevealed &&
      !cell.isMine &&
      cell.adjacentMines > 0
    ) {
      this.drawNumber(
        cell.adjacentMines,
        x,
        y
      );
    }

    // Revealed mines.
    if (cell.isRevealed && cell.isMine) {
      this.drawMine(x, y);
    }

    // Flags on hidden cells.
    if (cell.isFlagged && !cell.isRevealed) {
      this.drawFlag(x, y);
    }
  }


  /* ========================================================================
     5. Cell Contents
     ======================================================================== */

  /**
   * Draw an adjacent mine count.
   */
  drawNumber(number, x, y) {
    const ctx = this.ctx;

    ctx.fillStyle = NUMBER_COLORS[number];
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.fillText(
      number,
      x + CELL_SIZE / 2,
      y + CELL_SIZE / 2
    );
  }


  /**
   * Draw a mine using the custom SVG asset.
   *
   * Uses a Canvas fallback if the image is unavailable.
   */
  drawMine(x, y) {
    const ctx = this.ctx;
    const image = this.images.mine;

    if (image) {
      const padding = CELL_SIZE * 0.15;

      ctx.drawImage(
        image,
        x + padding,
        y + padding,
        CELL_SIZE - padding * 2,
        CELL_SIZE - padding * 2
      );

      return;
    }

    // Fallback mine graphic.
    const centerX = x + CELL_SIZE / 2;
    const centerY = y + CELL_SIZE / 2;

    ctx.fillStyle = '#252525';

    ctx.beginPath();
    ctx.arc(
      centerX,
      centerY,
      CELL_SIZE * 0.22,
      0,
      Math.PI * 2
    );
    ctx.fill();

    // Mine spikes.
    ctx.strokeStyle = '#252525';
    ctx.lineWidth = 3;

    for (
      let angle = 0;
      angle < Math.PI * 2;
      angle += Math.PI / 4
    ) {
      const innerRadius = CELL_SIZE * 0.19;
      const outerRadius = CELL_SIZE * 0.32;

      ctx.beginPath();

      ctx.moveTo(
        centerX + Math.cos(angle) * innerRadius,
        centerY + Math.sin(angle) * innerRadius
      );

      ctx.lineTo(
        centerX + Math.cos(angle) * outerRadius,
        centerY + Math.sin(angle) * outerRadius
      );

      ctx.stroke();
    }

    // Mine highlight.
    ctx.fillStyle = '#FFFFFF';

    ctx.beginPath();
    ctx.arc(
      centerX - 4,
      centerY - 4,
      3,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }


  /**
   * Draw a flag using the custom SVG asset.
   *
   * Uses a Canvas fallback if the image is unavailable.
   */
  drawFlag(x, y) {
    const ctx = this.ctx;
    const image = this.images.flag;

    if (image) {
      const padding = CELL_SIZE * 0.12;

      ctx.drawImage(
        image,
        x + padding,
        y + padding,
        CELL_SIZE - padding * 2,
        CELL_SIZE - padding * 2
      );

      return;
    }

    // Fallback flag graphic.
    const centerX = x + CELL_SIZE / 2;
    const centerY = y + CELL_SIZE / 2;

    // Flag pole.
    ctx.strokeStyle = '#343434';
    ctx.lineWidth = 3;

    ctx.beginPath();
    ctx.moveTo(centerX - 5, centerY - 12);
    ctx.lineTo(centerX - 5, centerY + 12);
    ctx.stroke();

    // Flag fabric.
    ctx.fillStyle = '#FF4F86';

    ctx.beginPath();
    ctx.moveTo(centerX - 5, centerY - 12);
    ctx.lineTo(centerX + 12, centerY - 6);
    ctx.lineTo(centerX - 5, centerY);
    ctx.closePath();
    ctx.fill();

    // Flag base.
    ctx.strokeStyle = '#343434';
    ctx.lineWidth = 3;

    ctx.beginPath();
    ctx.moveTo(centerX - 11, centerY + 12);
    ctx.lineTo(centerX + 3, centerY + 12);
    ctx.stroke();
  }


  /* ========================================================================
     6. Hover Handling
     ======================================================================== */

  /**
   * Highlight the cell under the mouse pointer.
   */
  setHover(row, col) {
    if (
      row === this.hoveredRow &&
      col === this.hoveredCol
    ) {
      return;
    }

    this.hoveredRow = row;
    this.hoveredCol = col;

    this.draw();
  }


  /**
   * Remove the current hover highlight.
   */
  clearHover() {
    if (
      this.hoveredRow === -1 &&
      this.hoveredCol === -1
    ) {
      return;
    }

    this.hoveredRow = -1;
    this.hoveredCol = -1;

    this.draw();
  }


  /* ========================================================================
     7. Input Coordinate Conversion
     ======================================================================== */

  /**
   * Convert mouse or touch pointer coordinates into
   * the corresponding board row and column.
   *
   * This remains accurate regardless of Canvas scaling,
   * screen orientation, or device pixel ratio.
   */
  getCellFromPointer(event) {
    const rect = this.canvas.getBoundingClientRect();

    if (rect.width <= 0 || rect.height <= 0) {
      return null;
    }

    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    if (
      x < 0 ||
      y < 0 ||
      x >= rect.width ||
      y >= rect.height
    ) {
      return null;
    }

    const col = Math.floor(
      (x / rect.width) * this.game.cols
    );

    const row = Math.floor(
      (y / rect.height) * this.game.rows
    );

    if (
      row < 0 ||
      row >= this.game.rows ||
      col < 0 ||
      col >= this.game.cols
    ) {
      return null;
    }

    return { row, col };
  }
}
