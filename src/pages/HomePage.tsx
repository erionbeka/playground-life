import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import BlobCritter from "@/components/home/BlobCritter";
import type { CritterMood, CritterShape } from "@/components/home/BlobCritter";

const heroCritter = {
  shape: "cat" as CritterShape,
  color: "hsl(199 60% 52%)",
  blush: "hsl(10 70% 75%)",
};

const pals: { shape: CritterShape; color: string; blush: string; caption: string; sub: string; mood: CritterMood }[] = [
  { shape: "cat", color: "hsl(199 60% 52%)", blush: "hsl(10 70% 75%)", caption: "Play", sub: "192 guided activities across matching, sequencing, emotions & more", mood: "play" },
  { shape: "frog", color: "hsl(142 40% 58%)", blush: "hsl(10 70% 75%)", caption: "Grow", sub: "Explainable personalization that meets each child exactly where they are", mood: "grow" },
  { shape: "bunny", color: "hsl(260 40% 72%)", blush: "hsl(25 80% 70%)", caption: "Communicate", sub: "AAC-enabled play — speak, point, symbol, switch, dwell or tap", mood: "communicate" },
  { shape: "bear", color: "hsl(25 80% 65%)", blush: "hsl(10 70% 78%)", caption: "Connect", sub: "A simple loop between therapist goals and family play at home", mood: "connect" },
  { shape: "bird", color: "hsl(45 90% 62%)", blush: "hsl(10 70% 75%)", caption: "Feel safe", sub: "Sensory-friendly by default — calm mode, no timers, no failures", mood: "safe" },
];

const audiences = [
  { emoji: "🧑‍⚕️", title: "Therapists", body: "Assign homework & classwork, tune games per child, approve progression, and review outcome reports." },
  { emoji: "👪", title: "Families", body: "See today's session, play together at home, and send results straight back to the care team." },
  { emoji: "🏥", title: "Clinics", body: "Manage staff access, family onboarding, caseloads, and audit activity — clinic-ready from day one." },
];

const stats = [
  { value: "192", label: "structured activities" },
  { value: "3", label: "roles: therapist, family, admin" },
  { value: "AAC", label: "enabled & supported" },
];

