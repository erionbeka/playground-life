export default function TokenStrip({ earned, total, token = "🪙" }: { earned: number; total: number; token?: string }) {  const safeTotal = Math.max(0, total);
  const safeEarned = Math.max(0, Math.min(earned, safeTotal));

  if (safeTotal === 0) return null;

  return (
    <div className="flex items-center gap-1" aria-label={`${safeEarned} of ${safeTotal} tokens earned`}>
      <span className="sr-only">{`${safeEarned} of ${safeTotal} tokens earned`}</span>
      {Array.from({ length: safeTotal }, (_, index) => (
        <span
          key={index}
          aria-hidden="true"
          className={`text-base leading-none transition-all ${
            index < safeEarned ? "scale-100 opacity-100 drop-shadow-[0_0_6px_rgba(251,191,36,0.7)]" : "opacity-25 grayscale"
          }`}
        >
          {token}
        </span>
      ))}
    </div>
  );
}
