interface RingRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export default function ActivationRing({
  rect,
  progress,
  reduced = false,
}: {
  rect: RingRect | null;
  progress: number;
  reduced?: boolean;
}) {
  if (!rect) return null;
  const size = Math.max(rect.width, rect.height) + 20;
  const radius = size / 2 - 5;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(1, progress));
  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        left: rect.left + rect.width / 2 - size / 2,
        top: rect.top + rect.height / 2 - size / 2,
        width: size,
        height: size,
        pointerEvents: "none",
        zIndex: 9999,
        opacity: reduced ? 0.85 : 1,
      }}
    >
      <svg width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(15,23,42,0.25)"
          strokeWidth={5}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#22c55e"
          strokeWidth={5}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
    </div>
  );
}
