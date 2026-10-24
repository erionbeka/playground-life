import { allGames, Difficulty, GameConfig } from "@/data/games";

/**
 * Developmental domains used by the PLAYGROUND crosswalk.
 *
 * These are generic developmental constructs drawn from the early-development
 * literature. They are deliberately NOT the item wording, task codes, or
 * scoring criteria of any published assessment instrument. The crosswalk exists
 * so that outside clinicians can independently relate PLAYGROUND activities to
 * established frameworks (for example by administering ABLLS-R or an AAC
 * assessment separately) without PLAYGROUND reproducing anyone else's instrument.
 */
export const DEVELOPMENTAL_DOMAINS = [
  "receptive language",
  "expressive language",
  "imitation",
  "visual discrimination",
  "visual-spatial",
  "categorisation",
  "sequencing",
  "problem solving",
  "social reciprocity",
  "functional communication",
  "symbolic/social play",
  "adaptive/self-care",
  "receptive instructions",
  "joint attention",
  "early academic",
  "emotional regulation",
  "motor planning",
] as const;

export type DevelopmentalDomain = (typeof DEVELOPMENTAL_DOMAINS)[number];

export const EXTERNAL_FRAMEWORKS = [
  "ABLLS-R-compatible",
  "AAC-compatible",
] as const;

export type ExternalFramework = (typeof EXTERNAL_FRAMEWORKS)[number];

export interface ExternalConstruct {
  framework: ExternalFramework;
  /** Our own generic domain label, never an instrument item or code. */
  domain: string;
}

/**
 * How a child can respond inside an activity. PLAYGROUND accepts any of these
 * modes rather than requiring speech, so the platform adapts to how the child
 * communicates instead of the child having to adapt to the platform.
 */
export const COMMUNICATION_MODES = [
  "touch",
  "switch/scanning",
  "dwell",
  "symbol selection",
  "gesture/pointing",
  "vocal/verbal",
] as const;

export type CommunicationMode = (typeof COMMUNICATION_MODES)[number];

export interface CrosswalkRow {
  gameId: string;
  playgroundWorld: string;
  developmentalDomains: DevelopmentalDomain[];
  construct: string;
  ageBand: [number, number];
  skillTarget: string;
  /** Foundational construct a child typically relies on before this activity. */
  prerequisiteSkill: string;
  observableBehaviour: string;
  /** Observable mastery criterion for moving on (our own, not an instrument rule). */
  progressionCriterion: string;
  /** Response modes the activity accepts; never speech-only. */
  communicationMode: CommunicationMode[];
  difficulty: Difficulty;
  parentPrompt: string;
  clinicianMetric: string;
  externalConstruct: ExternalConstruct;
}

/**
 * The PLAYGROUND world each engine belongs to. Worlds are the friendly,
 * child-facing groupings used in the platform narrative (Look & Find, Tell Me,
 * Copy Me, Build It, Sort & Match, My Turn / Your Turn, Ask Me, Play Together,
 * Everyday Me, Listen & Do).
 */
export const PLAYGROUND_WORLD_BY_ENGINE: Record<string, string> = {
  matching: "Look & Find",
  memory: "Look & Find",
  "whats-missing": "Look & Find",
  recognition: "Tell Me",
  "situation-feelings": "Tell Me",
  "face-builder": "Tell Me",
  sequence: "Build It",
  counting: "Build It",
  building: "Build It",
  "pattern-next": "Build It",
  sorting: "Sort & Match",
  "odd-one-out": "Sort & Match",
  tapping: "Copy Me",
  tracing: "Copy Me",
  social: "My Turn / Your Turn",
  "choice-request": "Ask Me",
  regulation: "Everyday Me",
  regulate: "Everyday Me",
  flexible: "Play Together",
  "magic-toys": "Play Together",
  listen: "Listen & Do",
  "sound-memory": "Listen & Do",
  echoic: "Copy Me",
  intraverbal: "Tell Me",
  "sentence-builder": "Tell Me",
  comment: "Tell Me",
  sandbox: "Play Together",
  slide: "Play Together",
  bench: "Play Together",
  playground: "Play Together",
};

const WORLD_BY_CATEGORY: Record<string, string> = {
  "daily-living": "Everyday Me",
  emotions: "Tell Me",
  language: "Tell Me",
  motor: "Copy Me",
  "colors-shapes": "Look & Find",
  playground: "Play Together",
};

