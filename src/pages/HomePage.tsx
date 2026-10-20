import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Heart, HeartHandshake, Hospital, Stethoscope } from "lucide-react";
import { useState } from "react";
import BlobCritter from "@/components/home/BlobCritter";
import type { CritterMood, CritterShape } from "@/components/home/BlobCritter";
import TermsModal from "@/components/TermsModal";
import InstallAppHint from "@/components/InstallAppHint";
import BackToTop from "@/components/BackToTop";

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
  { icon: "stethoscope", title: "Therapists", body: "Assign homework & classwork, tune games per child, approve progression, and review outcome reports." },
  { icon: "family", title: "Families", body: "See today's session, play together at home, and send results straight back to the care team." },
  { icon: "clinic", title: "Clinics", body: "Manage staff access, family onboarding, caseloads, and audit activity — clinic-ready from day one." },
];

const audienceIcons = {
  stethoscope: Stethoscope,
  family: HeartHandshake,
  clinic: Hospital,
} as const;

const stats = [
  { value: "192", label: "structured activities" },
  { value: "3", label: "roles: therapist, family, admin" },
  { value: "AAC", label: "enabled & supported" },
];

const team = [
  { id: "erion", name: "Erion Beka", initials: "EB", color: "hsl(199 60% 45%)", roleKey: "teamRoleCeo", bioKey: "teamBioErion" },
  { id: "ilirjana", name: "Ilirjana Gjetaj", initials: "IG", color: "hsl(142 40% 40%)", roleKey: "teamRoleCofounder", bioKey: "teamBioIlirjana" },
  { id: "loris", name: "Loris Canolli", initials: "LC", color: "hsl(260 45% 52%)", roleKey: "teamRoleCofounder", bioKey: "teamBioLoris" },
  { id: "saimir", name: "Saimir Balaj", initials: "SB", color: "hsl(15 75% 52%)", roleKey: "teamRoleCofounder", bioKey: "teamBioSaimir" },
  { id: "altin", name: "Altin Millaku", initials: "AM", color: "hsl(35 80% 45%)", roleKey: "teamRoleCofounder", bioKey: "teamBioAltin" },
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
    email: "bekaerion@gmail.com",
    ready: "Ready to play?",
    readyBody: "Open the app to choose your role — therapist, family, or clinic admin.",
    aboutUs: "About us",
    teamRoleCeo: "CEO & Co-founder",
    teamRoleCofounder: "Co-founder",
    teamBioErion:
      "Erion leads Playground Life from Prishtina, Kosovo. He works in IT and security, and has been building the platform evenings and weekends since April 2025.",
    teamBioIlirjana:
      "Co-founder. Ilirjana was part of the original team that started Playground Life at the pristina.innovate.healthcare hackathon in April 2025, and helps shape how the product works for families.",
    teamBioLoris:
      "Co-founder. Loris was part of the original team that started Playground Life at the pristina.innovate.healthcare hackathon in April 2025.",
    teamBioSaimir:
      "Co-founder. Saimir was part of the original team that started Playground Life at the pristina.innovate.healthcare hackathon in April 2025.",
    teamBioAltin:
      "Co-founder. Altin was part of the original team that started Playground Life at the pristina.innovate.healthcare hackathon in April 2025.",
    footerCopy: "Play Together, Grow Together · AAC-enabled guided play",
    terms: "Terms & Conditions",
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
    email: "bekaerion@gmail.com",
    ready: "Gati për të luajtur?",
    readyBody: "Hap aplikacionin për të zgjeruar rolin — terapist, familje, ose admin i klinikës.",
    aboutUs: "Rreth nesh",
    teamRoleCeo: "CEO & Co-fondues",
    teamRoleCofounder: "Co-fondues",
    teamBioErion:
      "Erion e drejton Playground Life nga Prishtina, Kosova. Ai punon në IT dhe siguri, dhe ndërton platformën mbrëmjeve dhe fundjavave që nga prilli 2025.",
    teamBioIlirjana:
      "Co-fondues. Ilirjana ishte pjesë e ekipit që themeloi Playground Life në hackathon-in pristina.innovate.healthcare në prill 2025, dhe ndihmon në formësimin e produktit për familjet.",
    teamBioLoris:
      "Co-fondues. Loris ishte pjesë e ekipit që themeloi Playground Life në hackathon-in pristina.innovate.healthcare në prill 2025.",
    teamBioSaimir:
      "Co-fondues. Saimir ishte pjesë e ekipit që themeloi Playground Life në hackathon-in pristina.innovate.healthcare në prill 2025.",
    teamBioAltin:
      "Co-fondues. Altin ishte pjesë e ekipit që themeloi Playground Life në hackathon-in pristina.innovate.healthcare në prill 2025.",
    footerCopy: "Luajmë Së Bashku, Rritemi Së Bashku · Lojë e udhëhequr me AAC",
    terms: "Termat e Përdorimit",
  },
};

