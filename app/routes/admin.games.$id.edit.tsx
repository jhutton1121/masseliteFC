import { Form, redirect, Link } from "react-router";
import type { Route } from "./+types/admin.games.$id.edit";
import { requireAdmin } from "~/lib/middleware.server";
import {
  enqueueNotification,
  getNotificationRecipients,
} from "~/lib/notifications/queue-producer.server";
import { AppShell } from "~/components/AppShell";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { GAME_STATUS_LABELS } from "~/utils/constants";

export function meta() {
  return [{ title: "Edit Game | Admin | MassEliteFC" }];
}

export async function loader({ request, context, params }: Route.LoaderArgs) {
  const db = context.cloudflare.env.DB;
  const user = await requireAdmin(request, db);

  const game = await db
    .prepare(
      `SELECT g.*, f.name as field_name
       FROM games g JOIN fields f ON g.field_id = f.id WHERE g.id = ?`
    )
    .bind(params.id)
    .first();

  if (!game) throw new Response("Game not found", { status: 404 });

  const fields = await db
    .prepare("SELECT * FROM fields ORDER BY is_default DESC, name ASC")
    .all();

  return { user, game, fields: fields.results };
}

export async function action({ request, context, params }: Route.ActionArgs) {
  const db = context.cloudflare.env.DB;
  const user = await requireAdmin(request, db);
  const form = await request.formData();

  const field_id = form.get("field_id") as string;
  const date = form.get("date") as string;
  const time = form.get("time") as string;
  const max_players = form.get("max_players") as string;
  const notes = (form.get("notes") as string)?.trim() || null;
  const status = form.get("status") as string;

  if (!field_id || !date || !time || !status) {
    return { error: "Field, date, time, and status are required." };
  }

  const validStatuses = ["scheduled", "in_progress", "completed", "cancelled"];
  if (!validStatuses.includes(status)) {
    return { error: "Invalid status." };
  }

  // Get current game state before update to compare max_players
  const currentGame = await db
    .prepare("SELECT max_players FROM games WHERE id = ?")
    .bind(params.id)
    .first();

  const newMaxPlayers = max_players ? parseInt(max_players) : null;
  const oldMaxPlayers = currentGame?.max_players as number | null;

  await db
    .prepare(
      `UPDATE games
       SET field_id = ?, date = ?, time = ?, max_players = ?, notes = ?, status = ?, updated_at = datetime('now')
       WHERE id = ?`
    )
    .bind(
      field_id,
      date,
      time,
      newMaxPlayers,
      notes,
      status,
      params.id
    )
    .run();

  // Handle Waitlist logic if max_players changed
  if (oldMaxPlayers !== newMaxPlayers) {
    if (newMaxPlayers === null || (oldMaxPlayers !== null && newMaxPlayers > oldMaxPlayers)) {
      // Capacity increased or removed: Promote waitlisted players
      const headcountReq = await db
        .prepare(`SELECT SUM(1 + COALESCE(extra_players, 0)) as total FROM rsvps WHERE game_id = ? AND status IN ('in', 'late')`)
        .bind(params.id)
        .first();
      const currentHeadcount = (headcountReq?.total as number) || 0;

      let availableSlots = newMaxPlayers === null ? Infinity : newMaxPlayers - currentHeadcount;

      if (availableSlots > 0) {
        const waitlist = await db
          .prepare(`SELECT user_id, extra_players FROM rsvps WHERE game_id = ? AND status = 'waitlist' ORDER BY created_at ASC`)
          .bind(params.id)
          .all();

        for (const w of waitlist.results) {
          const requiredSlots = 1 + ((w.extra_players as number) || 0);
          if (availableSlots >= requiredSlots) {
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
    } else if (newMaxPlayers !== null && (oldMaxPlayers === null || newMaxPlayers < oldMaxPlayers)) {
      // Capacity decreased: Demote players to waitlist if over capacity
      // We need to demote the LATEST ones to RSVP first.
      const headcountReq = await db
        .prepare(`SELECT SUM(1 + COALESCE(extra_players, 0)) as total FROM rsvps WHERE game_id = ? AND status IN ('in', 'late')`)
        .bind(params.id)
        .first();
      let currentHeadcount = (headcountReq?.total as number) || 0;

      if (currentHeadcount > newMaxPlayers) {
        // Fetch 'in' or 'late' players ordered by latest RSVP first
        const attendees = await db
          .prepare(`SELECT user_id, extra_players FROM rsvps WHERE game_id = ? AND status IN ('in', 'late') ORDER BY created_at DESC`)
          .bind(params.id)
          .all();

        for (const a of attendees.results) {
          if (currentHeadcount <= newMaxPlayers) break;

          const slotsToFree = 1 + ((a.extra_players as number) || 0);

          await db
            .prepare(`UPDATE rsvps SET status = 'waitlist', updated_at = datetime('now') WHERE game_id = ? AND user_id = ?`)
            .bind(params.id, a.user_id)
            .run();

          currentHeadcount -= slotsToFree;
        }
      }
    }
  }

  // Send game_updated notification
  try {
    const field = await db
      .prepare("SELECT name, address FROM fields WHERE id = ?")
      .bind(field_id)
      .first();

    const recipients = await getNotificationRecipients(db, "game_updated", user.id);

    if (recipients.length > 0 && field) {
      await enqueueNotification(context.cloudflare.env.NOTIFICATION_QUEUE, {
        type: "game_updated",
        recipients,
        payload: {
          gameId: params.id as string,
          fieldName: field.name as string,
          fieldAddress: field.address as string,
          date,
          time,
          notes: notes || "",
          appUrl: context.cloudflare.env.APP_URL,
        },
      });
    }
  } catch (e) {
    console.error("Failed to enqueue notification:", e);
  }

  return redirect(`/games/${params.id}`);
}

export default function EditGamePage({ loaderData, actionData }: Route.ComponentProps) {
  const { user, game, fields } = loaderData;

  return (
    <AppShell user={user}>
      <Box sx={{ mb: 3 }}>
        <Button
          component={Link}
          to={`/games/${game.id}`}
          startIcon={<ArrowBackIcon />}
          sx={{ mb: 2 }}
        >
          Back to Game
        </Button>
        <Typography variant="h4" fontWeight={700}>
          Edit Game
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {game.field_name as string} — {game.date as string} at {game.time as string}
        </Typography>
      </Box>

      <Card sx={{ maxWidth: 500 }}>
        <CardContent sx={{ p: 3 }}>
          {actionData?.error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {actionData.error}
            </Alert>
          )}

          <Form method="post">
            <FormControl fullWidth margin="normal" required>
              <InputLabel>Field</InputLabel>
              <Select
                name="field_id"
                label="Field"
                defaultValue={game.field_id as string}
              >
                {fields.map((f) => (
                  <MenuItem key={f.id as string} value={f.id as string}>
                    {f.name as string}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              name="date"
              label="Date"
              type="date"
              fullWidth
              required
              margin="normal"
              defaultValue={game.date as string}
              slotProps={{ inputLabel: { shrink: true } }}
            />

            <TextField
              name="time"
              label="Time"
              type="time"
              fullWidth
              required
              margin="normal"
              defaultValue={game.time as string}
              slotProps={{ inputLabel: { shrink: true } }}
            />

            <TextField
              name="max_players"
              label="Max Players (optional)"
              type="number"
              fullWidth
              margin="normal"
              defaultValue={game.max_players !== null ? (game.max_players as number) : ""}
            />

            <TextField
              name="notes"
              label="Notes (optional)"
              fullWidth
              margin="normal"
              multiline
              rows={3}
              defaultValue={(game.notes as string) || ""}
            />

            <FormControl fullWidth margin="normal" required>
              <InputLabel>Status</InputLabel>
              <Select
                name="status"
                label="Status"
                defaultValue={game.status as string}
              >
                {Object.entries(GAME_STATUS_LABELS).map(([value, label]) => (
                  <MenuItem key={value} value={value}>
                    {label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Button
              type="submit"
              variant="contained"
              fullWidth
              size="large"
              sx={{ mt: 2 }}
            >
              Save Changes
            </Button>
          </Form>
        </CardContent>
      </Card>
    </AppShell>
  );
}
