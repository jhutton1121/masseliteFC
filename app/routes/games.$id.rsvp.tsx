import { redirect } from "react-router";
import type { Route } from "./+types/games.$id.rsvp";
import { requireUser } from "~/lib/middleware.server";

export async function action({ request, context, params }: Route.ActionArgs) {
  const db = context.cloudflare.env.DB;
  const user = await requireUser(request, db);
  const form = await request.formData();
  const intent = form.get("intent") as string;

  if (intent === "extra_players") {
    const extraPlayers = Math.max(0, Math.min(10, parseInt(form.get("extra_players") as string) || 0));
    const names: string[] = [];
    for (let i = 0; i < extraPlayers; i++) {
      const name = (form.get(`extra_name_${i}`) as string || "").trim();
      names.push(name);
    }

    await db
      .prepare(
        `UPDATE rsvps SET extra_players = ?, extra_player_names = ?, updated_at = datetime('now')
         WHERE game_id = ? AND user_id = ?`
      )
      .bind(extraPlayers, JSON.stringify(names), params.id, user.id)
      .run();

    return { ok: true };
  }

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

  // Reset extra players when going "out"
  const extraPlayers = status === "out" ? 0 : undefined;
  const extraNames = status === "out" ? "[]" : undefined;

  // Upsert RSVP
  await db
    .prepare(
      `INSERT INTO rsvps (game_id, user_id, status)
       VALUES (?, ?, ?)
       ON CONFLICT(game_id, user_id) DO UPDATE SET
         status = ?,
         extra_players = COALESCE(?, extra_players),
         extra_player_names = COALESCE(?, extra_player_names),
         updated_at = datetime('now')`
    )
    .bind(params.id, user.id, status, status, extraPlayers ?? null, extraNames ?? null)
    .run();

  return { ok: true };
}
