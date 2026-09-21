import { COMPANION, companionGreeting } from "@/lib/companion";
import { cn } from "@/lib/utils";

interface GuideCompanionProps {
  message?: string;
  className?: string;
}

export default function GuideCompanion({ message, className }: GuideCompanionProps) {
  return (
    <div className={cn("flex items-start gap-2 rounded-2xl bg-card/80 p-3", className)}>
      <span aria-hidden="true" className="text-2xl">
        {COMPANION.emoji}
      </span>
      <p className="text-sm leading-5 text-foreground/90">
        {message ?? companionGreeting("friend")}
      </p>
    </div>
  );
}