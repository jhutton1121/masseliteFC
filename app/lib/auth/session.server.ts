import type { User } from "~/utils/types";

function generateId(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function createSession(
  db: D1Database,
  userId: string
): Promise<string> {
  const id = generateId();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  await db
    .prepare("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)")
    .bind(id, userId, expiresAt)
    .run();

  return id;
}

export async function getSessionUser(
  db: D1Database,
  sessionId: string | null
): Promise<User | null> {
  if (!sessionId) return null;

  const row = await db
    .prepare(
      `SELECT u.id, u.name, u.email, u.whatsapp, u.avatar_key, u.role,
              u.positions, u.notify_email, u.notify_whatsapp,
              u.notify_game_reminder, u.notify_schedule_change, u.notify_stats_posted,
              u.can_write_recaps, u.created_at, u.updated_at
       FROM sessions s
       JOIN users u ON s.user_id = u.id
       WHERE s.id = ? AND s.expires_at > datetime('now')`
    )
    .bind(sessionId)
    .first();

  if (!row) return null;

  return {
    ...row,
    positions: JSON.parse((row.positions as string) || "[]"),
    notify_email: Boolean(row.notify_email),
    notify_whatsapp: Boolean(row.notify_whatsapp),
    notify_game_reminder: Boolean(row.notify_game_reminder),
    notify_schedule_change: Boolean(row.notify_schedule_change),
    notify_stats_posted: Boolean(row.notify_stats_posted),
    can_write_recaps: Boolean(row.can_write_recaps),
  } as User;
}

export async function destroySession(
  db: D1Database,
  sessionId: string
): Promise<void> {
  await db.prepare("DELETE FROM sessions WHERE id = ?").bind(sessionId).run();
}

export function getSessionId(request: Request): string | null {
  const cookie = request.headers.get("Cookie") || "";
  const match = cookie.match(/session=([^;]+)/);
  return match ? match[1] : null;
}

export function sessionCookie(sessionId: string): string {
  return `session=${sessionId}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}`;
}

export function clearSessionCookie(): string {
  return "session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0";
}
