import { useState } from "react";
import { Child, ClinicalRatings, useApp } from "@/context/AppContext";
import { motion, AnimatePresence } from "framer-motion";
import { getPersonalizationSummary } from "@/lib/personalization";
import { emptySkillProfile } from "@/lib/skills";
import { buildGoalFromTemplate, goalTemplates } from "@/lib/goalTemplates";

function splitTags(value: string) {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function joinTags(values: string[]) {
  return values.join(", ");
}

const ratingLabels: Array<{ key: keyof ClinicalRatings; label: string }> = [
  { key: "communicationSupport", label: "Communication support" },
  { key: "regulationSupport", label: "Regulation support" },
  { key: "transitionSupport", label: "Transition support" },
  { key: "promptDependence", label: "Prompt dependence" },
  { key: "reinforcementResponse", label: "Reinforcement support" },
];

export default function ChildList() {
  const { children, removeChild, updateChild, addGoal, assignments } = useApp();
  const [showForm, setShowForm] = useState(false);
  const [editingChildId, setEditingChildId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [age, setAge] = useState("6");
  const [avatar, setAvatar] = useState("👧");
  const [notes, setNotes] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [preferredStyle, setPreferredStyle] = useState<Child["personalizationProfile"]["preferredStyle"]>("visual");
  const [communicationLevel, setCommunicationLevel] = useState<Child["personalizationProfile"]["communicationLevel"]>("phrases");
  const [reinforcementType, setReinforcementType] = useState<Child["personalizationProfile"]["reinforcementType"]>("social-praise");
  const [promptLevel, setPromptLevel] = useState<Child["personalizationProfile"]["promptLevel"]>("verbal");
  const [transitionDifficulty, setTransitionDifficulty] = useState<Child["personalizationProfile"]["transitionDifficulty"]>("moderate");
  const [interests, setInterests] = useState("");
  const [strengths, setStrengths] = useState("");
  const [supportNeeds, setSupportNeeds] = useState("");
  const [sensoryPreferences, setSensoryPreferences] = useState("");
  const [triggerPatterns, setTriggerPatterns] = useState("");
  const [regulationSupports, setRegulationSupports] = useState("");
  const [communicationSupport, setCommunicationSupport] = useState("3");
  const [regulationSupport, setRegulationSupport] = useState("3");
  const [transitionSupport, setTransitionSupport] = useState("3");
  const [promptDependence, setPromptDependence] = useState("3");
  const [reinforcementResponse, setReinforcementResponse] = useState("3");

  const [goalTemplateByChild, setGoalTemplateByChild] = useState<Record<string, string>>({});

  const avatars = ["👧", "👦", "👶", "🧒"];

  const relationshipLabels: Record<string, string> = {
    parent: "Parent",
    sibling: "Sibling",
    grandparent: "Grandparent",
    "aunt-uncle": "Aunt/Uncle",
    other: "Other",
  };

  const resetChildForm = () => {
    setName("");
    setAge("6");
    setAvatar("👧");
    setNotes("");
    setDiagnosis("");
    setPreferredStyle("visual");
    setCommunicationLevel("phrases");
    setReinforcementType("social-praise");
    setPromptLevel("verbal");
    setTransitionDifficulty("moderate");
    setInterests("");
    setStrengths("");
    setSupportNeeds("");
    setSensoryPreferences("");
    setTriggerPatterns("");
    setRegulationSupports("");
    setCommunicationSupport("3");
    setRegulationSupport("3");
    setTransitionSupport("3");
    setPromptDependence("3");
    setReinforcementResponse("3");
    setShowForm(false);
    setEditingChildId(null);
  };

  const saveChild = () => {
    const parsedAge = Number.parseInt(age, 10);
    if (!name.trim() || Number.isNaN(parsedAge)) return;
    const existingChild = editingChildId ? children.find((child) => child.id === editingChildId) : undefined;
    const nextRatings: ClinicalRatings = {
      communicationSupport: Number.parseInt(communicationSupport, 10),
      regulationSupport: Number.parseInt(regulationSupport, 10),
      transitionSupport: Number.parseInt(transitionSupport, 10),
      promptDependence: Number.parseInt(promptDependence, 10),
      reinforcementResponse: Number.parseInt(reinforcementResponse, 10),
    };
    const ratingValues = Object.values(nextRatings);
    if (ratingValues.some((value) => Number.isNaN(value) || value < 1 || value > 5)) return;
    const previousRatings = existingChild?.personalizationProfile.clinicalRatings;
    const ratingsChanged = !previousRatings || Object.entries(nextRatings).some(([key, value]) => previousRatings[key as keyof ClinicalRatings] !== value);
    const nextHistory = editingChildId
      ? existingChild?.personalizationProfile.clinicalRatingHistory || []
      : [];

    const payload: Omit<Child, "id"> = {
      name: name.trim(),
      age: parsedAge,
      avatar,
      notes,
      diagnosis,
      familyMembers: editingChildId ? children.find((child) => child.id === editingChildId)?.familyMembers || [] : [],
      personalizationProfile: {
        preferredStyle,
        communicationLevel,
        reinforcementType,
        promptLevel,
        transitionDifficulty,
        interests: splitTags(interests),
        strengths: splitTags(strengths),
        supportNeeds: splitTags(supportNeeds),
        sensoryPreferences: splitTags(sensoryPreferences),
        triggerPatterns: splitTags(triggerPatterns),
        regulationSupports: splitTags(regulationSupports),
        clinicalRatings: nextRatings,
        clinicalRatingHistory: ratingsChanged
          ? [
              ...nextHistory,
              {
                ...nextRatings,
                recordedAt: new Date().toISOString(),
                notes: editingChildId ? "Therapist updated clinical scale ratings." : "Initial clinical baseline created.",
              },
            ]
          : nextHistory,
      },
      therapyGoals: editingChildId
        ? existingChild?.therapyGoals || []
        : [
            {
              id: `goal-${Date.now()}`,
              title: "Build confidence with assigned learning games",
              domain: "attention",
              targetLevel: 70,
              status: "active",
              notes: "Starter goal created during onboarding.",
            },
          ],
      skillProfile: editingChildId ? existingChild?.skillProfile || emptySkillProfile() : emptySkillProfile(),
      progressionSettings: editingChildId
        ? existingChild?.progressionSettings || {
            autoAdvance: true,
            approvalRequired: true,
            recommendedDifficulty: "easy",
            maxDifficulty: "hard",
          }
        : {
            autoAdvance: true,
            approvalRequired: true,
            recommendedDifficulty: "easy",
            maxDifficulty: "hard",
          },
    };

    if (!editingChildId) return;

    updateChild(editingChildId, payload);

    resetChildForm();
  };

  const beginEdit = (child: Child) => {
    setEditingChildId(child.id);
    setShowForm(true);
    setName(child.name);
    setAge(String(child.age));
    setAvatar(child.avatar);
    setNotes(child.notes);
    setDiagnosis(child.diagnosis || "");
    setPreferredStyle(child.personalizationProfile.preferredStyle);
    setCommunicationLevel(child.personalizationProfile.communicationLevel);
    setReinforcementType(child.personalizationProfile.reinforcementType);
    setPromptLevel(child.personalizationProfile.promptLevel);
    setTransitionDifficulty(child.personalizationProfile.transitionDifficulty);
    setInterests(joinTags(child.personalizationProfile.interests));
    setStrengths(joinTags(child.personalizationProfile.strengths));
    setSupportNeeds(joinTags(child.personalizationProfile.supportNeeds));
    setSensoryPreferences(joinTags(child.personalizationProfile.sensoryPreferences));
    setTriggerPatterns(joinTags(child.personalizationProfile.triggerPatterns));
    setRegulationSupports(joinTags(child.personalizationProfile.regulationSupports));
    setCommunicationSupport(String(child.personalizationProfile.clinicalRatings.communicationSupport));
    setRegulationSupport(String(child.personalizationProfile.clinicalRatings.regulationSupport));
    setTransitionSupport(String(child.personalizationProfile.clinicalRatings.transitionSupport));
    setPromptDependence(String(child.personalizationProfile.clinicalRatings.promptDependence));
    setReinforcementResponse(String(child.personalizationProfile.clinicalRatings.reinforcementResponse));
  };

  const applyGoalTemplate = (childId: string) => {
    const child = children.find((entry) => entry.id === childId);
    const templateId = goalTemplateByChild[childId];
    const template = goalTemplates.find((entry) => entry.id === templateId);
    if (!child || !template) return;

    const duplicate = child.therapyGoals.some((goal) => goal.title === template.title && goal.domain === template.domain);
    if (duplicate) return;

    const { id: _ignored, ...goal } = buildGoalFromTemplate(template);
    addGoal(childId, goal);
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="font-display text-lg font-bold text-foreground">My Children ({children.length})</h2>
      </div>

      <AnimatePresence>
        {showForm ? (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mb-6 overflow-hidden rounded-xl bg-muted p-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Name"><input value={name} onChange={(event) => setName(event.target.value)} className="w-full rounded-lg border border-border bg-card px-3 py-2 text-foreground" placeholder="Child's name" /></Field>
              <Field label="Age"><input type="number" value={age} onChange={(event) => setAge(event.target.value)} className="w-full rounded-lg border border-border bg-card px-3 py-2 text-foreground" min="2" max="18" /></Field>
              <Field label="Diagnosis">
                <select value={diagnosis} onChange={(event) => setDiagnosis(event.target.value)} className="w-full rounded-lg border border-border bg-card px-3 py-2 text-foreground">
                  <option value="">Select...</option>
                  <option value="ASD Level 1">ASD Level 1</option>
                  <option value="ASD Level 2">ASD Level 2</option>
                  <option value="ASD Level 3">ASD Level 3</option>
                  <option value="ADHD">ADHD</option>
                  <option value="ASD + ADHD">ASD + ADHD</option>
                  <option value="Other">Other</option>
                </select>
              </Field>
              <Field label="Preferred Style">
                <select value={preferredStyle} onChange={(event) => setPreferredStyle(event.target.value as Child["personalizationProfile"]["preferredStyle"])} className="w-full rounded-lg border border-border bg-card px-3 py-2 text-foreground">
                  <option value="visual">Visual</option>
                  <option value="hands-on">Hands-on</option>
                  <option value="verbal">Verbal</option>
                  <option value="mixed">Mixed</option>
                </select>
              </Field>
              <Field label="Communication Level">
                <select value={communicationLevel} onChange={(event) => setCommunicationLevel(event.target.value as Child["personalizationProfile"]["communicationLevel"])} className="w-full rounded-lg border border-border bg-card px-3 py-2 text-foreground">
                  <option value="emerging">Emerging</option>
                  <option value="gestures">Gestures</option>
                  <option value="single-words">Single words</option>
                  <option value="phrases">Phrases</option>
                  <option value="conversational">Conversational</option>
                </select>
              </Field>
              <Field label="Reinforcement Type">
                <select value={reinforcementType} onChange={(event) => setReinforcementType(event.target.value as Child["personalizationProfile"]["reinforcementType"])} className="w-full rounded-lg border border-border bg-card px-3 py-2 text-foreground">
                  <option value="visual-praise">Visual praise</option>
                  <option value="tokens">Tokens</option>
                  <option value="movement-breaks">Movement breaks</option>
                  <option value="preferred-items">Preferred items</option>
                  <option value="social-praise">Social praise</option>
                </select>
              </Field>
              <Field label="Prompt Level">
                <select value={promptLevel} onChange={(event) => setPromptLevel(event.target.value as Child["personalizationProfile"]["promptLevel"])} className="w-full rounded-lg border border-border bg-card px-3 py-2 text-foreground">
                  <option value="full-physical">Full physical</option>
                  <option value="partial-physical">Partial physical</option>
                  <option value="modeling">Modeling</option>
                  <option value="gestural">Gestural</option>
                  <option value="verbal">Verbal</option>
                  <option value="independent">Independent</option>
                </select>
              </Field>
              <Field label="Transition Difficulty">
                <select value={transitionDifficulty} onChange={(event) => setTransitionDifficulty(event.target.value as Child["personalizationProfile"]["transitionDifficulty"])} className="w-full rounded-lg border border-border bg-card px-3 py-2 text-foreground">
                  <option value="low">Low</option>
                  <option value="moderate">Moderate</option>
                  <option value="high">High</option>
                </select>
              </Field>
              <div>
                <label className="mb-1 block text-sm font-semibold text-foreground">Avatar</label>
                <div className="flex flex-wrap gap-2">
                  {avatars.map((entry) => (
                    <button key={entry} onClick={() => setAvatar(entry)} className={`rounded-lg p-1 text-2xl transition-colors ${avatar === entry ? "bg-primary/20 ring-2 ring-primary" : ""}`}>
                      {entry}
                    </button>
                  ))}
                </div>
              </div>
              <Field label="Summary">
                <input value={notes} onChange={(event) => setNotes(event.target.value)} className="w-full rounded-lg border border-border bg-card px-3 py-2 text-foreground" placeholder="Loves visuals, benefits from structure..." />
              </Field>
              <Field label="Interests"><input value={interests} onChange={(event) => setInterests(event.target.value)} className="w-full rounded-lg border border-border bg-card px-3 py-2 text-foreground" placeholder="animals, colors, cars" /></Field>
              <Field label="Strengths"><input value={strengths} onChange={(event) => setStrengths(event.target.value)} className="w-full rounded-lg border border-border bg-card px-3 py-2 text-foreground" placeholder="visual matching, sequencing" /></Field>
              <Field label="Support Needs"><input value={supportNeeds} onChange={(event) => setSupportNeeds(event.target.value)} className="w-full rounded-lg border border-border bg-card px-3 py-2 text-foreground" placeholder="short instructions, predictable transitions" /></Field>
              <Field label="Sensory Preferences"><input value={sensoryPreferences} onChange={(event) => setSensoryPreferences(event.target.value)} className="w-full rounded-lg border border-border bg-card px-3 py-2 text-foreground" placeholder="low noise, movement breaks" /></Field>
              <Field label="Trigger Patterns"><input value={triggerPatterns} onChange={(event) => setTriggerPatterns(event.target.value)} className="w-full rounded-lg border border-border bg-card px-3 py-2 text-foreground" placeholder="task ending, waiting, too much noise" /></Field>
              <Field label="Regulation Supports"><input value={regulationSupports} onChange={(event) => setRegulationSupports(event.target.value)} className="w-full rounded-lg border border-border bg-card px-3 py-2 text-foreground" placeholder="deep breaths, first-then, movement break" /></Field>
            </div>
            <div className="mt-4 rounded-xl border border-border bg-card p-4">
              <p className="text-sm font-semibold text-foreground">Clinical baseline scales</p>
              <p className="mt-1 text-xs text-muted-foreground">Rate current support need from 1 to 5. Lower scores mean more independence and easier regulation.</p>
              <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
                <Field label="Communication">
                  <select value={communicationSupport} onChange={(event) => setCommunicationSupport(event.target.value)} className="w-full rounded-lg border border-border bg-card px-3 py-2 text-foreground">
                    {[1, 2, 3, 4, 5].map((value) => <option key={`communication-${value}`} value={value}>{value}</option>)}
                  </select>
                </Field>
                <Field label="Regulation">
                  <select value={regulationSupport} onChange={(event) => setRegulationSupport(event.target.value)} className="w-full rounded-lg border border-border bg-card px-3 py-2 text-foreground">
                    {[1, 2, 3, 4, 5].map((value) => <option key={`regulation-${value}`} value={value}>{value}</option>)}
                  </select>
                </Field>
                <Field label="Transitions">
                  <select value={transitionSupport} onChange={(event) => setTransitionSupport(event.target.value)} className="w-full rounded-lg border border-border bg-card px-3 py-2 text-foreground">
                    {[1, 2, 3, 4, 5].map((value) => <option key={`transition-${value}`} value={value}>{value}</option>)}
                  </select>
                </Field>
                <Field label="Prompting">
                  <select value={promptDependence} onChange={(event) => setPromptDependence(event.target.value)} className="w-full rounded-lg border border-border bg-card px-3 py-2 text-foreground">
                    {[1, 2, 3, 4, 5].map((value) => <option key={`prompt-${value}`} value={value}>{value}</option>)}
                  </select>
                </Field>
                <Field label="Reinforcement">
                  <select value={reinforcementResponse} onChange={(event) => setReinforcementResponse(event.target.value)} className="w-full rounded-lg border border-border bg-card px-3 py-2 text-foreground">
                    {[1, 2, 3, 4, 5].map((value) => <option key={`reinforcement-${value}`} value={value}>{value}</option>)}
                  </select>
                </Field>
              </div>
            </div>
            <button onClick={saveChild} className="mt-4 touch-target rounded-lg bg-secondary px-6 py-2 text-sm font-semibold text-secondary-foreground">
              {editingChildId ? "Save Changes" : "Save Child"}
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {children.map((child) => {
          const childAssignments = assignments.filter((assignment) => assignment.childId === child.id);
          const pending = childAssignments.filter((assignment) => assignment.status === "pending").length;
          const completed = childAssignments.filter((assignment) => assignment.status === "completed").length;
          const homeworkCount = childAssignments.filter((assignment) => assignment.type === "homework").length;
          const classworkCount = childAssignments.filter((assignment) => assignment.type === "classwork").length;
          const personalization = getPersonalizationSummary(child, assignments);

          return (
            <motion.div key={child.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-4xl">{child.avatar}</span>
                  <div>
                    <h3 className="font-display font-bold text-foreground">{child.name}</h3>
                    <p className="text-sm text-muted-foreground">Age {child.age}</p>
                    {child.diagnosis ? <p className="text-xs font-semibold text-primary">{child.diagnosis}</p> : null}
                  </div>
                </div>
                <button onClick={() => beginEdit(child)} className="text-xs font-semibold text-primary hover:underline">Edit</button>
              </div>

              {child.notes ? <p className="mb-3 text-sm italic text-muted-foreground">"{child.notes}"</p> : null}

              <div className="mb-3 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-accent/20 px-2 py-1 text-accent-foreground">{pending} pending</span>
                <span className="rounded-full bg-secondary/20 px-2 py-1 text-foreground">{completed} completed</span>
                <span className="rounded-full bg-primary/10 px-2 py-1 text-foreground">📝 {homeworkCount}</span>
                <span className="rounded-full bg-primary/10 px-2 py-1 text-foreground">🏥 {classworkCount}</span>
              </div>

              <div className="mb-3 rounded-xl bg-muted p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Personalization Profile</p>
                <p className="mt-1 text-sm font-semibold text-foreground">Learns best with {child.personalizationProfile.preferredStyle} supports</p>
                <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                  <p>Communication: {child.personalizationProfile.communicationLevel}</p>
                  <p>Reinforcement: {child.personalizationProfile.reinforcementType.replace("-", " ")}</p>
                  <p>Prompt level: {child.personalizationProfile.promptLevel.replace("-", " ")}</p>
                  <p>Transitions: {child.personalizationProfile.transitionDifficulty}</p>
                </div>
                <TagRow label="Interests" values={child.personalizationProfile.interests} />
                <TagRow label="Strengths" values={child.personalizationProfile.strengths} />
                <TagRow label="Needs" values={child.personalizationProfile.supportNeeds} />
                <TagRow label="Sensory" values={child.personalizationProfile.sensoryPreferences} />
                <TagRow label="Triggers" values={child.personalizationProfile.triggerPatterns} />
                <TagRow label="Regulation" values={child.personalizationProfile.regulationSupports} />
                <div className="mt-3 rounded-lg bg-card p-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Clinical scales</p>
                  <div className="mt-2 grid grid-cols-1 gap-1 text-[11px] text-muted-foreground">
                    {ratingLabels.map(({ key, label }) => (
                      <p key={`${child.id}-${key}`}>
                        {label}: {child.personalizationProfile.clinicalRatings[key]}/5
                      </p>
                    ))}
                  </div>
                  <p className="mt-2 text-[10px] text-muted-foreground">
                    {child.personalizationProfile.clinicalRatingHistory.length} saved baseline update{child.personalizationProfile.clinicalRatingHistory.length === 1 ? "" : "s"}
                  </p>
                </div>
              </div>

              <div className="mb-3 rounded-xl bg-muted p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Progression</p>
                <p className="mt-1 text-sm font-semibold text-foreground capitalize">
                  {personalization.progressionStage} stage - aim for {personalization.recommendedDifficulty}
                </p>
                <p className="text-xs text-muted-foreground">
                  Avg score {personalization.avgScore}% across {personalization.completedGamesCount} completed games
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Active goals: {child.therapyGoals.filter((goal) => goal.status === "active").map((goal) => goal.domain).join(", ") || "none yet"}
                </p>
              </div>

              <div className="mb-3 rounded-xl bg-muted p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Goal Templates</p>
                <div className="mt-2 flex gap-2">
                  <select
                    value={goalTemplateByChild[child.id] || ""}
                    onChange={(event) => setGoalTemplateByChild((current) => ({ ...current, [child.id]: event.target.value }))}
                    className="flex-1 rounded-lg border border-border bg-card px-3 py-2 text-xs text-foreground"
                  >
                    <option value="">Choose a template...</option>
                    {goalTemplates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.title}
                      </option>
                    ))}
                  </select>
                  <button onClick={() => applyGoalTemplate(child.id)} className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground">
                    Add Goal
                  </button>
                </div>
                <div className="mt-3 space-y-1">
                  {child.therapyGoals.slice(0, 3).map((goal) => (
                    <p key={goal.id} className="text-xs text-foreground">
                      {goal.title} ({goal.domain})
                    </p>
                  ))}
                </div>
              </div>

              <div className="border-t border-border pt-3">
                <p className="mb-2 text-xs font-semibold text-foreground">Family Members</p>
                <div className="space-y-1">
                  {child.familyMembers.map((familyMember) => (
                    <div key={familyMember.id} className="rounded-lg bg-muted px-2 py-1 text-xs">
                      <span>
                        {familyMember.avatar} {familyMember.name} <span className="text-muted-foreground">({relationshipLabels[familyMember.relationship]})</span>
                      </span>
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        Sign in: {familyMember.phoneNumber} · credentials {familyMember.credentialStatus}
                      </p>
                    </div>
                  ))}
                  {child.familyMembers.length === 0 ? <p className="text-xs text-muted-foreground">No family members added</p> : null}
                </div>
              </div>

              <button onClick={() => removeChild(child.id)} className="mt-3 text-xs text-destructive hover:underline">
                Remove Child
              </button>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-semibold text-foreground">{label}</label>
      {children}
    </div>
  );
}

function TagRow({ label, values }: { label: string; values: string[] }) {
  if (values.length === 0) return null;

  return (
    <div className="mt-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <div className="mt-1 flex flex-wrap gap-1">
        {values.map((value) => (
          <span key={`${label}-${value}`} className="rounded-full bg-card px-2 py-1 text-[10px] text-foreground">
            {value}
          </span>
        ))}
      </div>
    </div>
  );
}
