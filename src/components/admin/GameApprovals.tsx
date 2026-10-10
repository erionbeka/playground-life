import { useEffect, useState } from "react";
import { productionApi } from "@/lib/productionApi";
import { authoredGameToGameConfig, PublishedGame } from "@/lib/gameAuthoring";
import GamePreview from "@/components/game/GamePreview";

interface DraftRow extends Omit<PublishedGame, "status"> {
  status: "draft" | "submitted" | "approved" | "rejected" | "changes_requested";
  originConfirmed: boolean;
  updatedAt: string;
  authorId: string;
}

type Decision = "approve" | "reject" | "changes_requested";

const DECISION_CONFIRM_TEXT: Record<Decision, string> = {
  approve: "Approve this submission?",
  reject: "Reject this submission?",
  changes_requested: "Request changes to this submission?",
};

const LOAD_ERROR_TEXT = "We couldn't load game submissions. Please try again.";
const DECIDE_ERROR_TEXT = "We couldn't save that decision. Please try again.";

export default function GameApprovals() {
  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const { drafts: rows } = await productionApi.listGameDrafts();
      setDrafts(rows as DraftRow[]);
    } catch {
      setDrafts([]);
      setError(LOAD_ERROR_TEXT);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, []);

  const queue = drafts.filter((d) => d.status === "submitted");
  const decided = drafts.filter((d) => d.status === "approved" || d.status === "rejected");

  const decide = async (id: string, decision: Decision) => {
    if (!window.confirm(DECISION_CONFIRM_TEXT[decision])) return;
    setError("");
    try {
      await productionApi.decideGameDraft(id, decision);
      await load();
    } catch {
      setError(DECIDE_ERROR_TEXT);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-lg font-bold text-foreground">Game submissions</h2>
        <p className="text-sm text-muted-foreground">
          Review each game, confirm the therapist marked it as an original idea, then approve or reject.
        </p>
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}

      {error ? (
        <p role="alert" className="rounded-xl border border-border bg-background/50 p-4 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {!loading && queue.length === 0 && !error ? (
        <p className="rounded-xl border border-border bg-background/50 p-4 text-sm text-muted-foreground">
          No games waiting for review.
        </p>
      ) : null}

      <div className="space-y-6">
        {queue.map((draft) => {
          const game = authoredGameToGameConfig({ ...draft, status: "approved" });
          return (
            <div key={draft.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-display text-base font-bold text-foreground">{draft.emoji} {draft.title}</h3>
                  <p className="text-xs text-muted-foreground capitalize">{draft.engine} · by {draft.authorId.slice(0, 8)} · origin {draft.originConfirmed ? "confirmed" : "unconfirmed"}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => void decide(draft.id, "changes_requested")} className="rounded-xl border border-border px-4 py-2 text-sm font-semibold text-foreground touch-target">
                    Request changes
                  </button>
                  <button onClick={() => void decide(draft.id, "reject")} className="rounded-xl border border-border px-4 py-2 text-sm font-semibold text-muted-foreground touch-target">
                    Reject
                  </button>
                  <button onClick={() => void decide(draft.id, "approve")} className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground touch-target">
                    Approve
                  </button>
                </div>
              </div>
              <p className="mb-3 text-sm text-muted-foreground">{draft.description}</p>
              <div className="rounded-xl border border-border bg-background/40 p-3">
                <GamePreview game={game} />
              </div>
            </div>
          );
        })}
      </div>

      {decided.length > 0 ? (
        <div className="rounded-2xl border border-border bg-card p-4">
          <h3 className="mb-2 font-display text-sm font-bold text-foreground">Recently decided</h3>
          {decided.map((draft) => (
            <p key={draft.id} className="text-sm text-muted-foreground">{draft.emoji} {draft.title} — <span className="capitalize">{draft.status}</span></p>
          ))}
        </div>
      ) : null}
    </div>
  );
}
