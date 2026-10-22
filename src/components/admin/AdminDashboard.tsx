import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { FamilyMember, useApp } from "@/context/AppContext";
import { ApiError } from "@/lib/productionApi";
import { emptySkillProfile } from "@/lib/skills";
import { toast } from "@/components/ui/sonner";
import GameApprovals from "./GameApprovals";

type Tab = "overview" | "staff" | "families" | "content" | "platforms";

/**
 * A temporary password for a caregiver account.
 *
 * The server requires twelve characters, so the generated value has to be
 * longer than that or the reset is rejected. The earlier version produced
 * eleven characters at most, which meant the reset never worked.
 */
function generateTemporaryPassword(): string {
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const digits = "23456789";
  const rest = `${lower}${upper}${digits}`;
  const pick = (source: string) => source[Math.floor(Math.random() * source.length)];
  const characters = [pick(lower), pick(upper), pick(digits)];
  while (characters.length < 16) characters.push(pick(rest));
  return characters
    .sort(() => Math.random() - 0.5)
    .join("");
}

const tabs: { key: Tab; label: string; emoji?: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "staff", label: "Staff" },
  { key: "families", label: "Families" },
  { key: "content", label: "Content", emoji: "🎨" },
  { key: "platforms", label: "Platforms", emoji: "📱" },
];

