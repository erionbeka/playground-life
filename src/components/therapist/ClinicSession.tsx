import { useEffect, useState } from "react";
import { useApp } from "@/context/AppContext";
import { categoryMeta, GameCategory, Difficulty } from "@/data/games";
import { useCatalog } from "@/lib/customCatalog";
import { motion, AnimatePresence } from "framer-motion";
import { getGameSkillDomains } from "@/lib/skills";

const categories = Object.entries(categoryMeta) as [GameCategory, typeof categoryMeta[GameCategory]][];

export default function ClinicSession() {
  const { children, createAssignment } = useApp();
  const catalog = useCatalog();
  const [selectedChildren, setSelectedChildren] = useState<string[]>([]);
  const [selectedGames, setSelectedGames] = useState<string[]>([]);
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [mode, setMode] = useState<"single" | "multiplayer">("multiplayer");
  const [notes, setNotes] = useState("");
  const [filterCategory, setFilterCategory] = useState<GameCategory | "all">("all");
  const [success, setSuccess] = useState(false);

  const multiplayerGames = catalog.filter((g) => g.supportsMultiplayer);
  const availableGames = mode === "multiplayer" ? multiplayerGames : catalog;
  const filteredGames = filterCategory === "all" ? availableGames : availableGames.filter((g) => g.category === filterCategory);

  useEffect(() => {
    setSelectedGames((prev) => prev.filter((id) => availableGames.some((g) => g.id === id)));
  }, [availableGames]);

  const toggleChild = (id: string) => {
    setSelectedChildren((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  };

  const toggleGame = (id: string) => {
    setSelectedGames((prev) => (prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]));
  };

  const handleAssign = () => {
    if (selectedChildren.length === 0 || selectedGames.length === 0) return;
    const skillFocus = Array.from(new Set(selectedGames.flatMap((gameId) => getGameSkillDomains(gameId))));
    selectedChildren.forEach((childId) => {
      createAssignment({
        childId,
        type: "classwork",
        gameIds: selectedGames,
        difficulty,
        mode,
        notes,
        dueDate: new Date().toISOString().slice(0, 10),
        skillFocus: skillFocus.length > 0 ? skillFocus : ["social", "communication"],
      });
    });
    setSelectedGames([]);
    setSelectedChildren([]);
    setNotes("");
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
  };

  return (
    <div>
      <h2 className="font-display text-lg font-bold text-foreground mb-2">Clinic Classwork</h2>
      <p className="text-sm text-muted-foreground mb-6">Assign solo or multiplayer activities for in-clinic sessions</p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-4">
          <div>
            <label className="text-sm font-semibold text-foreground block mb-2">Select Children</label>
            <div className="space-y-2">
              {children.map((c) => (
                <button
                  key={c.id}
                  onClick={() => toggleChild(c.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all touch-target ${
                    selectedChildren.includes(c.id)
                      ? "border-primary bg-primary/10"
                      : "border-border bg-card hover:border-primary/30"
                  }`}
                >
                  <span className="text-2xl">{c.avatar}</span>
                  <div className="text-left">
                    <p className="font-bold text-sm text-foreground">{c.name}</p>
                    <p className="text-xs text-muted-foreground">Age {c.age}</p>
                  </div>
                  {selectedChildren.includes(c.id) && <span className="ml-auto text-primary">Done</span>}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-foreground block mb-1">Difficulty</label>
            <div className="flex gap-2">
              {(["easy", "medium", "hard"] as Difficulty[]).map((d) => (
                <button key={d} onClick={() => setDifficulty(d)} className={`px-4 py-2 rounded-lg text-sm font-semibold capitalize touch-target transition-colors ${difficulty === d ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                  {d}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-foreground block mb-1">Mode</label>
            <div className="flex gap-2">
              <button onClick={() => setMode("single")} className={`px-4 py-2 rounded-lg text-sm font-semibold touch-target transition-colors ${mode === "single" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                Solo
              </button>
              <button onClick={() => setMode("multiplayer")} className={`px-4 py-2 rounded-lg text-sm font-semibold touch-target transition-colors ${mode === "multiplayer" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                Multiplayer
              </button>
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-foreground block mb-1">Session Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="w-full rounded-lg border border-border bg-card px-3 py-2 text-foreground resize-none" placeholder="Goals, group dynamics..." />
          </div>

          <div className="bg-muted rounded-xl p-4">
            <p className="text-sm font-semibold text-foreground mb-1">
              {selectedChildren.length} children - {selectedGames.length} games
            </p>
            <div className="flex flex-wrap gap-1">
              {selectedGames.map((id) => {
                const g = availableGames.find((game) => game.id === id) || catalog.find((game) => game.id === id);
                return g ? (
                  <span key={id} className="text-xs bg-primary/10 text-foreground px-2 py-1 rounded-full">
                    {g.emoji} {g.name}
                  </span>
                ) : null;
              })}
            </div>
          </div>

          <button
            onClick={handleAssign}
            disabled={selectedChildren.length === 0 || selectedGames.length === 0}
            className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-display font-bold text-base touch-target disabled:opacity-50 transition-opacity"
          >
            Start Clinic Session ({selectedChildren.length} kids, {selectedGames.length} games)
          </button>

          <AnimatePresence>
            {success && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="bg-secondary/20 text-foreground text-center py-2 rounded-lg text-sm font-semibold">
                Classwork session created!
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="lg:col-span-2">
          <div className="flex gap-2 flex-wrap mb-4">
            <button onClick={() => setFilterCategory("all")} className={`px-3 py-1.5 rounded-full text-xs font-semibold touch-target transition-colors ${filterCategory === "all" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
              {mode === "multiplayer" ? "All Multiplayer" : "All Games"}
            </button>
            {categories.map(([key, meta]) => {
              const count = availableGames.filter((g) => g.category === key).length;
              if (count === 0) return null;
              return (
                <button key={key} onClick={() => setFilterCategory(key)} className={`px-3 py-1.5 rounded-full text-xs font-semibold touch-target transition-colors ${filterCategory === key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                  {meta.emoji} {meta.label} ({count})
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 min-[380px]:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-[500px] overflow-y-auto pr-1 sm:pr-2">
            {filteredGames.map((g) => (
              <button
                key={g.id}
                onClick={() => toggleGame(g.id)}
                className={`text-left p-3 rounded-xl border-2 transition-all touch-target ${
                  selectedGames.includes(g.id)
                    ? "border-primary bg-primary/10 shadow-md"
                    : "border-border bg-card hover:border-primary/30"
                }`}
              >
                <div className="text-2xl mb-1">{g.emoji}</div>
                <p className="text-xs font-bold text-foreground leading-tight">{g.name}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{g.estimatedMinutes}min - {g.difficulty}</p>
                {mode === "multiplayer" && (
                  <span className="text-[10px] bg-accent/20 text-foreground px-1.5 py-0.5 rounded-full mt-1 inline-block">Multiplayer</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
