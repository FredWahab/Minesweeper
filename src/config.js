
/* ==========================================================================
   Minesweeper - Configuration

   Central settings for:
   - Difficulty levels
   - Orientation-aware board dimensions
   - Rendering colors
   - Image and audio assets
   ========================================================================== */


/* ==========================================================================
   1. Difficulty Settings
   ========================================================================== */

/**
 * Preserve the original number of cells and mines:
 *
 * Beginner:      81 cells, 10 mines
 * Intermediate:  256 cells, 40 mines
 * Expert:        480 cells, 99 mines
 *
 * Intermediate and Expert use rectangular layouts that
 * can be transposed for portrait orientation.
 */
export const DIFFICULTIES = Object.freeze({
  beginner: {
    rows: 9,
    cols: 9,
    mines: 10
  },

  intermediate: {
    rows: 16,
    cols: 16,
    mines: 40
  },

  expert: {
    rows: 16,
    cols: 30,
    mines: 99
  }
});

export const DEFAULT_DIFFICULTY = 'intermediate';


/* ==========================================================================
   2. Orientation Settings
   ========================================================================== */

export const ORIENTATIONS = Object.freeze({
  PORTRAIT: 'portrait',
  LANDSCAPE: 'landscape'
});


/**
 * Determine the current viewport orientation.
 */
export function getScreenOrientation() {
  return window.innerWidth > window.innerHeight
    ? ORIENTATIONS.LANDSCAPE
    : ORIENTATIONS.PORTRAIT;
}


/**
 * Return the appropriate board dimensions for the selected
 * difficulty and orientation.
 *
 * Portrait mode transposes wide boards.
 * Square boards remain unchanged.
 *
 * Cell and mine counts are preserved.
 */
export function getBoardDimensions(
  difficulty,
  orientation = getScreenOrientation()
) {
  const settings =
    DIFFICULTIES[difficulty] ??
    DIFFICULTIES[DEFAULT_DIFFICULTY];

  let { rows, cols } = settings;

  if (
    orientation === ORIENTATIONS.PORTRAIT &&
    cols > rows
  ) {
    [rows, cols] = [cols, rows];
  }

  return {
    rows,
    cols,
    mines: settings.mines
  };
}


/* ==========================================================================
   3. Rendering Settings
   ========================================================================== */

/**
 * Logical Canvas cell size.
 *
 * The renderer calculates the actual displayed cell size
 * based on the available viewport space.
 */
export const CELL_SIZE = 40;


/**
 * Colors for revealed adjacent mine counts.
 */
export const NUMBER_COLORS = Object.freeze([
  null,
  '#0000FF',
  '#008000',
  '#FF0000',
  '#000080',
  '#800000',
  '#008080',
  '#000000',
  '#808080'
]);


/**
 * Board colors.
 */
export const BOARD_COLORS = Object.freeze({
  background: '#252545',

  hiddenLight: '#AAD751',
  hiddenDark: '#94BF44',

  revealedLight: '#C3C2C2',
  revealedDark: '#A7A6A6',

  hover: '#C6ED7C'
});


/* ==========================================================================
   4. Asset Paths
   ========================================================================== */

/**
 * Vite's BASE_URL ensures that assets load correctly
 * both locally and on GitHub Pages.
 */
const ASSET_BASE = import.meta.env.BASE_URL;

export const ASSETS = Object.freeze({
  flag: `${ASSET_BASE}images/flag.svg`,
  mine: `${ASSET_BASE}images/mine.svg`,

  soundOn: `${ASSET_BASE}images/sound-on.svg`,
  soundOff: `${ASSET_BASE}images/sound-off.svg`,

  revealSound: `${ASSET_BASE}audio/reveal.wav`,
  flagSound: `${ASSET_BASE}audio/flag.wav`,
  winSound: `${ASSET_BASE}audio/win.wav`,
  loseSound: `${ASSET_BASE}audio/lose.wav`
});