interface Profile {
  domains: DevelopmentalDomain[];
  construct: string;
  external: ExternalConstruct;
  parentPrompt: string;
  clinicianMetric: string;
  prerequisiteSkill?: string;
  progressionCriterion?: string;
  communicationMode?: CommunicationMode[];
  world?: string;
}

const ENGINE_PROFILE: Record<string, Profile> = {
  matching: {
    domains: ["visual discrimination", "categorisation"],
    construct: "Visually discriminate and match identical items and pairs",
    external: { framework: "ABLLS-R-compatible", domain: "visual discrimination" },
    parentPrompt: "Lay matching pairs of real objects in front of your child and take turns finding each pair.",
    clinicianMetric: "Independent correct matches across trials.",
    prerequisiteSkill: "Looking at and attending to a presented picture or object",
    progressionCriterion: "Matches identical items independently on most trials across two sessions.",
    communicationMode: ["touch", "switch/scanning", "dwell", "symbol selection"],
  },
  memory: {
    domains: ["visual discrimination", "joint attention"],
    construct: "Hold an image in memory and locate it again",
    external: { framework: "ABLLS-R-compatible", domain: "visual discrimination" },
    parentPrompt: "Show two toys, hide one, then ask which one is hiding.",
    clinicianMetric: "Independent correct recalls across trials.",
  },
  "whats-missing": {
    domains: ["visual discrimination", "joint attention"],
    construct: "Notice change and remember what was present",
    external: { framework: "ABLLS-R-compatible", domain: "visual discrimination" },
    parentPrompt: "Lay out three items, remove one while eyes are closed, and ask what is missing.",
    clinicianMetric: "Independent detection of the missing item.",
  },
  recognition: {
    domains: ["receptive language", "expressive language", "visual discrimination"],
    construct: "Receptive and expressive identification of objects, actions and people",
    external: { framework: "AAC-compatible", domain: "symbol recognition" },
    parentPrompt: "Point to things around the room and name them together.",
    clinicianMetric: "Independent correct identifications across trials.",
    prerequisiteSkill: "Responding to familiar objects, pictures, or people when named",
    progressionCriterion: "Identifies target items independently on most trials across two sessions.",
    communicationMode: ["touch", "switch/scanning", "dwell", "symbol selection", "gesture/pointing", "vocal/verbal"],
  },
  "situation-feelings": {
    domains: ["expressive language", "emotional regulation", "social reciprocity"],
    construct: "Understand and name feelings within social situations",
    external: { framework: "ABLLS-R-compatible", domain: "emotional regulation" },
    parentPrompt: "Name feelings during story time and in real moments through the day.",
    clinicianMetric: "Independent feeling labels in context.",
  },
  "face-builder": {
    domains: ["expressive language", "emotional regulation", "social reciprocity"],
    construct: "Recognise and build facial expressions for emotions",
    external: { framework: "ABLLS-R-compatible", domain: "emotional regulation" },
    parentPrompt: "Make faces together and name the feeling each face shows.",
    clinicianMetric: "Independent correct expression matching.",
  },
  sequence: {
    domains: ["sequencing", "problem solving"],
    construct: "Carry out steps in the correct order",
    external: { framework: "ABLLS-R-compatible", domain: "sequencing" },
    parentPrompt: "Do a short everyday routine together and narrate first, next, last.",
    clinicianMetric: "Independent correct step ordering.",
    prerequisiteSkill: "Attending to and completing a single step of a familiar routine",
    progressionCriterion: "Orders all steps independently on most trials across two sessions.",
    communicationMode: ["touch", "switch/scanning", "dwell", "symbol selection"],
  },
  counting: {
    domains: ["early academic", "visual-spatial"],
    construct: "Count objects and match quantity to amount",
    external: { framework: "ABLLS-R-compatible", domain: "early academic" },
    parentPrompt: "Count snacks, stairs, or toys together during daily routines.",
    clinicianMetric: "Independent correct counts across trials.",
  },
  building: {
    domains: ["visual-spatial", "problem solving", "sequencing"],
    construct: "Construct a model from parts, step by step",
    external: { framework: "ABLLS-R-compatible", domain: "visual-spatial" },
    parentPrompt: "Build the same block model side by side and copy each other.",
    clinicianMetric: "Independent correct placements with decreasing support.",
  },
  "pattern-next": {
    domains: ["sequencing", "visual-spatial"],
    construct: "Notice and continue a repeating pattern",
    external: { framework: "ABLLS-R-compatible", domain: "sequencing" },
    parentPrompt: "Make a simple pattern with real objects and ask what comes next.",
    clinicianMetric: "Independent correct continuations.",
  },
  sorting: {
    domains: ["categorisation", "visual discrimination"],
    construct: "Group items by attribute, category, or function",
    external: { framework: "ABLLS-R-compatible", domain: "categorisation" },
    parentPrompt: "Sort real laundry or toys into two groups together.",
    clinicianMetric: "Independent correct sorts across trials.",
    prerequisiteSkill: "Matching identical items before grouping by shared features",
    progressionCriterion: "Sorts into the correct groups independently on most trials across two sessions.",
    communicationMode: ["touch", "switch/scanning", "dwell", "symbol selection"],
  },
  "odd-one-out": {
    domains: ["categorisation", "problem solving", "visual discrimination"],
    construct: "Identify the item that does not belong to a group",
    external: { framework: "ABLLS-R-compatible", domain: "categorisation" },
    parentPrompt: "Line up three familiar items and ask which one does not belong.",
    clinicianMetric: "Independent correct exclusions.",
  },
  tapping: {
    domains: ["motor planning", "visual-spatial"],
    construct: "Control and direct movement to a target",
    external: { framework: "ABLLS-R-compatible", domain: "motor planning" },
    parentPrompt: "Copy hand actions and action songs together.",
    clinicianMetric: "Independent accurate movements with decreasing support.",
  },
  tracing: {
    domains: ["motor planning", "visual-spatial"],
    construct: "Trace along a path with controlled fine-motor movement",
    external: { framework: "ABLLS-R-compatible", domain: "motor planning" },
    parentPrompt: "Trace shapes with a finger in sand or on paper.",
    clinicianMetric: "Path completion with decreasing support.",
  },
  social: {
    domains: ["social reciprocity", "symbolic/social play", "emotional regulation"],
    construct: "Social reciprocity, turn-taking and cooperative choices",
    external: { framework: "ABLLS-R-compatible", domain: "social reciprocity" },
    parentPrompt: "Take turns in a short cooperative game and narrate my turn, your turn.",
    clinicianMetric: "Independent turn-taking and prosocial choices.",
    prerequisiteSkill: "Tolerating a partner joining a preferred activity",
    progressionCriterion: "Takes turns and makes cooperative choices independently across two sessions.",
    communicationMode: ["touch", "switch/scanning", "dwell", "symbol selection", "gesture/pointing", "vocal/verbal"],
  },
  "choice-request": {
    domains: ["functional communication", "expressive language", "receptive language"],
    construct: "Functional requesting and choice-making",
    external: { framework: "AAC-compatible", domain: "functional communication" },
    parentPrompt: "Offer two choices of a preferred item and accept any way your child asks.",
    clinicianMetric: "Independent functional communication attempts.",
    prerequisiteSkill: "Showing interest in or reaching toward a preferred item",
    progressionCriterion: "Requests a preferred item from two or more choices using any communication mode.",
    communicationMode: ["touch", "switch/scanning", "dwell", "symbol selection", "gesture/pointing", "vocal/verbal"],
  },
  regulation: {
    domains: ["emotional regulation", "adaptive/self-care"],
    construct: "Choose and use a calming or regulation strategy",
    external: { framework: "ABLLS-R-compatible", domain: "emotional regulation" },
    parentPrompt: "Practise the chosen calm-down plan at home before it is needed.",
    clinicianMetric: "Independent regulation strategy selection.",
  },
  regulate: {
    domains: ["emotional regulation", "adaptive/self-care"],
    construct: "Choose and use a calming or regulation strategy",
    external: { framework: "ABLLS-R-compatible", domain: "emotional regulation" },
    parentPrompt: "Practise the chosen calm-down plan at home before it is needed.",
    clinicianMetric: "Independent regulation strategy selection.",
  },
  flexible: {
    domains: ["problem solving", "emotional regulation"],
    construct: "Solve problems flexibly when a plan changes",
    external: { framework: "ABLLS-R-compatible", domain: "problem solving" },
    parentPrompt: "Change one small step in a familiar game and model a new plan.",
    clinicianMetric: "Independent flexible responses.",
  },
  "magic-toys": {
    domains: ["joint attention", "problem solving", "symbolic/social play"],
    construct: "Explore cause and effect and share attention to discoveries",
    external: { framework: "ABLLS-R-compatible", domain: "joint attention" },
    parentPrompt: "Explore a cause-and-effect toy together and share surprises.",
    clinicianMetric: "Independent exploration and shared attention.",
    prerequisiteSkill: "Attending to a partner and to a toy's effect together",
    progressionCriterion: "Explores cause and effect and shares attention with a partner across two sessions.",
    communicationMode: ["touch", "switch/scanning", "dwell", "gesture/pointing", "vocal/verbal"],
  },
  listen: {
    domains: ["receptive instructions", "receptive language", "joint attention"],
    construct: "Follow playful one- and two-step instructions",
    external: { framework: "ABLLS-R-compatible", domain: "receptive instructions" },
    parentPrompt: "Give one real-world instruction during play and celebrate every attempt.",
    clinicianMetric: "Independent following of instructions.",
    prerequisiteSkill: "Responding to a familiar single instruction with support",
    progressionCriterion: "Follows one- and two-step instructions independently across two sessions.",
    communicationMode: ["touch", "switch/scanning", "dwell", "symbol selection", "gesture/pointing"],
  },
  "sound-memory": {
    domains: ["imitation", "joint attention"],
    construct: "Hold sounds in memory and imitate them",
    external: { framework: "ABLLS-R-compatible", domain: "imitation" },
    parentPrompt: "Copy sounds and rhythms back and forth together.",
    clinicianMetric: "Independent correct repeats.",
    prerequisiteSkill: "Attending to a sound or action presented by a partner",
    progressionCriterion: "Imitates target sounds or rhythms independently across two sessions.",
    communicationMode: ["touch", "switch/scanning", "dwell", "gesture/pointing", "vocal/verbal"],
  },
  intraverbal: {
    domains: ["expressive language", "sequencing", "joint attention"],
    construct: "Complete familiar phrases and answer playful fill-in prompts",
    external: { framework: "ABLLS-R-compatible", domain: "expressive language" },
    parentPrompt: "Pause in a familiar song or phrase and let your child fill in the last word.",
    clinicianMetric: "Independent phrase completions across prompts.",
    prerequisiteSkill: "Echoing or attempting familiar words and sounds",
    progressionCriterion: "Completes familiar phrases independently across two sessions.",
    communicationMode: ["touch", "switch/scanning", "dwell", "symbol selection", "gesture/pointing", "vocal/verbal"],
  },
  "sentence-builder": {
    domains: ["expressive language", "sequencing", "functional communication"],
    construct: "Build a short sentence strip with symbols or words",
    external: { framework: "AAC-compatible", domain: "expressive language" },
    parentPrompt: "Build a short sentence together about something your child wants or sees.",
    clinicianMetric: "Independent sentence-strip construction.",
    prerequisiteSkill: "Selecting a symbol or word from a small field",
    progressionCriterion: "Builds a short sentence strip independently across two sessions.",
    communicationMode: ["touch", "switch/scanning", "dwell", "symbol selection", "gesture/pointing", "vocal/verbal"],
  },
  comment: {
    domains: ["functional communication", "joint attention", "social reciprocity"],
    construct: "Share a comment about a shared scene",
    external: { framework: "AAC-compatible", domain: "functional communication" },
    parentPrompt: "Notice something together and model a comment, accepting any response.",
    clinicianMetric: "Independent commenting attempts during shared attention.",
    prerequisiteSkill: "Sharing attention to an object or picture with a partner",
    progressionCriterion: "Shares comments during shared attention across two sessions.",
    communicationMode: ["touch", "switch/scanning", "dwell", "symbol selection", "gesture/pointing", "vocal/verbal"],
  },
  echoic: {
    domains: ["imitation", "expressive language", "joint attention"],
    construct: "Imitate sounds, words, or short phrases",
    external: { framework: "ABLLS-R-compatible", domain: "imitation" },
    parentPrompt: "Make a fun sound or word and take turns copying each other.",
    clinicianMetric: "Adult-confirmed vocal imitation attempts.",
    prerequisiteSkill: "Attending to a partner's voice and face",
    progressionCriterion: "Imitates sounds or words across two sessions with adult confirmation.",
    communicationMode: ["vocal/verbal", "gesture/pointing", "touch"],
  },
};

