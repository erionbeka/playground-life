import { ComponentType } from "react";
import { GameConfig, GameEngine } from "@/data/games";
import type { GameCompletionMetrics } from "./gameCompletion";
import MatchingEngine from "./engines/MatchingEngine";
import SequenceEngine from "./engines/SequenceEngine";
import SortingEngine from "./engines/SortingEngine";
import TappingEngine from "./engines/TappingEngine";
import SocialEngine from "./engines/SocialEngine";
import RecognitionEngine from "./engines/RecognitionEngine";
import CountingEngine from "./engines/CountingEngine";
import MemoryEngine from "./engines/MemoryEngine";
import BuildingEngine from "./engines/BuildingEngine";
import MagicToysEngine from "./engines/MagicToysEngine";
import PatternNextEngine from "./engines/PatternNextEngine";
import OddOneOutEngine from "./engines/OddOneOutEngine";
import FaceBuilderEngine from "./engines/FaceBuilderEngine";
import WhatsMissingEngine from "./engines/WhatsMissingEngine";
import SituationFeelingsEngine from "./engines/SituationFeelingsEngine";
import SoundMemoryEngine from "./engines/SoundMemoryEngine";
import ListenEngine from "./engines/ListenEngine";
import IntraverbalEngine from "./engines/IntraverbalEngine";
import SentenceBuilderEngine from "./engines/SentenceBuilderEngine";
import CommentEngine from "./engines/CommentEngine";
import EchoicEngine from "./engines/EchoicEngine";
import ChoiceRequestEngine from "./engines/ChoiceRequestEngine";
import RegulationEngine from "./engines/RegulationEngine";
import FlexibleThinkingEngine from "./engines/FlexibleThinkingEngine";
import TracingEngine from "./engines/TracingEngine";
import SocialStoryEngine from "./engines/SocialStoryEngine";
import PlaygroundEngine from "./engines/PlaygroundEngine";
import GenericEngine from "./engines/GenericEngine";

export interface GameEngineProps {
  game: GameConfig;
  onInteraction: () => void;
  onComplete: (score: number, socialScore?: number, metrics?: GameCompletionMetrics) => void;
}

export const ENGINE_COMPONENTS: Record<GameEngine, ComponentType<GameEngineProps>> = {
  sandbox: PlaygroundEngine,
  slide: PlaygroundEngine,
  bench: PlaygroundEngine,
  matching: MatchingEngine,
  sequence: SequenceEngine,
  sorting: SortingEngine,
  tapping: TappingEngine,
  social: SocialEngine,
  building: BuildingEngine,
  recognition: RecognitionEngine,
  counting: CountingEngine,
  memory: MemoryEngine,
  "magic-toys": MagicToysEngine,
  "odd-one-out": OddOneOutEngine,
  "pattern-next": PatternNextEngine,
  "face-builder": FaceBuilderEngine,
  "whats-missing": WhatsMissingEngine,
  "situation-feelings": SituationFeelingsEngine,
  "sound-memory": SoundMemoryEngine,
  listen: ListenEngine,
  intraverbal: IntraverbalEngine,
  "sentence-builder": SentenceBuilderEngine,
  comment: CommentEngine,
  echoic: EchoicEngine,
  "choice-request": ChoiceRequestEngine,
  regulation: RegulationEngine,
  flexible: FlexibleThinkingEngine,
  tracing: TracingEngine,
  "social-story": SocialStoryEngine,
};

export const GENERIC_ENGINE_FALLBACK = GenericEngine;

export function hasEngineComponent(engine: GameEngine): boolean {
  return Boolean(ENGINE_COMPONENTS[engine]);
}

export default function GameEngineView(props: GameEngineProps) {
  const Engine = ENGINE_COMPONENTS[props.game.engine] || GenericEngine;
  return <Engine {...props} />;
}
