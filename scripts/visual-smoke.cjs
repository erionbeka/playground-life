const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const base = (process.env.VISUAL_SMOKE_BASE_URL || "http://127.0.0.1:8080").trim();
const outDir = path.resolve((process.env.VISUAL_SMOKE_OUT_DIR || "test-results/visual-smoke").trim());

fs.mkdirSync(outDir, { recursive: true });

async function clearIndexedDB(page) {
  await page.evaluate(() => new Promise((resolve) => {
    if (!indexedDB.databases) return resolve();
    indexedDB.databases().then((dbs) => Promise.all(dbs.map((db) => new Promise((r) => {
      const req = indexedDB.deleteDatabase(db.name);
      req.onsuccess = req.onerror = req.onblocked = () => r();
    }))).then(resolve));
  }));
}

const apiMockResetters = new WeakMap();

// The visual smoke test exercises the browser UI, not the production API.
// Give each page a deterministic, isolated API fixture so it never needs a
// live database, real credentials, or a running API process.
function installApiMocks(page) {
  let authenticatedRole = null;
  const child = {
    id: "child-1",
    first_name: "Emma",
    display_name: "Emma",
    birth_date: "2019-01-01",
    notes: "",
    personalization_profile: {},
    skill_profile: {},
    progression_settings: {},
  };
  const secondChild = {
    id: "child-2",
    first_name: "Noah",
    display_name: "Noah",
    birth_date: "2018-01-01",
    notes: "",
    personalization_profile: {},
    skill_profile: {},
    progression_settings: {},
  };

  async function assignments() {
    return page.evaluate(() => {
      const raw = localStorage.getItem("playground-life.backend.v2");
      const data = raw ? JSON.parse(raw) : {};
      return Array.isArray(data.assignments) ? data.assignments : [];
    });
  }

  apiMockResetters.set(page, () => { authenticatedRole = null; });

  page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const pathname = url.pathname;
    const method = request.method();
    const json = (body, status = 200) => route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body),
    });

    if (pathname === "/api/auth/me" && method === "GET") {
      const pagePath = new URL(page.url()).pathname;
      const expectedRole = pagePath.startsWith("/family") ? "parent" : "therapist";
      if (authenticatedRole !== expectedRole) return json({ error: "Authentication required" }, 401);
      return json({ user: {
        id: authenticatedRole === "parent" ? "family-1" : "therapist-1",
        clinicId: "clinic-1",
        role: authenticatedRole,
        name: authenticatedRole === "parent" ? "Emma" : "Dr. Lane",
        canManageAdmins: false,
      } });
    }

    if (pathname === "/api/auth/login" && method === "POST") {
      const body = request.postDataJSON();
      authenticatedRole = String(body.identifier).includes("therapist") ? "therapist" : "parent";
      return json({ user: {
        id: authenticatedRole === "parent" ? "family-1" : "therapist-1",
        clinicId: "clinic-1",
        role: authenticatedRole,
        name: authenticatedRole === "parent" ? "Emma" : "Dr. Lane",
        canManageAdmins: false,
      } });
    }

    if (pathname === "/api/auth/logout" && method === "POST") {
      authenticatedRole = null;
      return route.fulfill({ status: 204, body: "" });
    }

    if (pathname === "/api/family/session" && method === "GET") {
      return json({ children: [child], assignments: await assignments() });
    }
    if (pathname === "/api/children" && method === "GET") {
      return json({ children: [child, secondChild] });
    }
    if (pathname === "/api/assignments" && method === "GET") {
      return json({ assignments: await assignments() });
    }
    if (pathname === "/api/families" && method === "GET") return json({ familyLinks: [] });
    if (pathname === "/api/goals" && method === "GET") return json({ goals: [] });
    if (pathname === "/api/audit" && method === "GET") return json({ auditLog: [] });
    if (pathname === "/api/auth/staff" && method === "GET") return json({ staff: [] });
    if (pathname === "/api/games/custom" && method === "GET") return json({ games: [] });
    if (pathname === "/api/children" && method === "GET" && url.searchParams.get("includeArchived")) {
      return json({ children: [] });
    }

    // Mutations not under test are acknowledged locally; unexpected reads
    // fail loudly rather than silently pretending an API contract exists.
    if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
      return json({ ok: true });
    }
    return json({ error: `Unmocked visual-smoke API request: ${method} ${pathname}` }, 501);
  });
}

