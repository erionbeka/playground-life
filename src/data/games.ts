export type GameCategory =
  | "playground"
  | "matching"
  | "sequences"
  | "sorting"
  | "tapping"
  | "social"
  | "building"
  | "colors-shapes"
  | "counting"
  | "memory"
  | "emotions"
  | "language"
  | "motor"
  | "motor-skills"
  | "daily-living";

export type GameEngine =
  | "sandbox"
  | "slide"
  | "bench"
  | "matching"
  | "sequence"
  | "sorting"
  | "tapping"
  | "social"
  | "building"
  | "recognition"
  | "counting"
  | "memory"
  | "magic-toys"
  | "odd-one-out"
  | "pattern-next"
  | "face-builder"
  | "whats-missing"
  | "situation-feelings"
  | "sound-memory"
  | "listen"
  | "choice-request"
  | "regulation"
  | "flexible"
  | "tracing";

export type Difficulty = "easy" | "medium" | "hard";

export type SupportLevel = "high" | "moderate" | "light";

export type ReadinessStage = "stabilize" | "build" | "generalize" | "stretch";

export const DEFAULT_CONTENT_VERSION = "v1.0.0";

export interface GameConfig {
  id: string;
  name: string;
  emoji: string;
  category: GameCategory;
  engine: GameEngine;
  description: string;
  skills: string[];
  difficulty: Difficulty;
  estimatedMinutes: number;
  supportsShared: boolean;
  supportsMultiplayer: boolean;
  ageRange?: { min: number; max: number };
  contentVersion?: string;
  learningGoal?: string;
  adultPrompt?: string;
  autismSupports?: string[];
  successCriteria?: string[];
  config: Record<string, unknown>;
  source?: "builtin" | "therapist";
}

const categoryMeta: Record<GameCategory, { label: string; emoji: string; color: string }> = {
  playground: { label: "Playground", emoji: "🏖️", color: "sky" },
  matching: { label: "Matching", emoji: "🧩", color: "lavender" },
  sequences: { label: "Sequences", emoji: "🔢", color: "coral" },
  sorting: { label: "Sorting", emoji: "📦", color: "mint" },
  tapping: { label: "Tapping", emoji: "👆", color: "sunshine" },
  social: { label: "Social", emoji: "🤝", color: "coral" },
  building: { label: "Building", emoji: "🏗️", color: "sky" },
  "colors-shapes": { label: "Colors & Shapes", emoji: "🎨", color: "lavender" },
  counting: { label: "Counting", emoji: "🔢", color: "mint" },
  memory: { label: "Memory", emoji: "🧠", color: "sunshine" },
  emotions: { label: "Emotions", emoji: "😊", color: "coral" },
  language: { label: "Language", emoji: "💬", color: "sky" },
  motor: { label: "Motor Skills", emoji: "✋", color: "mint" },
  "motor-skills": { label: "Motor Skills", emoji: "✋", color: "mint" },
  "daily-living": { label: "Daily Living", emoji: "🏠", color: "lavender" },
};

export { categoryMeta };function ageRangeFor(game: GameConfig) {
  if (game.difficulty === "easy") return { min: 0, max: 4 };
  if (game.difficulty === "medium") return { min: 3, max: 6 };
  return { min: 5, max: 8 };
}

