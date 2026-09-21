import { useMemo, useState } from "react";
import { GameConfig } from "@/data/games";
import { getAdaptiveGameConfig } from "@/lib/gameProgression";
import { speak } from "@/lib/speech";
import TokenStrip from "../TokenStrip";
import LearningLabel from "../LearningLabel";
import RoundProgress from "../RoundProgress";
import { buildCompletionMetrics, GameCompletionMetrics, masteryForSupport, withTrace } from "../gameCompletion";
import { createSessionRecorder } from "@/lib/gameAnalytics";

interface Props {
  game: GameConfig;
  onInteraction: () => void;
  onComplete: (score: number, socialScore?: number, metrics?: GameCompletionMetrics) => void;
}

type EntitledAction = "give space" | "ask an adult" | "say no" | "take a break" | "use aac" | "gesture";

interface FlexScenario {
  context: string;
  options: EntitledAction[];
}

interface EntitledOption {
  label: string;
  emoji: string;
}

const ENTITLED_OPTIONS: Record<EntitledAction, EntitledOption> = {
  "give space": { label: "Give it some space", emoji: "🫂" },
  "ask an adult": { label: "Ask an adult", emoji: "🧑" },
  "say no": { label: "Say no thank you", emoji: "🙅" },
  "take a break": { label: "Take a break", emoji: "⏸️" },
  "use aac": { label: "Use my AAC to ask", emoji: "🗣️" },
  gesture: { label: "Use a gesture", emoji: "👋" },
};

const SCENARIO_PACKS: Record<string, FlexScenario[]> = {
  "plan-b": [
    {
      context: "Our plan was to build with the blocks, then the blocks were picked up.",
      options: ["ask an adult", "give space", "take a break", "use aac"],
    },
    {
      context: "Our plan was to cut with scissors, then the scissors were not there.",
      options: ["say no", "ask an adult", "gesture", "give space"],
    },
  ],
  change: [
    {
      context: "Our plan was to have a snack outside, then the rain came.",
      options: ["take a break", "ask an adult", "use aac", "say no"],
    },
    {
      context: "Our plan was to be first in line, then someone else was first.",
      options: ["give space", "ask an adult", "gesture", "take a break"],
    },
  ],
  "new-way": [
    {
      context: "Our plan was to color with crayons, then the crayons were gone.",
      options: ["use aac", "ask an adult", "say no", "give space"],
    },
    {
      context: "Our plan was to ride the swing, then the swings were busy.",
      options: ["take a break", "gesture", "ask an adult", "say no"],
    },
  ],
  "when-change": [
    {
      context: "Our plan was to watch the red train, then the blue train came.",
      options: ["give space", "use aac", "ask an adult", "take a break"],
    },
    {
      context: "Our plan was to make a sandcastle, then the sandbox closed.",
      options: ["say no", "ask an adult", "gesture", "give space"],
    },
  ],
  "different-way": [
    {
      context: "Our plan was to walk to the library, then it started to pour.",
      options: ["take a break", "ask an adult", "say no", "use aac"],
    },
    {
      context: "Our plan was to draw with chalk, then the chalk box was empty.",
      options: ["gesture", "ask an adult", "give space", "take a break"],
    },
  ],
  default: [
    {
      context: "Our plan was to play with a friend, then the friend had to go.",
      options: ["give space", "ask an adult", "take a break", "say no"],
    },
  ],
};

function scenariosFor(game: GameConfig) {
  const steps = Math.max(1, Number(game.config.scenarioCount) || 2);
  const pool = SCENARIO_PACKS[String(game.config.theme || "default")] || SCENARIO_PACKS.default;
  return pool.slice(0, steps);
}

export default function FlexibleThinkingEngine({ game, onInteraction, onComplete }: Props) {
  const { supportLevel } = getAdaptiveGameConfig(game);
  const scenarios = useMemo(() => scenariosFor(game), [game]);
  const difficulty = (game.config.assignedDifficulty as string | undefined) || game.difficulty;
  const optionLimit = difficulty === "easy" ? 3 : difficulty === "medium" ? 4 : 5;

  const [scenarioIndex, setScenarioIndex] = useState(0);
  const [choices, setChoices] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const [feedback, setFeedback] = useState("Plans can change. Any of these plans can work.");
  const rec = useMemo(() => createSessionRecorder(game.id), [game.id]);

  const scenario = done ? null : scenarios[Math.min(scenarioIndex, scenarios.length - 1)];
  const options = scenario ? scenario.options.slice(0, optionLimit) : [];

  const finish = (safeExit: boolean) => {
    onComplete(100, undefined, withTrace(rec, buildCompletionMetrics({
      trials: scenarios.length,
      correctTrials: scenarios.length,
      errors: 0,
      promptsNeeded: 0,
      masteryThreshold: masteryForSupport(supportLevel),
      attemptsBySkill: { "flexible-thinking": scenarios.length, "self-advocacy": choices.length },
      observations: [
        `Faced ${scenarios.length} changed-plan scenario${scenarios.length === 1 ? "" : "s"}${safeExit ? " and then chose a safe stop" : ""}.`,
        `Chose ${choices.length} entitled alternatives: ${choices.join(", ") || "none"}.`,
        "No alternative was ever treated as a wrong answer.",
      ],
    })));
  };

  const handleOption = (action: EntitledAction) => {
    if (done || !scenario) return;
    onInteraction();
    const chosen = ENTITLED_OPTIONS[action].label;
    speak(`${chosen}. That plan can work.`);
    rec.event("choice", `${scenario.context}|${action}`);
    const nextChoices = [...choices, action];
    setChoices(nextChoices);
    const nextIndex = scenarioIndex + 1;
    if (nextIndex >= scenarios.length) {
      setDone(true);
      setFeedback("Plans can change, and you found a way. Well done.");
      finish(false);
    } else {
      setScenarioIndex(nextIndex);
      setFeedback(scenarios[nextIndex].context);
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
          <span className="text-xs font-black uppercase tracking-[0.2em] text-primary">When plans change</span>
          <TokenStrip earned={scenarioIndex} total={scenarios.length} token="🔀" />
        </div>
        <p className="mt-1 text-sm font-semibold text-foreground">
          {done ? feedback : scenario?.context || feedback}
        </p>
        <div className="mt-2 text-xs text-muted-foreground">
          {done ? "All set — you handled the change." : <RoundProgress current={scenarioIndex} total={scenarios.length} />}
        </div>
      </div>

      <div className="mb-4 rounded-2xl border-2 border-border bg-card p-4 text-center text-3xl" aria-hidden="true">
        {done ? "✅" : "🪄"}
      </div>

      {scenario ? (
        <div className="grid grid-cols-2 gap-3">
          {options.map((action) => {
            const option = ENTITLED_OPTIONS[action];
            return (
              <button
                key={action}
                type="button"
                onClick={() => handleOption(action)}
                aria-label={action}
                className="touch-target flex min-h-24 flex-col items-center justify-center gap-1 rounded-2xl border-2 border-primary bg-card p-3 text-center shadow-lg transition hover:border-secondary"
              >
                <span aria-hidden="true" className="text-4xl">{option.emoji}</span>
                <span className="text-sm font-black uppercase tracking-wide text-foreground">{option.label}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <p className="rounded-2xl border-2 border-secondary bg-secondary/20 p-6 text-center text-2xl">✅</p>
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