export default function HomePage() {
  const navigate = useNavigate();

  return (
    <div className="relative z-10 mx-auto min-h-screen max-w-5xl px-4 pb-12 pt-8 sm:px-6">
      <motion.header
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex items-center justify-between"
      >
        <span className="font-display text-lg font-extrabold text-foreground">Playground Life</span>
        <button
          onClick={() => navigate("/enter")}
          className="touch-target rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-[0_10px_30px_rgba(77,170,206,0.3)] transition-transform hover:scale-105 active:scale-95"
        >
          Open the app
        </button>
      </motion.header>

      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
        className="mt-10 flex flex-col items-center gap-8 text-center sm:mt-16 sm:flex-row sm:gap-12 sm:text-left"
      >
        <div className="flex justify-center sm:order-2">
          <BlobCritter
            shape={heroCritter.shape}
            color={heroCritter.color}
            blush={heroCritter.blush}
            size={210}
            grabCursor
            label="A friendly blue blob cat mascot that tries to playfully grab your cursor"
          />
        </div>
        <div className="sm:order-1">
          <h1 className="font-display text-4xl font-extrabold leading-tight text-foreground sm:text-5xl">
            Play Together,
            <br />
            Grow Together
          </h1>
          <p className="mt-4 text-base text-muted-foreground sm:text-lg">
            AAC-enabled guided play for home and clinic. Kids play joyful games — therapists and families
            get the signals that help them grow.
          </p>
          <button
            onClick={() => navigate("/enter")}
            className="touch-target mt-6 rounded-2xl bg-primary px-7 py-3.5 text-base font-bold text-primary-foreground shadow-[0_14px_40px_rgba(77,170,206,0.32)] transition-transform hover:scale-105 active:scale-95"
          >
            Open the app →
          </button>
        </div>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="mt-14 grid grid-cols-3 gap-3 sm:gap-4"
      >
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl border border-white/50 bg-card/85 p-4 text-center shadow-sm backdrop-blur-sm sm:p-5"
          >
            <div className="font-display text-2xl font-extrabold text-primary sm:text-3xl">{stat.value}</div>
            <div className="mt-1 text-xs text-muted-foreground sm:text-sm">{stat.label}</div>
          </div>
        ))}
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.25 }}
        className="mt-14 rounded-3xl border border-white/50 bg-card/85 p-6 shadow-sm backdrop-blur-sm sm:p-8"
      >
        <h2 className="font-display text-2xl font-extrabold text-foreground sm:text-3xl">What we do</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
          Playground Life is a clinic-ready platform for assigning, playing, and reviewing structured
          learning activities for autistic children. Children play — every tap is measured quietly in the
          background. The platform turns those taps into signals: independence, speed, prompts needed,
          regulation. Therapists read the signals and adjust support; the next session meets the child
          exactly where they are.
        </p>
      </motion.section>

      <section className="mt-14" aria-labelledby="play-pals-heading">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="text-center"
        >
          <h2 id="play-pals-heading" className="font-display text-2xl font-extrabold text-foreground sm:text-3xl">
            Meet the play pals
          </h2>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">
            The little blob friends who show up in every session
          </p>
        </motion.div>
        <div className="mt-8 flex flex-wrap items-stretch justify-center gap-4 sm:gap-5">
          {pals.map((pal, index) => (
            <motion.div
              key={pal.caption}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.35 + index * 0.08 }}
              className="flex w-40 flex-col items-center rounded-2xl border border-white/50 bg-card/80 p-4 text-center shadow-sm backdrop-blur-sm sm:w-44"
            >
              <BlobCritter
                shape={pal.shape}
                color={pal.color}
                blush={pal.blush}
                size={110}
                phase={index * 1.3}
                mood={pal.mood}
                label={`${pal.caption} blob pal`}
              />
              <h3 className="mt-2 font-display text-base font-bold text-foreground">{pal.caption}</h3>
              <p className="mt-1 text-xs leading-snug text-muted-foreground">{pal.sub}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="mt-14" aria-labelledby="who-heading">
        <motion.h2
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          id="who-heading"
          className="text-center font-display text-2xl font-extrabold text-foreground sm:text-3xl"
        >
          Who it's for
        </motion.h2>
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-5">
          {audiences.map((audience, index) => (
            <motion.div
              key={audience.title}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.45 + index * 0.08 }}
              className="rounded-2xl border border-white/50 bg-card/85 p-5 shadow-sm backdrop-blur-sm sm:p-6"
            >
              <div className="mb-3 text-4xl">{audience.emoji}</div>
              <h3 className="font-display text-lg font-bold text-foreground">{audience.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{audience.body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.55 }}
        className="mt-14 rounded-3xl bg-primary/95 p-8 text-center shadow-[0_18px_50px_rgba(77,170,206,0.28)] backdrop-blur-sm sm:p-10"
      >
        <div className="mb-4 flex justify-center">
          <BlobCritter shape="frog" color="hsl(142 40% 58%)" blush="hsl(10 70% 75%)" size={90} phase={2.7} label="Green blob frog cheering you on" />
        </div>
        <h2 className="font-display text-2xl font-extrabold text-primary-foreground sm:text-3xl">
          Ready to play?
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-primary-foreground/85 sm:text-base">
          Open the app to choose your role — therapist, family, or clinic admin.
        </p>
        <button
          onClick={() => navigate("/enter")}
          className="touch-target mt-6 rounded-2xl bg-white px-7 py-3.5 text-base font-bold text-primary shadow-lg transition-transform hover:scale-105 active:scale-95"
        >
          Open the app →
        </button>
      </motion.section>

      <motion.footer
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.6 }}
        className="mt-14 border-t border-border/60 pt-6 text-center"
      >
        <p className="font-display text-sm font-bold text-foreground">Playground Life</p>
        <p className="mt-1 text-xs text-muted-foreground">Play Together, Grow Together · AAC-enabled guided play</p>
        <p className="mt-3 text-xs text-muted-foreground">© 2026 Playground Life. All rights reserved.</p>
      </motion.footer>
    </div>
  );
}