async function loginAndPatch(page, gameId) {
  apiMockResetters.get(page)?.();
  await page.goto(`${base}/family`, { waitUntil: "networkidle" });
  await page.evaluate((gameIds) => {
    const KEY = "playground-life.backend.v2";
    const raw = localStorage.getItem(KEY);
    const data = raw ? JSON.parse(raw) : { assignments: [] };
    if (!Array.isArray(data.assignments)) data.assignments = [];

    let assignment = data.assignments.find((entry) => entry.id === "cw-1");
    if (!assignment) {
      assignment = {
        id: "cw-1",
        childId: "child-1",
        type: "classwork",
        gameIds: [],
        difficulty: "easy",
        mode: "multiplayer",
        notes: "Group session - practice social interactions with peers.",
        dueDate: new Date().toISOString().slice(0, 10),
        createdAt: new Date().toISOString().slice(0, 10),
        status: "pending",
        completedGames: [],
        results: [],
        skillFocus: ["social", "communication"],
        systemSuggestedDifficulty: "easy",
        therapistApproval: "approved",
        approvedAt: new Date().toISOString(),
        approvedBy: "therapist-1",
      };
      data.assignments.unshift(assignment);
    }
    assignment.type = "classwork";
    assignment.difficulty = "easy";
    assignment.mode = "multiplayer";
    assignment.status = "pending";
    assignment.therapistApproval = "approved";
    assignment.completedGames = [];
    assignment.results = [];
    assignment.gameIds = gameIds;
    localStorage.setItem(KEY, JSON.stringify(data));
    localStorage.removeItem("playground-life.session.v1");
  }, Array.isArray(gameId) ? gameId : [gameId]);

  await clearIndexedDB(page);
  await page.reload({ waitUntil: "networkidle" });
  await page.getByLabel(/phone number/i).fill("555-0101");
  await page.getByLabel(/^password$/i).fill("emma123");
  await page.getByRole("button", { name: "Sign In" }).click();
  await page.getByRole("button", { name: /Start today's session/i }).click();
  await page.getByRole("button", { name: /^Start$/i }).click();
  await page.waitForTimeout(1200);
}

async function loginTherapist(page) {
  await page.goto(`${base}/therapist`, { waitUntil: "networkidle" });
  await page.getByLabel(/clinic email/i).fill("therapist@playgroundlife.app");
  await page.getByLabel(/^password$/i).fill("therapist123");
  await page.getByRole("button", { name: "Sign In" }).click();
  await page.waitForTimeout(800);
}

async function seedNeedsReviewAttempt(page) {
  await page.evaluate(() => {
    const KEY = "playground-life.backend.v2";
    const raw = localStorage.getItem(KEY);
    const data = raw ? JSON.parse(raw) : { assignments: [] };
    if (!Array.isArray(data.assignments)) data.assignments = [];

    let assignment = data.assignments.find((entry) => entry.id === "cw-1");
    if (!assignment) {
      assignment = {
        id: "cw-1",
        childId: "child-1",
        type: "classwork",
        gameIds: ["game-052"],
        difficulty: "easy",
        mode: "multiplayer",
        notes: "Group session - practice social interactions with peers.",
        dueDate: new Date().toISOString().slice(0, 10),
        createdAt: new Date().toISOString().slice(0, 10),
        status: "pending",
        completedGames: [],
        results: [],
        skillFocus: ["social", "communication"],
        systemSuggestedDifficulty: "easy",
        therapistApproval: "approved",
        approvedAt: new Date().toISOString(),
        approvedBy: "therapist-1",
      };
      data.assignments.unshift(assignment);
    }

    assignment.status = "pending";
    assignment.therapistApproval = "pending";
    assignment.completedGames = [];
    assignment.results = [{
      gameId: assignment.gameIds[0] || "game-052",
      completedAt: "2026-05-30T10:00:00.000Z",
      durationSeconds: 88,
      score: 45,
      interactions: 9,
      completedSuccessfully: false,
      trials: 10,
      correctTrials: 4,
      errors: 6,
      accuracy: 40,
      masteryThreshold: 70,
      attemptsBySkill: { "visual-recognition": 10 },
      observations: ["Needed support identifying matching facial cues"],
    }];

    localStorage.setItem(KEY, JSON.stringify(data));
  });

  await clearIndexedDB(page);
}

async function runDesktop(page) {
  await loginTherapist(page);
  await page.screenshot({ path: path.join(outDir, "therapist-overview.png"), fullPage: true });
  const therapistChecks = {
    dashboard: await page.getByText(/Therapist Dashboard/i).first().isVisible(),
    navButtons: await page.locator("nav button").count(),
    visibleIcons: await page.locator("nav button").filter({ hasText: /Overview|Children|Homework|Classwork|Outcomes|Games/ }).count(),
  };

  await page.getByRole("button", { name: /Children/i }).click();
  await page.screenshot({ path: path.join(outDir, "therapist-kids-overview.png"), fullPage: true });
  const childrenChecks = {
    selector: await page.getByText(/My Children/i).first().isVisible(),
    selectedChild: await page.getByText("Emma", { exact: true }).first().isVisible(),
    hiddenChild: await page.getByText(/Emma|Noah/).count(),
  };

  await seedNeedsReviewAttempt(page);
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Outcomes/i }).click();
  await page.screenshot({ path: path.join(outDir, "therapist-needs-review.png"), fullPage: true });
  await page.getByRole("button", { name: /Detailed Review/i }).click();
  await page.screenshot({ path: path.join(outDir, "therapist-detailed-review.png"), fullPage: true });
  const reviewChecks = {
    quickReview: await page.getByText(/Clinical Progress Report/i).first().isVisible(),
    detailedReview: await page.getByText(/Approval Workflow/i).first().isVisible(),
    accuracy: await page.getByText(/Clinical Snapshot/i).first().isVisible(),
    skillEvidence: await page.getByText(/Skill Domain Mastery/i).first().isVisible(),
  };

  await page.getByRole("button", { name: /Homework/i }).click();
  await page.screenshot({ path: path.join(outDir, "therapist-give-work.png"), fullPage: true });
  const classworkChecks = {
    accessCopy: await page.getByText(/Assign Homework/i).first().isVisible(),
    createFlow: await page.getByRole("button", { name: /Use Personalized Plan/i }).isVisible(),
  };

  await loginAndPatch(page, "game-093");
  await page.screenshot({ path: path.join(outDir, "froebel-building.png"), fullPage: true });
  const buildingRoot = page.locator('[data-game-id="game-093"]');
  const buildingChecks = { mounted: await buildingRoot.isVisible(), engine: await buildingRoot.getAttribute("data-game-engine") };

  await loginAndPatch(page, "game-001");
  await page.screenshot({ path: path.join(outDir, "playground-beach.png"), fullPage: true });
  const playgroundRoot = page.locator('[data-game-id="game-001"]');
  const playgroundChecks = { mounted: await playgroundRoot.isVisible(), engine: await playgroundRoot.getAttribute("data-game-engine") };

  await loginAndPatch(page, "game-017");
  await page.screenshot({ path: path.join(outDir, "matching-learning.png"), fullPage: true });
  const matchingRoot = page.locator('[data-game-id="game-017"]');
  const matchingChecks = { mounted: await matchingRoot.isVisible(), engine: await matchingRoot.getAttribute("data-game-engine") };

  await loginAndPatch(page, "game-034");
  await page.screenshot({ path: path.join(outDir, "sequence-learning.png"), fullPage: true });
  const sequenceRoot = page.locator('[data-game-id="game-034"]');
  const sequenceChecks = { mounted: await sequenceRoot.isVisible(), engine: await sequenceRoot.getAttribute("data-game-engine") };

  await loginAndPatch(page, "game-131");
  await page.screenshot({ path: path.join(outDir, "memory-learning.png"), fullPage: true });
  const memoryRoot = page.locator('[data-game-id="game-131"]');
  const memoryChecks = { mounted: await memoryRoot.isVisible(), engine: await memoryRoot.getAttribute("data-game-engine") };

  await loginAndPatch(page, "game-105");
  await page.screenshot({ path: path.join(outDir, "recognition-learning.png"), fullPage: true });
  const recognitionRoot = page.locator('[data-game-id="game-105"]');
  const recognitionChecks = { mounted: await recognitionRoot.isVisible(), engine: await recognitionRoot.getAttribute("data-game-engine") };

  await page.goto(base, { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(outDir, "home.png"), fullPage: true });
  const homeChecks = {
    loaded: await page.locator("body").innerText().then((text) => text.trim().length > 0),
  };

  return { therapistChecks, childrenChecks, reviewChecks, classworkChecks, buildingChecks, playgroundChecks, matchingChecks, sequenceChecks, memoryChecks, recognitionChecks, homeChecks };
}

