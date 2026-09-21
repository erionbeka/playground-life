import { useMemo, useState } from "react";
import { GameConfig } from "@/data/games";
import { getAdaptiveGameConfig } from "@/lib/gameProgression";
import { emojiFor } from "@/lib/gameAssets";
import { speak } from "@/lib/speech";
import TokenStrip from "../TokenStrip";
import LearningLabel from "../LearningLabel";
import { buildCompletionMetrics, GameCompletionMetrics, masteryForSupport, withTrace } from "../gameCompletion";
import { createSessionRecorder } from "@/lib/gameAnalytics";

interface Props {
  game: GameConfig;
  onInteraction: () => void;
  onComplete: (score: number, socialScore?: number, metrics?: GameCompletionMetrics) => void;
}

type StageKind = "first" | "then" | "body" | "strategy";

interface RegOption {
  label: string;
  emoji: string;
}

interface RegulationStage {
  kind: StageKind;
  heading: string;
  options: RegOption[];
}

const REGULATION_PLANS: Record<string, { stages: RegulationStage[] }> = {
  "first-then": {
    stages: [
      {
        kind: "first",
        heading: "First, choose what you want to do. Any choice works.",
        options: [
          { label: "Eat a snack", emoji: "🍎" },
          { label: "Play with a toy", emoji: "🧸" },
          { label: "Read a book", emoji: "📖" },
          { label: "Move around", emoji: "🏃" },
          { label: "Do a puzzle", emoji: "🧩" },
        ],
      },
      {
        kind: "then",
        heading: "Then, choose what happens after. Any choice is okay.",
        options: [
          { label: "Short play break", emoji: "🎮" },
          { label: "Snuggle time", emoji: "🤗" },
          { label: "Music time", emoji: "🎵" },
          { label: "Outside time", emoji: "🌳" },
          { label: "A sticker", emoji: "⭐" },
        ],
      },
    ],
  },
  "getting-ready": {
    stages: [
      {
        kind: "first",
        heading: "First, choose what you will do to get ready. Any choice works.",
        options: [
          { label: "Brush my teeth", emoji: "🪥" },
          { label: "Get dressed", emoji: "👕" },
          { label: "Put on my shoes", emoji: "👟" },
          { label: "Pack my bag", emoji: "🎒" },
          { label: "Wash my hands", emoji: "🧼" },
        ],
      },
      {
        kind: "then",
        heading: "Then choose what happens after. Any choice is okay.",
        options: [
          { label: "A game together", emoji: "🎲" },
          { label: "A book with a grown-up", emoji: "📖" },
          { label: "Five more minutes of play", emoji: "⏱️" },
          { label: "A favorite snack", emoji: "🍎" },
        ],
      },
    ],
  },
  "body-check": {
    stages: [
      {
        kind: "body",
        heading: "How does your body feel right now? Any answer is right for you.",
        options: [
          { label: "Calm", emoji: "🌿" },
          { label: "Happy", emoji: "😊" },
          { label: "Wiggly", emoji: "🌀" },
          { label: "Tired", emoji: "😴" },
          { label: "Hungry", emoji: "🧀" },
          { label: "Big feelings", emoji: "🌋" },
        ],
      },
    ],
  },
  "calm-strategy": {
    stages: [
      {
        kind: "body",
        heading: "How does your body feel? Any answer is right for you.",
        options: [
          { label: "Wound up", emoji: "🌀" },
          { label: "Already calm", emoji: "🌿" },
          { label: "Tired", emoji: "😴" },
          { label: "Uncomfortable", emoji: "🙁" },
          { label: "Not sure yet", emoji: "🤔" },
        ],
      },
      {
        kind: "strategy",
        heading: "Now choose a way to feel steady. They are all good ways.",
        options: [
          { label: "Take a breath", emoji: "🌬️" },
          { label: "Get some water", emoji: "💧" },
          { label: "Move my body", emoji: "🏃" },
          { label: "Quiet time", emoji: "🔇" },
          { label: "Ask an adult", emoji: "🧑" },
          { label: "Take a break", emoji: "⏸️" },
        ],
      },
    ],
  },
  break: {
    stages: [
      {
        kind: "strategy",
        heading: "How could you ask for a break? Any way is a good way.",
        options: [
          { label: "Raise my hand", emoji: "🙋" },
          { label: 'Say "take a break"', emoji: "🗣️" },
          { label: "Point to a break card", emoji: "🃏" },
          { label: "Use a sign or symbol", emoji: "👌" },
          { label: "Ask a grown-up", emoji: "🧑" },
        ],
      },
      {
        kind: "strategy",
        heading: "While you take a break, what helps you settle? Any of these is fine.",
        options: [
          { label: "Calm breathing", emoji: "🌬️" },
          { label: "A quiet spot", emoji: "🔇" },
          { label: "Some water", emoji: "💧" },
          { label: "Squeeze a soft toy", emoji: "🧸" },
          { label: "Look at my calm book", emoji: "📖" },
        ],
      },
    ],
  },
  default: {
    stages: [
      {
        kind: "strategy",
        heading: "Pick a way to settle. Any of these is a good way.",
        options: [
          { label: "Take a breath", emoji: "🌬️" },
          { label: "Get some water", emoji: "💧" },
          { label: "Move my body", emoji: "🏃" },
          { label: "Quiet time", emoji: "🔇" },
          { label: "Ask an adult", emoji: "🧑" },
          { label: "Take a break", emoji: "⏸️" },
        ],
      },
    ],
  },
};

