const { chromium } = require("playwright");
const base = "http://127.0.0.1:8082";

async function clearIDB(page) {
  await page.evaluate(() => new Promise((resolve) => {
    if (!indexedDB.databases) return resolve();
    indexedDB.databases().then((dbs) => Promise.all(dbs.map((db) => new Promise((r) => {
      const req = indexedDB.deleteDatabase(db.name);
      req.onsuccess = req.onerror = req.onblocked = () => r();
    }))).then(resolve));
  }));
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  await page.goto(`${base}/family`, { waitUntil: "networkidle" });
  await page.evaluate(() => {
    const KEY = "playground-life.backend.v2";
    const data = { assignments: [{ id: "cw-1", childId: "child-1", type: "classwork", gameIds: ["game-003", "game-070", "game-023"],
      difficulty: "easy", mode: "multiplayer", dueDate: new Date().toISOString().slice(0, 10),
      createdAt: new Date().toISOString().slice(0, 10), status: "pending", completedGames: [], results: [],
      skillFocus: ["social", "communication"], systemSuggestedDifficulty: "easy", therapistApproval: "approved",
      approvedAt: new Date().toISOString(), approvedBy: "therapist-1" }] };
    localStorage.setItem(KEY, JSON.stringify(data));
    localStorage.removeItem("playground-life.session.v1");
  });
  await clearIDB(page);
  await page.reload({ waitUntil: "networkidle" });
  await page.getByLabel(/phone number/i).fill("555-0101");
  await page.getByLabel(/^password$/i).fill("emma123");
  await page.getByRole("button", { name: "Sign In" }).click();
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: /Start today's session/i }).click();
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: /^Start$/i }).click();
  await page.waitForTimeout(1400);

  const targets = page.getByRole("button", { name: /seat|friend|bench/i });
  console.log("TARGETS:", JSON.stringify(await targets.allInnerTexts()), "COUNT:", await targets.count());
  console.log("SEAT ATTRS BEFORE:", await targets.first().evaluate((el) => JSON.stringify({ cls: el.className, 'aria-pressed': el.getAttribute('aria-pressed'), disabled: el.disabled, innerText: el.innerText })));
  await targets.first().click();
  await page.waitForTimeout(400);
  console.log("SEAT ATTRS AFTER:", await targets.first().evaluate((el) => JSON.stringify({ cls: el.className, 'aria-pressed': el.getAttribute('aria-pressed'), disabled: el.disabled, innerText: el.innerText })));
  console.log("FRIEND ATTRS:", await targets.nth(1).evaluate((el) => JSON.stringify({ cls: el.className, 'aria-pressed': el.getAttribute('aria-pressed'), disabled: el.disabled })));
  const feedback = await page.locator("body").innerText();
  console.log("TAIL BEFORE ALL: " + JSON.stringify(feedback.slice(-120)));
  const ns = page.getByRole("button", { name: /Next step|Finish the game/i });
  console.log("NEXTSTEP DISABLED BEFORE ALL:", await ns.isDisabled());
  await targets.nth(1).click();
  await page.waitForTimeout(300);
  console.log("NEXTSTEP DISABLED AFTER 1:", await ns.isDisabled());
  await targets.nth(2).click();
  await page.waitForTimeout(300);
  console.log("NEXTSTEP DISABLED AFTER 2:", await ns.isDisabled());
  console.log("TAIL AFTER ALL: " + JSON.stringify((await page.locator("body").innerText()).slice(-120)));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });