
/* ==========================================================================
   Minesweeper - Canvas Renderer
   ========================================================================== */

import {
  CELL_SIZE,
  NUMBER_COLORS,
  BOARD_COLORS,
  ASSETS
} from './config.js';


/* ==========================================================================
   1. Animation Configuration
   ========================================================================== */

const ANIMATION = {
  duration: 420,
  stagger: 30,
  maxStagger: 300,
  dropDistance: CELL_SIZE * 2.4,
  rotation: 0.75
};

const EXPLOSION = {
  duration: 1400,
  flashDuration: 220,
  shakeDuration: 550,
  shakeStrength: 7,
  scatterDelay: 160,
  scatterDuration: 1050,
  particleCount: 48
};

const VICTORY = {
  duration: 1500,
  waveDuration: 750,
  glowDuration: 340,
  confettiStart: 300,
  confettiCount: 85
};

const clamp = (value, min = 0, max = 1) =>
  Math.max(min, Math.min(max, value));

const easeInCubic = t => t * t * t;

const easeOutCubic = t =>
  1 - Math.pow(1 - t, 3);


/* ==========================================================================
   2. Renderer Class
   ========================================================================== */

export class MinesweeperRenderer {
  constructor(canvas, game) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.game = game;

    this.boardWidth = game.cols * CELL_SIZE;
    this.boardHeight = game.rows * CELL_SIZE;

    this.hoveredRow = -1;
    this.hoveredCol = -1;

    this.images = {
      flag: null,
      mine: null
    };

    // Standard reveal animations.
    this.previousBoard = null;
    this.animations = new Map();
    this.animationFrame = null;
    this.animationBoard = null;

    // Loss animation.
    this.explosion = null;
    this.explosionFrame = null;

    // Victory animation.
    this.victory = null;
    this.victoryFrame = null;

    this.reducedMotion = Boolean(
      window.matchMedia &&
      window.matchMedia(
        '(prefers-reduced-motion: reduce)'
      ).matches
    );

