import { ReactNode, useEffect, useRef, useState } from "react";
import { useApp } from "@/context/AppContext";

export type ClinicRole = "admin" | "therapist";

const CREDENTIALS: Record<ClinicRole, { email: string; password: string }> = {
  admin: { email: "admin@playgroundlife.app", password: "admin123" },
  therapist: { email: "therapist@playgroundlife.app", password: "therapist123" },
};

/**
 * Signs in through the provider - the same call the sign-in forms make - and
 * only renders its children once the clinic data has arrived. Screens that
 * read the caseload while they mount, such as the child picker in
 * AssignHomework, therefore see a loaded clinic instead of an empty one.
 */
export function ClinicSession({ role = "therapist", children }: { role?: ClinicRole; children: ReactNode }) {
  const { session, children: clinicChildren, signInAdmin, signInTherapist } = useApp();
  const [ready, setReady] = useState(false);
  const signedIn = useRef(false);

  useEffect(() => {
    if (signedIn.current) return;
    signedIn.current = true;
    const credentials = CREDENTIALS[role];
    const signIn = role === "admin"
      ? signInAdmin(credentials.email, credentials.password)
      : signInTherapist(credentials.email, credentials.password);
    Promise.resolve(signIn).catch(() => undefined);
  }, [role, signInAdmin, signInTherapist]);

  useEffect(() => {
    if (session && clinicChildren.length > 0) setReady(true);
  }, [clinicChildren.length, session]);

  if (!ready) return null;
  return <>{children}</>;
}