const CATEGORY_PROFILE: Record<string, Profile> = {
  "daily-living": {
    domains: ["adaptive/self-care", "sequencing", "receptive instructions"],
    construct: "Carry out everyday routines in order",
    external: { framework: "ABLLS-R-compatible", domain: "adaptive/self-care" },
    parentPrompt: "Rehearse the same routine at home and let your child lead a step.",
    clinicianMetric: "Independent routine steps completed.",
  },
  emotions: {
    domains: ["emotional regulation", "expressive language"],
    construct: "Notice and name feelings",
    external: { framework: "ABLLS-R-compatible", domain: "emotional regulation" },
    parentPrompt: "Name feelings as they come up during the day.",
    clinicianMetric: "Independent feeling labels.",
  },
  language: {
    domains: ["expressive language", "functional communication"],
    construct: "Use words, symbols, or gestures to communicate",
    external: { framework: "AAC-compatible", domain: "expressive communication" },
    parentPrompt: "Model the word or symbol and accept any communication attempt.",
    clinicianMetric: "Independent functional communication attempts.",
  },
  motor: {
    domains: ["motor planning", "visual-spatial"],
    construct: "Coordinate movement with control",
    external: { framework: "ABLLS-R-compatible", domain: "motor planning" },
    parentPrompt: "Copy movements and action games together.",
    clinicianMetric: "Independent accurate movements.",
  },
  "colors-shapes": {
    domains: ["visual discrimination", "early academic"],
    construct: "Recognise and name colours and shapes",
    external: { framework: "ABLLS-R-compatible", domain: "visual discrimination" },
    parentPrompt: "Spot colours and shapes on a walk or around the home.",
    clinicianMetric: "Independent correct recognition.",
  },
  playground: {
    domains: ["symbolic/social play", "social reciprocity"],
    construct: "Play together and take turns",
    external: { framework: "ABLLS-R-compatible", domain: "symbolic/social play" },
    parentPrompt: "Play a short cooperative game and take turns.",
    clinicianMetric: "Independent turn-taking during play.",
  },
};

