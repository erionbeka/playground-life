import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useApp, HomeworkAssignment } from "@/context/AppContext";
import { getCatalogGameById, useCatalog } from "@/lib/customCatalog";
import { AnimatePresence, motion } from "framer-motion";
import MatchingEngine from "./engines/MatchingEngine";
import TappingEngine from "./engines/TappingEngine";
import SocialEngine from "./engines/SocialEngine";
import GenericEngine from "./engines/GenericEngine";
import PlaygroundEngine from "./engines/PlaygroundEngine";
import SequenceEngine from "./engines/SequenceEngine";
import SortingEngine from "./engines/SortingEngine";
import RecognitionEngine from "./engines/RecognitionEngine";
import CountingEngine from "./engines/CountingEngine";
import MemoryEngine from "./engines/MemoryEngine";
import BuildingEngine from "./engines/BuildingEngine";
import MagicToysEngine from "./engines/MagicToysEngine";
import CelebrationOverlay from "./CelebrationOverlay";
import BreathingOverlay from "./BreathingOverlay";
import SensoryControls from "./SensoryControls";
import RealWorldExtension from "./RealWorldExtension";
import ResponseModes from "./ResponseModes";
import { useGameAudio } from "./useGameAudio";
import { getChildReadinessState } from "@/lib/personalization";
import CoreWordBar from "@/components/aac/CoreWordBar";
import { appendChildEvent } from "@/lib/sessionEvents";
import { ResponseMode } from "@/lib/responseModes";
import { AAC_POSITIONING } from "@/lib/positioning";
import InputModeProvider from "@/components/input/InputModeProvider";
import { useTargetRegion } from "@/components/input/context";

interface Props {
  gameId: string;
  assignment: HomeworkAssignment;
  onComplete: () => void;
  onExit?: () => void;
}