const categoryLearningTargets: Record<GameCategory, { goal: string; prompt: string; supports: string[]; success: string[] }> = {
  playground: {
    goal: "Practice shared play, imitation, turn-taking, and safe body movement through predictable play routines.",
    prompt: "Model the action first, use a short phrase, then wait quietly for the child to copy or choose.",
    supports: ["first-then routine", "co-regulation pause", "turn-taking language", "movement break"],
    success: ["Completes the play routine", "Accepts a turn or transition", "Uses a gesture, word, or action to participate"],
  },
  matching: {
    goal: "Build visual discrimination, object recognition, joint attention, and working memory.",
    prompt: "Name one card, point to its match, and give the child time to scan before helping.",
    supports: ["reduced visual field", "matching by sameness", "errorless prompting option", "clear finish point"],
    success: ["Finds matching pairs", "Scans choices before tapping", "Completes the board with decreasing prompts"],
  },
  sequences: {
    goal: "Learn order, imitation, daily routines, and early executive-function skills.",
    prompt: "Say 'watch first, then your turn' and tap each step slowly while the child watches.",
    supports: ["watch-then-repeat structure", "predictable sequence", "visual step cues", "restart after mistakes"],
    success: ["Repeats the sequence", "Follows a first-next-last pattern", "Recovers from mistakes with support"],
  },
  sorting: {
    goal: "Develop category learning, receptive language, flexible thinking, and comparison skills.",
    prompt: "Say the category names out loud and gesture to each side before the child chooses.",
    supports: ["two-choice sorting", "category labels", "consistent button positions", "low-language response"],
    success: ["Sorts items into categories", "Responds to category labels", "Maintains attention across multiple items"],
  },
  tapping: {
    goal: "Practice visual tracking, fine-motor control, response inhibition, and sustained attention.",
    prompt: "Encourage slow looking first, then tapping only the target.",
    supports: ["large targets", "short timed round", "calm visual background", "distractor reduction by support level"],
    success: ["Taps visible targets", "Ignores decoys when present", "Completes the round without overload"],
  },
  social: {
    goal: "Practice social understanding, turn-taking, help-seeking, flexible choices, and kind communication.",
    prompt: "Read the situation slowly, act out the choices, and accept pointing or gestures as answers.",
    supports: ["social story format", "safe choice practice", "emotion-neutral feedback", "adult co-play"],
    success: ["Chooses a prosocial response", "Practices a communication action", "Stays engaged through multiple scenarios"],
  },
  building: {
    goal: "Strengthen planning, imitation from model, spatial reasoning, and visual-motor coordination.",
    prompt: "Show the model, name the next piece, and let the child place one piece at a time.",
    supports: ["build-from-model", "one-step-at-a-time", "visible template", "concrete shape pieces"],
    success: ["Places pieces in order", "Uses the model to guide action", "Completes the structure"],
  },
  "colors-shapes": {
    goal: "Learn early concepts including colors, shapes, visual attention, and receptive vocabulary.",
    prompt: "Name the target, point once, then wait for the child to select.",
    supports: ["clear visual targets", "small choice set", "label repetition", "gesture-friendly response"],
    success: ["Identifies target items", "Responds to color/shape labels", "Completes the visual search"],
  },
  counting: {
    goal: "Build early numeracy, one-to-one correspondence, attention, and quantity recognition.",
    prompt: "Point and count together slowly, then ask the child to choose the number.",
    supports: ["visible count set", "small number range", "answer choices", "shared counting"],
    success: ["Counts items with support", "Chooses the matching number", "Completes a counting trial"],
  },
  memory: {
    goal: "Practice recall, visual attention, sequencing memory, and listening/looking skills.",
    prompt: "Preview the items, use a calm countdown, then ask which item appeared in the named position.",
    supports: ["brief memory set", "predictable delay", "small answer set", "support-level timing"],
    success: ["Watches the memory set", "Chooses a recalled item", "Maintains focus through the delay"],
  },
  emotions: {
    goal: "Develop emotion recognition, self-regulation language, and body-state awareness.",
    prompt: "Label the feeling gently and connect it to a simple regulation choice.",
    supports: ["emotion labeling", "calm feedback", "safe pretend scenarios", "co-regulation option"],
    success: ["Identifies or practices a feeling", "Chooses a regulation-friendly response", "Uses gesture, word, or selection"],
  },
  language: {
    goal: "Support receptive and expressive communication, vocabulary, sentence starts, and conversation practice.",
    prompt: "Offer a model phrase and accept pointing, single words, AAC, or short phrases.",
    supports: ["short language models", "choice-based response", "AAC-friendly prompts", "wait time"],
    success: ["Responds to a language prompt", "Practices a word, gesture, or sentence", "Completes multiple communication turns"],
  },
  motor: {
    goal: "Practice fine-motor precision, hand-eye coordination, motor planning, and controlled movement.",
    prompt: "Demonstrate the motion slowly and let the child try without rushing.",
    supports: ["large tap targets", "short rounds", "calm pacing", "movement imitation"],
    success: ["Completes the motor action", "Improves control across the round", "Stays regulated while moving"],
  },
  "motor-skills": {
    goal: "Practice fine-motor precision, hand-eye coordination, motor planning, and controlled movement.",
    prompt: "Demonstrate the motion slowly and let the child try without rushing.",
    supports: ["large tap targets", "short rounds", "calm pacing", "movement imitation"],
    success: ["Completes the motor action", "Improves control across the round", "Stays regulated while moving"],
  },
  "daily-living": {
    goal: "Practice independence routines, transition readiness, self-care sequencing, and functional communication.",
    prompt: "Use the same words as the real routine and connect the game steps to daily life.",
    supports: ["routine sequence", "first-next-last cues", "functional vocabulary", "caregiver co-practice"],
    success: ["Orders routine steps", "Recognizes daily-living vocabulary", "Practices a real-life transition"],
  },
};

function enhanceGameForAutisticLearners(game: GameConfig): GameConfig {
  const target = categoryLearningTargets[game.category];
  const ageRange = ageRangeFor(game);
  return {
    ...game,
    ageRange,
    contentVersion: game.contentVersion || DEFAULT_CONTENT_VERSION,
    learningGoal: target.goal,
    adultPrompt: target.prompt,
    autismSupports: target.supports,
    successCriteria: target.success,
    estimatedMinutes: Math.min(game.estimatedMinutes, game.difficulty === "easy" ? 4 : game.difficulty === "medium" ? 5 : 6),
    config: {
      ...game.config,
      ageRange,
      learningGoal: target.goal,
      adultPrompt: target.prompt,
      autismSupports: target.supports,
      successCriteria: target.success,
      developmentalStage: game.difficulty === "easy" ? "early learner" : game.difficulty === "medium" ? "developing learner" : "school readiness",
      responseModes: ["tap", "point", "gesture", "spoken word", "AAC"],
    },
  };
}

