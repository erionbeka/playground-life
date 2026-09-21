export default function Sparkline({ values, width = 96, height = 24 }: { values: number[]; width?: number; height?: number }) {
  if (values.length < 2) {
    return <span className="text-[10px] text-muted-foreground">Not enough data yet</span>;
  }

  const max = Math.max(...values, 100);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const step = width / (values.length - 1);
  const points = values
    .map((value, index) => `${Math.round(index * step)},${Math.round(height - ((value - min) / range) * height)}`)
    .join(" ");

  const last = values[values.length - 1];
  const first = values[0];
  const rising = last >= first;

  return (
    <svg width={width} height={height} aria-hidden="true" className="overflow-visible">
      <polyline
        points={points}
        fill="none"
        stroke={rising ? "rgb(16,185,129)" : "rgb(244,114,182)"}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={width}
        cy={height - ((last - min) / range) * height}
        r="2.5"
        fill={rising ? "rgb(16,185,129)" : "rgb(244,114,182)"}
      />
    </svg>
  );
}
