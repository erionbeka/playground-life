import { motion } from "framer-motion";
import { useEffect, useState } from "react";

const ACCEPTED_KEY = "pl_terms_accepted";
const VERSION_KEY = "pl_terms_version";

export const TERMS_VERSION = 1;

export function isTermsAccepted(): boolean {
  try {
    return (
      localStorage.getItem(ACCEPTED_KEY) === "1" &&
      localStorage.getItem(VERSION_KEY) === String(TERMS_VERSION)
    );
  } catch {
    return false;
  }
}

function persistAcceptance() {
  try {
    localStorage.setItem(ACCEPTED_KEY, "1");
    localStorage.setItem(VERSION_KEY, String(TERMS_VERSION));
  } catch {
    /* storage unavailable (private mode) — modal will reappear next visit */
  }
}

type Lang = "en" | "sq";

const COPY: Record<Lang, { title: string; bodyBefore: string; bodyAfter: string; checkbox: string; cta: string }> = {
  en: {
    title: "Terms & Conditions",
    bodyBefore: "Before you continue, please read and accept our ",
    bodyAfter: ", covering use of the platform, data handling, responsibilities, and disclaimers.",
    checkbox: "I have read and accept the Terms & Conditions",
    cta: "Agree & continue",
  },
  sq: {
    title: "Termat e Përdorimit",
    bodyBefore: "Para se të vazhdoni, ju lutemi lexoni dhe pranoni ",
    bodyAfter: ", që mbulojnë përdorimin e platformës, trajtimin e të dhënave, përgjegjësitë dhe deklaratat.",
    checkbox: "I kam lexuar dhe i pranoj Termat e Përdorimit",
    cta: "Prano dhe vazhdo",
  },
};

export default function TermsModal({ lang = "en" }: { lang?: Lang }) {
  const [accepted, setAccepted] = useState(isTermsAccepted);
  const [agreed, setAgreed] = useState(false);
  const copy = COPY[lang] ?? COPY.en;

  useEffect(() => {
    if (accepted) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [accepted]);

  if (accepted) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="terms-modal-title"
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
    >
      <div className="absolute inset-0 bg-foreground/35 backdrop-blur-md" aria-hidden="true" />
      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="relative flex max-h-[85dvh] w-full max-w-md flex-col overflow-y-auto rounded-3xl border border-border bg-background p-6 shadow-2xl sm:p-8"
      >
        <h2 id="terms-modal-title" className="font-display text-xl font-extrabold text-foreground sm:text-2xl">
          {copy.title}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {copy.bodyBefore}
          <a
            href="/terms"
            className="font-semibold text-primary underline underline-offset-2 hover:text-primary/80"
          >
            {copy.title}
          </a>
          {copy.bodyAfter}
        </p>

        <label
          htmlFor="terms-modal-checkbox"
          className="mt-6 flex cursor-pointer select-none items-start gap-3 rounded-2xl border border-border bg-card/70 p-4"
        >
          <input
            id="terms-modal-checkbox"
            type="checkbox"
            checked={agreed}
            onChange={(event) => setAgreed(event.target.checked)}
            className="mt-0.5 size-5 shrink-0 rounded border-input text-primary shadow-sm focus:border-primary focus:ring-primary"
          />
          <span className="text-sm font-semibold leading-snug text-foreground">{copy.checkbox}</span>
        </label>

        <button
          type="button"
          onClick={() => {
            persistAcceptance();
            setAccepted(true);
          }}
          disabled={!agreed}
          className="touch-target mt-5 w-full rounded-2xl bg-primary px-7 py-3 text-base font-bold text-primary-foreground shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          {copy.cta}
        </button>
      </motion.div>
    </motion.div>
  );
}
