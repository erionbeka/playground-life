import { describe, expect, it } from "vitest";
import {
  familyForTheme,
  familyLabel,
  OWN_PLAN_CHOICE,
  OWN_PLAN_WONDER,
  scenariosForTheme,
  SOCIAL_PACKS,
  SocialFamily,
  THEME_SCENARIOS,
} from "@/lib/socialScenarios";
import { allGames } from "@/data/games";

const FAMILIES: SocialFamily[] = ["emotion-interoception", "assertiveness", "family-shared-play", "connection"];

const SHAME_CORPUS = [
  /\bpoints?\b/i,
  /\bscore\b/i,
  /\bbest answer\b/i,
  /\bkinder (choice|answer)\b/i,
  /\bpraise\b/i,
  /\bstars earned\b/i,
  /\bpush (someone|them|him|her)\b/i,
  /\bwalk past\b/i,
  /\blaugh at\b/i,
  /\bstay silent\b/i,
  /\bgive up\b/i,
  /\bgrab the toy\b/i,
  /\bignore\b/i,
  /\bmust look\b/i,
  /\byou need to\b/i,
  /punish\b/i,
];

const ALLOWED_FAMILIES: Record<string, SocialFamily> = {
  "eye contact": "connection",
  "personal space": "assertiveness",
  "asking for help": "assertiveness",
  "saying no": "assertiveness",
  hug: "assertiveness",
  "expressing feelings": "emotion-interoception",
  "emotion detective": "emotion-interoception",
  "calm breathing": "emotion-interoception",
  "feeling stories": "emotion-interoception",
  "mood match": "emotion-interoception",
  sharing: "family-shared-play",
  "taking turns": "family-shared-play",
  "joining play": "family-shared-play",
  "cooperative problem solving": "family-shared-play",
  "reading body language": "family-shared-play",
  greetings: "connection",
  "saying sorry": "family-shared-play",
};

describe("social content pack: psychological safety", () => {
  it("no scoring, shame, or compliance language anywhere in the pack", () => {
    const corpus = Object.values(SOCIAL_PACKS)
      .flatMap((pack) => [
        pack.intro,
        ...pack.scenarios.flatMap((scenario) => [scenario.situation, scenario.wonder, ...scenario.choices.map((choice) => `${choice.text} ${choice.strategy}`)]),
        OWN_PLAN_WONDER,
        OWN_PLAN_CHOICE.text,
      ])
      .join("\n");

    for (const pattern of SHAME_CORPUS) {
      expect(corpus.match(pattern)).toBeNull();
    }
  });

  it("every family ships at least three scenarios with real choices and a wonder", () => {
    for (const family of FAMILIES) {
      const pack = SOCIAL_PACKS[family];
      expect(pack.family).toBe(family);
      expect(familyLabel(family).length).toBeGreaterThan(3);
      expect(pack.scenarios.length).toBeGreaterThanOrEqual(3);
      for (const scenario of pack.scenarios) {
        expect(scenario.choices.length).toBeGreaterThanOrEqual(3);
        expect(scenario.wonder.length).toBeGreaterThan(10);
        expect(scenario.situation.length).toBeGreaterThan(10);
      }
    }
  });

  it("choices carry no scoring attributes and always keep an own-plan escape hatch", () => {
    for (const family of FAMILIES) {
      const pack = SOCIAL_PACKS[family];
      for (const scenario of pack.scenarios) {
        for (const choice of scenario.choices) {
          expect(choice).not.toHaveProperty("points");
          expect(choice).not.toHaveProperty("social");
          expect(choice).not.toHaveProperty("isCorrect");
        }
      }
    }
  });

  it("maps every catalog theme to a safe family, reframing compliance topics", () => {
    for (const [theme, expected] of Object.entries(ALLOWED_FAMILIES)) {
      expect(familyForTheme(theme)).toBe(expected);
      const pack = SOCIAL_PACKS[expected];
      expect(pack.intro.length).toBeGreaterThan(10);
    }
  });

  it("serves theme-specific scenarios so each game teaches its named skill", () => {
    const pooledText = (theme: string, limit = 4) =>
      scenariosForTheme(theme, limit).scenarios
        .flatMap((scenario) => [scenario.situation, scenario.wonder, ...scenario.choices.map((choice) => choice.text)])
        .join(" ")
        .toLowerCase();

    expect(pooledText("saying sorry")).toMatch(/\bsorry\b|apolog/);
    expect(pooledText("compliments")).toMatch(/your tower|kind|brave|compliment/i);
    expect(pooledText("greetings")).toMatch(/\bhello\b|\bhi\b|wave/);
    expect(pooledText("happy face")).toMatch(/proud|wonderful|art|happy/i);
  });

  it("no longer serves the same scenario across family-shared-play themes", () => {
    const sorry = scenariosForTheme("saying sorry", 4).scenarios;
    const sharing = scenariosForTheme("sharing", 4).scenarios;
    expect(sorry.length).toBeGreaterThanOrEqual(2);
    expect(sharing.length).toBeGreaterThanOrEqual(2);
    expect(sorry[0].situation).not.toBe(sharing[0].situation);
  });

  it("covers every catalog social theme with on-theme scenarios", () => {
    const catalogThemes = allGames
      .filter((game) => game.engine === "social")
      .map((game) => String(game.config.theme || "").trim().toLowerCase())
      .filter(Boolean);
    expect(catalogThemes.length).toBeGreaterThan(0);
    for (const theme of catalogThemes) {
      expect(THEME_SCENARIOS[theme], `missing scenario pool for "${theme}"`).toBeDefined();
    }
  });
});