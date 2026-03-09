import { redirect } from "react-router";
import type { Route } from "./+types/games.$id.rsvp";
import { requireUser } from "~/lib/middleware.server";

export async function action({ request, context, params }: Route.ActionArgs) {
  const db = context.cloudflare.env.DB;
  const user = await requireUser(request, db);
  const form = await request.formData();
  const status = form.get("status") as string;

  if (!["in", "out", "late"].includes(status)) {
    return { error: "Invalid RSVP status." };
  }

  // Verify game exists and is scheduled
  const game = await db
    .prepare("SELECT id FROM games WHERE id = ? AND status = 'scheduled'")
    .bind(params.id)
    .first();

  if (!game) {
    return { error: "Game not found or not accepting RSVPs." };
  }

  // Upsert RSVP
  await db
    .prepare(
      `INSERT INTO rsvps (game_id, user_id, status)
       VALUES (?, ?, ?)
       ON CONFLICT(game_id, user_id) DO UPDATE SET status = ?, updated_at = datetime('now')`
    )
    .bind(params.id, user.id, status, status)
    .run();

  return { ok: true };
}
