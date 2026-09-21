import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

const sections = [
  {
    icon: "🔄",
    title: "The loop that helps kids grow",
    body: [
      "Children play games. Every tap is measured quietly in the background.",
      "The platform turns those taps into signals: independence, speed, prompts needed, side preferences, stalls.",
      "You read the signals, adjust support, and the next session meets the child exactly where they are.",
    ],
  },
  {
    icon: "📊",
    title: "What we collect (and why)",
    body: [
      "Every trial: what was shown, what was answered, how fast, and whether a prompt helped.",
      "Independence rate — the % answered correctly with zero help. The therapy goal is watching this climb.",
      "Regulation signals: calm-mode use, breathing breaks, early exits, and pre-game feelings check-ins.",
      "Side-bias, perseveration, long pauses — flagged automatically so nothing important hides in averages.",
    ],
  },
  {
    icon: "🎚️",
    title: "Tailoring a game",
    body: [
      "Select games for homework or classwork, then tap a game's ⚙️ chip to tune it: board size, pace, biggest number, pattern length.",
      "Untuned games adapt automatically using the child's support level and live performance.",
    ],
  },
  {
    icon: "🗓️",
    title: "Suggested session plans",
    body: [
      "Each assignment screen proposes a Warm-up → Core → Stretch plan built from goals, mood check-ins, recent accuracy, and novelty rotation.",
      "Add the whole plan with a few taps, or cherry-pick single games.",
    ],
  },
  {
    icon: "🗂️",
    title: "Caseload management",
    body: [
      "Clinic admins assign every child to a therapist from the Caseloads tab — with live load counts and an audit trail.",
      "Therapists see which kids are on their caseload first; nothing about assignment changes is silent.",
    ],
  },
  {
    icon: "🧘",
    title: "Sensory-safe by default",
    body: [
      "Calm mode removes timers, particles, and shake effects; sound and voice have separate switches; every preference persists per device.",
      "Mastery is opportunity-based: clearing a board always succeeds, and wrong answers become gentle prompts — never failures.",
    ],
  },
  {
    icon: "🧩",
    title: "Where the games come from",
    body: [
      "Mechanics follow autism best practice: errorless learning, discrete trials, generalization variants, and Froebel's play theory (forms of life, beauty, and knowledge).",
      "Every engine reports the same trial format, so new games strengthen the dataset on day one.",
    ],
  },
];

export default function HowItWorks() {
  const navigate = useNavigate();

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-8">
      <button onClick={() => navigate(-1)} className="touch-target mb-6 text-sm text-muted-foreground hover:text-foreground">
        ← Back
      </button>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-display text-3xl font-extrabold text-foreground">How Playground Life works</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          A five-minute read for therapists and families. The short version: kids play, we measure everything that
          matters, and you adjust with one tap.
        </p>
      </motion.div>

      <div className="mt-8 space-y-4">
        {sections.map((section, index) => (
          <motion.section
            key={section.title}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * index }}
            className="rounded-2xl border border-border bg-card/85 p-5 shadow-sm"
          >
            <h2 className="flex items-center gap-2 font-display text-lg font-bold text-foreground">
              <span aria-hidden="true">{section.icon}</span>
              {section.title}
            </h2>
            <div className="mt-2 space-y-1.5">
              {section.body.map((line) => (
                <p key={line} className="text-sm leading-6 text-muted-foreground">{line}</p>
              ))}
            </div>
          </motion.section>
        ))}
      </div>

      <button
        onClick={() => navigate("/therapist")}
        className="touch-target mt-8 w-full rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground shadow-lg transition hover:brightness-105"
      >
        Open the therapist dashboard
      </button>
    </div>
  );
}
