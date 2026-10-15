
/* ==========================================================================
   Minesweeper - Audio Manager

   Responsible for:
   - Loading and decoding sound effects with Web Audio
   - Respecting supported device Silent Mode behavior
   - Playing reveal, flag, win, and loss sounds
   - Managing in-game mute state
   - Supporting overlapping sound effects
   - Prioritizing win and loss audio
   - Handling mobile browser audio restrictions

   Audio files are stored in public/audio/.
   ========================================================================== */

import { ASSETS } from './config.js';


/* ==========================================================================
   1. Audio Configuration
   ========================================================================== */

const SOUND_FILES = Object.freeze({
  reveal: ASSETS.revealSound,
  flag: ASSETS.flagSound,
  win: ASSETS.winSound,
  lose: ASSETS.loseSound
});

const SOUND_VOLUMES = Object.freeze({
  reveal: 0.70,
  flag: 0.55,
  win: 0.70,
  lose: 0.75
});

const MAX_SIMULTANEOUS_SOUNDS = 4;

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

    this.AudioContextClass =
      window.AudioContext || window.webkitAudioContext;

    this.context = null;

    // Decoded audio buffers.
    this.buffers = new Map();

    // In-progress sound loading promises.
    this.loading = new Map();

    // Currently playing audio sources.
    this.activeSounds = new Set();

    // Invalidates playback requests after mute or stop.
    this.playbackGeneration = 0;

    this.preloadStarted = false;

    // Bind handlers so they can be removed during cleanup.
    this.unlockAudio = this.unlockAudio.bind(this);

    document.addEventListener(
      'pointerdown',
      this.unlockAudio
    );

    document.addEventListener(
      'touchstart',
      this.unlockAudio,
      { passive: true }
    );

    document.addEventListener(
      'keydown',
      this.unlockAudio
    );
  }


  /* ========================================================================
     3. Audio Context
     ======================================================================== */

  getContext() {
    if (!this.AudioContextClass) {
      return null;
    }

    if (!this.context) {
      this.context = new this.AudioContextClass();
    }

    return this.context;
  }


  /* ========================================================================
     4. Sound Loading
     ======================================================================== */

  async loadSound(name) {
    if (this.buffers.has(name)) {
      return this.buffers.get(name);
    }

    if (this.loading.has(name)) {
      return this.loading.get(name);
    }

    const filename = SOUND_FILES[name];
    const ctx = this.getContext();

    if (!filename || !ctx) {
      return null;
    }

    const promise = (async () => {
      const response = await fetch(filename);

      if (!response.ok) {
        throw new Error(
          `Failed to load ${name}: ${response.status}`
        );
      }

      const data = await response.arrayBuffer();
      const buffer = await ctx.decodeAudioData(data);

      this.buffers.set(name, buffer);

      return buffer;
    })();

    this.loading.set(name, promise);

    try {
      return await promise;
    } finally {
      this.loading.delete(name);
    }
  }


  /**
   * Preload the four sounds after the first user interaction.
   */
  preloadSounds() {
    if (this.preloadStarted || this.muted) {
      return;
    }

    this.preloadStarted = true;

    for (const name of Object.keys(SOUND_FILES)) {
      this.loadSound(name).catch(error => {
        console.warn(
          `Could not preload ${name}:`,
          error
        );
      });
    }
  }


  /* ========================================================================
     5. Mobile Audio Activation
     ======================================================================== */

  unlockAudio() {
    if (this.muted) {
      return;
    }

    const ctx = this.getContext();

    if (!ctx) {
      return;
    }

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {
        // A later interaction can retry.
      });
    }

    this.preloadSounds();
  }


  /* ========================================================================
     6. Sound Playback
     ======================================================================== */

  async play(name) {
    if (this.muted) {
      return;
    }

    if (!SOUND_FILES[name]) {
      console.warn(
        `Unknown Minesweeper sound: ${name}`
      );
      return;
    }

    const isPriority = PRIORITY_SOUNDS.has(name);

    if (isPriority) {
      this.stopAll();
    } else if (
      this.activeSounds.size >= MAX_SIMULTANEOUS_SOUNDS
    ) {
      return;
    }

    const generation = this.playbackGeneration;

    try {
      const ctx = this.getContext();

      if (!ctx) {
        return;
      }

      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      const buffer = await this.loadSound(name);

      // Do not play a sound after mute, restart, or cleanup.
      if (
        this.muted ||
        generation !== this.playbackGeneration ||
        !buffer ||
        ctx.state !== 'running'
      ) {
        return;
      }

      // Check the concurrency limit again after loading.
      if (
        !isPriority &&
        this.activeSounds.size >= MAX_SIMULTANEOUS_SOUNDS
      ) {
        return;
      }

      const source = ctx.createBufferSource();
      const gain = ctx.createGain();

      source.buffer = buffer;
      gain.gain.value = SOUND_VOLUMES[name] ?? 0.5;

      source.connect(gain);
      gain.connect(ctx.destination);

      source.onended = () => {
        this.activeSounds.delete(source);

        source.disconnect();
        gain.disconnect();
      };

      this.activeSounds.add(source);

      source.start(0);

    } catch (error) {
      console.warn(
        `Audio playback failed: ${name}`,
        error
      );
    }
  }


  /* ========================================================================
     7. Mute Controls
     ======================================================================== */

  setMuted(muted) {
    this.muted = Boolean(muted);

    if (this.muted) {
      this.stopAll();
    } else {
      this.unlockAudio();
    }

    return this.muted;
  }


  toggleMute() {
    return this.setMuted(!this.muted);
  }


  isMuted() {
    return this.muted;
  }


  /* ========================================================================
     8. Audio Cleanup
     ======================================================================== */

  stopAll() {
    this.playbackGeneration++;

    for (const source of this.activeSounds) {
      try {
        source.stop();
      } catch {
        // Source may have already finished.
      }
    }

    this.activeSounds.clear();
  }


  destroy() {
    this.stopAll();

    document.removeEventListener(
      'pointerdown',
      this.unlockAudio
    );

    document.removeEventListener(
      'touchstart',
      this.unlockAudio
    );

    document.removeEventListener(
      'keydown',
      this.unlockAudio
    );

    this.buffers.clear();
    this.loading.clear();

    if (this.context) {
      this.context.close().catch(() => {});
      this.context = null;
    }
  }
}