const STAGE_EVENT: Record<StageKind, string> = {
  first: "choice",
  then: "choice",
  body: "bodySignal",
  strategy: "strategy",
};

function planFor(game: GameConfig) {
  return REGULATION_PLANS[String(game.config.theme || "default")] || REGULATION_PLANS.default;
}

export default function RegulationEngine({ game, onInteraction, onComplete }: Props) {
  const { supportLevel } = getAdaptiveGameConfig(game);
  const plan = useMemo(() => planFor(game), [game]);
  const stages = plan.stages;

  const optionLimit = supportLevel === "high" ? 2 : supportLevel === "moderate" ? 3 : 4;

  const [stageIndex, setStageIndex] = useState(0);
  const [choices, setChoices] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const [feedback, setFeedback] = useState(stages[0]?.heading || "");
  const rec = useMemo(() => createSessionRecorder(game.id), [game.id]);

  const stage = done ? null : stages[Math.min(stageIndex, stages.length - 1)];
  const options = stage ? stage.options.slice(0, optionLimit) : [];

  const finish = (safeExit: boolean) => {
    const bodySignals = choices.filter((choice) => choice.startsWith("[body]"));
    const strategies = choices.filter((choice) => choice.startsWith("[strategy]"));
    onComplete(100, undefined, withTrace(rec, buildCompletionMetrics({
      trials: stages.length,
      correctTrials: stages.length,
      errors: 0,
      promptsNeeded: 0,
      masteryThreshold: masteryForSupport(supportLevel),
      attemptsBySkill: {
        regulation: stages.length,
        interoception: bodySignals.length,
        "executive-function": stages.filter((entry) => entry.kind === "first" || entry.kind === "then").length,
      },
      observations: [
        `Made ${stages.length} regulation choices${safeExit ? " and then chose a safe stop" : ""}.`,
        safeExit ? "Child practiced an in-game safe exit ('I need to stop')." : "No in-game safe-exit requested.",
        "No strategy was ever marked wrong.",
      ],
    })));
  };

  const handleOption = (option: RegOption) => {
    if (done || !stage) return;
    onInteraction();
    speak(`${option.label}. Good choice.`);
    const nextChoices = [...choices, `[${stage.kind}] ${option.label}`];
    setChoices(nextChoices);
    const nextStage = stageIndex + 1;
    if (nextStage >= stages.length) {
      setDone(true);
      setFeedback("Nice choices. You planned your routine all by yourself.");
      finish(false);
    } else {
      setStageIndex(nextStage);
      setFeedback(stages[nextStage].heading);
    }
  };

  const handleStop = () => {
    if (done) return;
    onInteraction();
    speak("That is okay. We can stop anytime.");
    setDone(true);
    setFeedback("Stopping is always okay.");
    finish(true);
  };

  return (
    <div className="mx-auto max-w-lg">
      <LearningLabel game={game} />
      <div className="mb-4 rounded-2xl bg-muted/70 p-4 text-center">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-black uppercase tracking-[0.2em] text-primary">My plan, my choice</span>
          <TokenStrip earned={stageIndex} total={stages.length} token="💛" />
        </div>
        <p className="mt-1 text-sm font-semibold text-foreground">{feedback}</p>
        <p className="mt-2 text-xs text-muted-foreground">
          {done ? "You are all done — well planned." : `Step ${stageIndex + 1} of ${stages.length}`}
        </p>
      </div>

      {stage ? (
        <div className="grid grid-cols-2 gap-3">
          {options.map((option) => (
            <button
              key={option.label}
              type="button"
              onClick={() => handleOption(option)}
              aria-label={`${option.label} option`}
              className="touch-target flex min-h-24 flex-col items-center justify-center gap-1 rounded-2xl border-2 border-primary bg-card p-3 text-center shadow-lg transition hover:border-secondary"
            >
              <span aria-hidden="true" className="text-4xl">{option.emoji}</span>
              <span className="text-sm font-black uppercase tracking-wide text-foreground">{option.label}</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="rounded-2xl border-2 border-secondary bg-secondary/20 p-6 text-center text-2xl">💛</p>
      )}

      <div className="mt-4 flex justify-center gap-2">
        <button
          type="button"
          onClick={handleStop}
          aria-label="I need to stop"
          className="rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold text-muted-foreground transition hover:border-primary hover:text-foreground"
        >
          🛑 I need to stop
        </button>
      </div>
    </div>
  );
}