import { RESPONSE_MODE_OPTIONS, ResponseMode } from "@/lib/responseModes";

interface Props {
  onResponse: (mode: ResponseMode) => void;
  className?: string;
}

/**
 * Records an answer the child gave in a mode the touch screen cannot detect on
 * its own — a spoken word, a point, a symbol board, a switch, or a dwell. This
 * keeps spoken and aided communication first-class rather than screen-only.
 */
export default function ResponseModes({ onResponse, className = "" }: Props) {
  return (
    <div
      role="group"
      aria-label="Answer another way"
      className={`rounded-2xl border border-dashed border-border bg-card/70 p-3 text-left ${className}`}
    >
      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground">
        Answer another way? Tap to count it
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {RESPONSE_MODE_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            title={option.hint}
            aria-label={`Answered by: ${option.label}`}
            onClick={() => onResponse(option.id)}
            className="touch-target inline-flex items-center gap-1.5 rounded-full border-2 border-border bg-background px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:border-primary"
          >
            <span aria-hidden="true">{option.emoji}</span>
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
