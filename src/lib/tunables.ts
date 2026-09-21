import { GameEngine } from "@/data/games";

export type TuningFieldType = "slider" | "select";

export interface TuningField {
  key: string;
  label: string;
  hint: string;
  type: TuningFieldType;
  min?: number;
  max?: number;
  step?: number;
  options?: { value: string; label: string }[];
}

export interface EngineTunables {
  label: string;
  fields: TuningField[];
}

const SPEED_FIELD: TuningField = {
  key: "speed",
  label: "Pace",
  hint: "How fast targets appear",
  type: "select",
  options: [
    { value: "slow", label: "Gentle" },
    { value: "medium", label: "Steady" },
    { value: "fast", label: "Quick" },
  ],
};

const VARIANT_FIELD: TuningField = {
  key: "variant",
  label: "Play style",
  hint: "How matching boards are played",
  type: "select",
  options: [
    { value: "", label: "Automatic by level" },
    { value: "open", label: "All cards face up" },
    { value: "flip", label: "Memory flip" },
    { value: "shadow", label: "Shadow match" },
  ],
};

const PAIRS_FIELD: TuningField = {
  key: "pairs",
  label: "Pairs on board",
  hint: "Fewer pairs = shorter, easier game",
  type: "slider",
  min: 2,
  max: 8,
  step: 1,
};

const MAX_COUNT_FIELD: TuningField = {
  key: "max",
  label: "Biggest number asked",
  hint: "Highest count the child will practise",
  type: "slider",
  min: 3,
  max: 20,
  step: 1,
};

const LENGTH_FIELD: TuningField = {
  key: "length",
  label: "Steps in the pattern",
  hint: "Longer chains are harder to hold in mind",
  type: "slider",
  min: 2,
  max: 6,
  step: 1,
};

const ITEMS_FIELD: TuningField = {
  key: "itemsPerCategory",
  label: "Items per group",
  hint: "How many pictures to sort in total per group",
  type: "slider",
  min: 1,
  max: 4,
  step: 1,
};

const SCENARIOS_FIELD: TuningField = {
  key: "scenarios",
  label: "Scenarios",
  hint: "Number of situations to talk through",
  type: "slider",
  min: 2,
  max: 6,
  step: 1,
};

export const ENGINE_TUNABLES: Partial<Record<GameEngine, EngineTunables>> = {
  matching: {
    label: "Matching",
    fields: [PAIRS_FIELD, VARIANT_FIELD],
  },
  counting: {
    label: "Counting",
    fields: [MAX_COUNT_FIELD],
  },
  tapping: {
    label: "Tapping",
    fields: [SPEED_FIELD],
  },
  sequence: {
    label: "Sequences",
    fields: [LENGTH_FIELD],
  },
  sorting: {
    label: "Sorting",
    fields: [ITEMS_FIELD],
  },
  social: {
    label: "Social scenarios",
    fields: [SCENARIOS_FIELD],
  },
  memory: {
    label: "Memory",
    fields: [],
  },
  building: {
    label: "Building",
    fields: [],
  },
};

export function getTunables(engine: GameEngine): EngineTunables | null {
  const entry = ENGINE_TUNABLES[engine];
  return entry && entry.fields.length > 0 ? entry : null;
}
