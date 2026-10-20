import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useSpring,
  useTime,
  useTransform,
} from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useReducedMotionMode } from "@/lib/motion";

export type CritterShape = "cat" | "frog" | "bunny" | "bear" | "bird";
export type CritterMood = "play" | "grow" | "communicate" | "connect" | "safe";

type CritterConfig = {
  ear: "none" | "cat" | "bunny" | "bear" | "tuft";
  eyeStyle: "round" | "frog";
  mouth: "smile" | "open";
  bodySquash: number;
};

const CRITTERS: Record<CritterShape, CritterConfig> = {
  cat: { ear: "cat", eyeStyle: "round", mouth: "smile", bodySquash: 1 },
  frog: { ear: "none", eyeStyle: "frog", mouth: "smile", bodySquash: 0.88 },
  bunny: { ear: "bunny", eyeStyle: "round", mouth: "smile", bodySquash: 1.05 },
  bear: { ear: "bear", eyeStyle: "round", mouth: "open", bodySquash: 0.96 },
  bird: { ear: "tuft", eyeStyle: "round", mouth: "open", bodySquash: 0.92 },
};

function Ears({ shape, color, size }: { shape: CritterShape; color: string; size: number }) {
  const earStyle = CRITTERS[shape].ear;
  if (earStyle === "none") return null;

  const common = {
    position: "absolute" as const,
    background: color,
    zIndex: 0,
  };

  if (earStyle === "cat") {
    return (
      <>
        <div
          aria-hidden
          style={{
            ...common,
            width: size * 0.32,
            height: size * 0.36,
            left: size * 0.02,
            top: -size * 0.06,
            borderRadius: "60% 60% 40% 40%",
            transform: "rotate(-16deg)",
            boxShadow: "inset 0 -6px 10px rgba(0,0,0,0.06)",
          }}
        />
        <div
          aria-hidden
          style={{
            ...common,
            width: size * 0.32,
            height: size * 0.36,
            right: size * 0.02,
            top: -size * 0.06,
            borderRadius: "60% 60% 40% 40%",
            transform: "rotate(16deg)",
            boxShadow: "inset 0 -6px 10px rgba(0,0,0,0.06)",
          }}
        />
      </>
    );
  }

  if (earStyle === "bunny") {
    return (
      <>
        <div
          aria-hidden
          style={{
            ...common,
            width: size * 0.2,
            height: size * 0.48,
            left: size * 0.14,
            top: -size * 0.24,
            borderRadius: "50%",
            transform: "rotate(-10deg)",
            boxShadow: "inset 0 -6px 10px rgba(0,0,0,0.06)",
          }}
        />
        <div
          aria-hidden
          style={{
            ...common,
            width: size * 0.2,
            height: size * 0.48,
            right: size * 0.14,
            top: -size * 0.24,
            borderRadius: "50%",
            transform: "rotate(10deg)",
            boxShadow: "inset 0 -6px 10px rgba(0,0,0,0.06)",
          }}
        />
      </>
    );
  }

  if (earStyle === "bear") {
    return (
      <>
        <div
          aria-hidden
          style={{
            ...common,
            width: size * 0.26,
            height: size * 0.26,
            left: size * 0.0,
            top: -size * 0.02,
            borderRadius: "50%",
          }}
        />
        <div
          aria-hidden
          style={{
            ...common,
            width: size * 0.26,
            height: size * 0.26,
            right: size * 0.0,
            top: -size * 0.02,
            borderRadius: "50%",
          }}
        />
      </>
    );
  }

  return (
    <div
      aria-hidden
      style={{
        ...common,
        width: size * 0.16,
        height: size * 0.24,
        left: "50%",
        top: -size * 0.1,
        borderRadius: "50%",
        transform: "translateX(-50%) rotate(-12deg)",
      }}
    />
  );
}

