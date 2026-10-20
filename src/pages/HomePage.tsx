import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Heart } from "lucide-react";
import { useState } from "react";
import BlobCritter from "@/components/home/BlobCritter";
import type { CritterMood, CritterShape } from "@/components/home/BlobCritter";

const EASE = [0.22, 1, 0.36, 1] as const;

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

type Lang = "en" | "sq";

const TEXTS: Record<Lang, Record<string, string>> = {
  en: {
    brand: "Playground Life",
    openApp: "Open the app",
    like: "Like",
    liked: "Liked",
    contactBtn: "Contact",
    about: "About us",
    heroHeadline: "Play Together, Grow Together",
    heroSub: "AAC-enabled guided play for home and clinic. Kids play joyful games — therapists and families get the signals that help them grow.",
    whatWeDo: "What we do",
    whatWeDoBody:
      "Playground Life is a clinic-ready platform for assigning, playing, and reviewing structured learning activities for autistic and neurodivergent children, including those with late development. Children play — every tap is measured quietly in the background. The platform turns those taps into signals: independence, speed, regulation. Therapists read the signals and adjust support; the next session meets the child exactly where they are.",
    pals: "Meet the play pals",
    palsSub: "The little blob friends who show up in every session",
    whoFor: "Who it's for",
    contact: "Contact us for a demo",
    contactBody: "Want to see Playground Life in action before you commit? Book a demo of the product with our team.",
    emailLabel: "Demo requests & questions:",
    email: "info@playground-life.com",
    ready: "Ready to play?",
    readyBody: "Open the app to choose your role — therapist, family, or clinic admin.",
    aboutUs: "About us",
    ceo: "Erion Beka — CEO & Co-founder",
    ceoBio:
      "Erion leads Playground Life out of Prishtina, Kosovo. He is Support Team Leader at insteap (2024–present), was IT Support Specialist at Pc Kosovo (2022–2024), and started as an IT Support Technician in 2022. He holds a Bachelor's degree (2018–2021), with certifications in API Security Fundamentals, Junior Cybersecurity Analyst, and Cisco Digital Healthcare & Wellbeing (eHealth). He is also a student at Kolegji Riinvest and builds software end-to-end — TypeScript, Node, React, Postgres, and mobile.",
    ceoHackathon:
      "Playground Life began as an idea at the pristina.innovate.healthcare hackathon (April 2025) with teammates Ilirjana Gjetaj, Loris Canolli, Saimir Balaj and Altin Millaku. Erion then built the full product himself: a clinic-ready backend with real authentication, role-based authorization, Argon2id password hashing, audit logging and structured clinical data — plus this frontend.",
    ceoInvestor:
      "For investors: Erion runs security-hardened support operations full-time while shipping Playground Life nights and weekends. The platform already stores clinics, users, child profiles, goals, assignments and results in PostgreSQL, and is built to scale with therapy providers.",
    footerCopy: "Play Together, Grow Together · AAC-enabled guided play",
    terms: "Terms & Conditions",
    termsAcceptBody:
      "By continuing you accept our {terms}, which cover use of the platform, data handling, responsibilities, and disclaimers. You can review them anytime at /terms.",
  },
  sq: {
    brand: "Playground Life",
    openApp: "Hap aplikacionin",
    like: "Do",
    liked: "E duar",
    contactBtn: "Kontakt",
    about: "Rreth nesh",
    heroHeadline: "Luajmë Së Bashku, Rritemi Së Bashku",
    heroSub: "Lojë e udhëhequr me AAC për shtëpi dhe klinikë. Fëmijët luajnë lojëra të gëzueshme — terapistët dhe familjet marrin sinjalet që ndihmojnë rritjen.",
    whatWeDo: "Çfarë bëjmë",
    whatWeDoBody:
      "Playground Life është një platformë e gatshme për klinikë për caktimin, luajtjen dhe rishikimin e aktiviteteve të strukturuar të nxënit për fëmijë autistë dhe neurodivergjentë, përfshirë ata me zhvillim të vonuar. Fëmijët luajnë — çdo prekje matet qetësisht në sfond. Platforma i kthen ato prekje në sinjale: pavarësi, shpejtësi, rregullim. Terapistët i lexojnë sinjalet dhe rregullojnë mbështetjen; seanca tjetër takon fëmijën pikërisht aty ku është.",
    pals: "Njihuni me shokët e lojës",
    palsSub: "Shokët e vogël blob që qenë në çdo seancë",
    whoFor: "Për kush është",
    contact: "Kontaktoni ne për demo",
    contactBody: "Doni ta shihni Playground Life në veprim para se të komituoni? Rezervoni një demo të produktit me ekipën tonë.",
    emailLabel: "Kërkesa demo & pyetje:",
    email: "info@playground-life.com",
    ready: "Gati për të luajtur?",
    readyBody: "Hap aplikacionin për të zgjeruar rolin — terapist, familje, ose admin i klinikës.",
    aboutUs: "Rreth nesh",
    ceo: "Erion Beka — CEO & Co-fondues",
    ceoBio:
      "Erion e ngarkon Playground Life nga Prishtina, Kosova. Ai është Support Team Leader në insteap (2024–tani), ishte IT Support Specialist në Pc Kosovo (2022–2024), dhe filloi si IT Support Technician në 2022. Ai ka diplomë Bachelor (2018–2021), me certifikime në API Security Fundamentals, Junior Cybersecurity Analyst, dhe Cisco Digital Healthcare & Wellbeing (eHealth). Ai është Student në Kolegj Riinvest dhe kujdeset nga software në fund — TypeScript, Node, React, Postgres, dhe mobile.",
    ceoHackathon:
      "Playground Life filloi si ide në hackathon-in pristina.innovate.healthcare (prill 2025) me qashtërit Ilirjana Gjetaj, Loris Canolli, Saimir Balaj dhe Altin Millaku. Erion pastërt veçanërisht produktin e plotë: një backend i gatshme për klinikë me auth real, autorizim bazë rolet, Argon2id, logu auditing dhe të dhëna klinike — dhe këtë frontend.",
    ceoInvestor:
      "Për investitorë: Erion të drejtohet operacionin sigurtë full-time ndërsa dorëzon Playground Life ditët e hershja e ditëve të sie. Platforma tashmë ruajt klinika, përdorues, profila fëmijësh, vlefshmet, asignime dhe rezultate në PostgreSQL, dhe është i gatshëm për të skaleruar me furnizuesit e terapisë.",
    footerCopy: "Luajmë Së Bashku, Rritemi Së Bashku · Lojë e udhëhequr me AAC",
    terms: "Termat e Përdorimit",
    termsAcceptBody: "Duam vazhdim pranohet tërmat tona {terms}, mbrojtje të dhënave, rëollet dhe deklaratat. Mund e rishikoni çdoherë në /terms.",
  },
};

