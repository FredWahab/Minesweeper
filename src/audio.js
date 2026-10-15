
/* ==========================================================================
   Minesweeper - Audio Manager

   Responsible for:
   - Loading dedicated sound effect files
   - Playing reveal, flag, win, and loss sounds
   - Balancing sound effect volumes
   - Prioritizing important game events
   - Managing mute state
   - Supporting overlapping sound effects
   - Handling mobile browser audio restrictions

   Audio files are stored in public/audio/.
   ========================================================================== */

import { ASSETS } from './config.js';


/* ==========================================================================
   1. Audio Configuration
   ========================================================================== */

// Map gameplay events to their corresponding sound assets.
const SOUND_FILES = Object.freeze({
  reveal: ASSETS.revealSound,
  flag: ASSETS.flagSound,
  win: ASSETS.winSound,
  lose: ASSETS.loseSound
});

// Individual playback volume adjustments.
const SOUND_VOLUMES = Object.freeze({
  reveal: 0.70,
  flag: 0.55,
  win: 0.70,
  lose: 0.75
});

// Limit overlapping effects to prevent excessive sound stacking.
const MAX_SIMULTANEOUS_SOUNDS = 4;

// Win and loss effects take priority over ordinary gameplay sounds.
const PRIORITY_SOUNDS = new Set([
  'win',
  'lose'
]);


/* ==========================================================================
   2. Audio Manager Class
   ========================================================================== */

export class MinesweeperAudio {
  constructor() {
    this.muted = false;

    // Preloaded audio templates.
    this.sounds = new Map();

    // Active playback instances, mapped to their sound names.
    this.activeSounds = new Map();

    this.loadSounds();
  }


  /* ========================================================================
     3. Audio Preloading
     ======================================================================== */

  /**
   * Prepare sound files for playback.
   *
   * Mobile browsers may defer loading until the
   * user interacts with the page.
   */
  loadSounds() {
    for (const [name, source] of Object.entries(SOUND_FILES)) {
      const audio = new Audio();

      audio.preload = 'auto';
      audio.src = source;
      audio.volume = SOUND_VOLUMES[name] ?? 0.5;

      this.sounds.set(name, audio);

      audio.load();
    }
  }


  /* ========================================================================
     4. Sound Playback
     ======================================================================== */

  /**
   * Play a named sound effect.
   *
   * Supported names:
   * - reveal
   * - flag
   * - win
   * - lose
   */
  play(name) {
    if (this.muted) {
      return;
    }

    const source = this.sounds.get(name);

    if (!source) {
      console.warn(`Unknown Minesweeper sound: ${name}`);
      return;
    }

    const isPriority = PRIORITY_SOUNDS.has(name);

    // Game-ending effects should not compete with gameplay clicks.
    if (isPriority) {
      this.stopAll();
    } else if (
      this.activeSounds.size >= MAX_SIMULTANEOUS_SOUNDS
    ) {
      return;
    }

    // Clone the preloaded element to allow overlapping effects.
    const audio = source.cloneNode(true);

    audio.volume = SOUND_VOLUMES[name] ?? 0.5;

    const cleanup = () => {
      this.activeSounds.delete(audio);

      audio.removeEventListener('ended', cleanup);
      audio.removeEventListener('error', cleanup);
    };

    this.activeSounds.set(audio, name);

    audio.addEventListener('ended', cleanup);
    audio.addEventListener('error', cleanup);

    // Browsers may reject playback until user interaction.
    try {
      const playback = audio.play();

      if (
        playback &&
        typeof playback.catch === 'function'
      ) {
        playback.catch(() => {
          cleanup();
        });
      }
    } catch (error) {
      cleanup();
    }
  }


  /* ========================================================================
     5. Mute Controls
     ======================================================================== */

  /**
   * Enable or disable sound effects.
   *
   * Muting immediately stops currently playing sounds.
   */
  setMuted(muted) {
    this.muted = Boolean(muted);

    if (this.muted) {
      this.stopAll();
    }

    return this.muted;
  }


  /**
   * Toggle sound effects on or off.
   */
  toggleMute() {
    return this.setMuted(!this.muted);
  }


  /**
   * Return the current mute state.
   */
  isMuted() {
    return this.muted;
  }


  /* ========================================================================
     6. Audio Cleanup
     ======================================================================== */

  /**
   * Stop all active playback instances.
   */
  stopAll() {
    for (const audio of this.activeSounds.keys()) {
      audio.pause();

      try {
        audio.currentTime = 0;
      } catch (error) {
        // Some browsers restrict seeking during loading.
      }
    }

    this.activeSounds.clear();
  }


  /**
   * Release audio resources when the application is disposed.
   */
  destroy() {
    this.stopAll();

    for (const audio of this.sounds.values()) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }

    this.sounds.clear();
  }
}
