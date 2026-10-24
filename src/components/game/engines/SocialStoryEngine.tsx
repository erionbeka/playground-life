import { useState, useMemo } from "react";
import { GameConfig } from "@/data/games";
import { speak } from "@/lib/speech";
import LearningLabel from "../LearningLabel";
import RoundProgress from "../RoundProgress";
import { useGameAudio } from "../useGameAudio";
import { BurstLayer, useBursts } from "../Juice";

interface Props {
  game: GameConfig;
  onInteraction: () => void;
  onComplete: (score: number, socialScore?: number) => void;
}

interface StoryScenario {
  title: string;
  situation: string;
  emoji: string;
  choices: {
    text: string;
    emoji: string;
    correct: boolean;
    feedback: string;
  }[];
}

const SOCIAL_SCENARIOS: StoryScenario[] = [
  {
    title: "Sharing at Play",
    situation: "Blob wants to play with the red fire truck, but Sam is already holding it. What should Blob do?",
    emoji: "🚒",
    choices: [
      { text: "Ask politely: 'Can I have a turn when you're done?'", emoji: "🗣️", correct: true, feedback: "Great job! Asking politely is a kind and successful choice." },
      { text: "Grab the toy away", emoji: "✋", correct: false, feedback: "That might upset Sam. Let's try asking with words instead." },
      { text: "Find another fun toy to play with together", emoji: "🧸", correct: true, feedback: "Wonderful teamwork! Playing together is super fun." }
    ]
  },
  {
    title: "Waiting Patiently",
    situation: "Blob is standing in line for the slide, but there are two friends ahead. What should Blob do?",
    emoji: "🛝",
    choices: [
      { text: "Count slowly and wait for the turn", emoji: "⏳", correct: true, feedback: "Awesome patience! Taking turns keeps games safe and fun." },
      { text: "Push ahead in line", emoji: "🏃", correct: false, feedback: "Everyone gets a turn if we wait patiently in line." },
      { text: "Cheer for friends going down the slide", emoji: "🙌", correct: true, feedback: "So kind! Cheering for friends makes everyone happy." }
    ]
  },
  {
    title: "Handling Changes",
    situation: "It is time to clean up blocks and go outside, but Blob wants to keep building. What should Blob do?",
    emoji: "🧱",
    choices: [
      { text: "Take a deep breath and help clean up", emoji: "🌬️", correct: true, feedback: "Fantastic self-control! Outside play awaits us." },
      { text: "Throw the blocks on the floor", emoji: "💥", correct: false, feedback: "Throwing toys isn't safe. Let's take a calm breath together." },
      { text: "Ask: 'Can we build this again tomorrow?'", emoji: "📅", correct: true, feedback: "Great problem-solving! Planning ahead makes transitions easy." }
    ]
  }
];

export default function SocialStoryEngine({ game, onInteraction, onComplete }: Props) {
  const scenarios = useMemo(() => {
    const custom = game.config.scenarios as StoryScenario[] | undefined;
    return custom && custom.length > 0 ? custom : SOCIAL_SCENARIOS;
  }, [game.config.scenarios]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [scoreAcc, setScoreAcc] = useState(100);
  const { playCelebrationSound, playTapSound } = useGameAudio();
  const { bursts, fireBurst } = useBursts();

  const currentScenario = scenarios[currentIndex];

  const handleSelect = (index: number, choice: typeof currentScenario.choices[0], event: React.MouseEvent<HTMLButtonElement>) => {
    if (selectedChoice !== null) return;
    onInteraction();
    setSelectedChoice(index);
    setMessage(choice.feedback);
    speak(choice.feedback);

    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.round((rect.left + rect.width / 2 / window.innerWidth) * 100);
    const y = Math.round((rect.top / window.innerHeight) * 100);

    if (choice.correct) {
      playTapSound();
      fireBurst(x, y, "⭐");
      window.setTimeout(() => {
        if (currentIndex + 1 < scenarios.length) {
          setCurrentIndex((prev) => prev + 1);
          setSelectedChoice(null);
          setMessage(null);
        } else {
          playCelebrationSound();
          onComplete(scoreAcc, 95);
        }
      }, 1400);
    } else {
      setScoreAcc((prev) => Math.max(40, prev - 15));
      window.setTimeout(() => {
        setSelectedChoice(null);
        setMessage(null);
      }, 1600);
    }
  };

  return (
    <div className="mx-auto max-w-xl px-4 py-3 relative">
      <BurstLayer bursts={bursts} />
      <div className="mb-4 flex items-center justify-between">
        <LearningLabel game={game} />
        <RoundProgress current={currentIndex} total={scenarios.length} />
      </div>

      <div className="mb-6 rounded-3xl bg-card border border-border p-6 text-center shadow-lg relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-primary/10 blur-2xl pointer-events-none"></div>
        <span className="text-6xl mb-3 block">{currentScenario.emoji}</span>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">Blob's Social Adventure</p>
        <h2 className="mt-1 font-display text-2xl font-extrabold text-foreground">{currentScenario.title}</h2>
        <p className="mt-3 text-base font-semibold text-foreground/90 bg-muted/60 p-4 rounded-2xl border border-border/60">
          {currentScenario.situation}
        </p>
      </div>

      {message && (
        <div className="mb-5 rounded-2xl bg-secondary/20 border border-secondary p-4 text-center text-sm font-bold text-foreground animate-bounce-gentle">
          {message}
        </div>
      )}

      <div className="space-y-3">
        {currentScenario.choices.map((choice, idx) => {
          const isSelected = selectedChoice === idx;
          const isCorrect = choice.correct;

          let btnStyle = "border-border bg-card hover:border-primary hover:bg-primary/5";
          if (selectedChoice !== null) {
            if (isSelected) {
              btnStyle = isCorrect ? "border-emerald-500 bg-emerald-50 text-emerald-950 font-bold" : "border-rose-400 bg-rose-50 text-rose-950 font-bold animate-pulse";
            } else {
              btnStyle = "border-border bg-card opacity-50";
            }
          }

          return (
            <button
              key={idx}
              onClick={(e) => handleSelect(idx, choice, e)}
              disabled={selectedChoice !== null}
              className={`w-full touch-target flex items-center gap-4 rounded-3xl border-2 p-5 text-left transition-all shadow-sm ${btnStyle}`}
            >
              <span className="text-3xl flex-shrink-0">{choice.emoji}</span>
              <span className="text-base font-bold text-foreground flex-grow">{choice.text}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