async function runMobile(page) {
  await loginTherapist(page);
  await page.screenshot({ path: path.join(outDir, "therapist-overview-mobile.png"), fullPage: true });
  const therapistChecks = {
    dashboard: await page.getByText(/Therapist Dashboard/i).first().isVisible(),
    navButtons: await page.locator("nav button").count(),
    visibleIcons: await page.locator("nav button").filter({ hasText: /Overview|Children|Homework|Classwork|Outcomes|Games/ }).count(),
  };

  await loginAndPatch(page, "game-093");
  await page.screenshot({ path: path.join(outDir, "froebel-building-mobile.png"), fullPage: true });
  const buildingRoot = page.locator('[data-game-id="game-093"]');
  const buildingChecks = {
    mounted: await buildingRoot.isVisible(),
    engine: await buildingRoot.getAttribute("data-game-engine"),
    exitButton: await page.getByRole("button", { name: "Exit", exact: true }).isVisible(),
  };

  await loginAndPatch(page, "game-001");
  await page.screenshot({ path: path.join(outDir, "froebel-playground-mobile.png"), fullPage: true });
  const playgroundRoot = page.locator('[data-game-id="game-001"]');
  const gameRect = await playgroundRoot.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { left: Math.round(rect.left), right: Math.round(rect.right), width: Math.round(rect.width) };
  });

  return {
    therapistChecks,
    buildingChecks,
    playgroundChecks: {
      mounted: await playgroundRoot.isVisible(),
      engine: await playgroundRoot.getAttribute("data-game-engine"),
      exitButton: await page.getByRole("button", { name: "Exit", exact: true }).isVisible(),
      gameRect,
    },
  };
}

