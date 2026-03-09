import { Link, Form, redirect, useActionData } from "react-router";
import type { Route } from "./+types/games.$id.writeup";
import { requireUser } from "~/lib/middleware.server";
import { canWriteRecaps } from "~/utils/roles";
import { AppShell } from "~/components/AppShell";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

export function meta() {
  return [{ title: "Game Recap | MassEliteFC" }];
}

export async function loader({ request, context, params }: Route.LoaderArgs) {
  const db = context.cloudflare.env.DB;
  const user = await requireUser(request, db);

  if (!canWriteRecaps(user)) {
    throw new Response("Forbidden", { status: 403 });
  }

  const game = await db
    .prepare(
      `SELECT g.*, f.name as field_name
       FROM games g JOIN fields f ON g.field_id = f.id
       WHERE g.id = ?`
    )
    .bind(params.id)
    .first();

  if (!game) throw new Response("Game not found", { status: 404 });
  if (game.status !== "completed") {
    throw new Response("Recaps can only be written for completed games.", { status: 400 });
  }

  const writeup = await db
    .prepare("SELECT * FROM game_writeups WHERE game_id = ?")
    .bind(params.id)
    .first();

  return { user, game, writeup };
}

export async function action({ request, context, params }: Route.ActionArgs) {
  const db = context.cloudflare.env.DB;
  const user = await requireUser(request, db);

  if (!canWriteRecaps(user)) {
    throw new Response("Forbidden", { status: 403 });
  }

  const game = await db
    .prepare("SELECT id, status FROM games WHERE id = ?")
    .bind(params.id)
    .first();

  if (!game) throw new Response("Game not found", { status: 404 });
  if (game.status !== "completed") {
    return { error: "Recaps can only be written for completed games." };
  }

  const form = await request.formData();
  const content = (form.get("content") as string || "").trim();

  if (!content) {
    return { error: "Recap content cannot be empty." };
  }

  if (content.length > 5000) {
    return { error: "Recap must be under 5,000 characters." };
  }

  await db
    .prepare(
      `INSERT INTO game_writeups (game_id, author_id, content)
       VALUES (?, ?, ?)
       ON CONFLICT(game_id) DO UPDATE SET
         content = excluded.content,
         author_id = excluded.author_id,
         updated_at = datetime('now')`
    )
    .bind(params.id, user.id, content)
    .run();

  return redirect(`/games/${params.id}`);
}

export default function GameWriteupPage({ loaderData, actionData }: Route.ComponentProps) {
  const { user, game, writeup } = loaderData;
  const isEditing = !!writeup;

  return (
    <AppShell user={user}>
      <Button
        component={Link}
        to={`/games/${game.id}`}
        startIcon={<ArrowBackIcon />}
        sx={{ mb: 2 }}
      >
        Back to Game
      </Button>

      <Typography variant="h5" fontWeight={700} gutterBottom>
        {isEditing ? "Edit Recap" : "Write Recap"}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        {game.field_name as string} — {game.date as string}
      </Typography>

      {actionData?.error && (
        <Alert severity="error" sx={{ mb: 2 }}>{actionData.error}</Alert>
      )}

      <Card>
        <CardContent>
          <Form method="post">
            <TextField
              name="content"
              label="Game Recap"
              multiline
              minRows={6}
              maxRows={20}
              fullWidth
              required
              defaultValue={(writeup?.content as string) || ""}
              placeholder="How did the game go? Any highlights, great goals, or funny moments?"
              helperText="Max 5,000 characters"
              margin="normal"
            />
            <Box sx={{ display: "flex", gap: 1, mt: 2 }}>
              <Button type="submit" variant="contained">
                {isEditing ? "Update Recap" : "Publish Recap"}
              </Button>
              <Button component={Link} to={`/games/${game.id}`} variant="outlined">
                Cancel
              </Button>
            </Box>
          </Form>
        </CardContent>
      </Card>
    </AppShell>
  );
}
