import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CORE_WORDS, CoreWord } from "@/lib/coreVocabulary";
import { speak } from "@/lib/speech";

interface Props {
  /** Optional sink for AAC usage events (word tapped, message spoken). */
  onLog?: (type: string, detail?: string) => void;
  className?: string;
}

const COLLAPSE_KEY = "pp-aac-bar-collapsed";

function readCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Persistent AAC core-word bar.
 *
 * Renders the fixed core vocabulary as always-available communication buttons
 * and a growing sentence strip. Tapping a word speaks it and appends it to the
 * message; "Say it" speaks the whole message. It is present in every activity
 * so communication is never locked inside a single game.
 */
export default function CoreWordBar({ onLog, className = "" }: Props) {
  const [message, setMessage] = useState<CoreWord[]>([]);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(readCollapsed());
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((previous) => {
      const next = !previous;
      try {
        window.localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        /* storage unavailable */
      }
      return next;
    });
  };

  const addWord = (word: CoreWord) => {
    setMessage((previous) => [...previous, word]);
    speak(word.spoken);
    onLog?.("aac_word", word.id);
  };

  const sayIt = () => {
    if (message.length === 0) return;
    const text = message.map((word) => word.spoken).join(" ");
    speak(text);
    onLog?.("aac_speak", text);
  };

  const removeLast = () => setMessage((previous) => previous.slice(0, -1));
  const clear = () => setMessage([]);

  return (
    <div
      className={`rounded-t-2xl border-t border-border bg-card/95 backdrop-blur-md shadow-lg ${className}`}
      role="region"
      aria-label="Communication bar"
    >
      <div className="flex items-center justify-between px-3 pt-2">
        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">
          Communication · AAC-supported
        </span>
        <button
          type="button"
          onClick={toggleCollapsed}
          className="rounded-full px-3 py-1 text-xs text-muted-foreground hover:text-foreground touch-target"
          aria-label={collapsed ? "Show communication bar" : "Hide communication bar"}
          aria-expanded={!collapsed}
        >
          {collapsed ? "Show" : "Hide"}
        </button>
      </div>

      <AnimatePresence initial={false}>
        {!collapsed ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden px-3 pb-3"
          >
            <div className="mb-2 flex min-h-[2.5rem] items-center gap-2 rounded-xl border border-border bg-background px-3 py-1.5">
              <div className="min-w-0 flex-1">
                <div
                  data-testid="aac-strip"
                  aria-live="polite"
                  className="truncate font-display text-lg font-bold text-foreground"
                >
                  {message.map((word) => word.label).join(" ")}
                </div>
                {message.length === 0 ? (
                  <span className="text-xs text-muted-foreground">Tap a word to build a message</span>
                ) : null}
              </div>
              <button
                type="button"
                onClick={sayIt}
                disabled={message.length === 0}
                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-40 touch-target"
                aria-label="Say it"
              >
                Say it
              </button>
              <button
                type="button"
                onClick={removeLast}
                disabled={message.length === 0}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-bold text-foreground disabled:opacity-40 touch-target"
                aria-label="Remove last word"
              >
                ⌫
              </button>
              <button
                type="button"
                onClick={clear}
                disabled={message.length === 0}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-bold text-foreground disabled:opacity-40 touch-target"
                aria-label="Clear message"
              >
                Clear
              </button>
            </div>

            <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-12">
              {CORE_WORDS.map((word) => (
                <button
                  key={word.id}
                  type="button"
                  onClick={() => addWord(word)}
                  aria-label={word.label}
                  className="flex min-h-[3.25rem] flex-col items-center justify-center rounded-xl border-2 border-border bg-background px-1 py-1 transition-colors hover:border-primary touch-target"
                >
                  <span aria-hidden="true" className="text-xl leading-none">{word.emoji}</span>
                  <span className="mt-0.5 text-[10px] font-semibold leading-tight text-foreground">{word.label}</span>
                </button>
              ))}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
