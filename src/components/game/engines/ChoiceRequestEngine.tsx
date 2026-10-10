import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { GameConfig } from "@/data/games";
import { getAdaptiveGameConfig } from "@/lib/gameProgression";
import { speak } from "@/lib/speech";
import { BurstLayer, useBursts } from "../Juice";
import { useGameAudio } from "../useGameAudio";
import LearningLabel from "../LearningLabel";
import RoundProgress from "../RoundProgress";
import { buildCompletionMetrics, GameCompletionMetrics, masteryForSupport, withTrace } from "../gameCompletion";
import { createSessionRecorder } from "@/lib/gameAnalytics";
import { buildRequestLadder, coreWordForTheme, ladderRungFor } from "@/lib/requestLadder";

interface Props {
  game: GameConfig;
  onInteraction: () => void;
  onComplete: (score: number, socialScore?: number, metrics?: GameCompletionMetrics) => void;
}

export interface RequestOption {
  label: string;
  emoji: string;
  strategy: "verbal" | "pointing" | "card" | "gesture" | "sign";
  modality: "speech" | "visual" | "gesture";
}

export interface RequestScenario {
  situation: string;
  request: string;
  emoji: string;
  options: RequestOption[];
}

const REQUEST_PACKS: Record<string, RequestScenario[]> = {
  snack: [
    {
      situation: "It is snack time and you choose what to eat.",
      request: "choose a snack",
      emoji: "🍎",
      options: [
        { label: "I want crackers, please", emoji: "🍘", strategy: "verbal", modality: "speech" },
        { label: "Apple, please", emoji: "🍎", strategy: "pointing", modality: "gesture" },
        { label: "Show my snack card", emoji: "🃏", strategy: "card", modality: "visual" },
        { label: "Nod for crackers", emoji: "👌", strategy: "gesture", modality: "gesture" },
      ],
    },
    {
      situation: "You are thirsty and want a drink.",
      request: "ask for a drink",
      emoji: "🥤",
      options: [
        { label: "Water, please", emoji: "💧", strategy: "verbal", modality: "speech" },
        { label: "Point to my cup", emoji: "👉", strategy: "pointing", modality: "gesture" },
        { label: "Drink card, please", emoji: "🃏", strategy: "card", modality: "visual" },
      ],
    },
    {
      situation: "You finished your snack and want more.",
      request: "ask for more",
      emoji: "🍇",
      options: [
        { label: "More, please", emoji: "➕", strategy: "verbal", modality: "speech" },
        { label: "Tap my 'more' card", emoji: "🃏", strategy: "card", modality: "visual" },
        { label: "Raise my hand", emoji: "🙋", strategy: "gesture", modality: "gesture" },
      ],
    },
  ],
  help: [
    {
      situation: "A jar is stuck and you want it open.",
      request: "ask for help",
      emoji: "🫙",
      options: [
        { label: "Help, please", emoji: "🙋", strategy: "verbal", modality: "speech" },
        { label: "Tap the help card", emoji: "🃏", strategy: "card", modality: "visual" },
        { label: "Hand me the jar", emoji: "🫳", strategy: "gesture", modality: "gesture" },
        { label: "Sign 'help'", emoji: "🤟", strategy: "sign", modality: "gesture" },
      ],
    },
    {
      situation: "Your shoes are too hard to put on.",
      request: "ask for help with shoes",
      emoji: "👟",
      options: [
        { label: "Pull, please", emoji: "🧗", strategy: "verbal", modality: "speech" },
        { label: "Show my shoe card", emoji: "🃏", strategy: "card", modality: "visual" },
        { label: "Point to my shoe", emoji: "👉", strategy: "pointing", modality: "gesture" },
      ],
    },
    {
      situation: "You cannot reach the toy on the shelf.",
      request: "ask for reach",
      emoji: "🧸",
      options: [
        { label: "Up there, please", emoji: "☝️", strategy: "pointing", modality: "gesture" },
        { label: "Use my 'help' card", emoji: "🃏", strategy: "card", modality: "visual" },
        { label: "Call me, please", emoji: "📣", strategy: "verbal", modality: "speech" },
      ],
    },
  ],
  more: [
    {
      situation: "Your cup is empty and you would like another sip.",
      request: "ask for more",
      emoji: "🥤",
      options: [
        { label: "More juice, please", emoji: "🍹", strategy: "verbal", modality: "speech" },
        { label: "Tap my 'more' card", emoji: "🃏", strategy: "card", modality: "visual" },
        { label: "Slide my cup over", emoji: "🫸", strategy: "gesture", modality: "gesture" },
      ],
    },
    {
      situation: "You liked the song and want to hear it again.",
      request: "ask for another turn",
      emoji: "🎵",
      options: [
        { label: "Again, please", emoji: "🔁", strategy: "verbal", modality: "speech" },
        { label: "Nod 'yes' again", emoji: "👌", strategy: "gesture", modality: "gesture" },
        { label: "Show my music card", emoji: "🃏", strategy: "card", modality: "visual" },
      ],
    },
    {
      situation: "You want one more bubble before lunch.",
      request: "ask for one more",
      emoji: "🫧",
      options: [
        { label: "One more, please", emoji: "1️⃣", strategy: "verbal", modality: "speech" },
        { label: "Hold up one finger", emoji: "☝️", strategy: "gesture", modality: "gesture" },
        { label: "Tap the 'more' card", emoji: "🃏", strategy: "card", modality: "visual" },
        { label: "Point to the bubbles", emoji: "🫧", strategy: "pointing", modality: "gesture" },
      ],
    },
  ],
  "all done": [
    {
      situation: "Your plate is clean and you are finished eating.",
      request: "say all done",
      emoji: "✅",
      options: [
        { label: "All done", emoji: "✅", strategy: "verbal", modality: "speech" },
        { label: "Push my plate away", emoji: "🍽️", strategy: "gesture", modality: "gesture" },
        { label: "Tap my 'all done' card", emoji: "🃏", strategy: "card", modality: "visual" },
      ],
    },
    {
      situation: "You finished the puzzle and are ready to stop.",
      request: "say all done with puzzle",
      emoji: "🧩",
      options: [
        { label: "Finished", emoji: "🏁", strategy: "verbal", modality: "speech" },
        { label: "Cover my eyes", emoji: "🙈", strategy: "gesture", modality: "gesture" },
        { label: "Show my 'all done' card", emoji: "🃏", strategy: "card", modality: "visual" },
      ],
    },
    {
      situation: "Bath time is over and you are ready to get out.",
      request: "say done with bath",
      emoji: "🛁",
      options: [
        { label: "I am done", emoji: "✅", strategy: "verbal", modality: "speech" },
        { label: "Point to the towel", emoji: "🧻", strategy: "pointing", modality: "gesture" },
        { label: "Raise my hand", emoji: "🙋", strategy: "gesture", modality: "gesture" },
        { label: "Tap my card", emoji: "🃏", strategy: "card", modality: "visual" },
      ],
    },
  ],
  break: [
    {
      situation: "Your body feels wiggly and you want a quiet moment.",
      request: "ask for a break",
      emoji: "🌬️",
      options: [
        { label: "Break, please", emoji: "⏸️", strategy: "verbal", modality: "speech" },
        { label: "Show my 'break' card", emoji: "🃏", strategy: "card", modality: "visual" },
        { label: "Rest my head", emoji: "😌", strategy: "gesture", modality: "gesture" },
        { label: "Tap my shoulder", emoji: "🤚", strategy: "sign", modality: "gesture" },
      ],
    },
    {
      situation: "The music is too loud and you need it quieter.",
      request: "ask for quieter",
      emoji: "🔉",
      options: [
        { label: "Quieter, please", emoji: "🤫", strategy: "verbal", modality: "speech" },
        { label: "Cover my ears", emoji: "🙉", strategy: "gesture", modality: "gesture" },
        { label: "Point to my ears", emoji: "👂", strategy: "pointing", modality: "gesture" },
        { label: "Show my 'break' card", emoji: "🃏", strategy: "card", modality: "visual" },
      ],
    },
    {
      situation: "You want a slow walk in the hallway.",
      request: "ask for a walk",
      emoji: "🚶",
      options: [
        { label: "Walk, please", emoji: "🚶", strategy: "verbal", modality: "speech" },
        { label: "Stand up", emoji: "🧍", strategy: "gesture", modality: "gesture" },
        { label: "Show my card", emoji: "🃏", strategy: "card", modality: "visual" },
      ],
    },
  ],
  favorite: [
    {
      situation: "It is choice time and you get to pick your favorite thing.",
      request: "share a favorite",
      emoji: "⭐",
      options: [
        { label: "My favorite is blue", emoji: "🔵", strategy: "verbal", modality: "speech" },
        { label: "Point to my color", emoji: "👉", strategy: "pointing", modality: "gesture" },
        { label: "Show my blue card", emoji: "🃏", strategy: "card", modality: "visual" },
      ],
    },
    {
      situation: "Your favorite animal is visiting today.",
      request: "share favorite animal",
      emoji: "🐶",
      options: [
        { label: "Dogs are my favorite", emoji: "🐶", strategy: "verbal", modality: "speech" },
        { label: "Point to the dog", emoji: "👉", strategy: "pointing", modality: "gesture" },
        { label: "Show my dog card", emoji: "🃏", strategy: "card", modality: "visual" },
        { label: "Wiggle like a dog", emoji: "🐾", strategy: "gesture", modality: "gesture" },
      ],
    },
    {
      situation: "You can pick a game for the whole group.",
      request: "choose a favorite game",
      emoji: "🎲",
      options: [
        { label: "Bubbles, please", emoji: "🫧", strategy: "verbal", modality: "speech" },
        { label: "Point to the bubbles", emoji: "👉", strategy: "pointing", modality: "gesture" },
        { label: "Show my game card", emoji: "🃏", strategy: "card", modality: "visual" },
      ],
    },
  ],
};