function assertChecks(result) {
  const failures = [];
  if (!result.desktop.therapistChecks.dashboard) failures.push("Desktop therapist dashboard is missing");
  if (result.desktop.therapistChecks.navButtons < 3) failures.push("Desktop therapist nav should show 3 tabs");
  if (result.desktop.therapistChecks.visibleIcons < 3) failures.push("Desktop therapist nav labels are missing");
  if (!result.desktop.childrenChecks.selector) failures.push("Desktop caseload overview is missing");
  if (!result.desktop.childrenChecks.selectedChild) failures.push("Desktop caseload does not show an on-caseload child");
  if (result.desktop.childrenChecks.hiddenChild < 2) failures.push("Desktop caseload should show at least 2 children");
  if (!result.desktop.reviewChecks.quickReview) failures.push("Desktop results/review list is missing");
  if (!result.desktop.reviewChecks.detailedReview) failures.push("Desktop detailed approval workflow is missing");
  if (!result.desktop.reviewChecks.accuracy) failures.push("Desktop clinical snapshot is missing");
  if (!result.desktop.reviewChecks.skillEvidence) failures.push("Desktop skill domain mastery section is missing");
  if (!result.desktop.classworkChecks.accessCopy) failures.push("Desktop homework builder is missing");
  if (!result.desktop.classworkChecks.createFlow) failures.push("Desktop suggested session plan is missing");
  for (const [name, checks] of Object.entries({
    building: result.desktop.buildingChecks,
    playground: result.desktop.playgroundChecks,
    matching: result.desktop.matchingChecks,
    sequence: result.desktop.sequenceChecks,
    memory: result.desktop.memoryChecks,
    recognition: result.desktop.recognitionChecks,
  })) {
    if (!checks.mounted || !checks.engine) failures.push("Desktop " + name + " game engine did not mount");
  }
  if (!result.desktop.homeChecks.loaded) failures.push("Home page body is empty");
  if (!result.mobile.therapistChecks.dashboard) failures.push("Mobile therapist dashboard is missing");
  if (result.mobile.therapistChecks.navButtons < 3) failures.push("Mobile therapist nav should show 3 tabs");
  if (result.mobile.therapistChecks.visibleIcons < 3) failures.push("Mobile therapist nav labels are missing");
  if (!result.mobile.buildingChecks.mounted || !result.mobile.buildingChecks.engine) failures.push("Mobile building game engine did not mount");
  if (!result.mobile.buildingChecks.exitButton) failures.push("Mobile building game Exit control is missing");
  if (!result.mobile.playgroundChecks.mounted || !result.mobile.playgroundChecks.engine) failures.push("Mobile playground game engine did not mount");
  if (!result.mobile.playgroundChecks.exitButton) failures.push("Mobile playground Exit control is missing");
  if (result.mobile.playgroundChecks.gameRect.left < 0 || result.mobile.playgroundChecks.gameRect.right > 390) failures.push("Mobile playground game is clipped horizontally");

  if (!result.familyQA.personalizedCard) failures.push("Parent dashboard Personalized Journey card is missing");
  if (!result.familyQA.sessionCard) failures.push("Parent dashboard Today's Session card is missing");
  if (!result.familyQA.assignedGame) failures.push("Parent dashboard assigned game is missing");
  if (!result.familyQA.gameIntro) failures.push("Family game introduction is missing");
  if (!result.familyQA.planSummary) failures.push("Family game plan summary is missing");
  if (!result.familyQA.engineVisible) failures.push("Assigned game engine did not start");
  if (!result.familyQA.exitButton) failures.push("Active game Exit control is missing");

  if (failures.length > 0) {
    throw new Error(failures.join("; "));
  }
}

