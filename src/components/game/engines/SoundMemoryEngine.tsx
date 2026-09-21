import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { GameConfig } from "@/data/games";
import { shuffleItems } from "@/lib/shuffle";
import { getAdaptiveGameConfig } from "@/lib/gameProgression";
import { speak } from "@/lib/speech";
import TokenStrip from "../TokenStrip";
import { ComboBadge, useWobble } from "../Juice";
import { useGameAudio } from "../useGameAudio";
import LearningLabel from "../LearningLabel";
import { buildCompletionMetrics, GameCompletionMetrics, masteryForSupport, withTrace } from "../gameCompletion";
import { createSessionRecorder } from "@/lib/gameAnalytics";

interface Props {
  game: GameConfig;
  onInteraction: () => void;
  onComplete: (score: number, socialScore?: number, metrics?: GameCompletionMetrics) => void;
}

interface Bell {
  color: string;
  frequency: number;
}

const BELL_SETS: Record<string, { label: string; bells: Bell[] }> = {
  rainbow: {
    label: "Rainbow bells",
    bells: [
      { color: "bg-rose-400", frequency: 392 },
      { color: "bg-amber-400", frequency: 494 },
      { color: "bg-emerald-400", frequency: 587 },
      { color: "bg-sky-400", frequency: 698 },
    ],
  },
  animals: {
    label: "Animal chimes",
    bells: [
      { color: "bg-orange-300", frequency: 330 },
      { color: "bg-lime-400", frequency: 415 },
      { color: "bg-cyan-300", frequency: 523 },
      { color: "bg-violet-400", frequency: 659 },
    ],
  },
  night: {
    label: "Night tones",
    bells: [
      { color: "bg-indigo-300", frequency: 294 },
      { color: "bg-slate-400", frequency: 370 },
      { color: "bg-blue-300", frequency: 466 },
      { color: "bg-purple-300", frequency: 587 },
    ],
  },
};

type Phase = "listen" | "repeat" | "handover";

