
/* ==========================================================================
   Minesweeper - Board Logic

   Responsible for:
   - Creating the board
   - Random mine placement
   - First-click protection
   - Adjacent mine calculations
   - Revealing cells and empty areas
   - Placing and removing flags
   - Checking win conditions

   This module contains no Canvas, DOM, timer, or audio logic.
   ========================================================================== */


/* ==========================================================================
   1. Board Creation
   ========================================================================== */

/**
 * Create a new board containing the specified number of rows and columns.
 *
 * Each cell stores its own mine, reveal, flag, and neighbor state.
 */
export function createBoard(rows, cols) {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({
      isMine: false,
      isRevealed: false,
      isFlagged: false,
      adjacentMines: 0
    }))
  );
}


/* ==========================================================================
   2. Mine Placement
   ========================================================================== */

/**
 * Randomly distribute mines throughout the board.
 *
 * Mines are placed in unique cells.
 */
export function placeMines(board, mineCount) {
  const rows = board.length;
  const cols = board[0].length;

  let minesPlaced = 0;

  while (minesPlaced < mineCount) {
    const row = Math.floor(Math.random() * rows);
    const col = Math.floor(Math.random() * cols);

    const cell = board[row][col];

    if (!cell.isMine) {
      cell.isMine = true;
      minesPlaced++;
    }
  }

  countAdjacentMines(board);
}


/* ==========================================================================
   3. Adjacent Mine Counts
   ========================================================================== */

/**
 * Count the mines surrounding each non-mine cell.
 *
 * The eight neighboring positions are checked.
 */
export function countAdjacentMines(board) {
  const rows = board.length;
  const cols = board[0].length;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cell = board[row][col];

      if (cell.isMine) {
        cell.adjacentMines = 0;
        continue;
      }

      let count = 0;

      for (let r = -1; r <= 1; r++) {
        for (let c = -1; c <= 1; c++) {
          if (r === 0 && c === 0) continue;

          const newRow = row + r;
          const newCol = col + c;

          if (
            newRow >= 0 &&
            newRow < rows &&
            newCol >= 0 &&
            newCol < cols &&
            board[newRow][newCol].isMine
          ) {
            count++;
          }
        }
      }

      cell.adjacentMines = count;
    }
  }
}


/* ==========================================================================
   4. First-Click Protection
   ========================================================================== */

/**
 * Ensure the first revealed cell has zero adjacent mines.
 *
 * Mines within the first cell's 3x3 neighborhood are relocated
 * to randomly selected safe destinations outside that area.
 *
 * This guarantees the first reveal opens an empty region.
 */
export function protectFirstClick(board, row, col) {
  const rows = board.length;
  const cols = board[0].length;

  const protectedCells = new Set();

  // Identify the first cell and all valid surrounding cells.
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
        protectedCells.add(newRow * cols + newCol);
      }
    }
  }

  let minesToMove = 0;

  // Remove mines from the protected area.
  for (const index of protectedCells) {
    const safeRow = Math.floor(index / cols);
    const safeCol = index % cols;

    if (board[safeRow][safeCol].isMine) {
      board[safeRow][safeCol].isMine = false;
      minesToMove++;
    }
  }

  // Find available cells outside the protected area.
  const destinations = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (
        !protectedCells.has(r * cols + c) &&
        !board[r][c].isMine
      ) {
        destinations.push(board[r][c]);
      }
    }
  }

  // Randomly relocate each displaced mine.
  for (let i = 0; i < minesToMove; i++) {
    const randomIndex = Math.floor(Math.random() * destinations.length);

    const [destination] = destinations.splice(randomIndex, 1);
    destination.isMine = true;
  }

  // Recalculate numbers after changing mine locations.
  countAdjacentMines(board);
}


/* ==========================================================================
   5. Cell Revealing
   ========================================================================== */

/**
 * Reveal a cell and automatically expand through empty areas.
 *
 * Returns an object describing the result:
 * - hitMine: whether a mine was revealed
 * - revealedCount: number of newly revealed cells
 *
 * Uses an iterative flood fill to avoid excessive recursion.
 */
export function revealCell(board, row, col) {
  const rows = board.length;
  const cols = board[0].length;

  const result = {
    hitMine: false,
    revealedCount: 0
  };

  // Ignore invalid coordinates.
  if (
    row < 0 ||
    row >= rows ||
    col < 0 ||
    col >= cols
  ) {
    return result;
  }

  const initialCell = board[row][col];

  // Revealed and flagged cells cannot be revealed again.
  if (initialCell.isRevealed || initialCell.isFlagged) {
    return result;
  }

  // A mine ends the game.
  if (initialCell.isMine) {
    initialCell.isRevealed = true;
    result.hitMine = true;
    result.revealedCount = 1;

    return result;
  }

  // Process cells using a stack.
  const stack = [[row, col]];

  while (stack.length > 0) {
    const [currentRow, currentCol] = stack.pop();

    if (
      currentRow < 0 ||
      currentRow >= rows ||
      currentCol < 0 ||
      currentCol >= cols
    ) {
      continue;
    }

    const cell = board[currentRow][currentCol];

    // Never reveal flagged, already revealed, or mined cells
    // during flood expansion.
    if (
      cell.isRevealed ||
      cell.isFlagged ||
      cell.isMine
    ) {
      continue;
    }

    cell.isRevealed = true;
    result.revealedCount++;

    // Numbered cells stop the flood expansion.
    if (cell.adjacentMines !== 0) {
      continue;
    }

    // Add neighboring cells for further exploration.
    for (let r = -1; r <= 1; r++) {
      for (let c = -1; c <= 1; c++) {
        if (r === 0 && c === 0) continue;

        stack.push([
          currentRow + r,
          currentCol + c
        ]);
      }
    }
  }

  return result;
}


/* ==========================================================================
   6. Flag Management
   ========================================================================== */

/**
 * Toggle a flag on a hidden cell.
 *
 * Returns:
 * -  1 when a flag is placed
 * - -1 when a flag is removed
 * -  0 when no change occurs
 *
 * The game controller uses this result to update the counter.
 */
export function toggleCellFlag(board, row, col, flagsRemaining) {
  const rows = board.length;
  const cols = board[0].length;

  if (
    row < 0 ||
    row >= rows ||
    col < 0 ||
    col >= cols
  ) {
    return 0;
  }

  const cell = board[row][col];

  if (cell.isRevealed) {
    return 0;
  }

  if (cell.isFlagged) {
    cell.isFlagged = false;
    return -1;
  }

  if (flagsRemaining <= 0) {
    return 0;
  }

  cell.isFlagged = true;
  return 1;
}


/* ==========================================================================
   7. Win and Loss Helpers
   ========================================================================== */

/**
 * Check whether every non-mine cell has been revealed.
 *
 * Correctly placing flags is not required to win.
 */
export function checkWin(board) {
  return board.every(row =>
    row.every(cell =>
      cell.isMine || cell.isRevealed
    )
  );
}


/**
 * Reveal all mines after the player loses.
 */
export function revealAllMines(board) {
  for (const row of board) {
    for (const cell of row) {
      if (cell.isMine) {
        cell.isRevealed = true;
      }
    }
  }
}