export default function AdminDashboard() {
  const { setRole, session, signInAdmin, signOut, adminUsers, therapistUsers, addStaffUser, inviteStaffUser, addChild, addFamilyMember, children, assignments, issueFamilyInvite, resetFamilyCredentials, auditLog } = useApp();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("overview");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotMsg, setForgotMsg] = useState("");
  const [releaseNotes, setReleaseNotes] = useState(() => localStorage.getItem("releaseNotes") || "");
  const [savedNotes, setSavedNotes] = useState(() => localStorage.getItem("releaseNotes") || "");
  const [staffRole, setStaffRole] = useState<"admin" | "therapist">("therapist");
  const [staffName, setStaffName] = useState("");
  const [staffEmail, setStaffEmail] = useState("");
  const [staffPassword, setStaffPassword] = useState("");
  const [staffInviteMode, setStaffInviteMode] = useState<"password" | "invite">("password");
  const [staffInviteEmail, setStaffInviteEmail] = useState("");
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

  const saveChild = async () => {
    if (!childName.trim()) return;
    const parsedAge = Number.parseInt(childAge, 10);
    try {
      await addChild({
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
      toast.success(`Added ${childName.trim()} to the clinic.`);
      resetAddChildForm();
    } catch (error) {
      toast.error(
        error instanceof ApiError && error.code === "network"
          ? "Can't reach the clinic server. Nothing was saved."
          : error instanceof Error
            ? error.message
            : "Couldn't add the child. Nothing was saved."
      );
    }
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
    try {
      const inviteCode = await addFamilyMember(childId, {
        name: fmName.trim(),
        relationship: fmRelationship,
        avatar: fmAvatar,
        phoneNumber: fmPhoneNumber.trim(),
        password: fmPassword,
      });
      if (inviteCode) setGeneratedInvites((current) => ({ ...current, [fmPhoneNumber.trim()]: inviteCode }));
      toast.success(`Added ${fmName.trim()} to the family.`);
      resetFamilyForm();
    } catch (error) {
      toast.error(
        error instanceof ApiError && error.code === "network"
          ? "Can't reach the clinic server. Nothing was saved."
          : error instanceof Error
            ? error.message
            : "Couldn't add the family member. Nothing was saved."
      );
    }
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
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl border border-white/35 bg-card/82 p-6 shadow-[0_24px_70px_rgba(21,31,56,0.16)] backdrop-blur-xl sm:p-8"
          >
            <button
              onClick={() => { setRole("none"); navigate("/enter"); }}
              className="touch-target -ml-2 mb-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold text-muted-foreground transition hover:bg-accent/15 hover:text-foreground"
            >
              ← Back
            </button>
            <div className="mb-8 text-center">
              <h1 className="mb-2 font-display text-3xl font-extrabold text-foreground">Clinic Admin Sign In</h1>
              <p className="text-sm text-muted-foreground sm:text-base">Manage clinic access, onboarding, and readiness before backend rollout.</p>
            </div>

            <form
              className="space-y-4"
              onSubmit={async (event) => {
                event.preventDefault();
                try {
                  const authenticated = await signInAdmin(email, password);
                  if (!authenticated) {
                    setError("We couldn't sign you in. Check the admin email and password.");
                    return;
                  }
                  setError("");
                } catch (err) {
                  setError(
                    err instanceof ApiError && err.code === "network"
                      ? "Can't reach the clinic server. Check your connection and try again."
                      : "We couldn't sign you in right now. Please try again."
                  );
                }
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
             <div className="mt-4 text-center">
               <button type="button" onClick={() => setShowForgot((v) => !v)} className="text-sm text-muted-foreground underline hover:text-foreground">
                 Forgot password?
               </button>
               {showForgot ? (
                 <form
                   className="mt-3 space-y-2"
                   onSubmit={async (e) => {
                     e.preventDefault();
                     setForgotMsg("");
                     try {
                       const API = import.meta.env.VITE_API_URL || "";
                       const res = await fetch(`${API}/api/security/reset-request`, {
                         method: "POST",
                         headers: { "Content-Type": "application/json" },
                         body: JSON.stringify({ email: forgotEmail }),
                       });
                       const body = await res.json().catch(() => ({}));
                       setForgotMsg(body.message || (res.ok ? "If that account exists, a reset email has been queued." : "Request failed."));
                     } catch {
                       setForgotMsg("Can't reach the clinic server.");
                     }
                   }}
                 >
                   <input
                     type="email"
                     required
                     value={forgotEmail}
                     onChange={(e) => setForgotEmail(e.target.value)}
                     placeholder="Admin email"
                     className="h-11 w-full rounded-xl border border-border bg-background/85 px-4 text-base text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                   />
                   <button type="submit" className="touch-target w-full rounded-xl bg-primary px-4 py-2 font-semibold text-primary-foreground">
                     Send reset link
                   </button>
                   {forgotMsg ? <p className="text-sm text-muted-foreground">{forgotMsg}</p> : null}
                 </form>
               ) : null}
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
                  <button
                    onClick={() => setStaffInviteMode("password")}
                    className={`rounded-lg px-4 py-2 text-sm font-semibold ${staffInviteMode === "password" ? "bg-primary text-primary-foreground" : "bg-card text-foreground"}`}
                  >
                    Create with password
                  </button>
                  <button
                    onClick={() => setStaffInviteMode("invite")}
                    className={`rounded-lg px-4 py-2 text-sm font-semibold ${staffInviteMode === "invite" ? "bg-primary text-primary-foreground" : "bg-card text-foreground"}`}
                  >
                    Invite by email
                  </button>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setStaffRole("therapist")} className={`rounded-lg px-4 py-2 text-sm font-semibold ${staffRole === "therapist" ? "bg-primary text-primary-foreground" : "bg-card text-foreground"}`}>Therapist</button>
                  <button onClick={() => setStaffRole("admin")} className={`rounded-lg px-4 py-2 text-sm font-semibold ${staffRole === "admin" ? "bg-amber-500 text-white" : "bg-card text-foreground"}`}>Admin</button>
                </div>
                {staffInviteMode === "password" ? (
                  <>
                    <input value={staffName} onChange={(event) => setStaffName(event.target.value)} placeholder="Full name" className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground" />
                    <input value={staffEmail} onChange={(event) => setStaffEmail(event.target.value)} placeholder="Email" className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground" />
                    <input value={staffPassword} onChange={(event) => setStaffPassword(event.target.value)} placeholder="Temporary password" className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground" />
                    <button
                      onClick={async () => {
                        if (!staffName.trim() || !staffEmail.trim() || !staffPassword.trim()) return;
                        try {
                          await addStaffUser({
                            role: staffRole,
                            name: staffName.trim(),
                            email: staffEmail.trim(),
                            clinicName: adminUsers[0]?.clinicName || "Playground Life Clinic",
                            password: staffPassword,
                          });
                          toast.success(`Created the ${staffRole} account for ${staffName.trim()}.`);
                          setStaffName("");
                          setStaffEmail("");
                          setStaffPassword("");
                        } catch (error) {
                          toast.error(
                            error instanceof ApiError && error.code === "network"
                              ? "Can't reach the clinic server. Nothing was saved."
                              : error instanceof Error
                                ? error.message
                                : "Couldn't create the account. Nothing was saved."
                          );
                        }
                      }}
                      className="touch-target rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground"
                    >
                      Create Staff Account
                    </button>
                  </>
                ) : null}
                {staffInviteMode === "invite" ? (
                  <div className="space-y-3">
                    <input
                      value={staffInviteEmail}
                      onChange={(event) => setStaffInviteEmail(event.target.value)}
                      placeholder="therapist@example.com"
                      type="email"
                      className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground"
                    />
                    <button
                      onClick={async () => {
                        const email = staffInviteEmail.trim();
                        if (!email) return;
                        try {
                          await inviteStaffUser({ email, role: staffRole });
                          toast.success(`Invitation queued for ${email}. They can set their own password from the email link.`);
                          setStaffInviteEmail("");
                        } catch (error) {
                          toast.error(
                            error instanceof ApiError && error.code === "network"
                              ? "Can't reach the clinic server. The invitation was not sent."
                              : error instanceof Error
                                ? error.message
                                : "Couldn't send the invitation."
                          );
                        }
                      }}
                      className="touch-target rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground"
                    >
                      Send invitation
                    </button>
                    <p className="text-xs text-muted-foreground">
                      The invite link expires in 7 days. The email is sent by the mail worker
                      (<span className="font-mono">npm run mail:worker</span>).
                    </p>
                  </div>
                ) : null}
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
                              onClick={async () => {
                                const tempPassword = generateTemporaryPassword();
                                try {
                                  const ok = await resetFamilyCredentials(child.id, familyMember.id, tempPassword, true);
                                  if (!ok) {
                                    toast.error("The password could not be reset. Try again.");
                                    return;
                                  }
                                  setGeneratedPasswords((current) => ({ ...current, [familyMember.id]: tempPassword }));
                                } catch (cause) {
                                  toast.error(cause instanceof Error ? cause.message : "The password could not be reset.");
                                }
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

        {tab === "platforms" ? (
          <div className="space-y-6">
            <h2 className="font-display text-lg font-bold text-foreground">Release management</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-2xl bg-muted p-4">
                <p className="font-semibold text-foreground">Web</p>
                <p className="text-sm text-muted-foreground">v0.0.0 · SPA on nginx</p>
                <p className="text-xs text-muted-foreground mt-2">Build: npm run build</p>
                <a href="https://playground-life.com" target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs text-primary underline">Open web</a>
              </div>
              <div className="rounded-2xl bg-muted p-4">
                <p className="font-semibold text-foreground">Android</p>
                <p className="text-sm text-muted-foreground">v1.0 · com.playgroundlife.app · minSdk 24</p>
                <p className="text-xs text-muted-foreground mt-2">Build: npm run build:android + gradlew</p>
                <a href="https://github.com/erionbeka/playground-life/releases/tag/v1.0-android" target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs text-primary underline">Download APK</a>
              </div>
              <div className="rounded-2xl bg-muted p-4">
                <p className="font-semibold text-foreground">iOS</p>
                <p className="text-sm text-muted-foreground">Not configured</p>
                <p className="text-xs text-muted-foreground mt-2">Add @capacitor/ios + Xcode</p>
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-card/60 p-4">
              <h3 className="mb-2 font-semibold text-foreground">Release notes</h3>
              <textarea
                value={releaseNotes}
                onChange={(e) => setReleaseNotes(e.target.value)}
                rows={6}
                className="w-full rounded-xl border border-border bg-background/85 px-4 py-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                placeholder="What changed in this release..."
              />
              <button
                type="button"
                onClick={() => { localStorage.setItem("releaseNotes", releaseNotes); setSavedNotes(releaseNotes); }}
                className="touch-target mt-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
              >
                Save notes
              </button>
              {savedNotes ? <p className="mt-2 text-xs text-muted-foreground">Saved {savedNotes.length} chars.</p> : null}
            </div>
            <div className="rounded-2xl border border-border bg-card/60 p-4">
              <h3 className="mb-2 font-semibold text-foreground">Build commands</h3>
              <pre className="overflow-x-auto rounded-xl bg-muted p-3 text-xs text-foreground">npm run build:android
cd android && ./gradlew assembleRelease
# output: android/app/build/outputs/apk/release/app-release.apk</pre>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
