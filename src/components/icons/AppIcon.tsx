import {
  BarChart3,
  Blocks,
  BookOpen,
  Brain,
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  Hand,
  HeartHandshake,
  Home,
  MessageCircle,
  MousePointerClick,
  Palette,
  Play,
  School,
  Shapes,
  Smile,
  Sparkles,
  ToyBrick,
  UserRound,
  UsersRound,
} from "lucide-react";
import { GameCategory, GameConfig } from "@/data/games";

type IconSize = "sm" | "md" | "lg" | "xl";
type IconTone = "sky" | "mint" | "amber" | "rose" | "violet" | "slate";

const sizeClass: Record<IconSize, string> = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-12 w-12",
  xl: "h-20 w-20",
};

const iconSizeClass: Record<IconSize, string> = {
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-6 w-6",
  xl: "h-10 w-10",
};

const toneClass: Record<IconTone, string> = {
  sky: "bg-sky-100 text-sky-700 ring-sky-200",
  mint: "bg-emerald-100 text-emerald-700 ring-emerald-200",
  amber: "bg-amber-100 text-amber-800 ring-amber-200",
  rose: "bg-rose-100 text-rose-700 ring-rose-200",
  violet: "bg-violet-100 text-violet-700 ring-violet-200",
  slate: "bg-slate-100 text-slate-700 ring-slate-200",
};

const categoryVisuals: Record<GameCategory, { icon: typeof Shapes; tone: IconTone }> = {
  playground: { icon: Play, tone: "sky" },
  matching: { icon: Blocks, tone: "violet" },
  sequences: { icon: CalendarCheck, tone: "amber" },
  sorting: { icon: ClipboardList, tone: "mint" },
  tapping: { icon: MousePointerClick, tone: "sky" },
  social: { icon: HeartHandshake, tone: "rose" },
  building: { icon: ToyBrick, tone: "amber" },
  "colors-shapes": { icon: Palette, tone: "violet" },
  counting: { icon: BarChart3, tone: "mint" },
  memory: { icon: Brain, tone: "amber" },
  emotions: { icon: Smile, tone: "rose" },
  language: { icon: MessageCircle, tone: "sky" },
  motor: { icon: Hand, tone: "mint" },
  "daily-living": { icon: Home, tone: "violet" },
  sensory: { icon: Sparkles, tone: "violet" },
  reasoning: { icon: Shapes, tone: "sky" },
};

const shapeTokenMarks: Record<string, string> = {
  "[]": "froebel-cube",
  "/\\": "froebel-prism",
  "\\/": "froebel-prism",
  "o": "froebel-sphere",
  "=": "froebel-plank",
  "||": "froebel-column",
  "<>": "froebel-diamond",
  "^": "froebel-prism",
};

function isEmojiLike(value?: string) {
  if (!value) return false;
  return value.length <= 4 && /[^\w\s]/u.test(value);
}

export function CategoryIcon({ category, size = "md", label }: { category: GameCategory; size?: IconSize; label?: string }) {
  const visual = categoryVisuals[category] || { icon: Sparkles, tone: "slate" as IconTone };
  const Icon = visual.icon;

  return (
    <span className={`inline-grid shrink-0 place-items-center rounded-2xl ring-1 ${sizeClass[size]} ${toneClass[visual.tone]}`} aria-label={label || category}>
      <Icon className={iconSizeClass[size]} aria-hidden="true" strokeWidth={2.4} />
    </span>
  );
}

export function GameIcon({ game, mark, size = "md" }: { game?: GameConfig | null; mark?: string; size?: IconSize }) {
  const token = mark || game?.emoji || "";
  const shapeClass = shapeTokenMarks[token];

  if (shapeClass) {
    return (
      <span className={`game-mark game-mark-${size}`} aria-label={`${game?.name || "Shape"} icon`}>
        <span className={`froebel-object ${shapeClass}`} aria-hidden="true" />
      </span>
    );
  }

  if (isEmojiLike(token)) {
    return (
      <span className={`inline-grid shrink-0 place-items-center rounded-2xl bg-white/75 ring-1 ring-border ${sizeClass[size]}`} aria-label={`${game?.name || "Game"} icon`}>
        <span className={size === "xl" ? "text-5xl" : size === "lg" ? "text-3xl" : "text-xl"} aria-hidden="true">{token}</span>
      </span>
    );
  }

  if (game) return <CategoryIcon category={game.category} size={size} label={`${game.name} icon`} />;

  return (
    <span className={`inline-grid shrink-0 place-items-center rounded-2xl ring-1 ${sizeClass[size]} ${toneClass.slate}`} aria-label="Game icon">
      <Sparkles className={iconSizeClass[size]} aria-hidden="true" strokeWidth={2.4} />
    </span>
  );
}

export function PersonIcon({ label, avatar, size = "md" }: { label: string; avatar?: string; size?: IconSize }) {
  const initial = label.trim().slice(0, 1).toUpperCase() || "P";

  if (isEmojiLike(avatar)) {
    return (
      <span className={`inline-grid shrink-0 place-items-center rounded-full bg-white/80 ring-1 ring-border ${sizeClass[size]}`} aria-label={`${label} avatar`}>
        <span className={size === "lg" ? "text-2xl" : "text-xl"} aria-hidden="true">{avatar}</span>
      </span>
    );
  }

  return (
    <span className={`inline-grid shrink-0 place-items-center rounded-full bg-primary/10 font-black text-primary ring-1 ring-primary/20 ${sizeClass[size]}`} aria-label={`${label} avatar`}>
      {initial}
    </span>
  );
}

export const therapistNavIcons: Record<string, typeof Shapes> = {
  overview: BarChart3,
  children: UsersRound,
  assign: ClipboardList,
  clinic: School,
  review: CheckCircle2,
};

export { BookOpen, School, UsersRound };
