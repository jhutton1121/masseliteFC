import { redirect } from "react-router";
import type { Route } from "./+types/games.$id.rsvp";
import { requireUser } from "~/lib/middleware.server";

export async function action({ request, context, params }: Route.ActionArgs) {
  const db = context.cloudflare.env.DB;
  const user = await requireUser(request, db);
  const form = await request.formData();
  const intent = form.get("intent") as string;

  // Verify game exists and is scheduled
  const game = await db
    .prepare("SELECT id, max_players FROM games WHERE id = ? AND status = 'scheduled'")
    .bind(params.id)
    .first();

  if (!game) {
    return { error: "Game not found or not accepting RSVPs." };
  }

  const previousRsvp = await db
    .prepare("SELECT status, extra_players, extra_player_names FROM rsvps WHERE game_id = ? AND user_id = ?")
    .bind(params.id, user.id)
    .first();

  // Bring in enqueueNotification and getNotificationRecipients if we need to promote
  const { enqueueNotification, getNotificationRecipients } = await import("~/lib/notifications/queue-producer.server");

  let status = form.get("status") as string;
  let extraPlayers: number;
  let extraNamesRaw: string;

  if (intent === "extra_players") {
    if (!previousRsvp) {
      return { error: "Must RSVP before adding guests." };
    }
    status = previousRsvp.status as string;
    extraPlayers = Math.max(0, Math.min(10, parseInt(form.get("extra_players") as string) || 0));

    if (game.max_players && (status === "in" || status === "late")) {
      const currentExtras = (previousRsvp.extra_players as number) || 0;
      const additionalRequested = extraPlayers - currentExtras;

      if (additionalRequested > 0) {
        const headcountReq = await db
          .prepare(`SELECT SUM(1 + COALESCE(extra_players, 0)) as total FROM rsvps WHERE game_id = ? AND status IN ('in', 'late')`)
          .bind(params.id)
          .first();
        const currentHeadcount = (headcountReq?.total as number) || 0;
        const availableSlots = (game.max_players as number) - currentHeadcount;

        if (additionalRequested > availableSlots) {
          return { error: "Not enough spots available for additional guests." };
        }
      }
    }

    const names: string[] = [];
    for (let i = 0; i < extraPlayers; i++) {
      const name = (form.get(`extra_name_${i}`) as string || "").trim();
      names.push(name);
    }
    extraNamesRaw = JSON.stringify(names);
  } else {
    // Standard RSVP action
    if (!["in", "out", "late", "waitlist"].includes(status)) {
      return { error: "Invalid RSVP status." };
    }
    if (status === "out") {
      extraPlayers = 0;
      extraNamesRaw = "[]";
    } else {
      extraPlayers = previousRsvp?.extra_players as number ?? 0;
      extraNamesRaw = previousRsvp?.extra_player_names as string ?? "[]";
    }
  }

  // Determine if this user should be on the waitlist instead of 'in'
  let finalStatus = status;
  if ((status === "in" || status === "waitlist") && game.max_players) {
    // Check current headcount ('in' and 'late')
    const headcountReq = await db
      .prepare(`SELECT SUM(1 + COALESCE(extra_players, 0)) as total FROM rsvps WHERE game_id = ? AND status IN ('in', 'late') AND user_id != ?`)
      .bind(params.id, user.id)
      .first();
    const currentHeadcount = (headcountReq?.total as number) || 0;

    // If adding this user (1 + proposedExtras) exceeds max_players, put them on the waitlist
    if (currentHeadcount + 1 + extraPlayers > (game.max_players as number)) {
      finalStatus = "waitlist";
    } else {
      finalStatus = "in"; // Ensure they become 'in' if space clears up or they submit 'waitlist' when not full
    }
  }

  let slotsOpened = 0;
  if (previousRsvp?.status === "in" || previousRsvp?.status === "late") {
    if (finalStatus === "out" || finalStatus === "waitlist") {
      slotsOpened = 1 + ((previousRsvp.extra_players as number) || 0);
    } else if (finalStatus === "in" || finalStatus === "late") {
      const previousExtras = (previousRsvp.extra_players as number) || 0;
      if (extraPlayers < previousExtras) {
        slotsOpened = previousExtras - extraPlayers;
      }
    }
  }

  // Upsert RSVP
  await db
    .prepare(
      `INSERT INTO rsvps (game_id, user_id, status, extra_players, extra_player_names)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(game_id, user_id) DO UPDATE SET
         status = ?,
         extra_players = ?,
         extra_player_names = ?,
         updated_at = datetime('now')`
    )
    .bind(params.id, user.id, finalStatus, extraPlayers, extraNamesRaw, finalStatus, extraPlayers, extraNamesRaw)
    .run();

  // If slots opened up, try to promote users from the waitlist
  if (slotsOpened > 0 && game.max_players) {
    // Current headcount after this user dropped out
    const headcountReq = await db
      .prepare(`SELECT SUM(1 + COALESCE(extra_players, 0)) as total FROM rsvps WHERE game_id = ? AND status IN ('in', 'late')`)
      .bind(params.id)
      .first();
    let currentHeadcount = (headcountReq?.total as number) || 0;

    let availableSlots = (game.max_players as number) - currentHeadcount;

    if (availableSlots > 0) {
      // Get waitlisted users in order
      const waitlist = await db
        .prepare(`SELECT user_id, extra_players FROM rsvps WHERE game_id = ? AND status = 'waitlist' ORDER BY created_at ASC`)
        .bind(params.id)
        .all();

      for (const w of waitlist.results) {
        const requiredSlots = 1 + ((w.extra_players as number) || 0);
        if (availableSlots >= requiredSlots) {
          // Promote this user
          await db
            .prepare(`UPDATE rsvps SET status = 'in', updated_at = datetime('now') WHERE game_id = ? AND user_id = ?`)
            .bind(params.id, w.user_id)
            .run();

          availableSlots -= requiredSlots;

          // Notify them
          const gameDetails = await db
            .prepare("SELECT g.date, g.time, f.name as field_name FROM games g JOIN fields f ON g.field_id = f.id WHERE g.id = ?")
            .bind(params.id)
            .first();

          if (gameDetails) {
            const recipients = await getNotificationRecipients(db, "waitlist_promoted");
            const targetRecipient = recipients.find(r => r.userId === w.user_id);
            if (targetRecipient) {
              await enqueueNotification(context.cloudflare.env.NOTIFICATION_QUEUE, {
                type: "waitlist_promoted",
                recipients: [targetRecipient],
                payload: {
                  gameId: params.id as string,
                  fieldName: gameDetails.field_name as string,
                  date: gameDetails.date as string,
                  time: gameDetails.time as string,
                  appUrl: context.cloudflare.env.APP_URL,
                }
              }).catch(e => console.error("Waitlist notification failed to enqueue", e));
            }
          }
        }
      }
    }
  }

  return { ok: true };
}
