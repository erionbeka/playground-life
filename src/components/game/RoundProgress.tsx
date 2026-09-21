interface RoundProgressProps { current: number; total: number; className?: string; }
export default function RoundProgress({ current, total, className = "" }: RoundProgressProps) {
  const seen = total > 0 ? Math.min(current + 1, total) : 1;
  return (
    <p aria-live="polite" className={`text-xs font-bold uppercase tracking-wide text-muted-foreground ${className}`}>
      Step {seen} of {total}
    </p>
  );
}