function makeGames(): GameConfig[] {
  const games: GameConfig[] = [];
  let id = 1;
  const gid = () => `game-${String(id++).padStart(3, "0")}`;

  games.push(
    { id: gid(), name: "Sandy Shapes", emoji: "🏖️", category: "playground", engine: "sandbox", description: "Place colorful shapes in the sandbox", skills: ["creativity", "motor"], difficulty: "easy", estimatedMinutes: 5, supportsShared: true, supportsMultiplayer: true, config: { theme: "beach" } },
    { id: gid(), name: "Slide Fun", emoji: "🛝", category: "playground", engine: "slide", description: "Take turns going down the slide", skills: ["turn-taking", "patience"], difficulty: "easy", estimatedMinutes: 3, supportsShared: true, supportsMultiplayer: true, config: { speed: "slow" } },
    { id: gid(), name: "Bench Buddies", emoji: "🪑", category: "playground", engine: "bench", description: "Practice social choices at the park bench", skills: ["social", "choices"], difficulty: "easy", estimatedMinutes: 4, supportsShared: true, supportsMultiplayer: true, config: { scenarios: 5 } },
    { id: gid(), name: "Swing Together", emoji: "🎠", category: "playground", engine: "sandbox", description: "Coordinate swinging rhythms together", skills: ["coordination", "rhythm"], difficulty: "medium", estimatedMinutes: 4, supportsShared: true, supportsMultiplayer: true, config: { theme: "swings" } },
    { id: gid(), name: "See-Saw Balance", emoji: "⚖️", category: "playground", engine: "sandbox", description: "Balance the see-saw with a friend", skills: ["cooperation", "physics"], difficulty: "medium", estimatedMinutes: 5, supportsShared: true, supportsMultiplayer: true, config: { theme: "seesaw" } },
  );

  const matchThemes = ["Animals", "Food", "Vehicles", "Emotions", "Nature", "Clothes", "Tools", "Music", "Shapes", "Letters", "Numbers", "Colors", "Textures", "Seasons", "Body Parts"];
  matchThemes.forEach((theme, index) => {
    games.push({
      id: gid(),
      name: `Match ${theme}`,
      emoji: "🧩",
      category: "matching",
      engine: "matching",
      description: `Find matching pairs of ${theme.toLowerCase()}`,
      skills: ["memory", "attention"],
      difficulty: index < 5 ? "easy" : index < 10 ? "medium" : "hard",
      estimatedMinutes: 4,
      supportsShared: true,
      supportsMultiplayer: true,
      config: { theme: theme.toLowerCase(), pairs: index < 5 ? 4 : index < 10 ? 6 : 8 },
    });
  });

  const seqThemes = ["Colors", "Shapes", "Sounds", "Animals", "Numbers", "Patterns", "Dance Moves", "Musical Notes", "Emotions", "Actions", "Vehicles", "Foods", "Seasons", "Daily Routine", "Story Order"];
  seqThemes.forEach((theme, index) => {
    games.push({
      id: gid(),
      name: `${theme} Sequence`,
      emoji: "🔢",
      category: "sequences",
      engine: "sequence",
      description: `Watch and repeat the ${theme.toLowerCase()} pattern`,
      skills: ["memory", "sequencing"],
      difficulty: index < 5 ? "easy" : index < 10 ? "medium" : "hard",
      estimatedMinutes: 5,
      supportsShared: false,
      supportsMultiplayer: false,
      config: { theme: theme.toLowerCase(), length: index < 5 ? 3 : index < 10 ? 4 : 5 },
    });
  });

  const sortThemes = ["Farm vs City", "Hot vs Cold", "Big vs Small", "Living vs Non-living", "Day vs Night", "Healthy vs Unhealthy", "Land vs Water", "Loud vs Quiet", "Soft vs Hard", "Fast vs Slow", "Indoor vs Outdoor", "Happy vs Sad", "Sink vs Float", "Wild vs Domestic", "Fruits vs Vegetables"];
  sortThemes.forEach((theme, index) => {
    games.push({
      id: gid(),
      name: `Sort: ${theme}`,
      emoji: "📦",
      category: "sorting",
      engine: "sorting",
      description: `Sort items into ${theme} categories`,
      skills: ["categorization", "cognitive"],
      difficulty: index < 5 ? "easy" : index < 10 ? "medium" : "hard",
      estimatedMinutes: 5,
      supportsShared: true,
      supportsMultiplayer: true,
      config: { categories: theme.split(" vs "), items: 8 },
    });
  });

  const tapThemes = ["Butterflies", "Bubbles", "Stars", "Fish", "Balloons", "Fireflies", "Leaves", "Snowflakes", "Raindrops", "Birds", "Ladybugs", "Flowers", "Jellyfish", "Rockets", "Clouds"];
  tapThemes.forEach((theme, index) => {
    games.push({
      id: gid(),
      name: `Tap ${theme}`,
      emoji: "👆",
      category: "tapping",
      engine: "tapping",
      description: `Tap the ${theme.toLowerCase()} as they appear`,
      skills: ["motor", "reaction", "attention"],
      difficulty: index < 5 ? "easy" : index < 10 ? "medium" : "hard",
      estimatedMinutes: 3,
      supportsShared: false,
      supportsMultiplayer: true,
      config: { theme: theme.toLowerCase(), speed: index < 5 ? "slow" : index < 10 ? "medium" : "fast" },
    });
  });

  const socialThemes = ["Greetings", "Sharing", "Asking for Help", "Taking Turns", "Saying Please", "Saying Sorry", "Compliments", "Listening", "Eye Contact", "Personal Space", "Joining Play", "Expressing Feelings", "Waiting Patiently", "Reading Body Language", "Cooperative Problem Solving"];
  socialThemes.forEach((theme, index) => {
    games.push({
      id: gid(),
      name: theme,
      emoji: "🤝",
      category: "social",
      engine: "social",
      description: `Practice ${theme.toLowerCase()} in social scenarios`,
      skills: ["social", "communication"],
      difficulty: index < 5 ? "easy" : index < 10 ? "medium" : "hard",
      estimatedMinutes: 5,
      supportsShared: true,
      supportsMultiplayer: true,
      config: { scenarios: 4, theme: theme.toLowerCase() },
    });
  });

  const buildThemes = ["House", "Garden", "Spaceship", "Castle", "Farm", "City", "Ocean Scene", "Forest", "Kitchen", "Classroom", "Hospital", "Fire Station"];
  buildThemes.forEach((theme, index) => {
    games.push({
      id: gid(),
      name: `Build a ${theme}`,
      emoji: "🏗️",
      category: "building",
      engine: "building",
      description: `Place items to build a ${theme.toLowerCase()}`,
      skills: ["creativity", "planning"],
      difficulty: index < 4 ? "easy" : index < 8 ? "medium" : "hard",
      estimatedMinutes: 6,
      supportsShared: true,
      supportsMultiplayer: true,
      config: { scene: theme.toLowerCase(), pieces: 10 },
    });
  });

  const froebelBuilds = [
    {
      name: "Build a Triangle",
      description: "Choose the right pieces to build a triangle shape",
      difficulty: "easy" as Difficulty,
      estimatedMinutes: 4,
      objective: "Build a triangle with three matching edges",
      template: ["/\\", "[]", "/\\"],
      pieceOptions: ["/\\", "[]", "o", "="],
      skills: ["geometry", "spatial reasoning", "planning"],
    },
    {
      name: "Build a Square",
      description: "Place equal pieces to complete a square",
      difficulty: "easy" as Difficulty,
      estimatedMinutes: 4,
      objective: "Build a square using four equal sides",
      template: ["[]", "[]", "[]", "[]"],
      pieceOptions: ["[]", "/\\", "o", "||"],
      skills: ["geometry", "visual-motor", "planning"],
    },
    {
      name: "Build a Rectangle",
      description: "Notice the long and short sides while building a rectangle",
      difficulty: "medium" as Difficulty,
      estimatedMinutes: 5,
      objective: "Build a rectangle with matching opposite sides",
      template: ["[]", "=", "[]", "="],
      pieceOptions: ["[]", "=", "/\\", "o"],
      skills: ["geometry", "spatial reasoning", "sequencing"],
    },
    {
      name: "Build a Diamond",
      description: "Rotate and place angled pieces to build a diamond",
      difficulty: "medium" as Difficulty,
      estimatedMinutes: 5,
      objective: "Build a diamond from angled pieces",
      template: ["/\\", "<>", "\\/", "<>"],
      pieceOptions: ["/\\", "<>", "\\/", "[]"],
      skills: ["geometry", "planning", "visual discrimination"],
    },
    {
      name: "Pattern Block Flower",
      description: "Build a flower from repeated shape pieces",
      difficulty: "medium" as Difficulty,
      estimatedMinutes: 5,
      objective: "Repeat the same shape pattern around the center",
      template: ["o", "/\\", "/\\", "/\\", "/\\"],
      pieceOptions: ["o", "/\\", "[]", "="],
      skills: ["patterns", "spatial reasoning", "attention"],
    },
    {
      name: "Build a Block Bridge",
      description: "Use simple block pieces to build a bridge shape",
      difficulty: "hard" as Difficulty,
      estimatedMinutes: 6,
      objective: "Build a bridge with two supports and a top beam",
      template: ["||", "=", "||", "[]"],
      pieceOptions: ["||", "=", "[]", "/\\"],
      skills: ["planning", "spatial reasoning", "problem solving"],
    },
  ];

  froebelBuilds.forEach((game) => {
    games.push({
      id: gid(),
      name: game.name,
      emoji: "[]",
      category: "building",
      engine: "building",
      description: game.description,
      skills: game.skills,
      difficulty: game.difficulty,
      estimatedMinutes: game.estimatedMinutes,
      supportsShared: true,
      supportsMultiplayer: false,
      config: {
        objective: game.objective,
        template: game.template,
        pieceOptions: game.pieceOptions,
        source: "Froebel-inspired",
      },
    });
  });

  const physicalPlayBuilds = [
    {
      name: "Symmetry Board",
      objective: "Copy the left side so both sides match",
      modelLabel: "Mirror board",
      template: ["[]", "/\\", "/\\", "[]"],
      pieceOptions: ["[]", "/\\", "o", "="],
      difficulty: "easy" as Difficulty,
      skills: ["symmetry", "spatial reasoning", "attention"],
    },
    {
      name: "Copy the Pattern",
      objective: "Copy the repeating shape pattern from the model",
      modelLabel: "ABAB pattern",
      template: ["[]", "o", "[]", "o"],
      pieceOptions: ["[]", "o", "/\\", "="],
      difficulty: "easy" as Difficulty,
      skills: ["patterns", "sequencing", "visual-motor"],
    },
    {
      name: "Block Tower",
      objective: "Stack the tower from bottom to top",
      modelLabel: "Tall tower",
      template: ["[]", "[]", "[]", "/\\"],
      pieceOptions: ["[]", "/\\", "o", "||"],
      difficulty: "medium" as Difficulty,
      skills: ["planning", "motor", "spatial reasoning"],
    },
    {
      name: "Bridge From Model",
      objective: "Build the bridge to match the model",
      modelLabel: "Bridge with two supports",
      template: ["||", "=", "||", "[]"],
      pieceOptions: ["||", "=", "[]", "/\\"],
      difficulty: "medium" as Difficulty,
      skills: ["problem solving", "planning", "spatial reasoning"],
    },
    {
      name: "Stair Step Builder",
      objective: "Build the steps in the right order",
      modelLabel: "Three-step stair",
      template: ["[]", "[]", "=", "="],
      pieceOptions: ["[]", "=", "/\\", "o"],
      difficulty: "medium" as Difficulty,
      skills: ["sequencing", "spatial reasoning", "planning"],
    },
    {
      name: "Shape Mirror Bridge",
      objective: "Place matching pieces on both sides of the center",
      modelLabel: "Mirror bridge",
      template: ["/\\", "[]", "[]", "/\\"],
      pieceOptions: ["/\\", "[]", "o", "T"],
      difficulty: "hard" as Difficulty,
      skills: ["symmetry", "attention", "planning"],
    },
  ];

  physicalPlayBuilds.forEach((game) => {
    games.push({
      id: gid(),
      name: game.name,
      emoji: "[]",
      category: "building",
      engine: "building",
      description: game.objective,
      skills: game.skills,
      difficulty: game.difficulty,
      estimatedMinutes: 5,
      supportsShared: true,
      supportsMultiplayer: false,
      config: {
        objective: game.objective,
        modelLabel: game.modelLabel,
        template: game.template,
        pieceOptions: game.pieceOptions,
        source: "physical-play-inspired",
      },
    });
  });

  const colorShapeThemes = ["Red Things", "Blue Things", "Round Objects", "Square Objects", "Rainbow Sort", "Shape Shadows", "Color Mixing", "Pattern Fill", "Shape Puzzle", "Color Match", "Triangle Hunt", "Symmetry Mirror"];
  colorShapeThemes.forEach((theme, index) => {
    games.push({
      id: gid(),
      name: theme,
      emoji: "🎨",
      category: "colors-shapes",
      engine: "recognition",
      description: `Identify and select ${theme.toLowerCase()}`,
      skills: ["visual", "recognition"],
      difficulty: index < 4 ? "easy" : index < 8 ? "medium" : "hard",
      estimatedMinutes: 4,
      supportsShared: false,
      supportsMultiplayer: false,
      config: { theme: theme.toLowerCase(), items: 8 },
    });
  });

  const countThemes = ["Apples", "Stars", "Fish", "Blocks", "Fingers", "Coins", "Birds", "Flowers", "Cars", "Dots", "Butterflies", "Marbles"];
  countThemes.forEach((theme, index) => {
    games.push({
      id: gid(),
      name: `Count ${theme}`,
      emoji: "🔢",
      category: "counting",
      engine: "counting",
      description: `Count the ${theme.toLowerCase()} on screen`,
      skills: ["numeracy", "attention"],
      difficulty: index < 4 ? "easy" : index < 8 ? "medium" : "hard",
      estimatedMinutes: 4,
      supportsShared: false,
      supportsMultiplayer: false,
      config: { theme: theme.toLowerCase(), max: index < 4 ? 5 : index < 8 ? 10 : 20 },
    });
  });

  const memoryThemes = ["Faces", "Objects", "Words", "Sounds", "Positions", "Stories", "Sequences", "Colors", "Shapes", "Animals"];
  memoryThemes.forEach((theme, index) => {
    games.push({
      id: gid(),
      name: `Remember ${theme}`,
      emoji: "🧠",
      category: "memory",
      engine: "memory",
      description: `Remember and recall ${theme.toLowerCase()}`,
      skills: ["memory", "focus"],
      difficulty: index < 3 ? "easy" : index < 7 ? "medium" : "hard",
      estimatedMinutes: 5,
      supportsShared: false,
      supportsMultiplayer: false,
      config: { theme: theme.toLowerCase(), items: index < 3 ? 4 : index < 7 ? 6 : 8 },
    });
  });

  const emotionThemes = ["Happy Face", "Sad Face", "Angry Face", "Scared Face", "Surprised Face", "Calm Breathing", "Feeling Thermometer", "Emotion Charades", "Mood Match", "Feeling Stories", "Emotion Detective", "Calm Down Corner"];
  emotionThemes.forEach((theme, index) => {
    games.push({
      id: gid(),
      name: theme,
      emoji: "😊",
      category: "emotions",
      engine: "social",
      description: `Identify and express ${theme.toLowerCase()}`,
      skills: ["emotional-awareness", "self-regulation"],
      difficulty: index < 4 ? "easy" : index < 8 ? "medium" : "hard",
      estimatedMinutes: 5,
      supportsShared: true,
      supportsMultiplayer: true,
      config: { theme: theme.toLowerCase(), scenarios: 4 },
    });
  });

  const languageThemes = ["First Words", "Action Words", "Describing Words", "Question Starters", "Story Starters", "Rhyming Fun", "Sentence Builder", "What Comes Next", "Picture Naming", "Category Names", "Following Directions", "Conversation Starter"];
  languageThemes.forEach((theme, index) => {
    games.push({
      id: gid(),
      name: theme,
      emoji: "💬",
      category: "language",
      engine: "social",
      description: `Practice ${theme.toLowerCase()} skills`,
      skills: ["language", "communication", "vocabulary"],
      difficulty: index < 4 ? "easy" : index < 8 ? "medium" : "hard",
      estimatedMinutes: 5,
      supportsShared: true,
      supportsMultiplayer: false,
      config: { theme: theme.toLowerCase(), prompts: 6 },
    });
  });

  const motorThemes = ["Trace Lines", "Connect Dots", "Tap & Pop", "Tap & Aim", "Swipe Patterns", "Follow the Path", "Catch the Ball", "Pop & Hold", "Slow Drag", "Circle Draw", "Zig-Zag Trace", "Target Aim"];
  motorThemes.forEach((theme, index) => {
    games.push({
      id: gid(),
      name: theme,
      emoji: "✋",
      category: "motor",
      engine: "tapping",
      description: `Practice ${theme.toLowerCase()} motor skills`,
      skills: ["fine-motor", "coordination", "control"],
      difficulty: index < 4 ? "easy" : index < 8 ? "medium" : "hard",
      estimatedMinutes: 4,
      supportsShared: false,
      supportsMultiplayer: false,
      config: { theme: theme.toLowerCase(), targets: 8 },
    });
  });

  const dailyThemes = ["Morning Routine", "Getting Dressed", "Brushing Teeth", "Eating Meals", "Washing Hands", "Bedtime Steps", "Packing a Bag", "Setting the Table", "Tidying Up", "Going Shopping"];
  dailyThemes.forEach((theme, index) => {
    games.push({
      id: gid(),
      name: theme,
      emoji: "🏠",
      category: "daily-living",
      engine: "sequence",
      description: `Practice the ${theme.toLowerCase()} sequence`,
      skills: ["independence", "sequencing", "daily-living"],
      difficulty: index < 3 ? "easy" : index < 7 ? "medium" : "hard",
      estimatedMinutes: 5,
      supportsShared: true,
      supportsMultiplayer: false,
      config: { theme: theme.toLowerCase(), steps: 6 },
    });
  });

  games.push(
    { id: gid(), name: "Waiting For Turn", emoji: "⏳", category: "social", engine: "social", description: "Practice staying calm and waiting for your turn in common social moments", skills: ["turn-taking", "patience", "self-regulation"], difficulty: "easy", estimatedMinutes: 4, supportsShared: true, supportsMultiplayer: true, config: { theme: "waiting for turn", source: "Otsimo-inspired" } },
    { id: gid(), name: "Sharing Toys", emoji: "🧸", category: "social", engine: "social", description: "Practice friendly sharing choices while playing together", skills: ["sharing", "cooperation", "communication"], difficulty: "easy", estimatedMinutes: 4, supportsShared: true, supportsMultiplayer: true, config: { theme: "sharing toys", source: "Otsimo-inspired" } },
    { id: gid(), name: "Count Along", emoji: "🔢", category: "counting", engine: "counting", description: "Count along with bright stars as they appear on screen", skills: ["counting", "attention", "numeracy"], difficulty: "easy", estimatedMinutes: 4, supportsShared: false, supportsMultiplayer: false, config: { theme: "stars", max: 8, source: "Otsimo-inspired" } },
    { id: gid(), name: "Bright Color Match", emoji: "🎨", category: "matching", engine: "matching", description: "Find matching pairs of bright colors", skills: ["memory", "visual discrimination"], difficulty: "easy", estimatedMinutes: 4, supportsShared: true, supportsMultiplayer: true, config: { theme: "colors", pairs: 4, source: "Otsimo-inspired" } },
    { id: gid(), name: "Learn Animals", emoji: "🐾", category: "colors-shapes", engine: "recognition", description: "Tap the animal pictures and learn to recognize them", skills: ["recognition", "vocabulary", "attention"], difficulty: "easy", estimatedMinutes: 4, supportsShared: false, supportsMultiplayer: false, config: { theme: "learn animals", source: "Otsimo-inspired" } },
    { id: gid(), name: "Learn Emotions", emoji: "😊", category: "emotions", engine: "recognition", description: "Identify emotional expressions on faces", skills: ["emotional-awareness", "recognition"], difficulty: "easy", estimatedMinutes: 4, supportsShared: true, supportsMultiplayer: false, config: { theme: "learn emotions", source: "Otsimo-inspired" } },
    { id: gid(), name: "Vehicle Puzzle", emoji: "🚗", category: "building", engine: "building", description: "Place the vehicle pieces in order to complete the puzzle", skills: ["planning", "sequencing", "visual-motor"], difficulty: "easy", estimatedMinutes: 5, supportsShared: true, supportsMultiplayer: true, config: { scene: "vehicle puzzle", source: "Otsimo-inspired" } },
    { id: gid(), name: "Animal Memory Cards", emoji: "🧠", category: "memory", engine: "memory", description: "Remember the animal cards and choose the right one", skills: ["memory", "focus", "recognition"], difficulty: "easy", estimatedMinutes: 4, supportsShared: false, supportsMultiplayer: false, config: { theme: "animals", items: 4, source: "Otsimo-inspired" } }
  );

  games.push(
    { id: gid(), name: "Forest Magic", emoji: "🌳", category: "playground", engine: "magic-toys", description: "Tap the forest treasures as they are named", skills: ["attention", "vocabulary", "cause-effect"], difficulty: "easy", estimatedMinutes: 4, supportsShared: true, supportsMultiplayer: true, config: { theme: "forest" } },
    { id: gid(), name: "Dinosaur Magic", emoji: "🦖", category: "playground", engine: "magic-toys", description: "Tap the dinosaur treasures as they are named", skills: ["attention", "vocabulary", "cause-effect"], difficulty: "easy", estimatedMinutes: 4, supportsShared: true, supportsMultiplayer: true, config: { theme: "dinosaurs" } },
    { id: gid(), name: "Magic Bubbles", emoji: "🫧", category: "tapping", engine: "tapping", description: "Pop the bubbles as they float by", skills: ["motor", "attention", "reaction"], difficulty: "easy", estimatedMinutes: 3, supportsShared: false, supportsMultiplayer: false, config: { theme: "bubbles", speed: "slow" } },
    { id: gid(), name: "Next: Color Trios", emoji: "🔴", category: "sequences", engine: "pattern-next", description: "Continue the repeating three-color pattern", skills: ["patterns", "sequencing"], difficulty: "easy", estimatedMinutes: 4, supportsShared: false, supportsMultiplayer: false, config: { theme: "colorsTrio" } },
    { id: gid(), name: "Next: Animal Trios", emoji: "🐶", category: "sequences", engine: "pattern-next", description: "Continue the repeating three-animal pattern", skills: ["patterns", "sequencing"], difficulty: "easy", estimatedMinutes: 4, supportsShared: false, supportsMultiplayer: false, config: { theme: "animalsTrio" } },
    { id: gid(), name: "Odd One Out: Expert Animals", emoji: "🦜", category: "language", engine: "odd-one-out", description: "Find the one that does not belong in each animal group", skills: ["reasoning", "language"], difficulty: "hard", estimatedMinutes: 5, supportsShared: false, supportsMultiplayer: false, config: { theme: "expertAnimals" } },
    { id: gid(), name: "Odd One Out: Expert Foods", emoji: "🍽️", category: "language", engine: "odd-one-out", description: "Find the one that does not belong in each food group", skills: ["reasoning", "language"], difficulty: "hard", estimatedMinutes: 5, supportsShared: false, supportsMultiplayer: false, config: { theme: "expertFood" } },
    { id: gid(), name: "Category Match: Farm & City", emoji: "🚜", category: "matching", engine: "matching", description: "Place each picture in the right category", skills: ["categorization", "vocabulary"], difficulty: "easy", estimatedMinutes: 4, supportsShared: true, supportsMultiplayer: true, config: { matchStyle: "category", categories: ["Farm", "City"], categoryItems: { Farm: ["Cow", "Pig", "Tractor"], City: ["Bus", "Train"] } } },
    { id: gid(), name: "Category Match: Animals & Food", emoji: "🐾", category: "matching", engine: "matching", description: "Place each picture in the right category", skills: ["categorization", "vocabulary"], difficulty: "easy", estimatedMinutes: 4, supportsShared: true, supportsMultiplayer: true, config: { matchStyle: "category", categories: ["Animals", "Food"], categoryItems: { Animals: ["Cat", "Dog", "Bird"], Food: ["Apple", "Bread", "Milk"] } } },
    { id: gid(), name: "Sort Wet vs Dry", emoji: "💧", category: "sorting", engine: "sorting", description: "Sort items into wet and dry groups", skills: ["categorization", "cognitive"], difficulty: "easy", estimatedMinutes: 4, supportsShared: true, supportsMultiplayer: true, config: { categories: ["Wet", "Dry"] } },
    { id: gid(), name: "Sort Toys vs Tools", emoji: "🧸", category: "sorting", engine: "sorting", description: "Sort toys and tools into their groups", skills: ["categorization", "cognitive"], difficulty: "easy", estimatedMinutes: 4, supportsShared: true, supportsMultiplayer: true, config: { categories: ["Toys", "Tools"] } },
    { id: gid(), name: "Sort Sky Land Water", emoji: "🌈", category: "sorting", engine: "sorting", description: "Sort things into sky, land, and water", skills: ["categorization", "cognitive"], difficulty: "medium", estimatedMinutes: 5, supportsShared: true, supportsMultiplayer: true, config: { categories: ["Sky", "Land", "Water"] } },
    { id: gid(), name: "Sort Fruits Veggies Sweets", emoji: "🍎", category: "sorting", engine: "sorting", description: "Sort foods into fruits, vegetables, and sweets", skills: ["categorization", "cognitive"], difficulty: "medium", estimatedMinutes: 5, supportsShared: true, supportsMultiplayer: true, config: { categories: ["Fruits", "Vegetables", "Sweets"] } },
    { id: gid(), name: "Froebel Shadow Forms", emoji: "🌓", category: "matching", engine: "matching", description: "Match each shape to its shadow", skills: ["visual-discrimination", "attention"], difficulty: "easy", estimatedMinutes: 4, supportsShared: false, supportsMultiplayer: false, config: { theme: "shapes", variant: "shadow", pairs: 4 } },
    { id: gid(), name: "Count Penguins", emoji: "🐧", category: "counting", engine: "counting", description: "Count the penguins on screen", skills: ["numeracy", "attention"], difficulty: "easy", estimatedMinutes: 4, supportsShared: false, supportsMultiplayer: false, config: { theme: "penguins", max: 6 } },
    { id: gid(), name: "Count Monkeys", emoji: "🐒", category: "counting", engine: "counting", description: "Count the monkeys on screen", skills: ["numeracy", "attention"], difficulty: "easy", estimatedMinutes: 4, supportsShared: false, supportsMultiplayer: false, config: { theme: "monkeys", max: 8 } },
    { id: gid(), name: "Count Donuts", emoji: "🍩", category: "counting", engine: "counting", description: "Count the donuts on screen", skills: ["numeracy", "attention"], difficulty: "easy", estimatedMinutes: 4, supportsShared: false, supportsMultiplayer: false, config: { theme: "donuts", max: 6 } },
    { id: gid(), name: "Count Cupcakes", emoji: "🧁", category: "counting", engine: "counting", description: "Count the cupcakes on screen", skills: ["numeracy", "attention"], difficulty: "easy", estimatedMinutes: 4, supportsShared: false, supportsMultiplayer: false, config: { theme: "cupcakes", max: 8 } },
    { id: gid(), name: "Count Presents", emoji: "🎁", category: "counting", engine: "counting", description: "Count the presents on screen", skills: ["numeracy", "attention"], difficulty: "easy", estimatedMinutes: 4, supportsShared: false, supportsMultiplayer: false, config: { theme: "presents", max: 8 } },
    { id: gid(), name: "Count Candles", emoji: "🕯️", category: "counting", engine: "counting", description: "Count the candles on screen", skills: ["numeracy", "attention"], difficulty: "easy", estimatedMinutes: 4, supportsShared: false, supportsMultiplayer: false, config: { theme: "candles", max: 8 } },
    { id: gid(), name: "Count Bees", emoji: "🐝", category: "counting", engine: "counting", description: "Count the bees on screen", skills: ["numeracy", "attention"], difficulty: "easy", estimatedMinutes: 4, supportsShared: false, supportsMultiplayer: false, config: { theme: "bees", max: 8 } },
    { id: gid(), name: "Count Starfish", emoji: "🌟", category: "counting", engine: "counting", description: "Count the starfish on screen", skills: ["numeracy", "attention"], difficulty: "easy", estimatedMinutes: 4, supportsShared: false, supportsMultiplayer: false, config: { theme: "starfish", max: 8 } },
    { id: gid(), name: "Count Jellyfish", emoji: "🪼", category: "counting", engine: "counting", description: "Count the jellyfish on screen", skills: ["numeracy", "attention"], difficulty: "easy", estimatedMinutes: 4, supportsShared: false, supportsMultiplayer: false, config: { theme: "jellyfish", max: 8 } },
  );

  const choiceRequestPacks: Array<[string, string]> = [
    ["Choose A Snack", "snack"],
    ["Ask For Help", "help"],
    ["Ask For More", "more"],
    ["All Done", "all done"],
    ["I Need A Break", "break"],
    ["Pick Your Favorite", "favorite"],
  ];
  choiceRequestPacks.forEach(([name, theme]) => {
    games.push({
      id: gid(),
      name,
      emoji: "🗣️",
      category: "language",
      engine: "choice-request",
      description: `Practice requesting ${theme} with words, pictures, or AAC`,
      skills: ["communication", "self-advocacy"],
      difficulty: "easy",
      estimatedMinutes: 4,
      supportsShared: true,
      supportsMultiplayer: false,
      config: { theme },
    });
  });

  const regulationPacks: Array<[string, string]> = [
    ["First Snack Then Play", "first-then"],
    ["Getting Ready First", "getting-ready"],
    ["Body Check-In", "body-check"],
    ["Choose A Calm Strategy", "calm-strategy"],
    ["Asking For A Break", "break"],
    ["Settling Down", "default"],
  ];
  regulationPacks.forEach(([name, theme]) => {
    games.push({
      id: gid(),
      name,
      emoji: "🌿",
      category: "emotions",
      engine: "regulation",
      description: `Practice ${theme} regulation steps`,
      skills: ["self-regulation", "emotional-awareness"],
      difficulty: "easy",
      estimatedMinutes: 4,
      supportsShared: true,
      supportsMultiplayer: false,
      config: { theme },
    });
  });

  const flexiblePacks: Array<[string, string]> = [
    ["Plan B Practice", "plan-b"],
    ["Change of Plans", "change"],
    ["A New Way To Do It", "new-way"],
    ["When Things Change", "when-change"],
    ["Try A Different Way", "different-way"],
  ];
  flexiblePacks.forEach(([name, theme]) => {
    games.push({
      id: gid(),
      name,
      emoji: "🔀",
      category: "social",
      engine: "flexible",
      description: `Practice flexible thinking for ${theme}`,
      skills: ["flexibility", "problem-solving"],
      difficulty: "easy",
      estimatedMinutes: 4,
      supportsShared: true,
      supportsMultiplayer: false,
      config: { theme },
    });
  });

  return games;
}

export const allGames = makeGames().map(enhanceGameForAutisticLearners);

export function getGamesByCategory(category: GameCategory): GameConfig[] {
  return allGames.filter((game) => game.category === category);
}

export function getGameById(id: string): GameConfig | undefined {
  return allGames.find((game) => game.id === id);
}
