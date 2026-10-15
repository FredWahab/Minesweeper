
/* ==========================================================================
   Minesweeper - Audio Manager

   Responsible for:
   - Loading dedicated sound effect files
   - Playing reveal, flag, win, and loss sounds
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

// Relative volume for each sound effect.
const SOUND_VOLUMES = Object.freeze({
  reveal: 0.35,
  flag: 0.45,
  win: 0.6,
  lose: 0.55
});

// Allow several copies of a sound to play without cutting each other off.
const MAX_SIMULTANEOUS_SOUNDS = 4;


/* ==========================================================================
   2. Audio Manager Class
   ========================================================================== */

export class MinesweeperAudio {
  constructor() {
    this.muted = false;

    // Stores preloaded audio instances for each sound.
    this.sounds = new Map();

    // Track active sounds for cleanup and mute behavior.
    this.activeSounds = new Set();

    this.loadSounds();
  }


  /* ========================================================================
     3. Audio Preloading
     ======================================================================== */

  /**
   * Prepare sound files for playback.
   *
   * preload="auto" requests that the browser load audio ahead
   * of time, although mobile browsers may defer loading.
   */
  loadSounds() {
    for (const [name, source] of Object.entries(SOUND_FILES)) {
      const audio = new Audio();

      audio.preload = 'auto';
      audio.src = source;
      audio.volume = SOUND_VOLUMES[name] ?? 0.5;

      this.sounds.set(name, audio);

      // Request loading without starting playback.
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
    if (this.muted) return;

    const source = this.sounds.get(name);

    if (!source) {
      console.warn(`Unknown Minesweeper sound: ${name}`);
      return;
    }

    // Limit simultaneous playback to avoid excessive sound stacking.
    if (this.activeSounds.size >= MAX_SIMULTANEOUS_SOUNDS) {
      return;
    }

    // Clone the preloaded audio element so repeated effects
    // can overlap without interrupting one another.
    const audio = source.cloneNode(true);

    audio.volume = SOUND_VOLUMES[name] ?? 0.5;

    this.activeSounds.add(audio);

    const cleanup = () => {
      this.activeSounds.delete(audio);

      audio.removeEventListener('ended', cleanup);
      audio.removeEventListener('error', cleanup);
    };

    audio.addEventListener('ended', cleanup);
    audio.addEventListener('error', cleanup);

    // Browsers may reject playback before user interaction.
    // Handle this gracefully rather than generating errors.
    const playback = audio.play();

    if (playback && typeof playback.catch === 'function') {
      playback.catch(() => {
        cleanup();
      });
    }
  }


  /* ========================================================================
     5. Mute Controls
     ======================================================================== */

  /**
   * Enable or disable sound effects.
   *
   * Muting immediately silences currently playing effects.
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
   * Stop any sound effects currently playing.
   *
   * Useful when restarting the game or muting audio.
   */
  stopAll() {
    for (const audio of this.activeSounds) {
      audio.pause();
      audio.currentTime = 0;
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