async function runFamilyQA(page) {
  apiMockResetters.get(page)?.();
  await page.goto(`${base}/family`, { waitUntil: "networkidle" });
  await page.evaluate(() => {
    const KEY = "playground-life.backend.v2";
    const data = {
      assignments: [{
        id: "cw-1",
        childId: "child-1",
        type: "classwork",
        gameIds: ["game-003"],
        difficulty: "easy",
        mode: "multiplayer",
        notes: "Practice taking turns and making social choices.",
        dueDate: new Date().toISOString().slice(0, 10),
        createdAt: new Date().toISOString().slice(0, 10),
        status: "pending",
        completedGames: [],
        results: [],
        skillFocus: ["social", "communication"],
        systemSuggestedDifficulty: "easy",
        therapistApproval: "approved",
        approvedAt: new Date().toISOString(),
        approvedBy: "therapist-1",
      }],
    };
    localStorage.setItem(KEY, JSON.stringify(data));
    localStorage.removeItem("playground-life.session.v1");
  });

  await clearIndexedDB(page);
  await page.reload({ waitUntil: "networkidle" });
  await page.getByLabel(/phone number/i).fill("555-0101");
  await page.getByLabel(/^password$/i).fill("emma123");
  await page.getByRole("button", { name: "Sign In" }).click();

  await page.getByRole("button", { name: /Start today's session/i }).waitFor({ state: "visible" });

  const personalizedCard = await page.getByText(/Personalized Journey/i).first().isVisible();
  const sessionCard = await page.getByText(/Today's Session/i).first().isVisible();
  const assignedGame = await page.getByRole("button", { name: /Bench Buddies/i }).isVisible();
  await page.screenshot({ path: path.join(outDir, "parent-dashboard.png"), fullPage: true });

  await page.getByRole("button", { name: /Start today's session/i }).click();
  const gameIntro = await page.getByRole("heading", { name: /Bench Buddies/i }).isVisible();
  const planSummary = await page.getByText("Your plan", { exact: true }).isVisible();
  await page.screenshot({ path: path.join(outDir, "family-game-intro.png"), fullPage: true });

  await page.getByRole("button", { name: /^Start$/i }).click();
  const engine = page.locator('[data-game-engine="bench"][data-game-id="game-003"]');
  await engine.waitFor({ state: "visible" });
  const engineVisible = await engine.isVisible();
  const exitButton = await page.getByRole("button", { name: "Exit", exact: true }).isVisible();
  await page.screenshot({ path: path.join(outDir, "family-game-active.png"), fullPage: true });

  return {
    personalizedCard,
    sessionCard,
    assignedGame,
    gameIntro,
    planSummary,
    engineVisible,
    exitButton,
  };
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1 });
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  installApiMocks(desktop);
  installApiMocks(mobile);

  const result = {
    base,
    output: outDir,
    desktop: await runDesktop(desktop),
    mobile: await runMobile(mobile),
    familyQA: await runFamilyQA(desktop),
  };

  await browser.close();
  assertChecks(result);
  console.log(JSON.stringify(result, null, 2));
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
