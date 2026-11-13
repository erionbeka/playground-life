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
    visibleIcons: await page.locator("nav svg").count(),
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
  const buildingChecks = {
    studio: await page.getByText(/Build Studio/i).first().isVisible(),
    modelTray: await page.getByText(/Model Tray/i).first().isVisible(),
    chooseSolid: await page.getByText(/Drag a piece here|Choose the next solid/i).first().isVisible(),
    buttons: await page.getByText(/Roof Prism|Cube/i).count(),
  };

  await loginAndPatch(page, "game-001");
  await page.screenshot({ path: path.join(outDir, "playground-beach.png"), fullPage: true });
  const playgroundChecks = {
    name: await page.getByText(/Sandy Shapes/i).first().isVisible(),
    nextMove: await page.getByRole("button", { name: /Next step|Finish the game/i }).isVisible(),
    cards: await page.locator(".playground-step-card").count(),
  };

  await loginAndPatch(page, "game-017");
  await page.screenshot({ path: path.join(outDir, "matching-learning.png"), fullPage: true });
  const matchingChecks = {
    purpose: await page.getByText(/Vocabulary matching/i).first().isVisible(),
    prompt: await page.getByText(/Look, say the word/i).first().isVisible(),
    tokens: await page.getByText(/tokens earned/i).count(),
  };

  await loginAndPatch(page, "game-034");
  await page.screenshot({ path: path.join(outDir, "sequence-learning.png"), fullPage: true });
  const sequenceChecks = {
    purpose: await page.getByText(/Pattern and routine sequencing/i).first().isVisible(),
    prompt: await page.getByText(/Watch the order/i).first().isVisible(),
    routineWords: await page.getByText(/Wake|Wash|Dress|Eat/i).count(),
  };

  await loginAndPatch(page, "game-131");
  await page.screenshot({ path: path.join(outDir, "memory-learning.png"), fullPage: true });
  const memoryChecks = {
    purpose: await page.getByText(/Working memory/i).first().isVisible(),
    prompt: await page.getByText(/Say the name quietly|Which card was/i).first().isVisible(),
    cards: await page.locator("span").filter({ hasText: /CAT|SUN|TREE/i }).count(),
  };

  await loginAndPatch(page, "game-105");
  await page.screenshot({ path: path.join(outDir, "recognition-learning.png"), fullPage: true });
  const recognitionChecks = {
    target: await page.getByText(/Pick the red things/i).first().isVisible(),
    teachingPoint: await page.getByText(/Color recognition/i).first().isVisible(),
    choices: await page.getByRole("button").count(),
  };

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
    visibleIcons: await page.locator("nav svg").count(),
  };

  await loginAndPatch(page, "game-093");
  await page.screenshot({ path: path.join(outDir, "froebel-building-mobile.png"), fullPage: true });
  const buildingChecks = {
    studio: await page.getByText(/Build Studio/i).first().isVisible(),
    choices: await page.getByText(/Roof Prism|Cube/i).count(),
    header: await page.getByText(/Build a Triangle/i).first().isVisible(),
  };

  await loginAndPatch(page, "game-001");
  await page.screenshot({ path: path.join(outDir, "froebel-playground-mobile.png"), fullPage: true });
  const cards = await page.locator(".playground-step-card").evaluateAll((elements) =>
    elements.map((element) => {
      const rect = element.getBoundingClientRect();
      return { left: Math.round(rect.left), right: Math.round(rect.right), width: Math.round(rect.width) };
    })
  );

  return {
    therapistChecks,
    buildingChecks,
    playgroundChecks: {
name: await page.getByText(/Sandy Shapes/i).first().isVisible(),
      cards: cards.length,
      action: await page.getByRole("button", { name: /Next step|Finish the game/i }).isVisible(),
      cardRects: cards,
    },
  };
}

