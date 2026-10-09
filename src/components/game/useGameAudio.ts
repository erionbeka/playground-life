import { useCallback, useEffect, useRef } from "react";

type ToneOptions = {
  duration?: number;
  volume?: number;
  type?: OscillatorType;
  frequency?: number;
};

function clampVolume(volume: number) {
  return Math.min(0.12, Math.max(0.01, volume));
}

export function useGameAudio() {
  const audioContextRef = useRef<AudioContext | null>(null);

  const ensureContext = useCallback(() => {
    if (typeof window === "undefined") return null;

    if (!audioContextRef.current) {
      const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return null;
      audioContextRef.current = new AudioContextClass();
    }

    if (audioContextRef.current.state === "suspended") {
      void audioContextRef.current.resume();
    }

    return audioContextRef.current;
  }, []);

  const playTone = useCallback(
    ({ duration = 0.12, volume = 0.05, type = "sine", frequency = 440 }: ToneOptions) => {
      const context = ensureContext();
      if (!context) return;

      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const now = context.currentTime;
      const safeVolume = clampVolume(volume);

      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, now);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(safeVolume, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      oscillator.connect(gain);
      gain.connect(context.destination);

      oscillator.start(now);
      oscillator.stop(now + duration + 0.02);
    },
    [ensureContext]
  );

  const playTapSound = useCallback(() => {
    playTone({ frequency: 520, duration: 0.08, volume: 0.045, type: "triangle" });
  }, [playTone]);

  const playStartSound = useCallback(() => {
    playTone({ frequency: 392, duration: 0.14, volume: 0.04, type: "sine" });
    window.setTimeout(() => playTone({ frequency: 523.25, duration: 0.18, volume: 0.05, type: "triangle" }), 90);
  }, [playTone]);

  const playCelebrationSound = useCallback(() => {
    [523.25, 659.25, 783.99].forEach((frequency, index) => {
      window.setTimeout(() => {
        playTone({ frequency, duration: 0.22, volume: 0.055, type: "triangle" });
      }, index * 100);
    });
  }, [playTone]);

  const playHitSound = useCallback(
    (combo = 1) => {
      playTone({ frequency: 480 + Math.min(combo, 6) * 60, duration: 0.09, volume: 0.05, type: "triangle" });
    },
    [playTone]
  );

  const playMissSound = useCallback(() => {
    playTone({ frequency: 200, duration: 0.14, volume: 0.04, type: "sine" });
  }, [playTone]);

  const playPopSound = useCallback(() => {
    playTone({ frequency: 700, duration: 0.06, volume: 0.05, type: "square" });
  }, [playTone]);

  useEffect(() => {
    return () => {
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        void audioContextRef.current.close();
      }
    };
  }, []);

  return {
    warmUpAudio: ensureContext,
    playTone,
    playTapSound,
    playStartSound,
    playCelebrationSound,
    playHitSound,
    playMissSound,
    playPopSound,
  };
}
