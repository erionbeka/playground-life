import { Volume2, VolumeX, Waves, Wind, MessageCircle, MessageSquareOff } from "lucide-react";
import { updateSensory, useSensory } from "@/lib/sensory";
import { isVoiceEnabled, setVoiceEnabled, speak } from "@/lib/speech";
import { useState } from "react";

export function useVoiceToggle() {
  const [voiceOn, setVoiceOn] = useState(() => isVoiceEnabled());
  const toggle = () => {
    setVoiceOn((current) => {
      const next = !current;
      setVoiceEnabled(next);
      if (next) speak("Voice is on.");
      return next;
    });
  };
  return { voiceOn, toggleVoice: toggle };
}

function Pill({
  active,
  label,
  onClick,
  children,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={`touch-target grid h-9 w-9 place-items-center rounded-full transition ${
        active ? "bg-primary/12 text-primary ring-1 ring-primary/25" : "bg-muted text-muted-foreground"
      }`}
    >
      {children}
    </button>
  );
}

export default function SensoryControls({
  onBreathingBreak,
  onRegulationEvent,
}: {
  onBreathingBreak?: () => void;
  onRegulationEvent?: (type: "calm" | "voice" | "sound", enabled: boolean) => void;
}) {
  const { soundOn, calmMode } = useSensory();
  const { voiceOn, toggleVoice } = useVoiceToggle();

  const report = (type: "calm" | "voice" | "sound", enabled: boolean) => {
    onRegulationEvent?.(type, enabled);
  };

  return (
    <div className="flex items-center gap-1.5 rounded-full border border-border bg-card/90 px-2 py-1 shadow-sm">
      <Pill
        active={soundOn}
        label={soundOn ? "Turn sound effects off" : "Turn sound effects on"}
        onClick={() => {
          updateSensory({ soundOn: !soundOn });
          report("sound", !soundOn);
        }}
      >
        {soundOn ? <Volume2 className="h-4 w-4" aria-hidden="true" /> : <VolumeX className="h-4 w-4" aria-hidden="true" />}
      </Pill>

      <Pill active={voiceOn} label={voiceOn ? "Turn spoken voice off" : "Turn spoken voice on"} onClick={() => { toggleVoice(); report("voice", !voiceOn); }}>
        {voiceOn ? <MessageCircle className="h-4 w-4" aria-hidden="true" /> : <MessageSquareOff className="h-4 w-4" aria-hidden="true" />}
      </Pill>

      <Pill
        active={calmMode}
        label={calmMode ? "Calm mode is on: fewer animations, no timers" : "Turn on calm mode"}
        onClick={() => {
          updateSensory({ calmMode: !calmMode });
          if (!calmMode) speak("Calm mode is on. Take your time.");
          report("calm", !calmMode);
        }}
      >
        <Waves className="h-4 w-4" aria-hidden="true" />
      </Pill>

      {onBreathingBreak ? (
        <Pill active={false} label="Take a calming breath break" onClick={onBreathingBreak}>
          <Wind className="h-4 w-4" aria-hidden="true" />
        </Pill>
      ) : null}
    </div>
  );
}