    this.loadImages();
    this.resize();
  }


  /* ========================================================================
     3. Image Asset Loading
     ======================================================================== */

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
     4. Responsive Canvas Sizing
     ======================================================================== */

  resize() {
    this.boardWidth = this.game.cols * CELL_SIZE;
    this.boardHeight = this.game.rows * CELL_SIZE;

    this.cancelAnimations();

    const parent = this.canvas.parentElement;

    if (!parent) {
      return;
    }

    const parentRect = parent.getBoundingClientRect();

    const availableWidth = parentRect.width;
    const availableHeight = parentRect.height;

    if (availableWidth <= 0 || availableHeight <= 0) {
      return;
    }

    const cellSize = Math.min(
      availableWidth / this.game.cols,
      availableHeight / this.game.rows
    );

    const displayWidth = cellSize * this.game.cols;
    const displayHeight = cellSize * this.game.rows;

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
     5. Animation Management
     ======================================================================== */

  cancelAnimations() {
    if (this.animationFrame !== null) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }

    this.animations.clear();
    this.previousBoard = null;
    this.animationBoard = null;

    this.stopExplosion();
    this.stopVictory();
  }


  captureBoardState() {
    const board = this.game.board;

    if (!board) {
      return null;
    }

    return board.map(row =>
      row.map(cell => cell.isRevealed)
    );
  }


  detectReveals() {
    const board = this.game.board;

    if (!board) {
      return;
    }

    if (this.animationBoard !== board) {
      this.animations.clear();
      this.animationBoard = board;
      this.previousBoard = this.captureBoardState();
      return;
    }

    if (!this.previousBoard) {
      this.previousBoard = this.captureBoardState();
      return;
    }

    const newlyRevealed = [];

    for (let row = 0; row < this.game.rows; row++) {
      for (let col = 0; col < this.game.cols; col++) {
        const cell = board[row][col];

        if (
          cell.isRevealed &&
          !this.previousBoard[row]?.[col]
        ) {
          newlyRevealed.push({ row, col });
        }
      }
    }

    this.previousBoard = this.captureBoardState();

    if (
      newlyRevealed.length === 0 ||
      this.reducedMotion ||
      this.game.gameOver
    ) {
      return;
    }

    const startTime = performance.now();
    const origin = newlyRevealed[0];

    for (const { row, col } of newlyRevealed) {
      const distance =
        Math.abs(row - origin.row) +
        Math.abs(col - origin.col);

      const delay = Math.min(
        distance * ANIMATION.stagger,
        ANIMATION.maxStagger
      );

      this.animations.set(`${row},${col}`, {
        row,
        col,
        startTime: startTime + delay,
        duration: ANIMATION.duration
      });
    }

    this.startAnimationLoop();
  }


  startAnimationLoop() {
    if (this.animationFrame !== null) {
      return;
    }

    const tick = () => {
      this.animationFrame = null;

      const now = performance.now();

      for (const [key, animation] of this.animations) {
        if (
          now >= animation.startTime + animation.duration
        ) {
          this.animations.delete(key);
        }
      }

      this.renderBoard();

      if (this.animations.size > 0) {
        this.animationFrame = requestAnimationFrame(tick);
      }
    };

    this.animationFrame = requestAnimationFrame(tick);
  }


  drawFallingTile(animation, now) {
    const elapsed = now - animation.startTime;
    const progress = clamp(
      elapsed / animation.duration
    );

    const { row, col } = animation;

    const centerX = col * CELL_SIZE + CELL_SIZE / 2;
    const centerY = row * CELL_SIZE + CELL_SIZE / 2;

    const color = (row + col) % 2 === 0
      ? BOARD_COLORS.hiddenLight
      : BOARD_COLORS.hiddenDark;

    const liftPhase = Math.min(1, progress / 0.18);

    const fallPhase = Math.max(
      0,
      (progress - 0.18) / 0.82
    );

    const lift =
      Math.sin(liftPhase * Math.PI / 2) * 5;

    const drop =
      easeInCubic(fallPhase) *
      ANIMATION.dropDistance;

    const direction =
      (row + col) % 2 === 0 ? 1 : -1;

    const rotation =
      (
        0.12 * liftPhase +
        ANIMATION.rotation * fallPhase
      ) * direction;

    const fadeProgress = clamp(
      (progress - 0.82) / 0.18
    );

    const opacity = 1 - fadeProgress;

    const scaleX = 1 - 0.12 * fallPhase;
    const scaleY = 1 - 0.18 * fallPhase;

    this.drawTileFragment(
      centerX,
      centerY - lift + drop,
      color,
      rotation,
      scaleX,
      scaleY,
      opacity
    );
  }


  drawTileFragment(
    x,
    y,
    color,
    rotation = 0,
    scaleX = 1,
    scaleY = 1,
    opacity = 1
  ) {
    const ctx = this.ctx;

    ctx.save();

    ctx.globalAlpha = clamp(opacity);
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.scale(scaleX, scaleY);

    ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 5;

    ctx.fillStyle = color;

    ctx.fillRect(
      -CELL_SIZE / 2 + 1,
      -CELL_SIZE / 2 + 1,
      CELL_SIZE - 2,
      CELL_SIZE - 2
    );

    ctx.shadowColor = 'transparent';

    ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';

    ctx.fillRect(
      -CELL_SIZE / 2 + 2,
      -CELL_SIZE / 2 + 2,
      CELL_SIZE - 4,
      3
    );

    ctx.fillStyle = 'rgba(0, 0, 0, 0.20)';

    ctx.fillRect(
      -CELL_SIZE / 2 + 2,
      CELL_SIZE / 2 - 5,
      CELL_SIZE - 4,
      3
    );

    ctx.restore();
  }


  /* ========================================================================
     6. Mine Explosion
     ======================================================================== */

  startExplosion() {
    this.stopExplosion();

    if (!this.game.triggeredMine || this.reducedMotion) {
      return 0;
    }

    if (this.animationFrame !== null) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }

    this.animations.clear();

    const { row, col } = this.game.triggeredMine;

    const originX = col * CELL_SIZE + CELL_SIZE / 2;
    const originY = row * CELL_SIZE + CELL_SIZE / 2;

    const fragments = [];

    for (let r = 0; r < this.game.rows; r++) {
      for (let c = 0; c < this.game.cols; c++) {
        const cell = this.game.board[r][c];

        if (cell.isRevealed) {
          continue;
        }

        const x = c * CELL_SIZE + CELL_SIZE / 2;
        const y = r * CELL_SIZE + CELL_SIZE / 2;

        const dx = x - originX;
        const dy = y - originY;
        const distance = Math.hypot(dx, dy);

        const angle =
          Math.atan2(dy, dx) +
          (Math.random() - 0.5) * 0.65;

        const speed =
          2.5 + Math.random() * 4.5;

        fragments.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 4,
          rotationSpeed:
            (Math.random() - 0.5) * 0.16,
          color: (r + c) % 2 === 0
            ? BOARD_COLORS.hiddenLight
            : BOARD_COLORS.hiddenDark,
          delay: Math.min(distance * 0.35, 250)
        });
      }
    }

    const particles = [];

    for (let i = 0; i < EXPLOSION.particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 7;

      particles.push({
        angle,
        speed,
        size: 2 + Math.random() * 5,
        life: 0.5 + Math.random() * 0.5,
        color: [
          '#FFF5B0',
          '#FFD166',
          '#FF9F43',
          '#FF5E3A',
          '#FFFFFF'
        ][Math.floor(Math.random() * 5)]
      });
    }

    this.explosion = {
      startTime: performance.now(),
      originX,
      originY,
      fragments,
      particles
    };

    this.startExplosionLoop();

    return EXPLOSION.duration;
  }


  stopExplosion() {
    if (this.explosionFrame !== null) {
      cancelAnimationFrame(this.explosionFrame);
      this.explosionFrame = null;
    }

    this.explosion = null;
  }


  startExplosionLoop() {
    if (this.explosionFrame !== null) {
      return;
    }

    const tick = () => {
      this.explosionFrame = null;

      if (!this.explosion) {
        return;
      }

      const elapsed =
        performance.now() - this.explosion.startTime;

      if (elapsed >= EXPLOSION.duration) {
        this.stopExplosion();
        this.renderBoard();
        return;
      }

      this.renderBoard();

      this.explosionFrame = requestAnimationFrame(tick);
    };

    this.explosionFrame = requestAnimationFrame(tick);
  }


  drawExplosion(now) {
    const explosion = this.explosion;

    if (!explosion) {
      return;
    }

    const ctx = this.ctx;
    const elapsed = now - explosion.startTime;

    const {
      originX,
      originY,
      fragments,
      particles
    } = explosion;

    // Initial flash.
    if (elapsed < EXPLOSION.flashDuration) {
      const progress = clamp(
        elapsed / EXPLOSION.flashDuration
      );

      const radius =
        CELL_SIZE * (
          0.5 + easeOutCubic(progress) * 2.5
        );

      const gradient = ctx.createRadialGradient(
        originX,
        originY,
        0,
        originX,
        originY,
        radius
      );

      gradient.addColorStop(
        0,
        `rgba(255,255,255,${1 - progress})`
      );

      gradient.addColorStop(
        0.3,
        `rgba(255,235,120,${0.9 * (1 - progress)})`
      );

      gradient.addColorStop(
        0.7,
        `rgba(255,110,30,${0.7 * (1 - progress)})`
      );

      gradient.addColorStop(
        1,
        'rgba(255,70,0,0)'
      );

      ctx.save();
      ctx.fillStyle = gradient;

      ctx.beginPath();
      ctx.arc(
        originX,
        originY,
        radius,
        0,
        Math.PI * 2
      );
      ctx.fill();

      ctx.restore();
    }

    // Expanding shockwave.
    const shockProgress = clamp(elapsed / 450);

    if (shockProgress < 1) {
      ctx.save();

      ctx.strokeStyle =
        `rgba(255,190,70,${1 - shockProgress})`;

      ctx.lineWidth =
        6 * (1 - shockProgress) + 1;

      ctx.beginPath();
      ctx.arc(
        originX,
        originY,
        CELL_SIZE * 0.5 +
          shockProgress * CELL_SIZE * 5,
        0,
        Math.PI * 2
      );
      ctx.stroke();

      ctx.restore();
    }

    // Sparks.
    const particleProgress = clamp(elapsed / 850);

    for (const particle of particles) {
      const lifeProgress = clamp(
        particleProgress / particle.life
      );

      if (lifeProgress >= 1) {
        continue;
      }

      const distance =
        particle.speed *
        particleProgress *
        CELL_SIZE * 2.2;

      const x =
        originX +
        Math.cos(particle.angle) * distance;

      const y =
        originY +
        Math.sin(particle.angle) * distance +
        easeInCubic(particleProgress) * CELL_SIZE;

      ctx.save();
      ctx.globalAlpha = 1 - lifeProgress;
      ctx.fillStyle = particle.color;

      ctx.beginPath();
      ctx.arc(
        x,
        y,
        particle.size * (1 - lifeProgress * 0.5),
        0,
        Math.PI * 2
      );
      ctx.fill();

      ctx.restore();
    }

    // Scattering tiles.
    for (const fragment of fragments) {
      const fragmentElapsed =
        elapsed -
        EXPLOSION.scatterDelay -
        fragment.delay;

      if (fragmentElapsed < 0) {
        continue;
      }

      const progress = clamp(
        fragmentElapsed / EXPLOSION.scatterDuration
      );

      const time = fragmentElapsed / 16.67;

      const x =
        fragment.x + fragment.vx * time;

      const y =
        fragment.y +
        fragment.vy * time +
        0.11 * time * time;

      const rotation =
        fragment.rotationSpeed * time;

      const opacity = 1 - clamp(
        (progress - 0.72) / 0.28
      );

      this.drawTileFragment(
        x,
        y,
        fragment.color,
        rotation,
        1 - progress * 0.2,
        1 - progress * 0.2,
        opacity
      );
    }
  }


  /* ========================================================================
     7. Victory Animation
     ======================================================================== */

  /**
   * Start a celebratory wave and confetti animation.
   *
   * Returns the duration for main.js to use when
   * delaying the victory dialog.
   */
  startVictory() {
    this.stopVictory();

    if (this.reducedMotion) {
      return 0;
    }

    if (this.animationFrame !== null) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }

    this.animations.clear();

    const confetti = [];

    const colors = [
      '#FFD166',
      '#06D6A0',
      '#4CC9F0',
      '#EF476F',
      '#FFFFFF',
      '#A7F3D0'
    ];

    for (let i = 0; i < VICTORY.confettiCount; i++) {
      const x = Math.random() * this.boardWidth;

      const y =
        this.boardHeight * (
          0.6 + Math.random() * 0.4
        );

      confetti.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 4,
        vy: -(5 + Math.random() * 6),
        gravity: 0.12 + Math.random() * 0.08,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed:
          (Math.random() - 0.5) * 0.2,
        width: 3 + Math.random() * 5,
        height: 5 + Math.random() * 7,
        color: colors[
          Math.floor(Math.random() * colors.length)
        ]
      });
    }

    this.victory = {
      startTime: performance.now(),
      confetti
    };

    this.startVictoryLoop();

    return VICTORY.duration;
  }


  stopVictory() {
    if (this.victoryFrame !== null) {
      cancelAnimationFrame(this.victoryFrame);
      this.victoryFrame = null;
    }

    this.victory = null;
  }


  startVictoryLoop() {
    if (this.victoryFrame !== null) {
      return;
    }

    const tick = () => {
      this.victoryFrame = null;

      if (!this.victory) {
        return;
      }

      const elapsed =
        performance.now() - this.victory.startTime;

      if (elapsed >= VICTORY.duration) {
        this.stopVictory();
        this.renderBoard();
        return;
      }

      this.renderBoard();

      this.victoryFrame = requestAnimationFrame(tick);
    };

    this.victoryFrame = requestAnimationFrame(tick);
  }


  /**
   * Render the victory wave and confetti.
   */
  drawVictory(now) {
    if (!this.victory) {
      return;
    }

    const ctx = this.ctx;
    const elapsed = now - this.victory.startTime;

    // Diagonal wave traveling across the board.
    const waveProgress = clamp(
      elapsed / VICTORY.waveDuration
    );

    const maxDistance =
      this.boardWidth + this.boardHeight;

    const wavePosition =
      waveProgress * maxDistance;

    for (let row = 0; row < this.game.rows; row++) {
      for (let col = 0; col < this.game.cols; col++) {
        const cell = this.game.board[row][col];

        if (!cell.isRevealed) {
          continue;
        }

        const x = col * CELL_SIZE;
        const y = row * CELL_SIZE;

        const distance = x + y;

        const delta = wavePosition - distance;

        if (
          delta < 0 ||
          delta > CELL_SIZE * 3
        ) {
          continue;
        }

        const intensity =
          1 - delta / (CELL_SIZE * 3);

        ctx.save();

        ctx.fillStyle =
          `rgba(100,255,170,${intensity * 0.28})`;

        ctx.fillRect(
          x + 1,
          y + 1,
          CELL_SIZE - 2,
          CELL_SIZE - 2
        );

        ctx.strokeStyle =
          `rgba(255,215,100,${intensity * 0.7})`;

        ctx.lineWidth = 2;

        ctx.strokeRect(
          x + 2,
          y + 2,
          CELL_SIZE - 4,
          CELL_SIZE - 4
        );

        ctx.restore();
      }
    }

    // Confetti begins after the wave starts.
    if (elapsed < VICTORY.confettiStart) {
      return;
    }

    const time =
      (elapsed - VICTORY.confettiStart) / 16.67;

    const fade = 1 - clamp(
      (elapsed - 1150) / 350
    );

    for (const piece of this.victory.confetti) {
      const x =
        piece.x + piece.vx * time;

      const y =
        piece.y +
        piece.vy * time +
        piece.gravity * time * time;

      const rotation =
        piece.rotation +
        piece.rotationSpeed * time;

      ctx.save();

      ctx.globalAlpha = fade;
      ctx.translate(x, y);
      ctx.rotate(rotation);

      ctx.fillStyle = piece.color;

      ctx.fillRect(
        -piece.width / 2,
        -piece.height / 2,
        piece.width,
        piece.height
      );

      ctx.restore();
    }
  }


  /* ========================================================================
     8. Board Rendering
     ======================================================================== */

  draw() {
    this.detectReveals();
    this.renderBoard();
  }


  renderBoard() {
    const ctx = this.ctx;
    const board = this.game.board;

    if (!board) {
      return;
    }

    const now = performance.now();

    ctx.clearRect(
      0,
      0,
      this.boardWidth,
      this.boardHeight
    );

    ctx.save();

    // Shake the board during an explosion.
    if (this.explosion) {
      const elapsed =
        now - this.explosion.startTime;

      if (elapsed < EXPLOSION.shakeDuration) {
        const strength =
          EXPLOSION.shakeStrength *
          (1 - elapsed / EXPLOSION.shakeDuration);

        ctx.translate(
          (Math.random() - 0.5) * strength * 2,
          (Math.random() - 0.5) * strength * 2
        );
      }
    }

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

    for (const animation of this.animations.values()) {
      this.drawFallingTile(animation, now);
    }

    if (this.explosion) {
      this.drawExplosion(now);
    }

    if (this.victory) {
      this.drawVictory(now);
    }

    ctx.restore();
  }


  drawCell(row, col) {
    const ctx = this.ctx;
    const cell = this.game.board[row][col];

    const x = col * CELL_SIZE;
    const y = row * CELL_SIZE;

    const isLight = (row + col) % 2 === 0;

    if (cell.isRevealed) {
      ctx.fillStyle = isLight
        ? BOARD_COLORS.revealedLight
        : BOARD_COLORS.revealedDark;
    } else {
      ctx.fillStyle = isLight
        ? BOARD_COLORS.hiddenLight
        : BOARD_COLORS.hiddenDark;
    }

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

    ctx.fillRect(
      x + 1,
      y + 1,
      CELL_SIZE - 2,
      CELL_SIZE - 2
    );

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

    if (cell.isRevealed && cell.isMine) {
      this.drawMine(x, y);
    }

    if (cell.isFlagged && !cell.isRevealed) {
      this.drawFlag(x, y);
    }
  }


  /* ========================================================================
     9. Cell Contents
     ======================================================================== */

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

    const centerX = x + CELL_SIZE / 2;
    const centerY = y + CELL_SIZE / 2;

    ctx.strokeStyle = '#343434';
    ctx.lineWidth = 3;

    ctx.beginPath();
    ctx.moveTo(centerX - 5, centerY - 12);
    ctx.lineTo(centerX - 5, centerY + 12);
    ctx.stroke();

    ctx.fillStyle = '#FF4F86';

    ctx.beginPath();
    ctx.moveTo(centerX - 5, centerY - 12);
    ctx.lineTo(centerX + 12, centerY - 6);
    ctx.lineTo(centerX - 5, centerY);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#343434';
    ctx.lineWidth = 3;

    ctx.beginPath();
    ctx.moveTo(centerX - 11, centerY + 12);
    ctx.lineTo(centerX + 3, centerY + 12);
    ctx.stroke();
  }


  /* ========================================================================
     10. Hover Handling
     ======================================================================== */

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
     11. Input Coordinate Conversion
     ======================================================================== */

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
