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
  for (let round = 0; round < 4; round += 1) {
    await page.locator('[data-testid^="sentence-option-"]').first().click();
    await page.waitForTimeout(1200);
  }
  await expect(page.getByText(/completed: score/)).toBeVisible();
});

test("receptive direction and intraverbal engines complete", async ({ page }) => {
  await openLab(page, "game-238");
  for (let safety = 0; safety < 30; safety += 1) {
    if (await page.getByText(/completed: score/).isVisible().catch(() => false)) break;
    const options = page.locator('[data-testid^="listen-option-"]');
    const count = await options.count();
    for (let index = 0; index < count; index += 1) {
      await options.nth(index).click();
      await page.waitForTimeout(800);
    }
  }
  await expect(page.getByText(/completed: score/)).toBeVisible();

  await openLab(page, "game-233");
  for (let safety = 0; safety < 30; safety += 1) {
    if (await page.getByText(/completed: score/).isVisible().catch(() => false)) break;
    const options = page.locator('[data-testid^="intraverbal-option-"]');
    const count = await options.count();
    for (let index = 0; index < count; index += 1) {
      await options.nth(index).click();
      await page.waitForTimeout(900);
    }
  }
  await expect(page.getByText(/completed: score/)).toBeVisible();
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
