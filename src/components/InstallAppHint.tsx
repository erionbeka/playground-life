import { motion } from "framer-motion";
import { Download, X } from "lucide-react";
import { useEffect, useState } from "react";

/** Fill this in once the Google Play listing exists — the hint switches to it automatically. */
export const PLAYSTORE_URL = "";

const DISMISS_KEY = "pl_install_hint_dismissed";

type Lang = "en" | "sq";

const COPY: Record<Lang, { title: string; body: string; iosBody: string; cta: string; dismiss: string }> = {
  en: {
    title: "Install Playground Life",
    body: "Add it to your home screen for a full-screen, app-like experience.",
    iosBody: "Tap the Share button, then choose “Add to Home Screen”.",
    cta: "Install",
    dismiss: "Dismiss install hint",
  },
  sq: {
    title: "Installo Playground Life",
    body: "Shtojeni në ekranin e shtëpisë për një përvojë të plotë, si aplikacion.",
    iosBody: "Shtyp butonin Share, pastaj zgjidhni “Add to Home Screen”.",
    cta: "Installo",
    dismiss: "Mbyll këshillën",
  },
};

type PromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS Safari
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export default function InstallAppHint({ lang = "en" }: { lang?: "en" | "sq" }) {
  const [visible, setVisible] = useState(false);
  const [promptEvent, setPromptEvent] = useState<PromptEvent | null>(null);
  const [isIosAgent, setIsIosAgent] = useState(false);
  const copy = COPY[lang] ?? COPY.en;

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      dismissed = false;
    }
    if (dismissed || isStandalone()) return;

    const onInstallPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as PromptEvent);
      setVisible(true);
    };

    window.addEventListener("beforeinstallprompt", onInstallPrompt);

    if (isIos()) {
      setIsIosAgent(true);
      setVisible(true);
    }

    return () => window.removeEventListener("beforeinstallprompt", onInstallPrompt);
  }, []);

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  const install = async () => {
    if (promptEvent) {
      await promptEvent.prompt();
      try {
        await promptEvent.userChoice;
      } catch {
        /* ignore */
      }
      setPromptEvent(null);
      setVisible(false);
      return;
    }
    if (PLAYSTORE_URL) {
      window.open(PLAYSTORE_URL, "_blank", "noopener,noreferrer");
      setVisible(false);
    }
  };

  if (!visible) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="fixed inset-x-4 bottom-4 z-40 mx-auto flex max-w-sm items-start gap-3 rounded-2xl border border-border bg-background/95 p-4 shadow-xl backdrop-blur-md"
      style={{ bottom: "max(1rem, env(safe-area-inset-bottom))" }}
    >
      <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
        <Download size={18} aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-display text-sm font-bold text-foreground">{copy.title}</p>
        <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
          {isIosAgent ? copy.iosBody : copy.body}
        </p>
        {!isIosAgent && (promptEvent || PLAYSTORE_URL) ? (
          <button
            type="button"
            onClick={install}
            className="touch-target mt-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground transition-transform hover:scale-[1.03] active:scale-95"
          >
            {copy.cta}
          </button>
        ) : null}
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label={copy.dismiss}
        className="-m-1 flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-accent/15 hover:text-foreground"
      >
        <X size={16} aria-hidden="true" />
      </button>
    </motion.div>
  );
}
