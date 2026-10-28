export type UserRole = "superadmin" | "admin" | "therapist" | "parent";

export interface AuthUser {
  id: string;
  clinicId: string;
  role: UserRole;
  name: string;
  sessionVersion: number;
}

declare global {
  // Express request augmentation is the framework-supported way to expose authenticated users.
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