export default function SoundMemoryEngine({ game, onInteraction, onComplete }: Props) {
  const theme = String(game.config.theme || "rainbow");
  const set = BELL_SETS[theme] || BELL_SETS.rainbow;
  const { difficulty, supportLevel } = getAdaptiveGameConfig(game);
  const startLevel = String(game.config.startLevel || "") as "easy" | "medium" | "hard" | "";
  const roundCount = supportLevel === "high" ? 3 : difficulty === "easy" ? 4 : difficulty === "medium" ? 5 : 6;

  const sequences = useMemo(
    () =>
      Array.from({ length: roundCount }, (_, round) => {
        const tierBoost = startLevel === "hard" ? 1 : startLevel === "easy" ? -1 : 0;
        const length = Math.min(
          Math.max(2, 2 + Math.floor(round / 1.5) + (difficulty === "hard" ? 1 : 0) + tierBoost),
          set.bells.length
        );
        return Array.from({ length }, () => Math.floor(Math.random() * set.bells.length));
      }),
    [difficulty, roundCount, set.bells.length, startLevel]
  );

  const [roundIndex, setRoundIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("listen");
  const [playIndex, setPlayIndex] = useState(-1);
  const [inputIndex, setInputIndex] = useState(0);
  const [litBell, setLitBell] = useState<number | null>(null);
  const [prompts, setPrompts] = useState(0);
  const [errorsThisRound, setErrorsThisRound] = useState(0);
  const [combo, setCombo] = useState(0);
  const comboRef = useRef(0);
  const completedRef = useRef(false);
  const rec = useMemo(() => createSessionRecorder(game.id), [game.id]);
  const { playTone, playHitSound, playMissSound } = useGameAudio();
  const { controls, wobble } = useWobble();

  const sequence = sequences[roundIndex] || [];

  useEffect(() => {
    if (!sequence.length) return;
    setPhase("listen");
    setInputIndex(0);
    setErrorsThisRound(0);

    let index = 0;
    const stepMs = supportLevel === "high" ? 750 : 600;
    const playStep = () => {
      if (index >= sequence.length) {
        setLitBell(null);
        setPhase("repeat");
        speak("Now you play it.");
        rec.mark();
        return;
      }
      setPlayIndex(index);
      setLitBell(sequence[index]);
      playTone({ frequency: set.bells[sequence[index]].frequency, duration: 0.28, volume: 0.05, type: "triangle" });
      window.setTimeout(() => setPlayIndex(-1), stepMs * 0.6);
      index += 1;
      window.setTimeout(playStep, stepMs);
    };
    speak(`Listen to ${sequence.length} notes.`);
    window.setTimeout(playStep, 500);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rec, roundIndex]);

  const finishSequence = useCallback(
    (prompted: boolean) => {
      rec.trial({
        stimulus: `melody:${theme}#${roundIndex}:${sequence.length}`,
        correct: true,
        prompted,
      });
      adaptiveRecord(prompted);
      if (roundIndex + 1 >= sequences.length) {
        if (completedRef.current) return;
        completedRef.current = true;
        const score = Math.max(60, 100 - prompts * 12);
        onComplete(score, undefined, withTrace(rec, buildCompletionMetrics({
          trials: sequences.length + prompts,
          correctTrials: sequences.length,
          errors: prompts,
          promptsNeeded: prompts,
          masteryThreshold: masteryForSupport(supportLevel),
          attemptsBySkill: { "auditory-memory": sequences.length, sequencing: sequences.length },
          observations: [
            `Replayed ${sequences.length} tone melodies (longest ${Math.max(...sequences.map((s) => s.length))} notes).`,
            prompted ? "Some melodies were handed over note-by-note after retries." : "Replayed every melody independently.",
          ],
        })));
        return;
      }
      setCombo((value) => value + 1);
      setRoundIndex((value) => value + 1);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onComplete, prompts, rec, roundIndex, sequences, supportLevel, theme]
  );

  function adaptiveRecord(prompted: boolean) {
    if (!prompted) {
      comboRef.current += 1;
      setCombo(comboRef.current);
    } else {
      setPrompts((value) => value + 1);
    }
  }

  const handleBellTap = (bellIndex: number) => {
    if (phase !== "repeat") return;
    onInteraction();
    setLitBell(bellIndex);
    playTone({ frequency: set.bells[bellIndex].frequency, duration: 0.24, volume: 0.05, type: "triangle" });
    window.setTimeout(() => setLitBell(null), 220);

    if (sequence[inputIndex] === bellIndex) {
      rec.event("note", `${inputIndex + 1}/${sequence.length}`);
      const next = inputIndex + 1;
      if (next >= sequence.length) {
        playHitSound(comboRef.current + 1);
        finishSequence(errorsThisRound > 0);
      } else {
        setInputIndex(next);
      }
      return;
    }

    rec.trial({
      stimulus: `melody:${theme}#${roundIndex}:note${inputIndex + 1}`,
      correct: false,
      prompted: false,
    });
    wobble();
    playMissSound();
    const nextErrors = errorsThisRound + 1;
    setErrorsThisRound(nextErrors);
    setInputIndex(0);
    if (nextErrors >= 3) {
      setPhase("handover");
      speak("Let me show you the melody. Listen and watch.");
      window.setTimeout(() => {
        setPrompts((value) => value + 1);
        finishSequence(true);
      }, 1200);
    } else {
      speak("Listen again in your head, then try my melody with me.");
    }
  };

  return (
    <div className="mx-auto max-w-lg">
      <LearningLabel game={game} />
      <div className="mb-3 rounded-2xl bg-muted/70 p-3 text-center">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">Sound Memory · {set.label}</p>
      </div>

      <div className="relative rounded-[2rem] border border-border bg-gradient-to-br from-indigo-50/80 to-white/70 p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Melody {roundIndex + 1} of {sequences.length} · {sequence.length} notes
          </span>
          <TokenStrip earned={roundIndex} total={sequences.length} token="🎵" />
        </div>
        <ComboBadge combo={combo} />

        <motion.div animate={controls} className={`grid gap-4 ${phase === "listen" ? "" : ""}`}>
          {set.bells.map((bell, index) => {
            const lit = litBell === index;
            return (
              <motion.button
                key={index}
                whileTap={{ scale: 0.94 }}
                onClick={() => handleBellTap(index)}
                disabled={phase === "listen"}
                aria-label={`bell ${index + 1}`}
                className={`touch-target h-20 rounded-3xl border border-white/60 shadow-[inset_0_-8px_16px_rgba(0,0,0,0.08)] transition-all ${
                  bell.color
                } ${lit ? "brightness-150 scale-[1.03] ring-4 ring-white/80" : "opacity-85 hover:opacity-100"} ${
                  phase === "listen" ? "cursor-default" : ""
                }`}
              >
                <span className="sr-only">{`bell ${index + 1}`}</span>
              </motion.button>
            );
          })}
        </motion.div>

        <p className="mt-5 text-center text-xs font-semibold text-muted-foreground">
          {phase === "listen" ? "👂 Listen…" : phase === "handover" ? "🤝 Watch my fingers…" : "🎶 Your turn — tap the melody"}
        </p>
      </div>
    </div>
  );
}
