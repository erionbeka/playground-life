import { useEffect, useMemo, useState } from "react";
import { productionApi } from "@/lib/productionApi";
import {
  AuthoredGame,
  AUTHORED_ENGINES,
  validateAuthoredGame,
  runOriginAudit,
  AuthoredEngine,
} from "@/lib/gameAuthoring";
import { authoredGameToGameConfig } from "@/lib/gameAuthoring";
import GamePreview from "@/components/game/GamePreview";

interface DraftRow extends AuthoredGame {
  id: string;
  status: string;
  originConfirmed: boolean;
  updatedAt: string;
}

const emptyGame: AuthoredGame = {
  title: "", description: "", emoji: "🎲", difficulty: "easy", learningGoal: "",
  successCriteria: [""], skills: [], supportsShared: true, engine: "matching", config: { pairList: ["🦕", "🐲"] },
};

function EngineContentFields({ game, update }: { game: AuthoredGame; update: (patch: Partial<AuthoredGame>) => void }) {
  const setConfig = (key: string, value: unknown) => update({ config: { ...game.config, [key]: value } });
  const list = (key: string) => (Array.isArray(game.config[key]) ? (game.config[key] as string[]) : []);

  if (game.engine === "matching") {
    const pairs = list("pairList");
    const items = pairs.length > 0 ? pairs : [""];
    return (
      <div className="space-y-3">
        {items.map((value, index) => (
          <label key={index} className="block">
            <span className="mb-1 block text-sm font-semibold">Pair list</span>
            <input
              aria-label="pair list"
              value={value}
              maxLength={24}
              onChange={(e) => setConfig("pairList", items.map((entry, entryIndex) => (entryIndex === index ? e.target.value : entry)))}
              className="h-11 w-full rounded-xl border border-border bg-background px-3"
            />
          </label>
        ))}
        <button type="button" onClick={() => setConfig("pairList", [...pairs, ""])} className="rounded-xl border border-border px-3 py-2 text-sm font-semibold touch-target">
          Add pair
        </button>
      </div>
    );
  }

  if (game.engine === "sorting") {
    const map = (game.config.itemsByCategory as Record<string, unknown> | undefined) || {};
    const categoryKeys = Object.keys(map).length > 0 ? Object.keys(map) : ["", ""];
    const categories = categoryKeys.slice(0, 2);
    return (
      <div className="space-y-4">
        {categories.map((category, index) => (
          <div key={index} className="grid gap-3">
            <label className="block">
              <span className="mb-1 block text-sm font-semibold">Category</span>
              <input
                aria-label="category"
                value={category}
                maxLength={24}
                onChange={(e) => {
                  const next = { ...map };
                  const previous = categories[index];
                  const items = Array.isArray(map[previous]) ? (map[previous] as string[]) : [];
                  delete next[previous];
                  next[e.target.value] = items;
                  setConfig("itemsByCategory", next);
                }}
                className="h-11 w-full rounded-xl border border-border bg-background px-3"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold">Items (one per line)</span>
              <textarea
                aria-label="category items"
                rows={4}
                value={(Array.isArray(map[category]) ? (map[category] as string[]) : []).join("\n")}
                onChange={(e) => setConfig("itemsByCategory", { ...map, [category]: e.target.value.split("\n").filter(Boolean) })}
                className="w-full rounded-xl border border-border bg-background px-3 py-2"
              />
            </label>
          </div>
        ))}
      </div>
    );
  }

  if (game.engine === "recognition") {
    const items = list("items");
    const correct = list("correctItems");
    return (
      <div className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Items (one per line)</span>
          <textarea
            aria-label="items"
            rows={4}
            value={items.join("\n")}
            onChange={(e) => setConfig("items", e.target.value.split("\n").filter(Boolean))}
            className="w-full rounded-xl border border-border bg-background px-3 py-2"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Correct items (one per line)</span>
          <textarea
            aria-label="correct items"
            rows={3}
            value={correct.join("\n")}
            onChange={(e) => setConfig("correctItems", e.target.value.split("\n").filter(Boolean))}
            className="w-full rounded-xl border border-border bg-background px-3 py-2"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Target</span>
          <input
            aria-label="target"
            value={typeof game.config.target === "string" ? game.config.target : ""}
            maxLength={24}
            onChange={(e) => setConfig("target", e.target.value)}
            className="h-11 w-full rounded-xl border border-border bg-background px-3"
          />
        </label>
      </div>
    );
  }

  if (game.engine === "memory") {
    const cardItems = list("cardItems");
    return (
      <div className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Card items (one per line)</span>
          <textarea
            aria-label="card items"
            rows={4}
            value={cardItems.join("\n")}
            onChange={(e) => setConfig("cardItems", e.target.value.split("\n").filter(Boolean))}
            className="w-full rounded-xl border border-border bg-background px-3 py-2"
          />
        </label>
      </div>
    );
  }

  if (game.engine === "choice-request") {
    const scenarios = Array.isArray(game.config.scenarios)
      ? (game.config.scenarios as { situation?: string; request?: string; options?: { label?: string }[] }[])
      : [];
    const rows = scenarios.length > 0 ? scenarios : [{ situation: "", request: "", options: [] }];
    return (
      <div className="space-y-4">
        {rows.map((scenario, index) => (
          <div key={index} className="grid gap-3">
            <label className="block">
              <span className="mb-1 block text-sm font-semibold">Situation</span>
              <input
                aria-label="situation"
                value={scenario.situation || ""}
                onChange={(e) => setConfig("scenarios", rows.map((row, rowIndex) => (rowIndex === index ? { ...row, situation: e.target.value } : row)))}
                className="h-11 w-full rounded-xl border border-border bg-background px-3"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold">Request</span>
              <input
                aria-label="request"
                value={scenario.request || ""}
                onChange={(e) => setConfig("scenarios", rows.map((row, rowIndex) => (rowIndex === index ? { ...row, request: e.target.value } : row)))}
                className="h-11 w-full rounded-xl border border-border bg-background px-3"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold">Options (comma separated)</span>
              <input
                aria-label="options"
                value={(scenario.options || []).map((option) => option.label || "").join(", ")}
                onChange={(e) => setConfig("scenarios", rows.map((row, rowIndex) => (rowIndex === index ? { ...row, options: e.target.value.split(",").map((label) => ({ label: label.trim() })).filter((option) => option.label) } : row)))}
                className="h-11 w-full rounded-xl border border-border bg-background px-3"
              />
            </label>
          </div>
        ))}
        <button type="button" onClick={() => setConfig("scenarios", [...rows, { situation: "", request: "", options: [] }])} className="rounded-xl border border-border px-3 py-2 text-sm font-semibold touch-target">
          Add scenario
        </button>
      </div>
    );
  }

  const setItems = list("setItems");
  const oddIndex = typeof game.config.oddIndex === "number" ? game.config.oddIndex : -1;
  return (
    <div className="space-y-3">
      <label className="block">
        <span className="mb-1 block text-sm font-semibold">Set items (one per line)</span>
        <textarea
          aria-label="set items"
          rows={4}
          value={setItems.join("\n")}
          onChange={(e) => setConfig("setItems", e.target.value.split("\n").filter(Boolean))}
          className="w-full rounded-xl border border-border bg-background px-3 py-2"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-semibold">Odd item index</span>
        <input
          aria-label="odd item index"
          type="number"
          min={0}
          value={oddIndex < 0 ? "" : oddIndex}
          onChange={(e) => setConfig("oddIndex", e.target.value === "" ? -1 : Number(e.target.value))}
          className="h-11 w-full rounded-xl border border-border bg-background px-3"
        />
      </label>
    </div>
  );
}