export default function HomePage() {
  const navigate = useNavigate();
  const [lang, setLang] = useState<Lang>("en");
  const [termsAccepted, setTermsAccepted] = useState(() => {
    try { return localStorage.getItem("pl_terms_accepted") === "1"; } catch { return false; }
  });
  const [likes, setLikes] = useState(() => {
    try { return Number(localStorage.getItem("pl_likes") || "0"); } catch { return 0; }
  });
  const [liked, setLiked] = useState(() => {
    try { return localStorage.getItem("pl_liked") === "1"; } catch { return false; }
  });

  const t = (key: string) => TEXTS[lang][key] || key;

  const toggleLike = () => {
    setLiked((l) => {
      const next = !l;
      try { localStorage.setItem("pl_liked", next ? "1" : "0"); } catch {}
      setLikes((c) => {
        const nextC = next ? c + 1 : Math.max(0, c - 1);
        try { localStorage.setItem("pl_likes", String(nextC)); } catch {}
        return nextC;
      });
      return next;
    });
  };

  const acceptTerms = () => {
    try { localStorage.setItem("pl_terms_accepted", "1"); } catch {}
    setTermsAccepted(true);
  };

  return (
    <div className="relative z-10 mx-auto min-h-screen max-w-5xl px-4 pb-12 pt-8 sm:px-6">
      <motion.header
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: EASE }}
        className="flex items-center justify-between"
      >
        <span className="font-display text-lg font-extrabold text-foreground">Playground Life</span>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setLang(lang === "en" ? "sq" : "en")}
            className="touch-target rounded-full border border-border px-3 py-1 text-xs font-bold capitalize transition hover:bg-accent"
          >
            {lang === "en" ? "SQ" : "EN"}
          </button>
          <button
            onClick={() => toggleLike()}
            aria-pressed={liked}
            className={`touch-target rounded-full border px-3 py-1.5 text-xs font-bold transition ${liked ? "bg-accent text-accent-foreground border-accent" : "border-border text-muted-foreground hover:bg-accent/10"}`}
            title={liked ? t("liked") : t("like")}
          >
            <Heart size={13} className={liked ? "text-accent-foreground" : "text-muted-foreground"} />
            <span className="pl-1">{likes}</span>
          </button>
          <a
            href="mailto:info@playground-life.com"
            className="touch-target rounded-full border border-border px-3 py-1 text-xs font-bold transition hover:bg-accent/10"
          >
            {t("contactBtn")}
          </a>
          <a
            href="#about-us"
            className="touch-target rounded-full border border-border px-3 py-1 text-xs font-bold transition hover:bg-accent/10"
          >
            {t("about")}
          </a>
          <button
            onClick={() => navigate("/enter")}
            className="touch-target rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-[0_10px_30px_rgba(77,170,206,0.3)] transition-transform hover:scale-105 active:scale-95"
          >
            {t("openApp")}
          </button>
        </div>
      </motion.header>

      {!termsAccepted && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <div className="rounded-2xl border border-border bg-background p-6 shadow-2xl w-full max-w-lg">
            <h2 className="font-display text-xl font-extrabold text-foreground mb-2">{t("terms")}</h2>
            <p className="text-sm text-muted-foreground mb-4">
              {t("termsAcceptBody").replace("{terms}", `<a href="/terms" className="text-primary underline hover:text-primary/80">Terms & Conditions</a>`)}
            </p>
            <div className="flex items-center gap-3 mt-6">
              <input
                id="terms-checkbox"
                type="checkbox"
                checked={termsAccepted}
                onChange={() => setTermsAccepted((a) => !a)}
                className="rounded border-input bg-background text-primary shadow-sm focus:border-primary focus:ring focus:ring-primary"
              />
              <label htmlFor="terms-checkbox" className="text-sm text-foreground cursor-pointer select-none">
                I have read and accept the Terms & Conditions
              </label>
            </div>
            <button
              onClick={acceptedTerms}
              disabled={!termsAccepted}
              className="mt-5 rounded-2xl bg-primary px-7 py-3 text-base font-bold text-primary-foreground shadow-lg transition-transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
            >
            {t("openApp")}
            </button>
          </div>
        </motion.div>
      )}

      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.1, ease: EASE }}
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
            {t("heroHeadline")}
          </h1>
          <p className="mt-4 text-base text-muted-foreground sm:text-lg">
            {t("heroSub")}
          </p>
          <button
            onClick={() => navigate("/enter")}
            className="touch-target mt-6 rounded-2xl bg-primary px-7 py-3.5 text-base font-bold text-primary-foreground shadow-[0_14px_40px_rgba(77,170,206,0.32)] transition-transform hover:scale-105 active:scale-95"
          >
            {t("openApp")} →
          </button>
        </div>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.2, ease: EASE }}
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
        transition={{ duration: 0.7, delay: 0.25, ease: EASE }}
        className="mt-14 rounded-3xl border border-white/50 bg-card/85 p-6 shadow-sm backdrop-blur-sm sm:p-8"
      >
        <h2 className="font-display text-2xl font-extrabold text-foreground sm:text-3xl">{t("whatWeDo")}</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
          {t("whatWeDoBody")}
        </p>
      </motion.section>

      <section className="mt-14" aria-labelledby="play-pals-heading">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3, ease: EASE }}
          className="text-center"
        >
          <h2 id="play-pals-heading" className="font-display text-2xl font-extrabold text-foreground sm:text-3xl">
            {t("pals")}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">{t("palsSub")}</p>
        </motion.div>
        <div className="mt-8 flex flex-wrap items-stretch justify-center gap-4 sm:gap-5">
          {pals.map((pal, index) => (
            <motion.div
              key={pal.caption}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, delay: 0.35 + index * 0.08, ease: EASE }}
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
          transition={{ duration: 0.7, delay: 0.4, ease: EASE }}
          id="who-heading"
          className="text-center font-display text-2xl font-extrabold text-foreground sm:text-3xl"
        >
          {t("whoFor")}
        </motion.h2>
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-5">
          {audiences.map((audience, index) => (
            <motion.div
              key={audience.title}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, delay: 0.45 + index * 0.08, ease: EASE }}
              className="rounded-2xl border border-white/50 bg-card/85 p-5 shadow-sm backdrop-blur-sm sm:p-6"
            >
              <div className="mb-3 text-4xl">{audience.emoji}</div>
              <h3 className="font-display text-lg font-bold text-foreground">{audience.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{audience.body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="mt-16" aria-labelledby="contact-heading">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.5, ease: EASE }}
          className="text-center"
        >
          <h2 id="contact-heading" className="font-display text-2xl font-extrabold text-foreground sm:text-3xl">
            {t("contact")}
          </h2>
        </motion.div>
        <div className="mt-8 rounded-3xl border border-white/50 bg-card/85 p-6 shadow-sm backdrop-blur-sm sm:p-10 sm:flex sm:items-center sm:justify-between">
          <div className="text-center sm:text-left">
            <h3 className="font-display text-lg font-bold text-foreground sm:text-xl">{t("contactBody")}</h3>
            <p className="mt-2 text-sm text-muted-foreground sm:text-base">{t("emailLabel")}</p>
            <p className="mt-1 font-mono text-sm font-bold text-primary">{t("email")}</p>
          </div>
          <button
            onClick={() => navigate("/enter")}
            className="mt-6 sm:mt-0 rounded-2xl bg-primary px-7 py-3 text-base font-bold text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95"
          >
            {t("openApp")}
          </button>
        </div>
      </section>

      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.55, ease: EASE }}
        className="mt-14 rounded-3xl bg-primary/95 p-8 text-center shadow-[0_18px_50px_rgba(77,170,206,0.28)] backdrop-blur-sm sm:p-10"
      >
        <div className="mb-4 flex justify-center">
          <BlobCritter shape="frog" color="hsl(142 40% 58%)" blush="hsl(10 70% 75%)" size={90} phase={2.7} label="Green blob frog cheering you on" />
        </div>
        <h2 className="font-display text-2xl font-extrabold text-primary-foreground sm:text-3xl">
          {t("ready")}
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-primary-foreground/85 sm:text-base">
          {t("readyBody")}
        </p>
        <button
          onClick={() => navigate("/enter")}
          className="touch-target mt-6 rounded-2xl bg-white px-7 py-3.5 text-base font-bold text-primary shadow-lg transition-transform hover:scale-105 active:scale-95"
        >
          {t("openApp")} →
        </button>
      </motion.section>

      <section className="mt-16" id="about-us" aria-labelledby="about-heading">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.4, ease: EASE }}
          className="text-center"
        >
          <h2 id="about-heading" className="font-display text-2xl font-extrabold text-foreground sm:text-3xl">
            {t("aboutUs")}
          </h2>
        </motion.div>
        <div className="mt-10 rounded-3xl border border-white/50 bg-card/85 p-6 shadow-sm backdrop-blur-sm sm:p-10 sm:flex sm:items-center sm:gap-8">
          <div className="relative inline-block sm:w-auto">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-accent/20 to-primary/20 rounded-[46%_54%_58%_42%/_52%_40%_60%_48%] blur-xl opacity-60 animate-pulse"></div>
            <div className="relative rounded-[46%_54%_58%_42%/_52%_40%_60%_48%] border border-primary/30 bg-primary/10 p-4 sm:p-8 text-center overflow-hidden">
              <span className="text-6xl sm:text-7xl">EB</span>
            </div>
          </div>
          <div className="mt-8 sm:mt-0 sm:flex-1 text-center sm:text-left">
            <h3 className="font-display text-xl font-bold text-foreground sm:text-2xl">{t("ceo")}</h3>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base whitespace-pre-wrap">{t("ceoBio")}</p>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base whitespace-pre-wrap">{t("ceoHackathon")}</p>
            <p className="mt-4 text-sm font-semibold text-foreground sm:text-base">{t("ceoInvestor")}</p>
          </div>
        </div>
      </section>

      <motion.footer
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.7, delay: 0.6, ease: EASE }}
        className="mt-14 border-t border-border/60 pt-6 text-center"
      >
        <p className="font-display text-sm font-bold text-foreground">Playground Life</p>
        <p className="mt-1 text-xs text-muted-foreground">{t("footerCopy")}</p>
        <p className="mt-3 text-xs text-muted-foreground">© 2026 Playground Life. All rights reserved.</p>
        <div className="mt-4 text-xs text-muted-foreground">
          <a href="/terms" className="text-primary underline hover:text-primary/80">{t("terms")}</a>
          &nbsp;·&nbsp;
          <a href={`mailto:${t("email")}`} className="text-primary underline hover:text-primary/80">{t("email")}</a>
        </div>
      </motion.footer>
    </div>
  );
}