export default function HomePage() {
  const navigate = useNavigate();
  const [lang, setLang] = useState<Lang>("en");
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
      try { localStorage.setItem("pl_liked", next ? "1" : "0"); } catch { /* storage unavailable */ }
      setLikes((c) => {
        const nextC = next ? c + 1 : Math.max(0, c - 1);
        try { localStorage.setItem("pl_likes", String(nextC)); } catch { /* storage unavailable */ }
        return nextC;
      });
      return next;
    });
  };

  return (
    <div className="relative z-10 mx-auto min-h-screen max-w-5xl px-4 pb-12 pt-8 sm:px-6">
      <TermsModal lang={lang} />
      <InstallAppHint lang={lang} />
      <BackToTop />

      <motion.header
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: EASE }}
        className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3"
      >
        <span className="font-display text-lg font-extrabold text-foreground">Playground Life</span>
        <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
          <button
            onClick={() => setLang(lang === "en" ? "sq" : "en")}
            className="touch-target inline-flex items-center justify-center rounded-full border border-border px-3 py-1 text-xs font-bold capitalize transition hover:bg-accent"
          >
            {lang === "en" ? "SQ" : "EN"}
          </button>
          <button
            onClick={() => toggleLike()}
            aria-pressed={liked}
            className={`touch-target inline-flex items-center justify-center rounded-full border px-3 py-1.5 text-xs font-bold transition ${liked ? "bg-accent text-accent-foreground border-accent" : "border-border text-muted-foreground hover:bg-accent/10"}`}
            title={liked ? t("liked") : t("like")}
          >
            <Heart size={13} className={liked ? "text-accent-foreground" : "text-muted-foreground"} />
            <span className="pl-1">{likes}</span>
          </button>
          <a
            href={`mailto:${t("email")}`}
            className="touch-target inline-flex items-center justify-center rounded-full border border-border px-3 py-1 text-xs font-bold transition hover:bg-accent/10"
          >
            {t("contactBtn")}
          </a>
          <a
            href="#about-us"
            className="touch-target inline-flex items-center justify-center rounded-full border border-border px-3 py-1 text-xs font-bold transition hover:bg-accent/10"
          >
            {t("about")}
          </a>
          <button
            onClick={() => navigate("/enter")}
            className="touch-target inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-[0_10px_30px_rgba(77,170,206,0.3)] transition-transform hover:scale-105 active:scale-95"
          >
            {t("openApp")}
          </button>
        </div>
      </motion.header>

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
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                {(() => {
                  const Icon = audienceIcons[audience.icon as keyof typeof audienceIcons];
                  return <Icon size={24} strokeWidth={2} aria-hidden="true" />;
                })()}
              </div>
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
        <div className="mt-10 flex flex-wrap justify-center gap-5">
          {team.map((member, index) => (
            <motion.div
              key={member.id}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.55, delay: index * 0.06, ease: EASE }}
              className="flex w-[calc(50%-0.625rem)] flex-col items-center rounded-2xl border border-white/50 bg-card/85 p-4 text-center shadow-sm backdrop-blur-sm sm:w-[calc(33.333%-0.833rem)] sm:p-5 lg:w-[calc(20%-1rem)]"
            >
              <div className="relative">
                <div
                  aria-hidden
                  className="absolute -inset-1.5 rounded-[46%_54%_58%_42%_/_52%_40%_60%_48%] opacity-40 blur-lg"
                  style={{ background: `linear-gradient(135deg, ${member.color}, hsl(10 70% 75%))` }}
                />
                <div
                  className="relative flex size-20 items-center justify-center overflow-hidden rounded-[46%_54%_58%_42%_/_52%_40%_60%_48%] border sm:size-24"
                  style={{ borderColor: `${member.color}59`, background: `${member.color}1a` }}
                >
                  <span className="font-display text-2xl font-extrabold sm:text-3xl" style={{ color: member.color }}>
                    {member.initials}
                  </span>
                </div>
              </div>
              <h3 className="mt-4 font-display text-sm font-bold text-foreground sm:text-base">{member.name}</h3>
              <p className="mt-0.5 text-[0.7rem] font-bold uppercase tracking-wide text-primary sm:text-xs">
                {t(member.roleKey)}
              </p>
              <p className="mt-2 text-xs leading-snug text-muted-foreground">{t(member.bioKey)}</p>
            </motion.div>
          ))}
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
