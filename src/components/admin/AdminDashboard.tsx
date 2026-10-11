import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { FamilyMember, useApp } from "@/context/AppContext";
import { emptySkillProfile } from "@/lib/skills";
import GameApprovals from "./GameApprovals";

type Tab = "overview" | "staff" | "families" | "content" | "readiness";

const tabs: { key: Tab; label: string; emoji?: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "staff", label: "Staff" },
  { key: "families", label: "Families" },
  { key: "content", label: "Content", emoji: "🎨" },
  { key: "readiness", label: "Readiness" },
];

export default function AdminDashboard() {
  const { setRole, session, signInAdmin, signOut, adminUsers, therapistUsers, addStaffUser, addChild, addFamilyMember, children, assignments, issueFamilyInvite, resetFamilyCredentials, auditLog } = useApp();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("overview");
  const [email, setEmail] = useState(adminUsers[0]?.email || "admin@playgroundlife.app");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState("");
  const [staffRole, setStaffRole] = useState<"admin" | "therapist">("therapist");
  const [staffName, setStaffName] = useState("");
  const [staffEmail, setStaffEmail] = useState("");
  const [staffPassword, setStaffPassword] = useState("");
  const [generatedPasswords, setGeneratedPasswords] = useState<Record<string, string>>({});
  const [generatedInvites, setGeneratedInvites] = useState<Record<string, string>>({});
  const [showAddChild, setShowAddChild] = useState(false);
  const [childName, setChildName] = useState("");
  const [childAvatar, setChildAvatar] = useState("🧒");
  const [childAge, setChildAge] = useState("6");
  const [childDiagnosis, setChildDiagnosis] = useState("");
  const [childNotes, setChildNotes] = useState("");
  const [addingFamilyTo, setAddingFamilyTo] = useState<string | null>(null);
  const [fmName, setFmName] = useState("");
  const [fmRelationship, setFmRelationship] = useState<FamilyMember["relationship"]>("parent");
  const [fmAvatar, setFmAvatar] = useState("👩");
  const [fmPhoneNumber, setFmPhoneNumber] = useState("");
  const [fmPassword, setFmPassword] = useState("");
  const childAvatars = ["👧", "👦", "👶", "🧒"];
  const fmAvatars = ["👩", "👨", "👧", "👦", "👵", "👴"];

  const resetAddChildForm = () => {
    setChildName("");
    setChildAvatar("🧒");
    setChildAge("6");
    setChildDiagnosis("");
    setChildNotes("");
    setShowAddChild(false);
  };

  const saveChild = () => {
    if (!childName.trim()) return;
    const parsedAge = Number.parseInt(childAge, 10);
    addChild({
      name: childName.trim(),
      age: Number.isNaN(parsedAge) ? 0 : parsedAge,
      avatar: childAvatar,
      notes: childNotes,
      diagnosis: childDiagnosis || undefined,
      familyMembers: [],
      personalizationProfile: {
        preferredStyle: "mixed",
        communicationLevel: "phrases",
        reinforcementType: "social-praise",
        promptLevel: "verbal",
        transitionDifficulty: "moderate",
        interests: [],
        strengths: [],
        supportNeeds: [],
        sensoryPreferences: [],
        triggerPatterns: [],
        regulationSupports: [],
        clinicalRatings: {
          communicationSupport: 3,
          regulationSupport: 3,
          transitionSupport: 3,
          promptDependence: 3,
          reinforcementResponse: 3,
        },
        clinicalRatingHistory: [],
      },
      therapyGoals: [],
      skillProfile: emptySkillProfile(),
      progressionSettings: { autoAdvance: true, approvalRequired: true, recommendedDifficulty: "easy", maxDifficulty: "hard" },
    });
    resetAddChildForm();
  };

  const resetFamilyForm = () => {
    setFmName("");
    setFmRelationship("parent");
    setFmAvatar("👩");
    setFmPhoneNumber("");
    setFmPassword("");
    setAddingFamilyTo(null);
  };

  const handleAddFamily = async (childId: string) => {
    if (!fmName.trim() || !fmPhoneNumber.trim() || fmPassword.trim().length < 12) return;
    const inviteCode = await addFamilyMember(childId, {
      name: fmName.trim(),
      relationship: fmRelationship,
      avatar: fmAvatar,
      phoneNumber: fmPhoneNumber.trim(),
      password: fmPassword,
    });
    if (inviteCode) setGeneratedInvites((current) => ({ ...current, [fmPhoneNumber.trim()]: inviteCode }));
    resetFamilyForm();
  };

  const familyRows = useMemo(
    () =>
      children.flatMap((child) =>
        child.familyMembers.map((familyMember) => ({
          child,
          familyMember,
        }))
      ),
    [children]
  );

  const pendingFamilies = familyRows.filter(({ familyMember }) => familyMember.credentialStatus === "pending").length;
  const pendingApprovals = assignments.filter((assignment) => assignment.therapistApproval === "pending").length;
  const achievedGoals = children.flatMap((child) => child.therapyGoals).filter((goal) => goal.status === "achieved").length;
  const activeGoals = children.flatMap((child) => child.therapyGoals).filter((goal) => goal.status !== "paused").length;

  if (session?.role !== "admin") {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md">
          <button onClick={() => { setRole("none"); navigate("/enter"); }} className="absolute left-4 top-4 text-sm text-muted-foreground hover:text-foreground touch-target">
            Back
          </button>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl border border-white/35 bg-card/82 p-6 shadow-[0_24px_70px_rgba(21,31,56,0.16)] backdrop-blur-xl sm:p-8"
          >
            <div className="mb-8 text-center">
              <h1 className="mb-2 font-display text-3xl font-extrabold text-foreground">Clinic Admin Sign In</h1>
              <p className="text-sm text-muted-foreground sm:text-base">Manage clinic access, onboarding, and readiness before backend rollout.</p>
            </div>

            <form
              className="space-y-4"
              onSubmit={async (event) => {
                event.preventDefault();
                const authenticated = await signInAdmin(email, password);
                if (!authenticated) {
                  setError("We couldn't sign you in. Check the admin email and password.");
                  return;
                }
                setError("");
              }}
            >
              <div className="space-y-2">
                <label htmlFor="admin-email" className="block text-sm font-semibold text-foreground">Admin email</label>
                <input
                  id="admin-email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    if (error) setError("");
                  }}
                  className="h-12 w-full rounded-xl border border-border bg-background/85 px-4 text-base text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="admin-password" className="block text-sm font-semibold text-foreground">Password</label>
                <input
                  id="admin-password"
                  type="password"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    if (error) setError("");
                  }}
                  className="h-12 w-full rounded-xl border border-border bg-background/85 px-4 text-base text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>

              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              <button type="submit" className="touch-target w-full rounded-xl bg-amber-500 px-4 py-3 font-semibold text-white shadow-[0_16px_40px_rgba(194,120,27,0.28)] transition hover:brightness-105">
                Sign In
              </button>
            </form>

            <div className="mt-6 rounded-2xl border border-border/70 bg-background/45 p-4 text-sm text-muted-foreground">
              <p>admin@playgroundlife.app</p>
              <p>admin123</p>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-border bg-card/85 px-4 py-4 backdrop-blur-md sm:px-6">
        <div>
          <h1 className="font-display text-xl font-bold text-foreground">Clinic Admin Dashboard</h1>
          <p className="text-xs text-muted-foreground">Signed in as {session.displayName}</p>
        </div>
        <button onClick={signOut} className="touch-target px-3 text-sm text-muted-foreground hover:text-foreground">
          Sign Out
        </button>
      </header>

      <nav className="flex gap-1 overflow-x-auto px-4 pt-4 sm:px-6">
        {tabs.map((entry) => (
          <button
            key={entry.key}
            onClick={() => setTab(entry.key)}
            className={`touch-target whitespace-nowrap rounded-t-xl px-5 py-3 font-display text-sm font-semibold transition-colors ${tab === entry.key ? "border border-b-0 border-border bg-card text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            {entry.label}
          </button>
        ))}
      </nav>

      <div className="mx-4 mb-6 rounded-b-xl rounded-tr-xl border border-border bg-card/88 p-4 backdrop-blur-md sm:mx-6 sm:p-6">
        {tab === "overview" ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <div className="rounded-2xl bg-muted p-4">
                <p className="text-2xl font-bold text-foreground">{adminUsers.length + therapistUsers.length}</p>
                <p className="text-xs text-muted-foreground">Clinic staff accounts</p>
              </div>
              <div className="rounded-2xl bg-muted p-4">
                <p className="text-2xl font-bold text-foreground">{pendingFamilies}</p>
                <p className="text-xs text-muted-foreground">Families awaiting activation</p>
              </div>
              <div className="rounded-2xl bg-muted p-4">
                <p className="text-2xl font-bold text-foreground">{pendingApprovals}</p>
                <p className="text-xs text-muted-foreground">Assignments awaiting approval</p>
              </div>
              <div className="rounded-2xl bg-muted p-4">
                <p className="text-2xl font-bold text-foreground">{activeGoals > 0 ? Math.round((achievedGoals / activeGoals) * 100) : 0}%</p>
                <p className="text-xs text-muted-foreground">Goals achieved across caseload</p>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
              <div className="rounded-2xl bg-muted p-4">
                <h2 className="mb-3 font-display text-lg font-bold text-foreground">Recent Audit Activity</h2>
                <div className="space-y-2">
                  {auditLog.slice(0, 10).map((entry) => (
                    <div key={entry.id} className="rounded-xl border border-border bg-card p-3">
                      <p className="text-sm font-semibold text-foreground">{entry.action.replace(/_/g, " ")}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{entry.details}</p>
                      <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                        {entry.actorRole} · {new Date(entry.createdAt).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl bg-muted p-4">
                <h2 className="mb-3 font-display text-lg font-bold text-foreground">Operational Watchlist</h2>
                <div className="space-y-3 text-sm text-muted-foreground">
                  <p>{pendingFamilies > 0 ? `${pendingFamilies} family accounts still need onboarding completion.` : "All current family accounts are active."}</p>
                  <p>{pendingApprovals > 0 ? `${pendingApprovals} assignments still need therapist approval before progression.` : "No assignments are blocked on approval."}</p>
                  <p>{auditLog.length < 10 ? "Audit activity is still light, which is expected in demo data." : "Audit history is being captured consistently for sign-ins and assignment changes."}</p>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {tab === "staff" ? (
          <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="rounded-2xl bg-muted p-4">
              <h2 className="mb-4 font-display text-lg font-bold text-foreground">Add Staff Account</h2>
              <div className="space-y-3">
                <div className="flex gap-2">
                  <button onClick={() => setStaffRole("therapist")} className={`rounded-lg px-4 py-2 text-sm font-semibold ${staffRole === "therapist" ? "bg-primary text-primary-foreground" : "bg-card text-foreground"}`}>Therapist</button>
                  <button onClick={() => setStaffRole("admin")} className={`rounded-lg px-4 py-2 text-sm font-semibold ${staffRole === "admin" ? "bg-amber-500 text-white" : "bg-card text-foreground"}`}>Admin</button>
                </div>
                <input value={staffName} onChange={(event) => setStaffName(event.target.value)} placeholder="Full name" className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground" />
                <input value={staffEmail} onChange={(event) => setStaffEmail(event.target.value)} placeholder="Email" className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground" />
                <input value={staffPassword} onChange={(event) => setStaffPassword(event.target.value)} placeholder="Temporary password" className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground" />
                <button
                  onClick={() => {
                    if (!staffName.trim() || !staffEmail.trim() || !staffPassword.trim()) return;
                    addStaffUser({
                      role: staffRole,
                      name: staffName.trim(),
                      email: staffEmail.trim(),
                      clinicName: adminUsers[0]?.clinicName || "Playground Life Clinic",
                      password: staffPassword,
                    });
                    setStaffName("");
                    setStaffEmail("");
                    setStaffPassword("");
                  }}
                  className="touch-target rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground"
                >
                  Create Staff Account
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl bg-muted p-4">
                <h2 className="mb-3 font-display text-lg font-bold text-foreground">Admins</h2>
                <div className="space-y-2">
                  {adminUsers.map((user) => (
                    <div key={user.id} className="rounded-xl border border-border bg-card p-3">
                      <p className="font-semibold text-foreground">{user.name}</p>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl bg-muted p-4">
                <h2 className="mb-3 font-display text-lg font-bold text-foreground">Therapists</h2>
                <div className="space-y-2">
                  {therapistUsers.map((user) => (
                    <div key={user.id} className="rounded-xl border border-border bg-card p-3">
                      <p className="font-semibold text-foreground">{user.name}</p>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {tab === "families" ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between gap-4">
              <h2 className="font-display text-lg font-bold text-foreground">Children & Family Onboarding</h2>
              <button
                onClick={() => (showAddChild ? resetAddChildForm() : setShowAddChild(true))}
                className="touch-target rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
              >
                {showAddChild ? "Cancel" : "+ Add Child"}
              </button>
            </div>

            {showAddChild ? (
              <div className="rounded-2xl border border-border bg-muted p-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <input value={childName} onChange={(event) => setChildName(event.target.value)} placeholder="Child's name" className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground" />
                  <input type="number" value={childAge} onChange={(event) => setChildAge(event.target.value)} min="2" max="18" className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground" />
                  <select value={childDiagnosis} onChange={(event) => setChildDiagnosis(event.target.value)} className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground">
                    <option value="">Select diagnosis...</option>
                    <option value="ASD Level 1">ASD Level 1</option>
                    <option value="ASD Level 2">ASD Level 2</option>
                    <option value="ASD Level 3">ASD Level 3</option>
                    <option value="ADHD">ADHD</option>
                    <option value="ASD + ADHD">ASD + ADHD</option>
                    <option value="Other">Other</option>
                  </select>
                  <input value={childNotes} onChange={(event) => setChildNotes(event.target.value)} placeholder="Summary" className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground" />
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-foreground">Avatar</label>
                    <div className="flex flex-wrap gap-2">
                      {childAvatars.map((entry) => (
                        <button key={entry} onClick={() => setChildAvatar(entry)} className={`rounded-lg p-1 text-2xl transition-colors ${childAvatar === entry ? "bg-primary/20 ring-2 ring-primary" : ""}`}>
                          {entry}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <button onClick={saveChild} className="mt-4 touch-target rounded-lg bg-secondary px-6 py-2 text-sm font-semibold text-secondary-foreground">
                  Save Child
                </button>
              </div>
            ) : null}

            <div className="space-y-4">
              {children.map((child) => (
                <div key={child.id} className="rounded-2xl border border-border bg-card p-4">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{child.avatar}</span>
                    <div>
                      <p className="font-semibold text-foreground">{child.name}</p>
                      <p className="text-xs text-muted-foreground">Age {child.age}{child.diagnosis ? ` · ${child.diagnosis}` : ""}</p>
                    </div>
                  </div>

                  <div className="mt-3 space-y-2">
                    {child.familyMembers.map((familyMember) => (
                      <div key={familyMember.id} className="rounded-xl border border-border bg-muted p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-foreground">{familyMember.avatar} {familyMember.name} <span className="text-muted-foreground">({familyMember.relationship})</span></p>
                            <p className="text-[11px] text-muted-foreground">Sign in: {familyMember.phoneNumber} · credentials {familyMember.credentialStatus}</p>
                            {generatedPasswords[familyMember.id] ? (
                              <p className="mt-1 text-[11px] text-foreground">Temporary password: <span className="font-mono font-semibold">{generatedPasswords[familyMember.id]}</span></p>
                            ) : null}
                            {generatedInvites[familyMember.phoneNumber] ? (
                              <p className="mt-1 text-[11px] text-foreground">Invite code: <span className="font-mono font-semibold">{generatedInvites[familyMember.phoneNumber]}</span></p>
                            ) : null}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={async () => {
                                const code = await issueFamilyInvite(child.id, familyMember.id);
                                if (code) setGeneratedInvites((current) => ({ ...current, [familyMember.phoneNumber]: code }));
                              }}
                              className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white"
                            >
                              Issue Invite
                            </button>
                            <button
                              onClick={() => {
                                const tempPassword = `Play-${Math.random().toString(36).slice(2, 8)}`;
                                resetFamilyCredentials(child.id, familyMember.id, tempPassword, true);
                                setGeneratedPasswords((current) => ({ ...current, [familyMember.id]: tempPassword }));
                              }}
                              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                            >
                              Reset Password
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                    {child.familyMembers.length === 0 ? <p className="text-xs text-muted-foreground">No family members yet.</p> : null}
                  </div>

                  {addingFamilyTo === child.id ? (
                    <div className="mt-3 space-y-2 rounded-xl bg-muted p-3">
                      <input value={fmName} onChange={(event) => setFmName(event.target.value)} placeholder="Name" className="w-full rounded-lg border border-border bg-card px-3 py-2 text-xs text-foreground" />
                      <input value={fmPhoneNumber} onChange={(event) => setFmPhoneNumber(event.target.value)} placeholder="Phone number" className="w-full rounded-lg border border-border bg-card px-3 py-2 text-xs text-foreground" />
                      <input value={fmPassword} onChange={(event) => setFmPassword(event.target.value)} placeholder="Temporary password (min 12 characters)" className="w-full rounded-lg border border-border bg-card px-3 py-2 text-xs text-foreground" />
                      <select value={fmRelationship} onChange={(event) => setFmRelationship(event.target.value as FamilyMember["relationship"])} className="w-full rounded-lg border border-border bg-card px-3 py-2 text-xs text-foreground">
                        <option value="parent">Parent</option>
                        <option value="sibling">Sibling</option>
                        <option value="grandparent">Grandparent</option>
                        <option value="aunt-uncle">Aunt/Uncle</option>
                        <option value="other">Other</option>
                      </select>
                      <div className="flex gap-1">
                        {fmAvatars.map((entry) => (
                          <button key={entry} onClick={() => setFmAvatar(entry)} className={`rounded p-0.5 text-lg ${fmAvatar === entry ? "ring-2 ring-primary" : ""}`}>
                            {entry}
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => handleAddFamily(child.id)} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">Create Credentials</button>
                        <button onClick={resetFamilyForm} className="text-xs text-muted-foreground">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setAddingFamilyTo(child.id)} className="mt-3 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted">
                      + Add Family Member
                    </button>
                  )}
                </div>
              ))}
              {children.length === 0 ? <p className="text-sm text-muted-foreground">No children yet. Add a child to get started.</p> : null}
            </div>
          </div>
        ) : null}

        {tab === "content" ? (
          <GameApprovals />
        ) : null}

        {tab === "readiness" ? (
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl bg-muted p-4">
              <h2 className="mb-3 font-display text-lg font-bold text-foreground">What This App Can Do Now</h2>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>Role-based clinic access for admin, therapist, and family flows.</p>
                <p>Family onboarding states, invite issuance, and credential resets.</p>
                <p>Skill-domain progression, assignment approvals, and audit history.</p>
                <p>Clinic-facing reports with goals, skill scores, and operational review.</p>
              </div>
            </div>

            <div className="rounded-2xl bg-muted p-4">
              <h2 className="mb-3 font-display text-lg font-bold text-foreground">Still Needed Before Production</h2>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>Server-side auth, database, and encrypted storage beyond browser local state.</p>
                <p>Real invitation delivery, password reset tokens, and MFA.</p>
                <p>Centralized audit export, retention rules, and monitored backups.</p>
                <p>Formal HIPAA risk analysis, policies, BAAs, and operational controls.</p>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
