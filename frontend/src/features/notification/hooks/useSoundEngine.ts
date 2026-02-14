import { useRef, useCallback, useEffect } from 'react';
import type { NotificationCategory, SoundPack } from '@/types';

// ---------------------------------------------------------------------------
// Sound Packs
// ---------------------------------------------------------------------------

/** Peon (Warcraft III Orc Peon) - CC-BY-NC-4.0 via openpeon.com */
const PEON_PACK: SoundPack = {
  id: 'peon',
  name: 'Orc Peon',
  description: 'Warcraft III Orc Peon (openpeon.com)',
  sounds: {
    'task.complete': '/sounds/peon/PeonYes3.wav',
    'task.error': '/sounds/peon/PeonAngry4.wav',
    'input.required': '/sounds/peon/PeonWhat4.wav',
    'session.start': '/sounds/peon/PeonReady1.wav',
  },
};

/** Peon pack: randomized variants per category */
const PEON_VARIANTS: Partial<Record<NotificationCategory, string[]>> = {
  'task.complete': [
    '/sounds/peon/PeonYes1.wav',
    '/sounds/peon/PeonYes2.wav',
    '/sounds/peon/PeonYes3.wav',
    '/sounds/peon/PeonYes4.wav',
  ],
  'task.error': [
    '/sounds/peon/PeonAngry4.wav',
    '/sounds/peon/PeonDeath.wav',
  ],
  'input.required': [
    '/sounds/peon/PeonWhat1.wav',
    '/sounds/peon/PeonWhat2.wav',
    '/sounds/peon/PeonWhat3.wav',
    '/sounds/peon/PeonWhat4.wav',
  ],
  'session.start': [
    '/sounds/peon/PeonReady1.wav',
  ],
};

// ---------------------------------------------------------------------------
// Web Audio API synthesized sounds (default pack)
// ---------------------------------------------------------------------------

type SynthGenerator = (ctx: AudioContext, volume: number) => void;

function playSuccessChime(ctx: AudioContext, volume: number) {
  const notes = [523.25, 659.25, 783.99];
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(volume * 0.3, ctx.currentTime + i * 0.12);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.3);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime + i * 0.12);
    osc.stop(ctx.currentTime + i * 0.12 + 0.35);
  });
}

function playErrorBuzz(ctx: AudioContext, volume: number) {
  [440, 330].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume * 0.15, ctx.currentTime + i * 0.2);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.2 + 0.25);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime + i * 0.2);
    osc.stop(ctx.currentTime + i * 0.2 + 0.3);
  });
}

function playAttentionPing(ctx: AudioContext, volume: number) {
  [0, 0.15].forEach((delay) => {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime + delay);
    gain.gain.linearRampToValueAtTime(volume * 0.25, ctx.currentTime + delay + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.12);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime + delay);
    osc.stop(ctx.currentTime + delay + 0.15);
  });
}

function playStartBeep(ctx: AudioContext, volume: number) {
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(440, ctx.currentTime);
  osc.frequency.linearRampToValueAtTime(880, ctx.currentTime + 0.15);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(volume * 0.2, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.25);
}

const SYNTH_MAP: Record<string, SynthGenerator> = {
  'task.complete': playSuccessChime,
  'task.error': playErrorBuzz,
  'input.required': playAttentionPing,
  'session.start': playStartBeep,
};

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const SOUND_PACKS: SoundPack[] = [
  { id: 'default', name: 'Default', description: 'Web Audio API', sounds: {} },
  PEON_PACK,
];

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function useSoundEngine() {
  const ctxRef = useRef<AudioContext | null>(null);
  const cacheRef = useRef<Map<string, AudioBuffer>>(new Map());

  useEffect(() => {
    return () => {
      if (ctxRef.current && ctxRef.current.state !== 'closed') {
        ctxRef.current.close();
        ctxRef.current = null;
      }
    };
  }, []);

  const getContext = useCallback(() => {
    if (!ctxRef.current || ctxRef.current.state === 'closed') {
      ctxRef.current = new AudioContext();
    }
    if (ctxRef.current.state === 'suspended') {
      ctxRef.current.resume();
    }
    return ctxRef.current;
  }, []);

  /** WAV/MP3 파일 재생 (AudioBuffer 캐시) */
  const playFile = useCallback(async (url: string, volume: number) => {
    const ctx = getContext();
    let buffer = cacheRef.current.get(url);
    if (!buffer) {
      const response = await fetch(url);
      const arrayBuf = await response.arrayBuffer();
      buffer = await ctx.decodeAudioData(arrayBuf);
      cacheRef.current.set(url, buffer);
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    source.connect(gain);
    gain.connect(ctx.destination);
    source.start(0);
  }, [getContext]);

  /** 사운드 재생 (팩에 따라 파일 or 합성) */
  const playSound = useCallback((category: string, volume: number, soundPack: string = 'default') => {
    try {
      if (soundPack === 'peon') {
        const variants = PEON_VARIANTS[category as NotificationCategory];
        if (variants && variants.length > 0) {
          const url = pickRandom(variants);
          playFile(url, volume);
          return;
        }
      }
      // default: Web Audio API synth
      const generator = SYNTH_MAP[category];
      if (generator) {
        const ctx = getContext();
        generator(ctx, volume);
      }
    } catch {
      // AudioContext or fetch not available
    }
  }, [getContext, playFile]);

  return { playSound };
}
