import type { User, UserRole } from "~/utils/types";
import { getSessionId, getSessionUser } from "~/lib/auth/session.server";
import { redirect } from "react-router";

export async function requireUser(
  request: Request,
  db: D1Database
): Promise<User> {
  const sessionId = getSessionId(request);
  const user = await getSessionUser(db, sessionId);

  if (!user) {
    throw redirect("/auth/login");
  }

  return user;
}

export async function requireRole(
  request: Request,
  db: D1Database,
  roles: UserRole[]
): Promise<User> {
  const user = await requireUser(request, db);

  if (!roles.includes(user.role)) {
    throw new Response("Forbidden", { status: 403 });
  }

  return user;
}

export async function requireAdmin(
  request: Request,
  db: D1Database
): Promise<User> {
  return requireRole(request, db, ["admin", "superadmin"]);
}

export async function requireSuperadmin(
  request: Request,
  db: D1Database
): Promise<User> {
  return requireRole(request, db, ["superadmin"]);
}

// Client-safe role checks are in ~/utils/roles.ts
