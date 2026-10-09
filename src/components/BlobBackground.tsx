import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useSpring,
  useTime,
  useTransform,
} from "framer-motion";
import { useEffect, useState } from "react";
import { useReducedMotionMode } from "@/lib/motion";

const blobs = [
  { size: 320, color: "hsla(199, 78%, 58%, 0.44)", x: "12%", y: "18%", mouseX: 48, mouseY: 28, idleX: 18, idleY: 14, speed: 0.00022, phase: 0.2 },
  { size: 280, color: "hsla(25, 92%, 66%, 0.4)", x: "66%", y: "12%", mouseX: -44, mouseY: 34, idleX: 16, idleY: 18, speed: 0.00018, phase: 1.4 },
  { size: 260, color: "hsla(142, 54%, 56%, 0.4)", x: "22%", y: "62%", mouseX: 36, mouseY: -40, idleX: 15, idleY: 20, speed: 0.00024, phase: 2.6 },
  { size: 220, color: "hsla(260, 52%, 74%, 0.32)", x: "74%", y: "64%", mouseX: -34, mouseY: -24, idleX: 12, idleY: 16, speed: 0.0002, phase: 3.4 },
  { size: 180, color: "hsla(45, 98%, 68%, 0.28)", x: "44%", y: "36%", mouseX: 24, mouseY: 42, idleX: 10, idleY: 14, speed: 0.00026, phase: 4.1 },
];

const sparkles = [
  { left: "14%", top: "22%", size: 10, drift: 18, delay: 0.2 },
  { left: "28%", top: "70%", size: 8, drift: 12, delay: 1.1 },
  { left: "52%", top: "18%", size: 12, drift: 20, delay: 0.8 },
  { left: "72%", top: "34%", size: 9, drift: 16, delay: 1.7 },
  { left: "84%", top: "72%", size: 11, drift: 14, delay: 0.5 },
  { left: "38%", top: "46%", size: 7, drift: 10, delay: 1.4 },
];

function Blob({
  size,
  color,
  x,
  y,
  mouseX,
  mouseY,
  idleX,
  idleY,
  speed,
  phase,
  pointerX,
  pointerY,
  scale,
}: {
  size: number;
  color: string;
  x: string;
  y: string;
  mouseX: number;
  mouseY: number;
  idleX: number;
  idleY: number;
  speed: number;
  phase: number;
  pointerX: ReturnType<typeof useSpring>;
  pointerY: ReturnType<typeof useSpring>;
  scale: number;
}) {
  const time = useTime();
  const idleOffsetX = useTransform(time, (value) => Math.sin(value * speed + phase) * idleX * scale);
  const idleOffsetY = useTransform(time, (value) => Math.cos(value * speed * 1.2 + phase) * idleY * scale);
  const pointerOffsetX = useTransform(pointerX, [-0.5, 0.5], [-mouseX * scale, mouseX * scale]);
  const pointerOffsetY = useTransform(pointerY, [-0.5, 0.5], [-mouseY * scale, mouseY * scale]);
  const translateX = useTransform([idleOffsetX, pointerOffsetX], ([idle, pointer]: number[]) => idle + pointer);
  const translateY = useTransform([idleOffsetY, pointerOffsetY], ([idle, pointer]: number[]) => idle + pointer);
  const rotate = useTransform(time, (value) => Math.sin(value * speed * 0.45 + phase) * 8);
  const radiusA = useTransform(time, (value) => 44 + Math.sin(value * speed * 0.6 + phase) * 10);
  const radiusB = useTransform(time, (value) => 56 + Math.cos(value * speed * 0.8 + phase) * 8);
  const radiusC = useTransform(time, (value) => 48 + Math.sin(value * speed * 0.7 + phase + 1.1) * 8);
  const radiusD = useTransform(time, (value) => 52 + Math.cos(value * speed * 0.65 + phase + 0.6) * 9);
  const borderRadius = useMotionTemplate`${radiusA}% ${radiusB}% ${radiusC}% ${radiusD}% / ${radiusD}% ${radiusC}% ${radiusB}% ${radiusA}%`;

  return (
    <motion.div
      className="absolute"
      style={{
        left: x,
        top: y,
        width: size * scale,
        height: size * scale,
        x: translateX,
        y: translateY,
        rotate,
        borderRadius,
        background: color,
        boxShadow: "inset 0 0 40px rgba(255,255,255,0.16), 0 0 50px rgba(255,255,255,0.08)",
      }}
      animate={{ scale: [1, 1.03, 0.98, 1] }}
      transition={{ scale: { duration: 7 + phase, repeat: Infinity, ease: "easeInOut" } }}
    />
  );
}

