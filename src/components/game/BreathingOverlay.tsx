import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useGameAudio } from "./useGameAudio";
import { speak } from "@/lib/speech";

type Phase = "in" | "hold" | "out";

const PHASES: { key: Phase; label: string; seconds: number; scale: number; instruction: string }[] = [
  { key: "in", label: "Breathe in…", seconds: 4, scale: 1.35, instruction: "Fill your lungs with air" },
  { key: "hold", label: "Hold it gently", seconds: 4, scale: 1.35, instruction: "Hold the air gently" },
  { key: "out", label: "Breathe out slowly", seconds: 6, scale: 0.8, instruction: "Release the air slowly" },
];

export default function BreathingOverlay({ onExit }: { onExit: () => void }) {
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [cycles, setCycles] = useState(0);
  const phaseRef = useRef(phaseIndex);
  const { playTone, playStartSound } = useGameAudio();

  const phase = PHASES[phaseIndex];

  useEffect(() => {
    speak("Let's take slow, calm breaths together.");
    playStartSound();
  }, [playStartSound]);

  useEffect(() => {
    phaseRef.current = phaseIndex;
    if (phase.key === "in") {
      playTone({ frequency: 329.6, duration: 0.5, volume: 0.035, type: "sine" });
    } else if (phase.key === "out") {
      playTone({ frequency: 220, duration: 0.5, volume: 0.03, type: "sine" });
    }
  }, [phaseIndex, phase.key, playTone]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPhaseIndex((current) => {
        const next = (current + 1) % PHASES.length;
        if (next === 0) setCycles((value) => value + 1);
        return next;
      });
    }, phase.seconds * 1000);
    return () => window.clearTimeout(timer);
  }, [phase.seconds, phaseIndex]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-gradient-to-b from-slate-900/92 via-indigo-950/92 to-slate-900/92 px-6 backdrop-blur-sm"
    >
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.35em] text-white/55">Calm corner</p>
      <h2 className="mb-10 font-display text-2xl font-bold text-white">Breathing with me</h2>

      <div className="relative grid place-items-center">
        <motion.div
          aria-hidden="true"
          animate={{ scale: phase.scale }}
          transition={{ duration: phase.seconds, ease: phase.key === "hold" ? "linear" : "easeInOut" }}
          className="grid h-52 w-52 place-items-center rounded-full bg-gradient-to-br from-sky-300/40 via-cyan-200/30 to-emerald-200/30 shadow-[0_0_90px_rgba(125,211,252,0.35)] ring-1 ring-white/25"
        >
          <span aria-hidden="true" className="text-6xl select-none">🐋</span>
        </motion.div>
      </div>

      <motion.p
        key={phase.key}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="mt-10 font-display text-xl font-semibold text-white"
      >
        {phase.label}
      </motion.p>

      <div className="mt-4 text-center">
        <p className="text-lg text-white/70 font-medium">{phase.instruction}</p>
        <p className="mt-2 text-sm text-white/60">
          {cycles === 0 ? "Follow the whale whenever you are ready." : `${cycles} calm breath${cycles === 1 ? "" : "s"} finished`}
        </p>
      </div>

      <button
        onClick={onExit}
        className="touch-target mt-12 rounded-full border border-white/25 bg-white/12 px-7 py-3 text-sm font-semibold text-white transition hover:bg-white/20"
      >
        I'm ready to go back
      </button>
      <p className="mt-3 max-w-xs text-center text-xs text-white/45">No rush. Leave whenever it feels right.</p>
    </motion.div>
  );
}