function CreateReviewButtons({
  onSave,
  onSaveLabel,
  disabled,
  onSubmit,
}: {
  onSave: () => void;
  onSaveLabel: string;
  disabled: boolean;
  onSubmit: () => void;
}) {
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      <button
        type="button"
        onClick={onSave}
        disabled={disabled}
        className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground touch-target disabled:opacity-50"
      >
        {onSaveLabel}
      </button>
      <button
        type="button"
        onClick={onSubmit}
        className="rounded-xl border border-border px-4 py-2 text-sm font-semibold touch-target"
      >
        Submit for review
      </button>
    </div>
  );
}

export default function GameAuthoring() {
  const apiMode = typeof import.meta.env.VITE_DATA_MODE === "string" && import.meta.env.VITE_DATA_MODE === "api";
  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [editing, setEditing] = useState<AuthoredGame | null>(null);
  const [viewingDraft, setViewingDraft] = useState<DraftRow | null>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [originConfirmed, setOriginConfirmed] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [submitNotice, setSubmitNotice] = useState("");

  const load = async () => {
    if (!apiMode) return;
    try {
      const { drafts: rows } = await productionApi.listGameDrafts();
      setDrafts(rows as DraftRow[]);
    } catch {
      setLoadError("Could not load drafts. Is the server running?");
    }
  };
  useEffect(() => { void load(); }, [apiMode]);

  const errors = useMemo(() => (editing ? validateAuthoredGame(editing) : []), [editing]);
  const audit = useMemo(
    () => (editing ? runOriginAudit(editing.title, editing.description) : { tokenHits: [], banned: [] }),
    [editing]
  );
  const blocked = audit.tokenHits.length > 0 || audit.banned.length > 0;

  const update = (patch: Partial<AuthoredGame>) => setEditing((prev) => (prev ? { ...prev, ...patch } : prev));

  const payload = (game: AuthoredGame): Record<string, unknown> => ({
    title: game.title,
    description: game.description,
    emoji: game.emoji,
    difficulty: game.difficulty,
    learningGoal: game.learningGoal,
    successCriteria: game.successCriteria,
    skills: game.skills,
    supportsShared: game.supportsShared,
    engine: game.engine,
    config: game.config,
    originConfirmed,
  });

  const createDraft = async () => {
    if (!editing) return;
    if (validateAuthoredGame(editing).length > 0) return;
    try {
      await productionApi.createGameDraft(payload(editing));
      setEditing(null);
      setStep(1);
      setOriginConfirmed(false);
      setSubmitNotice("");
      await load();
    } catch {
      setLoadError("Could not save the draft.");
    }
  };

  const updateDraft = async (draft: DraftRow) => {
    if (validateAuthoredGame(draft).length > 0) return;
    try {
      await productionApi.updateGameDraft(draft.id, payload(draft));
      setEditing(null);
      setStep(1);
      setOriginConfirmed(false);
      setSubmitNotice("");
      await load();
    } catch {
      setLoadError("Could not save the draft.");
    }
  };

  const saveCurrent = () => {
    if (!editing) return;
    if ("id" in editing) {
      void updateDraft(editing as DraftRow);
    } else {
      void createDraft();
    }
  };

  const submitDraft = async (draft: DraftRow) => {
    if (!draft.originConfirmed) {
      setEditing(draft);
      setOriginConfirmed(false);
      setStep(3);
      setSubmitNotice("");
      return;
    }
    try {
      await productionApi.submitGameDraft(draft.id);
      setOriginConfirmed(false);
      setSubmitNotice("");
      await load();
    } catch {
      setLoadError("Submission failed — check originality flags.");
    }
  };

  const submitNewDraft = async () => {
    if (!editing || !originConfirmed) return;
    if (validateAuthoredGame(editing).length > 0) return;
    try {
      let id: string;
      if ("id" in editing) {
        await productionApi.updateGameDraft((editing as DraftRow).id, payload(editing));
        id = (editing as DraftRow).id;
      } else {
        const created = await productionApi.createGameDraft(payload(editing));
        id = created.id;
      }
      await productionApi.submitGameDraft(id);
      setEditing(null);
      setStep(1);
      setOriginConfirmed(false);
      setSubmitNotice("");
      await load();
    } catch {
      setLoadError("Submission failed — check originality flags.");
    }
  };

  const requestSubmit = () => {
    if (errors.length > 0) {
      setSubmitNotice(`Resolve these before submitting: ${errors.join(", ")}`);
      return;
    }
    if (!originConfirmed) {
      setSubmitNotice("Origin confirmation is required before submitting.");
      return;
    }
    setSubmitNotice("");
    void submitNewDraft();
  };

  const saveLabel = editing && "id" in editing ? "Save changes" : "Create draft";

  if (!apiMode) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="font-display text-lg font-bold text-foreground">Create games</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Game authoring needs the clinic server. Start the app with VITE_DATA_MODE=api to create new games.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-bold text-foreground">Create games</h2>
          <p className="text-sm text-muted-foreground">Build a game from scratch, then send it to a clinic admin for approval.</p>
        </div>
        <button
          onClick={() => { setEditing(emptyGame); setStep(1); setOriginConfirmed(false); setSubmitNotice(""); }}
          className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground touch-target"
        >
          New game
        </button>
      </div>

      {loadError ? <p className="text-sm text-destructive">{loadError}</p> : null}

      {viewingDraft ? (
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display text-sm font-bold text-foreground">Draft preview</h3>
            <button onClick={() => setViewingDraft(null)} className="rounded-xl border border-border px-3 py-2 text-sm font-semibold touch-target">
              Close
            </button>
          </div>
          <div className="rounded-xl border border-border bg-background/40 p-3">
            <GamePreview game={authoredGameToGameConfig({ ...viewingDraft, id: viewingDraft.id, status: "approved" as const, createdAt: viewingDraft.updatedAt })} />
          </div>
        </div>
      ) : null}

      {editing ? (
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-4 flex gap-2 text-xs font-bold text-muted-foreground">
            {(["Basics", "Content", "Review"] as const).map((label, index) => {
              const stepNumber = (index + 1) as 1 | 2 | 3;
              return (
                <button
                  key={label}
                  disabled={stepNumber > 1 && errors.length > 0}
                  onClick={() => setStep(stepNumber)}
                  className={`rounded-full px-3 py-1 touch-target ${step === stepNumber ? "bg-primary text-primary-foreground" : "border border-border"}`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {step === 1 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="block sm:col-span-2">
                <label className="block">
                  <span className="mb-1 block text-sm font-semibold">Game name</span>
                  <input aria-label="title" value={editing.title} maxLength={60}
                    onChange={(e) => update({ title: e.target.value })}
                    className="h-11 w-full rounded-xl border border-border bg-background px-3" />
                </label>
              </div>
              <label className="block">
                <span className="mb-1 block text-sm font-semibold">Emoji</span>
                <input aria-label="emoji" value={editing.emoji} maxLength={2}
                  onChange={(e) => update({ emoji: e.target.value })}
                  className="h-11 w-full rounded-xl border border-border bg-background px-3" />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-semibold">Engine</span>
                <select aria-label="engine" value={editing.engine}
                  onChange={(e) => update({ engine: e.target.value as AuthoredEngine, config: {} })}
                  className="h-11 w-full rounded-xl border border-border bg-background px-3">
                  {AUTHORED_ENGINES.map((engine) => (
                    <option key={engine} value={engine}>{engine}</option>
                  ))}
                </select>
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-sm font-semibold">Description</span>
                <textarea aria-label="description" value={editing.description} maxLength={240}
                  onChange={(e) => update({ description: e.target.value })}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2" rows={3} />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-semibold">Difficulty</span>
                <select aria-label="difficulty" value={editing.difficulty}
                  onChange={(e) => update({ difficulty: e.target.value as AuthoredGame["difficulty"] })}
                  className="h-11 w-full rounded-xl border border-border bg-background px-3">
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-semibold">Learning goal</span>
                <input aria-label="learning goal" value={editing.learningGoal} maxLength={140}
                  onChange={(e) => update({ learningGoal: e.target.value })}
                  className="h-11 w-full rounded-xl border border-border bg-background px-3" />
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-sm font-semibold">Success criteria (one per line)</span>
                <textarea aria-label="success criteria"
                  value={editing.successCriteria.join("\n")}
                  onChange={(e) => update({ successCriteria: e.target.value.split("\n").filter(Boolean).slice(0, 3) })}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2" rows={3} />
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-sm font-semibold">Skills (comma separated)</span>
                <input aria-label="skills" value={editing.skills.join(", ")}
                  onChange={(e) => update({ skills: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                  className="h-11 w-full rounded-xl border border-border bg-background px-3" />
              </label>
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input type="checkbox" aria-label="supports shared"
                  checked={editing.supportsShared}
                  onChange={(e) => update({ supportsShared: e.target.checked })}
                  className="h-5 w-5" />
                Supports caregiver-shared play
              </label>
            </div>
          ) : step === 2 ? (
            <EngineContentFields game={editing} update={update} />
          ) : (
            <div className="space-y-4">
              <h3 className="font-display text-sm font-bold text-foreground">Review games</h3>
              <div className="rounded-xl border border-border bg-background/40 p-3">
                <GamePreview game={authoredGameToGameConfig({ ...editing, id: "preview-id", status: "approved", createdAt: new Date().toISOString() })} />
              </div>
              <div className="rounded-2xl border border-border bg-background/60 p-4">
                <label className="flex items-start gap-3 text-sm">
                  <input type="checkbox" aria-label="origin confirmation"
                    checked={originConfirmed}
                    onChange={(e) => setOriginConfirmed(e.target.checked)}
                    className="mt-1 h-5 w-5" />
                  <span>
                    I created this game and its examples myself. I am not copying a scored task, protocol, or
                    item from a published test or instructional program.
                  </span>
                </label>
                {blocked ? (
                  <p className="mt-2 text-sm text-destructive">
                    Review flagged wording first: banned terms {audit.banned.map((m) => m.text).join(", ")}{" "}
                    {audit.tokenHits.length > 0 ? `| codes ${audit.tokenHits.map((m) => m.text).join(", ")}` : ""}
                  </p>
                ) : null}
                {!originConfirmed ? (
                  <p className="mt-2 text-sm text-destructive">Confirm the origin of this game before submitting it for review.</p>
                ) : null}
              </div>
            </div>
          )}

          {errors.length > 0 ? (
            <p className="mt-3 text-sm text-destructive">Check: {errors.join(", ")}</p>
          ) : null}

          <CreateReviewButtons
            onSave={saveCurrent}
            onSaveLabel={saveLabel}
            disabled={errors.length > 0}
            onSubmit={() => (step === 3 ? requestSubmit() : setStep(3))}
          />
          {submitNotice ? <p className="mt-3 text-sm text-destructive">{submitNotice}</p> : null}
        </div>
      ) : null}

      <div className="space-y-3">
        {drafts.map((draft) => (
          <div key={draft.id} className="flex items-center justify-between rounded-2xl border border-border bg-card p-4">
            <div>
              <p className="font-display text-sm font-bold text-foreground">{draft.emoji} {draft.title}</p>
              <p className="text-xs text-muted-foreground capitalize">{draft.engine} · {draft.status}</p>
            </div>
            <div className="flex gap-2">
              {draft.status === "draft" || draft.status === "changes_requested" ? (
                <>
                  <button onClick={() => { setEditing(draft); setOriginConfirmed(draft.originConfirmed); setStep(1); setSubmitNotice(""); }} className="rounded-xl border border-border px-3 py-2 text-sm font-semibold touch-target">
                    Edit
                  </button>
                  <button onClick={() => void submitDraft(draft)} className="rounded-xl bg-primary px-3 py-2 text-sm font-bold text-primary-foreground touch-target">
                    Submit for review
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => setViewingDraft(draft)} className="rounded-xl border border-border px-3 py-2 text-sm font-semibold touch-target">
                    View
                  </button>
                  <span className="text-xs text-muted-foreground">{draft.status}</span>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}