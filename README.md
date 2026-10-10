
# Minesweeper

A modern, browser-based version of the classic Minesweeper puzzle game, built with vanilla JavaScript and HTML Canvas.

Reveal safe cells, use the numbered clues to locate hidden mines, and clear the board without triggering an explosion.

**[▶ Play Minesweeper](https://fredwahab.github.io/minesweeper/)**

![Minesweeper gameplay showing revealed cells, numbered clues, and flagged mines](assets/gameplay.png)

## How to Play

The goal is to reveal every cell that does not contain a mine.

- **Reveal cells** to uncover empty spaces or numbered clues.
- **Read the numbers.** Each number tells you how many mines are hidden in the eight surrounding cells.
- **Flag suspected mines** to keep track of dangerous cells.
- **Clear all safe cells** to win the game.
- **Avoid revealing a mine**, or the game ends!

The first reveal is always an empty cell, giving you a safe starting area.

### Controls

| Action | Desktop | Mobile / Touchscreen |
|---|---|---|
| Reveal a cell | Left-click in Reveal mode | Tap in Reveal mode |
| Place or remove a flag | Right-click, or left-click in Flag mode | Tap in Flag mode |
| Switch Reveal / Flag mode | Click the flag counter (🚩) | Tap the flag counter (🚩) |
| Start a new game | New Game button | New Game button |
| Change difficulty | Difficulty dropdown | Difficulty dropdown |
| Mute or unmute audio | Speaker button | Speaker button |

**Flag Mode:** Select the flag counter above the board to toggle Flag mode. A green outline indicates that Flag mode is active. While active, normal clicks or taps place and remove flags instead of revealing cells.

Right-clicking on desktop always toggles a flag, regardless of the selected mode.

Starting a new game automatically returns to Reveal mode.

### Difficulty Levels

| Difficulty | Board Size | Mines |
|---|---|---|
| Beginner | 9 × 9 | 10 |
| Intermediate | 16 × 16 | 40 |
| Expert | 16 × 30 | 99 |

The game starts on Intermediate difficulty. Changing difficulty creates a new board.

## Features

- Three classic difficulty levels
- Randomized mine placement
- Guaranteed empty first reveal
- Automatic flood reveal of connected empty cells
- Numbered clues with traditional Minesweeper colors
- Flag placement and remaining-flag counter
- Reveal/Flag mode toggle for desktop and mobile
- Game timer that starts on the first reveal
- Win and loss detection
- Win/loss dialog and New Game functionality
- Sound effects with mute/unmute controls
- Responsive board scaling
- Hover highlighting for available cells
- Automatic deployment to GitHub Pages

## Technology

Minesweeper was developed without a game engine or frontend UI framework.

| Technology | Purpose |
|---|---|
| JavaScript (ES Modules) | Game logic, state management, and input handling |
| HTML5 Canvas | Board rendering, numbers, mines, and flags |
| CSS3 | Page layout, controls, styling, and dialogs |
| Web Audio API | Generated sound effects |
| Vite | Local development and production builds |
| GitHub Actions | Automated builds and deployment |
| GitHub Pages | Static website hosting |

## Technical Overview

The game uses a two-dimensional array to represent the board. Each cell stores its mine status, reveal status, flag status, and number of adjacent mines.

### Board Generation

When a new game starts:

1. An empty board is created using the selected difficulty settings.
2. Mines are randomly distributed across the board.
3. Each safe cell is assigned its adjacent mine count.
4. The board is rendered to the canvas.

### First-Click Protection

The first revealed cell and its surrounding neighbors are guaranteed to contain no mines.

Any mines initially placed within that protected area are relocated to available cells elsewhere on the board. Adjacent mine counts are then recalculated.

This guarantees that the first reveal triggers an empty-area expansion while preserving the selected difficulty's total mine count.

### Cell Revealing

The game uses a recursive flood-reveal algorithm.

When a cell with zero adjacent mines is revealed, the game automatically reveals its neighboring cells. The process continues through connected empty cells until numbered cells form the boundary.

Flagged and previously revealed cells are skipped.

### Win and Loss Detection

The game is won when every non-mine cell has been revealed. Correctly flagging every mine is not required.

Revealing a mine ends the game, stops the timer, and displays the remaining mines.

### Canvas Rendering and Input

The board is drawn using the Canvas 2D API.

The canvas is scaled to fit the available browser window while preserving its aspect ratio. Mouse coordinates are converted from displayed canvas dimensions into logical board coordinates so cell selection remains accurate when the board is resized.

The flag-mode toggle allows touchscreen users to place and remove flags without requiring a right-click.

### Audio

Sound effects are synthesized using the Web Audio API rather than loaded from external audio files.

Different sounds are used for cell reveals, flag placement, winning, and losing.

## Running Locally

### Prerequisites

- Node.js
- npm
- Git

### Installation

Clone the repository:

```bash
git clone https://github.com/FredWahab/minesweeper.git
cd minesweeper
```

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Open the local URL displayed in the terminal.

### Production Build

Generate a production build:

```bash
npm run build
```

The generated files are placed in the `dist/` directory.

To preview the production build locally:

```bash
npm run preview
```

## Deployment

The game is hosted on GitHub Pages:

**https://fredwahab.github.io/minesweeper/**

Deployment is automated using GitHub Actions.

When changes are pushed to the `master` branch, the deployment workflow:

1. Checks out the repository.
2. Installs Node.js and project dependencies.
3. Builds the project using Vite.
4. Uploads the generated production files.
5. Deploys the build to GitHub Pages.

The Vite configuration uses `/minesweeper/` as its base path for GitHub Pages hosting.

## Future Improvements

Potential enhancements include:

- A landscape-oriented mobile layout with controls positioned beside the board
- Optional long-press flag placement on touchscreens
- Additional accessibility and keyboard controls

## Author

**Fred Wahab**

[GitHub](https://github.com/FredWahab)

---

Built as a browser game development and JavaScript portfolio project.