function packForTheme(theme: string): RequestScenario[] {
  const key = theme.toLowerCase();
  if (key.includes("snack")) return REQUEST_PACKS.snack;
  if (key.includes("help")) return REQUEST_PACKS.help;
  if (key.includes("more")) return REQUEST_PACKS.more;
  if (key.includes("all done") || key.includes("all-done")) return REQUEST_PACKS["all done"];
  if (key.includes("break")) return REQUEST_PACKS.break;
  if (key.includes("favorite") || key.includes("favourite")) return REQUEST_PACKS.favorite;
  return REQUEST_PACKS.help;
}

const KIND_THANKS = [
  "Good idea. That works.",
  "Thanks for letting me know.",
  "That is clear. Thank you.",
];

function sentenceCase(value: string) {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function ChoiceRequestEngine({ game, onInteraction, onComplete }: Props) {
  const { supportLevel } = getAdaptiveGameConfig(game);
  const theme = String(game.config.theme || "help");
  const scenarios = useMemo(
    () =>
      Array.isArray(game.config.scenarios)
        ? (game.config.scenarios as unknown[] as RequestScenario[])
        : packForTheme(theme),
    [game.config.scenarios, theme]
  );
  const totalRounds = Math.max(1, Number(game.config.rounds) || 3);
  const targetCount = supportLevel === "high" ? Math.min(2, scenarios.length) : Math.min(totalRounds, scenarios.length);
  const activeScenarios = useMemo(() => scenarios.slice(0, targetCount), [scenarios, targetCount]);
  const optionLimit = supportLevel === "high" ? 2 : supportLevel === "moderate" ? 3 : 4;

  const [current, setCurrent] = useState(0);
  const [explored, setExplored] = useState(0);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [played, setPlayed] = useState<string[]>([]);
  const rec = useMemo(() => createSessionRecorder(game.id), [game.id]);
  const { playHitSound } = useGameAudio();
  const { bursts, fireBurst } = useBursts();

  const scenario = activeScenarios[current];
  const ladder = useMemo(() => buildRequestLadder(coreWordForTheme(theme)), [theme]);
  const rung = ladderRungFor(explored);

  useEffect(() => {
    if (!scenario) return;
    setFeedback(null);
    rec.mark();
    rec.event("scenario_started", scenario.situation);
    if (supportLevel === "high") {
      speak(`${scenario.situation} You can${scenario.options.length > 1 ? "" : ""} ask or show me.`);
    }
  }, [rec, scenario, supportLevel]);

  const handleOption = (option: RequestOption) => {
    onInteraction();
    rec.event("request", `${scenario.request}|${option.label}|${option.strategy}|${option.modality}`);
    const nextExplored = explored + 1;
    playHitSound(1);
    fireBurst(50, 40, option.emoji);
    const thank = KIND_THANKS[Math.min(nextExplored - 1, KIND_THANKS.length - 1)];
    const model = ladder[ladderRungFor(nextExplored)];
    setFeedback(`${thank} You asked for “${option.label}”. Try saying: “${model}”.`);
    setPlayed((prev) => [...prev, option.label]);
    setExplored(nextExplored);
    speak(`${thank} ${model}.`);

    window.setTimeout(() => {
      setFeedback(null);
      if (current + 1 >= activeScenarios.length) {
        onComplete(
          100,
          nextExplored,
          withTrace(rec, buildCompletionMetrics({
            trials: activeScenarios.length,
            correctTrials: activeScenarios.length,
            errors: 0,
            masteryThreshold: masteryForSupport(supportLevel),
            attemptsBySkill: { communication: nextExplored, requestsMade: nextExplored },
            observations: [
              `Explored ${nextExplored} request scenarios about ${theme} in an AAC-friendly session.`,
              "Exploration-based activity: every request is acceptable; participation is the goal.",
            ],
          })),
        );
      } else {
        setCurrent((value) => value + 1);
      }
    }, supportLevel === "high" ? 1800 : 1500);
  };

  if (!scenario) return null;

  const options = scenario.options.slice(0, optionLimit);

  return (
    <div className="mx-auto max-w-lg">
      <LearningLabel game={game} />
      <div className="mb-2 text-center">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">Request practice · {sentenceCase(theme)}</p>
        <div className="mt-1">
          <RoundProgress current={current} total={activeScenarios.length} />
        </div>
      </div>

      <div className="relative mb-4 overflow-hidden rounded-2xl border border-border bg-card p-6">
        <p aria-hidden="true" className="mb-3 text-center text-5xl">{scenario.emoji}</p>
        <h2 className="text-center font-display text-xl font-bold text-foreground">{scenario.situation}</h2>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Any way you ask is okay — no wrong answers, no rush.
        </p>
        <div className="mt-3 border-t border-border pt-3">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground">Grow your words</p>
          <ol data-testid="request-ladder" className="mt-2 flex flex-wrap items-center justify-center gap-2">
            {ladder.map((step, index) => (
              <li
                key={step}
                aria-current={index === rung ? "step" : undefined}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  index <= rung ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}
              >
                {step}
              </li>
            ))}
          </ol>
        </div>
      </div>

      {feedback ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-2xl border border-border bg-card p-6 text-center shadow-sm"
        >
          <p className="text-xl font-semibold text-foreground">{feedback}</p>
        </motion.div>
      ) : (
        <div className="relative grid grid-cols-1 gap-3 sm:grid-cols-2">
          {options.map((option) => (
            <motion.button
              key={option.label}
              whileTap={{ scale: 0.94 }}
              whileHover={{ scale: 1.03 }}
              onClick={() => handleOption(option)}
              aria-label={`${option.label} request`}
              className="touch-target flex items-center gap-3 rounded-2xl border-2 border-border bg-card px-4 py-4 text-left shadow-sm transition-colors hover:border-primary"
            >
              <span aria-hidden="true" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-muted text-3xl">{option.emoji}</span>
              <span className="text-sm font-semibold leading-snug text-foreground">{option.label}</span>
            </motion.button>
          ))}
          <BurstLayer bursts={bursts} />
        </div>
      )}
    </div>
  );
}