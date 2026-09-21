import { useMemo } from "react";
import { motion } from "framer-motion";
import { STICKER_CATALOG, getRewardState } from "@/lib/rewards";

export default function StickerBook({ childId, childName }: { childId: string; childName: string }) {
  const state = useMemo(() => getRewardState(childId), [childId]);

  return (
    <div className="mb-6 rounded-2xl border border-secondary/25 bg-gradient-to-br from-card to-secondary/10 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-secondary">Sticker Book</p>
          <p className="mt-1 font-display text-lg font-bold text-foreground">
            {state.stars} stars · {state.stickers.length}/{STICKER_CATALOG.length} stickers
          </p>
        </div>
        <p className="text-xs text-muted-foreground">{childName} collects a new friend for every mastered game.</p>
      </div>

      <div className="mt-3 grid grid-cols-6 gap-2 sm:grid-cols-8 md:grid-cols-12">
        {STICKER_CATALOG.map((sticker, index) => {
          const owned = state.stickers.includes(sticker);
          return (
            <motion.div
              key={`${sticker}-${index}`}
              initial={false}
              animate={owned ? { scale: 1 } : { scale: 0.94 }}
              title={owned ? "Collected" : "Keep playing to unlock"}
              className={`grid aspect-square place-items-center rounded-xl text-2xl ${
                owned
                  ? "bg-white shadow-sm ring-1 ring-secondary/40"
                  : "bg-muted/60 text-muted-foreground/30 grayscale"
              }`}
            >
              <span aria-hidden="true">{owned ? sticker : "❔"}</span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
