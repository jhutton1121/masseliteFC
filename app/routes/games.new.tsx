import { Form, redirect, useActionData, useLoaderData, Link } from "react-router";
import type { Route } from "./+types/games.new";
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

export function meta() {
  return [{ title: "New Game | MassEliteFC" }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const db = context.cloudflare.env.DB;
  const user = await requireAdmin(request, db);

  const fields = await db
    .prepare("SELECT * FROM fields ORDER BY is_default DESC, name ASC")
    .all();

  return { user, fields: fields.results };
}

export async function action({ request, context }: Route.ActionArgs) {
  const db = context.cloudflare.env.DB;
  const user = await requireAdmin(request, db);
  const form = await request.formData();

  const field_id = form.get("field_id") as string;
  const date = form.get("date") as string;
  const time = form.get("time") as string;
  const max_players = form.get("max_players") as string;
  const notes = (form.get("notes") as string)?.trim() || null;

  if (!field_id || !date || !time) {
    return { error: "Field, date, and time are required." };
  }

  const result = await db
    .prepare(
      `INSERT INTO games (field_id, date, time, max_players, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?) RETURNING id`
    )
    .bind(
      field_id,
      date,
      time,
      max_players ? parseInt(max_players) : null,
      notes,
      user.id
    )
    .first();

  if (!result) {
    return { error: "Failed to create game." };
  }

  // Send notifications
  try {
    const field = await db
      .prepare("SELECT name, address FROM fields WHERE id = ?")
      .bind(field_id)
      .first();

    const recipients = await getNotificationRecipients(db, "game_created", user.id);

    if (recipients.length > 0 && field) {
      await enqueueNotification(context.cloudflare.env.NOTIFICATION_QUEUE, {
        type: "game_created",
        recipients,
        payload: {
          gameId: result.id as string,
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

  return redirect(`/games/${result.id}`);
}

export default function NewGamePage({ loaderData, actionData }: Route.ComponentProps) {
  const { user, fields } = loaderData;

  return (
    <AppShell user={user}>
      <Box sx={{ mb: 3 }}>
        <Button
          component={Link}
          to="/games"
          startIcon={<ArrowBackIcon />}
          sx={{ mb: 2 }}
        >
          Back to Games
        </Button>
        <Typography variant="h4" fontWeight={700}>
          Schedule New Game
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
              <Select name="field_id" label="Field" defaultValue="">
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
              slotProps={{ inputLabel: { shrink: true } }}
            />

            <TextField
              name="time"
              label="Time"
              type="time"
              fullWidth
              required
              margin="normal"
              slotProps={{ inputLabel: { shrink: true } }}
            />

            <TextField
              name="max_players"
              label="Max Players (optional)"
              type="number"
              fullWidth
              margin="normal"
            />

            <TextField
              name="notes"
              label="Notes (optional)"
              fullWidth
              margin="normal"
              multiline
              rows={3}
            />

            <Button
              type="submit"
              variant="contained"
              fullWidth
              size="large"
              sx={{ mt: 2 }}
            >
              Create Game
            </Button>
          </Form>
        </CardContent>
      </Card>
    </AppShell>
  );
}
