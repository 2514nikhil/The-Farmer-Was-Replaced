'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { Howler } from 'howler';

interface SoundEffects {
  playMove: () => void;
  playPlant: () => void;
  playHarvest: () => void;
  playWater: () => void;
  playError: () => void;
  playSuccess: () => void;
  playClick: () => void;
  playMerge: () => void;
  playResearch: () => void;
}

export function useSound() {
  const soundsRef = useRef<SoundEffects | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolumeState] = useState(0.5);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    Howler.volume(volume);

    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const audioContext = new AudioCtx();
    audioContextRef.current = audioContext;

    const createTone = (frequency: number, duration: number, type: OscillatorType = 'sine', gain = 0.3) => {
      const buffer = audioContext.createBuffer(1, audioContext.sampleRate * duration, audioContext.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < buffer.length; i++) {
        const t = i / audioContext.sampleRate;
        const envelope = Math.exp(-t * 10);
        if (type === 'square') data[i] = (Math.sin(2 * Math.PI * frequency * t) > 0 ? 1 : -1) * envelope * gain;
        else data[i] = Math.sin(2 * Math.PI * frequency * t) * envelope * gain;
      }
      return buffer;
    };

    const createNoise = (duration: number, gain = 0.1) => {
      const buffer = audioContext.createBuffer(1, audioContext.sampleRate * duration, audioContext.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < buffer.length; i++) {
        const envelope = 1 - i / buffer.length;
        data[i] = (Math.random() * 2 - 1) * envelope * gain;
      }
      return buffer;
    };

    const createChord = (frequencies: number[], duration: number, gain = 0.2) => {
      const buffer = audioContext.createBuffer(1, audioContext.sampleRate * duration, audioContext.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < buffer.length; i++) {
        const t = i / audioContext.sampleRate;
        const envelope = Math.exp(-t * 8);
        let sample = 0;
        for (const freq of frequencies) sample += Math.sin(2 * Math.PI * freq * t);
        data[i] = (sample / frequencies.length) * envelope * gain;
      }
      return buffer;
    };

    const playBuffer = (buffer: AudioBuffer, gain = 1) => {
      if (audioContext.state === 'closed') return;
      const source = audioContext.createBufferSource();
      source.buffer = buffer;
      const gainNode = audioContext.createGain();
      gainNode.gain.value = gain * volume;
      source.connect(gainNode);
      gainNode.connect(audioContext.destination);
      source.start(0);
    };

    const buffers = {
      move: createTone(220, 0.12, 'sine', 0.15),
      plant: createTone(330, 0.25, 'sine', 0.2),
      harvest: createChord([440, 554, 659], 0.35, 0.25),
      water: createNoise(0.25, 0.12),
      error: createTone(150, 0.25, 'square', 0.25),
      success: createChord([523, 659, 784], 0.4, 0.2),
      click: createTone(800, 0.04, 'sine', 0.1),
      merge: createChord([330, 415, 495, 587], 0.5, 0.25),
      research: createChord([262, 330, 392, 523], 0.6, 0.2),
    };

    soundsRef.current = {
      playMove: () => playBuffer(buffers.move),
      playPlant: () => playBuffer(buffers.plant),
      playHarvest: () => playBuffer(buffers.harvest),
      playWater: () => playBuffer(buffers.water),
      playError: () => playBuffer(buffers.error),
      playSuccess: () => playBuffer(buffers.success),
      playClick: () => playBuffer(buffers.click),
      playMerge: () => playBuffer(buffers.merge),
      playResearch: () => playBuffer(buffers.research),
    };

    const resumeAudio = () => {
      if (audioContext.state === 'suspended') audioContext.resume();
    };
    document.addEventListener('click', resumeAudio);
    document.addEventListener('keydown', resumeAudio);

    return () => {
      document.removeEventListener('click', resumeAudio);
      document.removeEventListener('keydown', resumeAudio);
      audioContext.close();
    };
  }, [volume]);

  const playSound = useCallback(
    (name: keyof SoundEffects) => {
      if (isMuted) return;
      soundsRef.current?.[name]?.();
    },
    [isMuted]
  );

  const playClick = useCallback(() => {
    if (isMuted) return;
    soundsRef.current?.playClick();
  }, [isMuted]);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      Howler.mute(!prev);
      return !prev;
    });
  }, []);

  const setVolume = useCallback((v: number) => {
    const clamped = Math.max(0, Math.min(1, v));
    setVolumeState(clamped);
    Howler.volume(clamped);
  }, []);

  return { isMuted, volume, playSound, playClick, toggleMute, setVolume };
}
