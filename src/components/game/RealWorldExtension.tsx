interface Props {
  prompt: string;
  metric?: string;
  className?: string;
}

/**
 * Prominent screen-to-real-world transfer prompt. The advisor brief calls the
 * move from screen to offline play one of PLAYGROUND's defining features, so it
 * is shown as its own card rather than a muted footnote.
 */
export default function RealWorldExtension({ prompt, metric, className = "" }: Props) {
  return (
    <div
      data-testid="real-world-extension"
      className={`rounded-2xl border-2 border-primary/40 bg-primary/5 p-4 text-left ${className}`}
    >
      <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-primary">
        <span aria-hidden="true">🌍</span>
        Take it into the real world
      </p>
      <p className="mt-2 text-sm font-semibold leading-6 text-foreground">{prompt}</p>
      {metric ? <p className="mt-1 text-xs text-muted-foreground">Look for: {metric}</p> : null}
    </div>
  );
}