function Face({
  shape,
  size,
  blush,
  pupilX,
  pupilY,
  mood,
  tickled = false,
}: {
  shape: CritterShape;
  size: number;
  blush: string;
  pupilX: ReturnType<typeof useTransform<number, number>>;
  pupilY: ReturnType<typeof useTransform<number, number>>;
  mood?: CritterMood;
  tickled?: boolean;
}) {
  const config = CRITTERS[shape];
  const eyeSize = size * 0.09;
  const eyeTop = config.eyeStyle === "frog" ? size * 0.34 : size * 0.34;
  const eyeSpread = size * 0.2;

  const calmBlink =
    mood === "safe"
      ? { duration: 7, times: [0, 0.32, 0.36, 0.72, 0.76, 1], repeat: Infinity, ease: "easeInOut" as const }
      : { duration: 5.6, times: [0, 0.44, 0.47, 0.5, 1], repeat: Infinity, ease: "easeInOut" as const };
  const calmScaleY = mood === "safe" ? [1, 1, 0.08, 0.08, 1, 1] : [1, 1, 0.08, 1, 1];

  if (config.eyeStyle === "frog") {
    return (
      <div aria-hidden style={{ position: "absolute", inset: 0, zIndex: 2 }}>
        {[-1, 1].map((side) => (
          <div
            key={side}
            style={{
              position: "absolute",
              left: side === -1 ? size * 0.5 - eyeSpread - size * 0.09 : size * 0.5 + eyeSpread - size * 0.09,
              top: -size * 0.02,
              width: size * 0.18,
              height: size * 0.18,
              borderRadius: "50%",
              background: "white",
              boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
            }}
          >
            <motion.div
              style={{
                width: size * 0.08,
                height: size * 0.08,
                borderRadius: "50%",
                background: "#2a2a3a",
                x: pupilX,
                y: pupilY,
              }}
              animate={{ scaleY: calmScaleY }}
              transition={{ ...calmBlink, delay: side === -1 ? 0 : 0.04 }}
            />
          </div>
        ))}
        {tickled ? (
          <div
            style={{
              position: "absolute",
              left: size * 0.5 - size * 0.15,
              top: size * 0.38,
              width: size * 0.3,
              height: size * 0.15,
              borderRadius: "18% 18% 50% 50% / 18% 18% 70% 70%",
              background: "#2a2a3a",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                left: "22%",
                bottom: "-4%",
                width: "56%",
                height: "46%",
                borderRadius: "50% 50% 40% 40%",
                background: "hsl(10 72% 62%)",
              }}
            />
          </div>
        ) : (
          <div
            style={{
              position: "absolute",
              left: size * 0.5 - size * 0.11,
              top: size * 0.42,
              width: size * 0.22,
              height: size * 0.07,
              borderRadius: "0 0 50% 50%",
              border: `${Math.max(2, size * 0.02)}px solid #2a2a3a`,
              borderTop: "none",
              background: "transparent",
            }}
          />
        )}
        {[-1, 1].map((side) => (
          <div
            key={`blush-${side}`}
            style={{
              position: "absolute",
              left: side === -1 ? size * 0.12 : size * 0.72,
              top: size * 0.48,
              width: size * 0.16,
              height: size * 0.09,
              borderRadius: "50%",
              background: blush,
              opacity: 0.7,
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <div aria-hidden style={{ position: "absolute", inset: 0, zIndex: 2 }}>
      {[-1, 1].map((side) => (
        <div
          key={side}
          style={{
            position: "absolute",
            left: side === -1 ? size * 0.5 - eyeSpread - eyeSize / 2 : size * 0.5 + eyeSpread - eyeSize / 2,
            top: eyeTop,
            width: eyeSize,
            height: eyeSize * 1.15,
            borderRadius: "50%",
            background: "white",
            overflow: "hidden",
            boxShadow: "inset 0 0 0 1.5px rgba(42,42,58,0.12)",
          }}
        >
          <motion.div
            style={{
              position: "absolute",
              left: eyeSize * 0.22,
              top: eyeSize * 0.28,
              width: eyeSize * 0.56,
              height: eyeSize * 0.62,
              borderRadius: "50%",
              background: "#2a2a3a",
              x: pupilX,
              y: pupilY,
            }}
            animate={{ scaleY: calmScaleY }}
            transition={{ ...calmBlink, delay: side === -1 ? 0 : 0.05 }}
          />
          <div
            style={{
              position: "absolute",
              left: eyeSize * 0.3,
              top: eyeSize * 0.34,
              width: eyeSize * 0.2,
              height: eyeSize * 0.2,
              borderRadius: "50%",
              background: "white",
              opacity: 0.95,
            }}
          />
        </div>
      ))}
      {[-1, 1].map((side) => (
        <div
          key={`blush-${side}`}
          style={{
            position: "absolute",
            left: side === -1 ? size * 0.14 : size * 0.7,
            top: eyeTop + size * 0.14,
            width: size * 0.16,
            height: size * 0.09,
            borderRadius: "50%",
            background: blush,
            opacity: 0.65,
          }}
        />
      ))}
      {tickled ? (
        <div
          style={{
            position: "absolute",
            left: size * 0.5 - size * 0.15,
            top: eyeTop + size * 0.06,
            width: size * 0.3,
            height: size * 0.17,
            borderRadius: "18% 18% 50% 50% / 18% 18% 70% 70%",
            background: "#2a2a3a",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: "22%",
              bottom: "-4%",
              width: "56%",
              height: "46%",
              borderRadius: "50% 50% 40% 40%",
              background: "hsl(10 72% 62%)",
            }}
          />
        </div>
      ) : config.mouth === "smile" ? (
        <div
          style={{
            position: "absolute",
            left: size * 0.5 - size * 0.08,
            top: eyeTop + size * 0.1,
            width: size * 0.16,
            height: size * 0.08,
            borderRadius: "0 0 50% 50%",
            border: `${Math.max(2, size * 0.018)}px solid #2a2a3a`,
            borderTop: "none",
            background: "transparent",
          }}
        />
      ) : (
        <div
          style={{
            position: "absolute",
            left: size * 0.5 - size * 0.05,
            top: eyeTop + size * 0.1,
            width: size * 0.1,
            height: size * 0.09,
            borderRadius: "50%",
            background: "#2a2a3a",
          }}
        />
      )}
    </div>
  );
}

function PersonalityProp({ mood, size, color }: { mood: CritterMood; size: number; color: string }) {
  if (mood === "play") {
    return (
      <motion.div
        aria-hidden
        style={{
          position: "absolute",
          right: -size * 0.08,
          bottom: size * 0.08,
          width: size * 0.16,
          height: size * 0.16,
          borderRadius: "50%",
          background: "hsl(45 90% 62%)",
          boxShadow: "inset -3px -4px 0 rgba(0,0,0,0.08)",
          zIndex: 3,
        }}
        animate={{ y: [0, -size * 0.34, 0, -size * 0.16, 0], scaleY: [1, 0.85, 1, 0.92, 1] }}
        transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut", times: [0, 0.35, 0.55, 0.75, 1] }}
      />
    );
  }

  if (mood === "grow") {
    return (
      <div aria-hidden style={{ position: "absolute", left: "50%", top: -size * 0.18, zIndex: 3, transform: "translateX(-50%)" }}>
        <motion.div
          style={{ width: size * 0.05, height: size * 0.14, borderRadius: 99, background: "hsl(142 45% 42%)", transformOrigin: "bottom center" }}
          animate={{ scaleY: [0.55, 1, 0.75, 1, 0.55] }}
          transition={{ duration: 4.6, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          style={{
            position: "absolute",
            left: size * 0.04,
            top: -size * 0.02,
            width: size * 0.12,
            height: size * 0.09,
            borderRadius: "50% 50% 50% 0",
            background: "hsl(142 50% 50%)",
            transformOrigin: "bottom left",
            rotate: -24,
          }}
          animate={{ scaleX: [0.6, 1, 0.8, 1, 0.6], rotate: [-24, -10, -18, -10, -24] }}
          transition={{ duration: 4.6, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          style={{
            position: "absolute",
            right: size * 0.04,
            top: size * 0.02,
            width: size * 0.1,
            height: size * 0.08,
            borderRadius: "50% 50% 0 50%",
            background: "hsl(142 50% 46%)",
            transformOrigin: "bottom right",
            rotate: 20,
          }}
          animate={{ scaleX: [0.6, 1, 0.8, 1, 0.6], rotate: [20, 8, 16, 8, 20] }}
          transition={{ duration: 4.6, repeat: Infinity, ease: "easeInOut", delay: 0.15 }}
        />
      </div>
    );
  }

  if (mood === "communicate") {
    return (
      <motion.div
        aria-hidden
        style={{
          position: "absolute",
          right: -size * 0.14,
          top: -size * 0.08,
          zIndex: 3,
          background: "white",
          borderRadius: "14px 14px 14px 4px",
          padding: `${size * 0.05}px ${size * 0.08}px`,
          boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
          display: "flex",
          gap: size * 0.03,
          alignItems: "center",
        }}
        animate={{ opacity: [0, 1, 1, 0], y: [6, 0, 0, -4], scale: [0.7, 1, 1, 0.85] }}
        transition={{ duration: 4.4, repeat: Infinity, ease: "easeInOut", times: [0, 0.15, 0.75, 1] }}
      >
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            style={{ width: size * 0.05, height: size * 0.05, borderRadius: "50%", background: color, display: "block" }}
            animate={{ opacity: [0.35, 1, 0.35] }}
            transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.24, ease: "easeInOut" }}
          />
        ))}
      </motion.div>
    );
  }

  return null;
}

export interface BlobCritterProps {
  shape: CritterShape;
  color: string;
  blush?: string;
  size?: number;
  phase?: number;
  className?: string;
  label?: string;
  mood?: CritterMood;
  grabCursor?: boolean;
}

export default function BlobCritter({
  shape,
  color,
  blush = "hsl(10 70% 75%)",
  size = 150,
  phase = 0,
  className = "",
  label,
  mood,
  grabCursor = false,
}: BlobCritterProps) {
  const reducedMotion = useReducedMotionMode();
  const time = useTime();
  const squash = CRITTERS[shape].bodySquash;
  const rootRef = useRef<HTMLDivElement>(null);
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const px = useSpring(rawX, { stiffness: 75, damping: 24, mass: 1 });
  const py = useSpring(rawY, { stiffness: 75, damping: 24, mass: 1 });
  const [hover, setHover] = useState(false);
  const hoverRef = useRef(false);
  const nearRef = useRef(false);

  const radiusA = useTransform(time, (v) => 46 + Math.sin(v * 0.00055 + phase) * 7);
  const radiusB = useTransform(time, (v) => 56 + Math.cos(v * 0.00068 + phase) * 6);
  const radiusC = useTransform(time, (v) => 48 + Math.sin(v * 0.00062 + phase + 1.2) * 6);
  const radiusD = useTransform(time, (v) => 54 + Math.cos(v * 0.00058 + phase + 0.5) * 7);
  const borderRadius = useMotionTemplate`${radiusA}% ${radiusB}% ${radiusC}% ${radiusD}% / ${radiusD}% ${radiusC}% ${radiusB}% ${radiusA}%`;

  const dist = useTransform([px, py], ([x, y]: number[]) => Math.hypot(x, y));
  const near = useTransform(dist, (d) => (d < size * 2.0 ? 1 : 0));
  const leanRotate = useTransform([px, py, near], ([x, y, n]: number[]) => (n ? (x / size) * 10 : 0));
  const leanX = useTransform([px, py, near], ([x, y, n]: number[]) => (n ? (x / size) * size * 0.05 : 0));
  const leanY = useTransform([px, py, near], ([x, y, n]: number[]) => (n ? (y / size) * size * 0.03 : 0));
  const pupilX = useTransform(px, [-size * 2, size * 2], [-size * 0.03, size * 0.03]);
  const pupilY = useTransform(py, [-size * 2, size * 2], [-size * 0.025, size * 0.025]);

  const grabReach = useTransform(dist, (d) => {
    const start = size * 0.4;
    const max = size * 0.85;
    return Math.max(0, Math.min(d - start, max));
  });
  const grabAngle = useTransform([px, py], ([x, y]: number[]) => (Math.atan2(y, x) * 180) / Math.PI);
  const grabOpacity = useTransform([dist, grabReach], ([d, r]: number[]) => (d > size * 0.42 && r > 4 ? 1 : 0));

  const zeroX = useMotionValue(0);
  const zeroY = useMotionValue(0);

  useEffect(() => {
    if (reducedMotion) return;
    let rafId = 0;
    let pendingX = 0;
    let pendingY = 0;
    let hasPending = false;

    const applyMove = () => {
      rafId = 0;
      if (!hasPending) return;
      hasPending = false;
      const el = rootRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2 + size * 0.1;
      const dx = pendingX - cx;
      const dy = pendingY - cy;
      const d = Math.hypot(dx, dy);

      const engage = size * 2.0;
      const release = size * 2.6;
      if (!nearRef.current && d < engage) nearRef.current = true;
      else if (nearRef.current && d > release) nearRef.current = false;

      if (nearRef.current) {
        rawX.set(dx);
        rawY.set(dy);
      } else {
        rawX.set(0);
        rawY.set(0);
      }

      const hoverIn = size * 0.55;
      const hoverOut = size * 0.72;
      const isHover = hoverRef.current ? d < hoverOut : d < hoverIn;
      if (isHover !== hoverRef.current) {
        hoverRef.current = isHover;
        setHover(isHover);
      }
    };

    const onMove = (event: PointerEvent) => {
      pendingX = event.clientX;
      pendingY = event.clientY;
      hasPending = true;
      if (!rafId) rafId = requestAnimationFrame(applyMove);
    };

    const release = () => {
      hasPending = false;
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
      nearRef.current = false;
      if (hoverRef.current) {
        hoverRef.current = false;
        setHover(false);
      }
      rawX.set(0);
      rawY.set(0);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerup", release, { passive: true });
    window.addEventListener("pointercancel", release, { passive: true });
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
    };
  }, [rawX, rawY, size, reducedMotion]);

  const bodyWidth = size;
  const bodyHeight = size * squash;

  if (reducedMotion) {
    return (
      <div ref={rootRef} className={`relative ${className}`} style={{ width: bodyWidth, height: bodyHeight + size * 0.2 }}>
        <div style={{ position: "relative", width: bodyWidth, height: bodyHeight, marginTop: size * 0.2 }}>
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "48% 52% 46% 54% / 52% 46% 56% 44%",
              background: color,
              boxShadow: "inset 0 -10px 24px rgba(0,0,0,0.07), inset 0 8px 16px rgba(255,255,255,0.25)",
              zIndex: 1,
            }}
          >
            <Ears shape={shape} color={color} size={bodyWidth} />
            <Face
              shape={shape}
              size={bodyWidth}
              blush={blush}
              pupilX={zeroX}
              pupilY={zeroY}
              mood={undefined}
            />
          </div>
          {mood ? <PersonalityProp mood={mood} size={bodyWidth} color={color} /> : null}
        </div>
        {label ? <span className="sr-only">{label}</span> : null}
      </div>
    );
  }

  return (
    <motion.div
      ref={rootRef}
      className={`relative ${className}`}
      style={{ width: bodyWidth, height: bodyHeight + size * 0.28 }}
      animate={
        hover
          ? { y: [0, -size * 0.008, size * 0.004, -size * 0.006, 0] }
          : { y: [0, -size * 0.045, 0] }
      }
      transition={
        hover
          ? { duration: 0.6, repeat: Infinity, ease: "easeInOut" }
          : { duration: 4.8 + phase * 0.4, repeat: Infinity, ease: "easeInOut" }
      }
    >
      <div style={{ position: "relative", width: bodyWidth, height: bodyHeight, marginTop: size * 0.2 }}>
        <motion.div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius,
            background: color,
            boxShadow: "inset 0 -10px 24px rgba(0,0,0,0.07), inset 0 8px 16px rgba(255,255,255,0.25)",
            zIndex: 1,
            x: leanX,
            y: leanY,
            rotate: leanRotate,
          }}
          animate={
            hover
              ? {
                  scaleX: [1, 1.025, 0.985, 1.018, 0.992, 1],
                  scaleY: [1, 0.982, 1.025, 0.988, 1.015, 1],
                }
              : { scaleX: [1, 1.02, 0.99, 1], scaleY: [1, 0.98, 1.01, 1] }
          }
          transition={
            hover
              ? { duration: 0.65, repeat: Infinity, ease: "easeInOut" }
              : { duration: 7 + phase, repeat: Infinity, ease: "easeInOut" }
          }
        >
          <Ears shape={shape} color={color} size={bodyWidth} />
          <Face shape={shape} size={bodyWidth} blush={blush} pupilX={pupilX} pupilY={pupilY} mood={mood} tickled={hover} />
        </motion.div>

        {[-1, 1].map((side) => (
          <motion.div
            key={`arm-${side}`}
            aria-hidden
            style={{
              position: "absolute",
              left: side === -1 ? size * 0.04 : undefined,
              right: side === 1 ? size * 0.04 : undefined,
              top: bodyHeight * 0.56,
              width: size * 0.38,
              height: size * 0.13,
              borderRadius: 99,
              background: color,
              zIndex: 3,
              transformOrigin: side === -1 ? "left center" : "right center",
              boxShadow: "inset 0 -3px 6px rgba(0,0,0,0.06)",
            }}
            animate={
              hover
                ? {
                    opacity: 1,
                    rotate: side === -1 ? -14 : 14,
                    x: side === -1 ? size * 0.07 : -size * 0.07,
                    y: [0, -size * 0.01, 0],
                  }
                : {
                    opacity: 0,
                    rotate: side === -1 ? 55 : -55,
                    x: 0,
                    y: 0,
                  }
            }
            transition={
              hover
                ? { duration: 0.7, repeat: Infinity, ease: "easeInOut" }
                : { duration: 0.4, ease: "easeOut" }
            }
          >
            <div
              style={{
                position: "absolute",
                left: side === -1 ? undefined : -size * 0.04,
                right: side === -1 ? -size * 0.04 : undefined,
                top: "50%",
                transform: "translateY(-50%)",
                width: size * 0.13,
                height: size * 0.13,
                borderRadius: "50%",
                background: color,
                boxShadow: "inset 0 -2px 4px rgba(0,0,0,0.05)",
              }}
            />
          </motion.div>
        ))}

        {grabCursor ? (
          <motion.div
            aria-hidden
            style={{
              position: "absolute",
              left: bodyWidth * 0.5,
              top: bodyHeight * 0.45,
              width: grabReach,
              height: size * 0.11,
              borderRadius: 99,
              background: color,
              transformOrigin: "left center",
              rotate: grabAngle,
              opacity: grabOpacity,
              zIndex: 0,
              boxShadow: "inset 0 -3px 6px rgba(0,0,0,0.06)",
            }}
          >
            <div
              style={{
                position: "absolute",
                right: -size * 0.045,
                top: "50%",
                transform: "translateY(-50%)",
                width: size * 0.14,
                height: size * 0.14,
                borderRadius: "50%",
                background: color,
                boxShadow: "inset 0 -3px 6px rgba(0,0,0,0.06)",
              }}
            >
              {[-0.22, 0, 0.22].map((offset, i) => (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    left: `${50 + offset * 100}%`,
                    top: i === 1 ? "18%" : "8%",
                    transform: "translateX(-50%)",
                    width: size * 0.045,
                    height: size * 0.05,
                    borderRadius: "50%",
                    background: color,
                    boxShadow: "inset 0 -2px 3px rgba(0,0,0,0.05)",
                  }}
                />
              ))}
            </div>
          </motion.div>
        ) : null}

        {mood ? <PersonalityProp mood={mood} size={bodyWidth} color={color} /> : null}
      </div>
      {label ? <span className="sr-only">{label}</span> : null}
    </motion.div>
  );
}