export default function GamePlayer({ gameId, assignment, onComplete, onExit }: Props) {
  const { completeGame, children, assignments } = useApp();
  const catalog = useCatalog();
  const game = getCatalogGameById(gameId);
  const [started, setStarted] = useState(false);
  const [startTime] = useState(Date.now());
  const [interactions, setInteractions] = useState(0);
  const [celebrationVisible, setCelebrationVisible] = useState(false);
  const [quitVisible, setQuitVisible] = useState(false);
  const [breathingVisible, setBreathingVisible] = useState(false);
  const breathingOpenedAt = useRef<number | null>(null);
  const { warmUpAudio, playTapSound, playStartSound, playCelebrationSound } = useGameAudio();
  const playRef = useTargetRegion("play", 20);
  const aacRef = useTargetRegion("aac", 10);
  const dialogRef = useTargetRegion("dialog", 30);

  const child = useMemo(
    () => children.find((candidate) => candidate.id === assignment.childId) || null,
    [assignment.childId, children]
  );

  const celebrationConfig = useMemo(() => {
    const loweredNotes = child?.notes.toLowerCase() || "";

    if (loweredNotes.includes("animal")) {
      return {
        message: `${child?.name || "You"} finished strong, so a parade of animal friends is here to cheer you on!`,
        themes: [
          { icon: "🦊", label: "Forest Friends", accentClass: "bg-emerald-400/25", glowClass: "text-emerald-200" },
          { icon: "🐼", label: "Animal Party", accentClass: "bg-sky-400/25", glowClass: "text-sky-200" },
          { icon: "🦁", label: "Wild Cheers", accentClass: "bg-amber-400/25", glowClass: "text-amber-200" },
          { icon: "🐬", label: "Ocean Splash", accentClass: "bg-cyan-400/25", glowClass: "text-cyan-200" },
        ],
      };
    }

    if (loweredNotes.includes("visual") || loweredNotes.includes("pattern")) {
      return {
        message: `${child?.name || "You"} just completed another challenge, so bright shapes and stars are celebrating every smart move!`,
        themes: [
          { icon: "🌈", label: "Color Burst", accentClass: "bg-fuchsia-400/25", glowClass: "text-fuchsia-200" },
          { icon: "⭐", label: "Star Spark", accentClass: "bg-amber-400/25", glowClass: "text-amber-200" },
          { icon: "🧩", label: "Pattern Pop", accentClass: "bg-violet-400/25", glowClass: "text-violet-200" },
          { icon: "💫", label: "Glow Trail", accentClass: "bg-sky-400/25", glowClass: "text-sky-200" },
        ],
      };
    }

    return {
      message: `${child?.name || "You"} did it, and this celebration is here to make the finish feel extra special.`,
      themes: [
        { icon: "🎉", label: "Big Cheers", accentClass: "bg-rose-400/25", glowClass: "text-rose-200" },
        { icon: "🌟", label: "Shiny Win", accentClass: "bg-amber-400/25", glowClass: "text-amber-200" },
        { icon: "🎈", label: "Balloon Lift", accentClass: "bg-sky-400/25", glowClass: "text-sky-200" },
        { icon: "🎶", label: "Happy Beats", accentClass: "bg-emerald-400/25", glowClass: "text-emerald-200" },
      ],
    };
  }, [child]);

  const readiness = useMemo(
    () => (child ? getChildReadinessState(child, assignments) : null),
    [assignments, child]
  );

  const runtimeGame = useMemo(
    () => game ? ({
      ...game,
      config: {
        ...game.config,
        assignedDifficulty: assignment.difficulty || game.difficulty,
        supportLevel: assignment.supportLevel || game.config.supportLevel || "moderate",
        readinessStage: readiness?.stage || "build",
      },
    }) : null,
    [assignment.difficulty, assignment.supportLevel, game, readiness?.stage]
  );

  const handleInteraction = useCallback(() => {
    playTapSound();
    setInteractions((prev) => prev + 1);
  }, [playTapSound]);

  const handleNonScreenResponse = useCallback(
    (mode: ResponseMode) => {
      handleInteraction();
      appendChildEvent(assignment.childId, "response_mode", mode);
    },
    [assignment.childId, handleInteraction]
  );

  const handleAacLog = useCallback(
    (type: string, detail?: string) => {
      appendChildEvent(assignment.childId, type, detail);
    },
    [assignment.childId]
  );

  const leaveSession = useCallback(() => {
    if (onExit) onExit();
    else onComplete();
  }, [onComplete, onExit]);

  const requestExit = useCallback(() => {
    if (started && interactions > 0 && !celebrationVisible) {
      setQuitVisible(true);
    } else {
      leaveSession();
    }
  }, [interactions, leaveSession, started, celebrationVisible]);

  const confirmQuit = useCallback(() => {
    appendChildEvent(assignment.childId, "quit_mid_game", `after ${interactions} interactions`);
    leaveSession();
  }, [assignment.childId, interactions, leaveSession]);

  const openBreathing = useCallback(() => {
    breathingOpenedAt.current = Date.now();
    setBreathingVisible(true);
  }, []);

  const closeBreathing = useCallback(() => {
    if (breathingOpenedAt.current !== null) {
      const elapsedMs = Date.now() - breathingOpenedAt.current;
      const seconds = Math.max(1, Math.round(elapsedMs / 1000));
      appendChildEvent(assignment.childId, "breathing_break", `${seconds}s`);
      breathingOpenedAt.current = null;
    }
    setBreathingVisible(false);
  }, [assignment.childId]);

  useEffect(() => {
    if (!celebrationVisible) return;

    playCelebrationSound();
  }, [celebrationVisible, playCelebrationSound]);

  const handleGameComplete = useCallback(
    (score: number, socialScore?: number) => {
      const durationSeconds = Math.round((Date.now() - startTime) / 1000);
      completeGame(assignment.id, {
        gameId,
        completedAt: new Date().toISOString().slice(0, 10),
        durationSeconds,
        score,
        interactions,
        socialScore,
      });
      setCelebrationVisible(true);
    },
    [assignment.id, completeGame, gameId, interactions, startTime]
  );

  if (!game) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-foreground">Game not found</p>
      </div>
    );
  }

  if (!started) {
    const supportLevelLabel = assignment.supportLevel || "moderate";
    const successMarkers =
      assignment.monthlyPlan && assignment.monthlyPlan.successMarkers.length > 0
        ? assignment.monthlyPlan.successMarkers
        : game.successCriteria || [];

    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-md"
        >
          <div className="text-7xl mb-4 animate-bounce-gentle">{game.emoji}</div>
          <h1 className="font-display text-3xl font-extrabold text-foreground mb-2">{game.name}</h1>
          <p className="text-muted-foreground mb-6">{game.description}</p>
          <div className="mb-5 rounded-2xl border border-border bg-card p-4 text-left">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {game.ageRange ? (
                <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-foreground">
                  Ages {game.ageRange.min}-{game.ageRange.max}
                </span>
              ) : null}
              <span className="rounded-full bg-secondary/20 px-3 py-1 text-xs font-semibold text-foreground capitalize">
                {game.difficulty}
              </span>
            </div>
            {game.learningGoal ? (
              <p className="text-sm font-semibold text-foreground">{game.learningGoal}</p>
            ) : null}
            {game.adultPrompt ? (
              <RealWorldExtension prompt={game.adultPrompt} className="mt-3" />
            ) : null}
          </div>
          <div className="flex gap-3 justify-center mb-6">
            {game.skills.map((s) => (
              <span key={s} className="text-xs bg-primary/10 text-foreground px-3 py-1 rounded-full capitalize">{s}</span>
            ))}
          </div>
          <div className="mb-6 rounded-2xl border border-border bg-card p-4 text-left">
            <p className="mb-3 text-sm font-black uppercase tracking-[0.18em] text-primary">Your plan</p>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>What you will do — {game.description}</p>
              <p>Approximate length — about {game.estimatedMinutes} minutes</p>
              <p>Support level — {supportLevelLabel}. Extra help: {(game.autismSupports || []).join(", ")}</p>
              <p>What success looks like — {successMarkers.join(", ")}</p>
              <p>How to pause or stop — press Exit at any time.</p>
              <p>{AAC_POSITIONING.responseModesLine}</p>
              <p>Caregiver — a grown-up plays alongside your child.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 justify-center">
            <button
              onClick={() => onExit?.()}
              className="px-5 py-3 border border-border text-muted-foreground rounded-xl font-semibold touch-target"
            >
              Opt out
            </button>
            <button onClick={onComplete} className="px-6 py-3 bg-muted text-muted-foreground rounded-xl font-semibold touch-target">
              Back
            </button>
            <button
              onClick={() => {
                warmUpAudio();
                playStartSound();
                setStarted(true);
              }}
              className="px-8 py-3 bg-primary text-primary-foreground rounded-xl font-display font-bold text-lg touch-target"
            >
              Start
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (!runtimeGame) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-foreground">Game not found</p>
      </div>
    );
  }

  const engineProps = { game: runtimeGame, onInteraction: handleInteraction, onComplete: handleGameComplete };

  return (
    <InputModeProvider childId={assignment.childId}>
      <div className="min-h-screen">
      <div className="bg-card/85 backdrop-blur-md border-b border-border px-4 py-2 flex items-center justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <span role="img" aria-label={game.name} title={game.name} className="text-xl">{game.emoji}</span>
          {runtimeGame.learningGoal ? (
            <p className="hidden text-[10px] text-muted-foreground sm:block">{runtimeGame.learningGoal}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <SensoryControls onBreathingBreak={openBreathing} />
          <button onClick={requestExit} className="text-xs text-muted-foreground hover:text-foreground touch-target px-3">
            Exit
          </button>
        </div>
      </div>

      <div className="relative p-4" ref={playRef}>
        {game.engine === "matching" ? (
          <MatchingEngine {...engineProps} />
        ) : game.engine === "tapping" ? (
          <TappingEngine {...engineProps} />
        ) : game.engine === "magic-toys" ? (
          <MagicToysEngine {...engineProps} />
        ) : game.engine === "social" ? (
          <SocialEngine {...engineProps} />
        ) : game.engine === "sandbox" || game.engine === "slide" || game.engine === "bench" ? (
          <PlaygroundEngine {...engineProps} />
        ) : game.engine === "sequence" ? (
          <SequenceEngine {...engineProps} />
        ) : game.engine === "sorting" ? (
          <SortingEngine {...engineProps} />
        ) : game.engine === "recognition" ? (
          <RecognitionEngine {...engineProps} />
        ) : game.engine === "counting" ? (
          <CountingEngine {...engineProps} />
        ) : game.engine === "memory" ? (
          <MemoryEngine {...engineProps} />
        ) : game.engine === "building" ? (
          <BuildingEngine {...engineProps} />
        ) : (
          <GenericEngine {...engineProps} />
        )}

        <AnimatePresence>
          {celebrationVisible && child ? (
            <CelebrationOverlay
              childName={child.name}
              childAvatar={child.avatar}
              message={celebrationConfig.message}
              themes={celebrationConfig.themes}
              extensionPrompt={game.adultPrompt}
              regionRef={dialogRef}
              onContinue={() => {
                appendChildEvent(assignment.childId, "celebration_closed");
                setCelebrationVisible(false);
                onComplete();
              }}
            />
          ) : null}
        </AnimatePresence>

        <ResponseModes onResponse={handleNonScreenResponse} className="mt-4" />
      </div>

      {quitVisible ? (
        <div ref={dialogRef} className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 text-center shadow-2xl">
            <h2 className="font-display text-xl font-bold text-foreground">Leave this game?</h2>
            <p className="mt-2 text-sm text-muted-foreground">This round will not be saved, and that is okay.</p>
            <div className="mt-5 flex flex-col gap-3">
              <button
                onClick={() => setQuitVisible(false)}
                className="rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground touch-target"
              >
                Keep playing
              </button>
              <button
                onClick={confirmQuit}
                className="rounded-xl border border-border px-5 py-3 text-sm font-semibold text-muted-foreground touch-target"
              >
                Leave now
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {breathingVisible ? <BreathingOverlay onExit={closeBreathing} regionRef={dialogRef} /> : null}

      <div className="fixed inset-x-0 bottom-0 z-40" ref={aacRef}>
        <CoreWordBar onLog={handleAacLog} />
      </div>
      </div>
    </InputModeProvider>
  );
}