function Sparkle({
  left,
  top,
  size,
  drift,
  delay,
  pointerX,
  pointerY,
  scale,
}: {
  left: string;
  top: string;
  size: number;
  drift: number;
  delay: number;
  pointerX: ReturnType<typeof useSpring>;
  pointerY: ReturnType<typeof useSpring>;
  scale: number;
}) {
  const x = useTransform(pointerX, [-0.5, 0.5], [-drift * scale, drift * scale]);
  const y = useTransform(pointerY, [-0.5, 0.5], [-drift * 0.6 * scale, drift * 0.6 * scale]);

  return (
    <motion.div
      className="absolute rounded-full bg-white/70"
      style={{ left, top, width: size * scale, height: size * scale, x, y, boxShadow: "0 0 18px rgba(255,255,255,0.55)" }}
      animate={{ opacity: [0.25, 1, 0.3], scale: [0.7, 1.25, 0.8], y: [0, -12 * scale, 0] }}
      transition={{ duration: 4.5, delay, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

export default function BlobBackground() {
  const reducedMotion = useReducedMotionMode();
  const rawPointerX = useMotionValue(0);
  const rawPointerY = useMotionValue(0);
  const pointerX = useSpring(rawPointerX, { stiffness: 70, damping: 20, mass: 1.2 });
  const pointerY = useSpring(rawPointerY, { stiffness: 70, damping: 20, mass: 1.2 });
  const glowX = useTransform(pointerX, [-0.5, 0.5], ["28%", "72%"]);
  const glowY = useTransform(pointerY, [-0.5, 0.5], ["26%", "74%"]);
  const sheenX = useTransform(pointerX, [-0.5, 0.5], ["20%", "80%"]);
  const sheenY = useTransform(pointerY, [-0.5, 0.5], ["18%", "82%"]);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const updateScale = () => {
      const width = window.innerWidth;
      setScale(width < 640 ? 0.58 : width < 1024 ? 0.8 : 1);
    };

    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, []);

  if (reducedMotion) {
    return (
      <div data-testid="blob-static" className="fixed inset-0 overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.86),_transparent_52%),linear-gradient(180deg,_rgba(255,255,255,0.22),_rgba(255,255,255,0))]" />
        <div className="pointer-events-none absolute inset-0">
          {blobs.map((blob, index) => (
            <div
              key={index}
              className="absolute"
              style={{
                left: blob.x,
                top: blob.y,
                width: blob.size * scale,
                height: blob.size * scale,
                background: blob.color,
                borderRadius: "48% 52% 44% 56% / 54% 46% 58% 42%",
                boxShadow: "inset 0 0 40px rgba(255,255,255,0.16), 0 0 50px rgba(255,255,255,0.08)",
              }}
            />
          ))}
        </div>
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,_transparent_0,_transparent_58%,rgba(255,255,255,0.14)_100%)]" />
        <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:radial-gradient(rgba(255,255,255,0.9)_0.8px,transparent_0.8px)] [background-size:26px_26px]" />
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 overflow-hidden"
      onMouseMove={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        rawPointerX.set((event.clientX - bounds.left) / bounds.width - 0.5);
        rawPointerY.set((event.clientY - bounds.top) / bounds.height - 0.5);
      }}
      onMouseLeave={() => {
        rawPointerX.set(0);
        rawPointerY.set(0);
      }}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.86),_transparent_52%),linear-gradient(180deg,_rgba(255,255,255,0.22),_rgba(255,255,255,0))]" />

      <svg className="absolute h-0 w-0" aria-hidden="true">
        <defs>
          <filter id="gooey-blobs-global">
            <feGaussianBlur in="SourceGraphic" stdDeviation="22" result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="
                1 0 0 0 0
                0 1 0 0 0
                0 0 1 0 0
                0 0 0 24 -10
              "
              result="goo"
            />
            <feBlend in="SourceGraphic" in2="goo" />
          </filter>
        </defs>
      </svg>

      <div className="pointer-events-none absolute inset-0" style={{ filter: "url(#gooey-blobs-global)" }}>
        {blobs.map((blob, index) => (
          <Blob key={index} {...blob} pointerX={pointerX} pointerY={pointerY} scale={scale} />
        ))}
        <motion.div className="absolute rounded-full bg-white/25 blur-2xl" style={{ left: glowX, top: glowY, x: "-50%", y: "-50%", width: 176 * scale, height: 176 * scale }} />
      </div>

      <motion.div className="pointer-events-none absolute rounded-full bg-white/12 blur-3xl" style={{ left: sheenX, top: sheenY, x: "-50%", y: "-50%", width: 448 * scale, height: 448 * scale }} />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,_transparent_0,_transparent_58%,rgba(255,255,255,0.14)_100%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:radial-gradient(rgba(255,255,255,0.9)_0.8px,transparent_0.8px)] [background-size:26px_26px]" />

      {sparkles.map((sparkle, index) => (
        <Sparkle key={index} {...sparkle} pointerX={pointerX} pointerY={pointerY} scale={scale} />
      ))}
    </div>
  );
}