const DEFAULT_PROFILE: Profile = {
  domains: ["joint attention"],
  construct: "Share attention and participate in guided play",
  external: { framework: "ABLLS-R-compatible", domain: "joint attention" },
  parentPrompt: "Play alongside your child and follow their lead.",
  clinicianMetric: "Participation and shared attention.",
};

function profileFor(game: GameConfig): Profile {
  if (game.category === "daily-living") return CATEGORY_PROFILE["daily-living"];
  return ENGINE_PROFILE[game.engine] || CATEGORY_PROFILE[game.category] || DEFAULT_PROFILE;
}

function worldFor(game: GameConfig, profile: Profile): string {
  return profile.world || PLAYGROUND_WORLD_BY_ENGINE[game.engine] || WORLD_BY_CATEGORY[game.category] || "Play Together";
}

function ageBandFor(game: GameConfig): [number, number] {
  if (game.ageRange) return [game.ageRange.min, game.ageRange.max];
  if (game.difficulty === "easy") return [0, 4];
  if (game.difficulty === "medium") return [3, 6];
  return [5, 8];
}

const DEFAULT_PREREQUISITE_SKILL = "Joint attention and intentional engagement in a shared activity";
const DEFAULT_PROGRESSION_CRITERION = "Independent success on most trials across two or more sessions.";
const DEFAULT_COMMUNICATION_MODES: CommunicationMode[] = ["touch", "switch/scanning", "dwell", "symbol selection"];

export function buildCrosswalk(games: GameConfig[]): CrosswalkRow[] {
  return games.map((game) => {
    const profile = profileFor(game);
    return {
      gameId: game.id,
      playgroundWorld: worldFor(game, profile),
      developmentalDomains: profile.domains,
      construct: profile.construct,
      ageBand: ageBandFor(game),
      skillTarget: game.skills.length ? game.skills.join(", ") : profile.construct,
      prerequisiteSkill: profile.prerequisiteSkill || DEFAULT_PREREQUISITE_SKILL,
      observableBehaviour: `Child demonstrates ${profile.domains.join(" and ")} during the activity.`,
      progressionCriterion: profile.progressionCriterion || DEFAULT_PROGRESSION_CRITERION,
      communicationMode: profile.communicationMode || DEFAULT_COMMUNICATION_MODES,
      difficulty: game.difficulty,
      parentPrompt: profile.parentPrompt,
      clinicianMetric: profile.clinicianMetric,
      externalConstruct: profile.external,
    };
  });
}

export const CROSSWALK: CrosswalkRow[] = buildCrosswalk(allGames);
