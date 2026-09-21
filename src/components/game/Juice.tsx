import { useCallback, useRef, useState } from "react";
import { AnimatePresence, motion, useAnimationControls } from "framer-motion";
import { useSensory } from "@/lib/sensory";
import { reduceMotionEffects, useReducedMotionMode } from "@/lib/motion";

export interface Burst {
  id: number;
  x: number;
  y: number;
  emoji: string;
}

const PARTICLE_OFFSETS = [
  { x: -58, y: -66 },
  { x: 56, y: -74 },
  { x: -86, y: -8 },
  { x: 84, y: -16 },
  { x: -28, y: -104 },
  { x: 30, y: -98 },
];

export function useBursts() {
  const [bursts, setBursts] = useState<Burst[]>([]);
  const idRef = useRef(0);

  const fireBurst = useCallback((x: number, y: number, emoji = "✨") => {
    idRef.current += 1;
    const burst: Burst = { id: idRef.current, x, y, emoji };
    setBursts((current) => [...current.slice(-5), burst]);
    window.setTimeout(() => {
      setBursts((current) => current.filter((entry) => entry.id !== burst.id));
    }, 900);
  }, []);

  return { bursts, fireBurst };
}

export function pointFromEvent(event: { clientX: number; clientY: number }, host: HTMLElement | null) {
  if (!host) return { x: 50, y: 50 };
  const rect = host.getBoundingClientRect();
  return {
    x: Math.round(((event.clientX - rect.left) / rect.width) * 100),
    y: Math.round(((event.clientY - rect.top) / rect.height) * 100),
  };
}

export function BurstLayer({ bursts }: { bursts: Burst[] }) {
  const { calmMode } = useSensory();
  if (reduceMotionEffects(useReducedMotionMode(), calmMode)) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden bg-transparent">
      <AnimatePresence>
        {bursts.map((burst) =>
          PARTICLE_OFFSETS.map((offset, index) => (
            <motion.span
              key={`${burst.id}-${index}`}
              initial={{ opacity: 1, scale: 0.4, x: 0, y: 0 }}
              animate={{ opacity: 0, scale: [0.6, 1.15], x: offset.x, y: offset.y }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.7, ease: "easeOut" }}
              className="absolute text-xl drop-shadow"
              style={{ left: `${burst.x}%`, top: `${burst.y}%` }}
            >
              {index % 2 === 0 ? burst.emoji : "✨"}
            </motion.span>
          )),
        )}
      </AnimatePresence>
    </div>
  );
}

export function ComboBadge({ combo }: { combo: number }) {
  const { calmMode } = useSensory();
  if (reduceMotionEffects(useReducedMotionMode(), calmMode)) return null;

  return (
    <AnimatePresence>
      {combo >= 2 ? (
        <motion.div
          key={combo}
          initial={{ opacity: 0, scale: 0.5, y: 8 }}
          animate={{ opacity: 1, scale: [1.25, 1], y: 0 }}
          exit={{ opacity: 0, scale: 0.6 }}
          transition={{ type: "spring", stiffness: 320, damping: 16 }}
          className="pointer-events-none absolute right-3 top-3 z-20 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-3 py-1 text-sm font-black text-white shadow-lg"
        >
          🔥 {combo} in a row!
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export function useWobble() {
  const controls = useAnimationControls();
  const { calmMode } = useSensory();
  const reduced = useReducedMotionMode();
  const suppressFx = reduceMotionEffects(reduced, calmMode);
  const wobble = useCallback(() => {
    if (suppressFx) return;
    void controls.start({
      x: [0, -7, 6, -4, 0],
      transition: { duration: 0.42, ease: "easeInOut" },
    });
  }, [suppressFx, controls]);
  return { controls, wobble };
}
