import { GameConfig } from "@/data/games";

const PURPOSE: Record<string, string> = {
  emotions: "What we learn: naming how others feel, on top of knowing our own.",
  social: "What we learn: reading scenarios and choosing a kind, workable response.",
  playground: "What we learn: taking turns and following a small plan one step at a time.",
  matching: "What we learn: finding pairs and spotting what belongs together.",
  sorting: "What we learn: grouping things by a rule, then checking our work.",
  "colors-shapes": "What we learn: naming colors and shapes at our own pace.",
  counting: "What we learn: counting slowly, one tap at a time.",
  memory: "What we learn: holding a little picture in our head and finding it again.",
  sequences: "What we learn: doing steps in the right order, one after another.",
  language: "What we learn: using our words — or a card, or a nod — to ask.",
  motor: "What we learn: steady, careful hands.",
  "daily-living": "What we learn: doing everyday steps on our own, in order.",
  tapping: "What we learn: one tap at a time, at our own speed.",
  sensory: "What we learn: noticing what feels calm and what feels big.",
  regulation: "What we learn: choosing what helps our body feel ready.",
  reasoning: "What we learn: thinking about choices before we pick.",
  building: "What we learn: building step by step, checking as we go.",
  "memory-sequencing": "What we learn: remembering a pattern, then copying it.",
};

const ICON: Record<string, string> = {
  emotions: "😊", social: "🤝", playground: "🛝", matching: "🧩", sorting: "🗂️",
  "colors-shapes": "🎨", counting: "🔢", memory: "🧠", sequences: "🔁",
  language: "💬", motor: "👐", "daily-living": "🧺", tapping: "👆",
  sensory: "🧸", regulation: "🌬️", reasoning: "💡", building: "🏗️",
};

const GAME_PURPOSE: Record<string, string> = {
  "Sort Sky Land Water": "What we learn: putting animals and things where they belong.",
  "Sort Fruits Veggies Sweets": "What we learn: sorting everyday foods into groups.",
  "Emotion Detective": "What we learn: spotting feelings from clues on a face.",
  "Magic Toys": "What we learn: exploring each toy and noticing what it does.",
  "Odd One Out": "What we learn: looking closely to find the one that does not fit.",
  "Pattern Next": "What we learn: spotting what comes next in a pattern.",
  "Face Builder": "What we learn: building a face that matches a feeling.",
  "What's Missing": "What we learn: remembering what was there and noticing a change.",
  "Sound Memory": "What we learn: holding a sound in memory and repeating it.",
  "Choice Request": "What we learn: asking for what we need with words or a card.",
  "Regulation": "What we learn: picking a calm-down plan that feels right.",
  "Flexible Thinking": "What we learn: trying a new plan when the first one changes.",
  "Situation Feelings": "What we learn: thinking about how a friend might feel.",
};

export function getLearningPurpose(game: GameConfig): string {
  const byName = GAME_PURPOSE[game.name];
  if (byName) return byName;
  const byCategory = PURPOSE[game.category] || PURPOSE[game.engine] || "";
  if (byCategory) return byCategory;
  const skill = game.skills?.[0];
  if (skill) return `What we learn: practicing ${skill.replace(/-/g, " ")}.`;
  return "What we learn: trying something new, at our own pace.";
}

export function getLearningPurposeIcon(game: GameConfig): string {
  const byEngine = ICON[game.engine];
  if (byEngine) return byEngine;
  const byCat = ICON[game.category];
  if (byCat) return byCat;
  return "🌟";
}