function assertChecks(result) {
  const failures = [];
  if (!result.desktop.therapistChecks.dashboard) failures.push("Desktop therapist dashboard is missing");
  if (result.desktop.therapistChecks.navButtons < 3) failures.push("Desktop therapist nav should show 3 tabs");
  if (result.desktop.therapistChecks.visibleIcons < 3) failures.push("Desktop therapist nav icons are missing");
  if (!result.desktop.childrenChecks.selector) failures.push("Desktop caseload overview is missing");
  if (!result.desktop.childrenChecks.selectedChild) failures.push("Desktop caseload does not show an on-caseload child");
  if (result.desktop.childrenChecks.hiddenChild < 2) failures.push("Desktop caseload should show at least 2 children");
  if (!result.desktop.reviewChecks.quickReview) failures.push("Desktop results/review list is missing");
  if (!result.desktop.reviewChecks.detailedReview) failures.push("Desktop detailed approval workflow is missing");
  if (!result.desktop.reviewChecks.accuracy) failures.push("Desktop clinical snapshot is missing");
  if (!result.desktop.reviewChecks.skillEvidence) failures.push("Desktop skill domain mastery section is missing");
  if (!result.desktop.classworkChecks.accessCopy) failures.push("Desktop homework builder is missing");
  if (!result.desktop.classworkChecks.createFlow) failures.push("Desktop suggested session plan is missing");
  if (!result.desktop.buildingChecks.studio) failures.push("Desktop building studio is missing");
  if (!result.desktop.buildingChecks.modelTray) failures.push("Desktop building model tray is missing");
  if (!result.desktop.buildingChecks.chooseSolid) failures.push("Desktop building choice panel is missing");
  if (result.desktop.buildingChecks.buttons < 2) failures.push("Desktop building needs at least 2 solid chips");
  if (!result.desktop.playgroundChecks.name) failures.push("Desktop playground name is missing");
  if (!result.desktop.playgroundChecks.nextMove) failures.push("Desktop playground action is missing");
  if (result.desktop.playgroundChecks.cards !== 4) failures.push("Desktop playground should show 4 step cards");
  if (!result.desktop.matchingChecks.purpose) failures.push("Desktop matching learning purpose is missing");
  if (!result.desktop.matchingChecks.prompt) failures.push("Desktop matching learning prompt is missing");
  if (result.desktop.matchingChecks.tokens < 1) failures.push("Desktop matching token tracker is missing");
  if (!result.desktop.sequenceChecks.purpose) failures.push("Desktop sequence learning purpose is missing");
  if (!result.desktop.sequenceChecks.prompt) failures.push("Desktop sequence learning prompt is missing");
  if (result.desktop.sequenceChecks.routineWords < 4) failures.push("Desktop sequence routine words are missing");
  if (!result.desktop.memoryChecks.purpose) failures.push("Desktop memory learning purpose is missing");
  if (!result.desktop.memoryChecks.prompt) failures.push("Desktop memory learning prompt is missing");
  if (result.desktop.memoryChecks.cards < 3) failures.push("Desktop memory word cards are missing");
  if (!result.desktop.recognitionChecks.target) failures.push("Desktop recognition target is missing");
  if (!result.desktop.recognitionChecks.teachingPoint) failures.push("Desktop recognition teaching point is missing");
  if (result.desktop.recognitionChecks.choices < 6) failures.push("Desktop recognition choices are missing");
  if (!result.desktop.homeChecks.loaded) failures.push("Home page body is empty");
  if (!result.mobile.buildingChecks.studio) failures.push("Mobile building studio is missing");
  if (!result.mobile.therapistChecks.dashboard) failures.push("Mobile therapist dashboard is missing");
  if (result.mobile.therapistChecks.navButtons < 3) failures.push("Mobile therapist nav should show 3 tabs");
  if (result.mobile.therapistChecks.visibleIcons < 3) failures.push("Mobile therapist nav icons are missing");
  if (result.mobile.buildingChecks.choices < 2) failures.push("Mobile building needs at least 2 choices");
  if (result.mobile.playgroundChecks.cards !== 4) failures.push("Mobile playground should show 4 cards");
  if (!result.mobile.playgroundChecks.name) failures.push("Mobile playground name is missing");
  if (!result.mobile.playgroundChecks.action) failures.push("Mobile playground action is missing");
  if (result.mobile.playgroundChecks.cardRects.some((rect) => rect.left < 0 || rect.right > 390)) failures.push("Mobile playground card is clipped horizontally");

  if (!result.familyQA.personalizedCard) failures.push("Parent dashboard Personalised Journey card is missing");
  if (result.familyQA.catalogTotalActual < 1) failures.push("Parent dashboard catalog total data attribute is missing");
  if (result.familyQA.catalogTotalDisplayed !== result.familyQA.catalogTotalActual) failures.push("Parent dashboard catalog total does not match allGames.length");
  if (!result.familyQA.familySummaryRemoved) failures.push("Parent dashboard still shows the family recommendation summary");
  if (!result.familyQA.companionGreetingShown) failures.push("Parent dashboard does not show Pip companion greeting");
  if (!result.familyQA.planHeader) failures.push("GamePlayer plan dropdown header is missing");
  if (result.familyQA.planListVisible < 1) failures.push("GamePlayer plan list is missing when expanded");
  if (result.familyQA.planListAfterHide !== 0) failures.push("GamePlayer plan list is still visible after Hide plan");
  if (!result.familyQA.showPlanButton) failures.push("GamePlayer Show plan button is missing after collapsing");
  if (result.familyQA.planListAfterShow < 1) failures.push("GamePlayer plan list does not reappear after Show plan");
  if (!result.familyQA.companionReadyShown) failures.push("GamePlayer start screen does not show Pip ready bubble");
  if (!result.familyQA.learningLabelShown) failures.push("Playground game does not show the learning purpose label");
  if (result.familyQA.tapButtons < 3) failures.push("Playground game lacks tappable action targets");
  if (!result.familyQA.tapFeedback) failures.push("Playground tap does not show You did it feedback");
  if (!result.familyQA.advanced) failures.push("Playground Next step does not advance to step 2");
  if (!result.familyQA.socialScenario) failures.push("Saying Sorry game does not show on-theme scenario text");
  if (result.familyQA.socialChoices < 2) failures.push("Saying Sorry game lacks scenario choices");

  if (failures.length > 0) {
    throw new Error(failures.join("; "));
  }
}

