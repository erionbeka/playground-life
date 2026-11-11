import { expect, test, Page } from "@playwright/test";

const GAMES = [
  "game-001",
  "game-017",
  "game-233",
  "game-234",
  "game-235",
  "game-236",
  "game-237",
  "game-238",
  "game-239",
  "game-240",
  "game-241",
  "game-242",
];

async function stubSpeech(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: {
        speak: () => undefined,
        cancel: () => undefined,
        pause: () => undefined,
        resume: () => undefined,
        getVoices: () => [],
        speaking: false,
        pending: false,
        paused: false,
      },
    });
  });
}

async function openLab(page: Page, gameId: string) {
  await stubSpeech(page);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`/dev/lab?game=${gameId}`);
  await expect(page.getByTestId("game-lab")).toBeVisible();
  await expect(page.locator("[data-lab-game]")).toHaveAttribute("data-lab-game", gameId);
  return errors;
}

test("renders representative active games without page errors", async ({ page }) => {
  for (const gameId of GAMES) {
    const errors = await openLab(page, gameId);
    await expect(page.locator("main")).toBeVisible();
    await page.screenshot({ path: `test-results/audit/${gameId}.png`, fullPage: true });
    expect(errors, `${gameId} page errors`).toEqual([]);
  }
});

test("matching pairs complete and expose pair ids", async ({ page }) => {
  await openLab(page, "game-236");
  for (const pairId of [0, 1, 2, 3]) {
    const cards = page.locator(`[data-pair-id="${pairId}"]`);
    await cards.nth(0).click();
    await cards.nth(1).click();
    await page.waitForTimeout(700);
  }
  await expect(page.getByText(/completed: score/)).toBeVisible();
});

test("AAC and language engines complete from their own controls", async ({ page }) => {
  await openLab(page, "game-234");
  for (let round = 0; round < 4; round += 1) {
    await page.getByTestId("echoic-copied").click();
    await page.waitForTimeout(1700);
  }
  await expect(page.getByText(/completed: score/)).toBeVisible();

  await openLab(page, "game-242");
  for (let round = 0; round < 4; round += 1) {
    await page.locator('[data-testid^="comment-option-"]').first().click();
    await page.waitForTimeout(1500);
  }
  await expect(page.getByText(/completed: score/)).toBeVisible();

  await openLab(page, "game-235");
  const sentenceEngine = page.getByTestId("sentence-builder-engine");
  const sentenceProgress = sentenceEngine.locator("p").filter({ hasText: /^Step \\d+ of \\d+$/ });
  const sentenceFeedback = sentenceEngine.locator('p[aria-live="polite"]').filter({ hasText: /You built:/ });
  for (let round = 0; round < 3; round += 1) {
    await page.locator('[data-testid^="sentence-option-"]').first().click();
    await expect(sentenceFeedback).toContainText("You built:", { timeout: 5_000 });
    if (round < 2) {
      await expect(sentenceFeedback).toBeHidden({ timeout: 5_000 });
      await expect(sentenceProgress).toHaveText(`Step ${round + 2} of 3`, { timeout: 5_000 });
    }
  }
  await expect(page.getByText(/completed: score/)).toBeVisible({ timeout: 10_000 });
});

test("receptive direction and intraverbal engines complete", async ({ page }) => {
  await openLab(page, "game-238");
  const listenEngine = page.getByTestId("listen-engine");
  // RoundProgress reports the direction number; this label reports the step within that direction.
  const listenProgress = listenEngine.locator("p.text-xs.font-black").filter({ hasText: /^Step \\d+ of \\d+$/ });
  for (let action = 0; action < 10; action += 1) {
    if (await page.getByText(/completed: score/).isVisible().catch(() => false)) break;
    const instruction = await listenEngine.locator("p.font-display").innerText();
    const stepText = await listenProgress.innerText();
    const stepIndex = Number(stepText.match(/Step (\\d+) of/)?.[1] || 1) - 1;
    const expected = instruction.split(", then ")[stepIndex]?.match(/Touch the (.+)/)?.[1];
    expect(expected, `expected target for "${instruction}" at ${stepText}`).toBeTruthy();
    const feedback = listenEngine.locator('p[aria-live="polite"]').filter({ hasText: `You found ${expected}.` });
    await page.getByRole("button", { name: `Choose ${expected}` }).click();
    await expect(feedback).toBeVisible({ timeout: 5_000 });
    await expect(feedback).toBeHidden({ timeout: 5_000 });
  }
  await expect(page.getByText(/completed: score/)).toBeVisible({ timeout: 5_000 });

  await openLab(page, "game-233");
  const answers: Record<string, string> = {
    "Twinkle, twinkle, little ___": "star",
    "The itsy bitsy ___ climbed up the water spout": "spider",
    "Old MacDonald had a ___": "farm",
    "If you're happy and you know it, ___ your hands": "clap",
  };
  for (let round = 0; round < 4; round += 1) {
    const prompt = await page.getByTestId("intraverbal-engine").locator("p.font-display").innerText();
    const answer = answers[prompt];
    expect(answer, `missing expected answer for prompt "${prompt}"`).toBeTruthy();
    await page.getByRole("button", { name: `Choose ${answer}` }).click();
    await expect(page.getByText(`Yes! ${answer}.`)).toBeVisible({ timeout: 3_000 });
  }
  await expect(page.getByText(/completed: score/)).toBeVisible({ timeout: 5_000 });
});

test("scanning game exposes forced switch access", async ({ page }) => {
  await openLab(page, "game-241");
  await expect(page.locator(".scan-target").first()).toBeVisible({ timeout: 15_000 });
  await page.screenshot({ path: "test-results/audit/game-241-scanning.png", fullPage: true });
});

test("mobile layout keeps the lab usable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openLab(page, "game-236");
  await expect(page.getByLabel("Choose a game")).toBeVisible();
  await expect(page.locator("main")).toBeVisible();
  await page.screenshot({ path: "test-results/audit/mobile-game-236.png", fullPage: true });
});