async function runFamilyQA(page) {
  await page.goto(`${base}/family`, { waitUntil: "networkidle" });
  await page.evaluate((gameIds) => {
    const KEY = "playground-life.backend.v2";
    const data = { assignments: [{ 
      id: "cw-1",
      childId: "child-1",
      type: "classwork",
      gameIds,
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
    }] };
    localStorage.setItem(KEY, JSON.stringify(data));
    localStorage.removeItem("playground-life.session.v1");
    localStorage.removeItem("playground-life.plan-collapsed");
  }, ["game-003", "game-070", "game-023"]);

  await clearIndexedDB(page);
  await page.reload({ waitUntil: "networkidle" });
  await page.getByLabel(/phone number/i).fill("555-0101");
  await page.getByLabel(/^password$/i).fill("emma123");
  await page.getByRole("button", { name: "Sign In" }).click();
  await page.waitForTimeout(700);

  const dashboardText = await page.locator("body").innerText();
  const familySummaryRemoved = !/(Keep things calm, short, and predictable|Use familiar encouragement|little more independence|Stay steady and encouraging)/i.test(dashboardText);
  const companionGreetingShown = /I'm Pip/i.test(dashboardText);
  const personalizedCard = await page.getByText(/Personalized Journey/i).first().isVisible();
  const catalogTotal = await page.getByTestId("catalog-total");
  const catalogTotalDisplayed = catalogTotal.isVisible()
    ? Number.parseInt((await catalogTotal.innerText()).replace(/\D/g, ""), 10)
    : 0;
  const catalogTotalActual = Number.parseInt((await catalogTotal.getAttribute("data-catalog-total")) || "0", 10);
  await page.screenshot({ path: path.join(outDir, "parent-dashboard.png"), fullPage: true });

  await page.getByRole("button", { name: /Start today's session/i }).click();
  await page.waitForTimeout(700);
  const planHeader = await page.getByText(/Today's plan · \d+ games? left/i).first().isVisible();
  const planListVisible = await page.locator("#todays-plan-list").count();
  const companionReadyShown = await page.getByText(/Ready when you are, Emma!/i).first().isVisible();

  await page.getByRole("button", { name: /Hide plan/i }).click();
  await page.waitForTimeout(300);
  const planListAfterHide = await page.locator("#todays-plan-list").count();
  const showPlanButton = await page.getByRole("button", { name: /Show plan/i }).isVisible();

  await page.getByRole("button", { name: /Show plan/i }).click();
  await page.waitForTimeout(300);
  const planListAfterShow = await page.locator("#todays-plan-list").count();
  await page.screenshot({ path: path.join(outDir, "gameplayer-start-plan.png"), fullPage: true });

  await page.getByRole("button", { name: /^Start$/i }).click();
  await page.waitForTimeout(1500);
  const learningLabelShown = await page.getByTestId("learning-label").first().isVisible();
  const tapButtons = await page.getByRole("button", { name: /seat|friend|bench/i }).count();
  for (let i = 0; i < tapButtons; i++) {
    await page.getByRole("button", { name: /seat|friend|bench/i }).nth(i).click();
    await page.waitForTimeout(250);
  }
  const tapFeedback = await page.getByText(/You did it! Great work/i).isVisible();
  await page.getByRole("button", { name: /Next step/i }).click();
  await page.waitForTimeout(600);
  const advanced = await page.getByText(/Step 2 of/i).first().isVisible();
  await page.screenshot({ path: path.join(outDir, "playground-interaction.png"), fullPage: true });

  await page.goto(`${base}/family`, { waitUntil: "networkidle" });
  await page.evaluate(() => {
    const KEY = "playground-life.backend.v2";
    const raw = localStorage.getItem(KEY);
    const data = raw ? JSON.parse(raw) : { assignments: [] };
    if (!Array.isArray(data.assignments)) data.assignments = [];
    let assignment = data.assignments.find((entry) => entry.id === "cw-1");
    if (!assignment) {
      assignment = {
        id: "cw-1", childId: "child-1", type: "classwork", gameIds: ["game-071"],
        difficulty: "easy", mode: "multiplayer",
        notes: "Group session - practice social interactions with peers.",
        dueDate: new Date().toISOString().slice(0, 10),
        createdAt: new Date().toISOString().slice(0, 10),
        status: "pending", completedGames: [], results: [],
        skillFocus: ["social", "communication"],
        systemSuggestedDifficulty: "easy", therapistApproval: "approved",
        approvedAt: new Date().toISOString(), approvedBy: "therapist-1",
      };
      data.assignments.unshift(assignment);
    }
    assignment.gameIds = ["game-071"];
    assignment.status = "pending";
    assignment.completedGames = [];
    assignment.results = [];
    localStorage.setItem(KEY, JSON.stringify(data));
    localStorage.removeItem("playground-life.session.v1");
    localStorage.removeItem("playground-life.plan-collapsed");
  });
  await clearIndexedDB(page);
  await page.reload({ waitUntil: "networkidle" });
  await page.getByLabel(/phone number/i).fill("555-0101");
  await page.getByLabel(/^password$/i).fill("emma123");
  await page.getByRole("button", { name: "Sign In" }).click();
  await page.getByRole("button", { name: /Start today's session/i }).click();
  await page.getByRole("button", { name: /^Start$/i }).click();
  await page.waitForTimeout(1500);
  const socialText = await page.locator("body").innerText();
  const socialScenario = /sorry|apolog|knocked over|hurt|grabbed/i.test(socialText);
  const socialButtons = page.getByRole("button", { name: /Say:|Ask:|Offer:|Tell a grown-up|Give them space|Hand it back/i });
  const socialChoices = await socialButtons.count();
  if (socialChoices > 0) {
    await socialButtons.first().click();
    await page.waitForTimeout(700);
  }
  await page.screenshot({ path: path.join(outDir, "social-saying-sorry.png"), fullPage: true });

  return {
    familySummaryRemoved,
    companionGreetingShown,
    personalizedCard,
    catalogTotalDisplayed,
    catalogTotalActual,
    planHeader,
    planListVisible,
    planListAfterHide,
    showPlanButton,
    planListAfterShow,
    companionReadyShown,
    learningLabelShown,
    tapButtons,
    tapFeedback,
    advanced,
    socialScenario,
    socialChoices,
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
