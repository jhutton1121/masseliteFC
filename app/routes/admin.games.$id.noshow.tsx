import { Form, useActionData, Link } from "react-router";
import type { Route } from "./+types/admin.games.$id.noshow";
import { requireAdmin } from "~/lib/middleware.server";
import { AppShell } from "~/components/AppShell";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

export function meta() {
  return [{ title: "No-Shows | Admin | MassEliteFC" }];
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

  const rsvps = await db
    .prepare(
      `SELECT r.*, u.name as user_name
       FROM rsvps r
       JOIN users u ON r.user_id = u.id
       WHERE r.game_id = ? AND r.status IN ('in', 'late')
       ORDER BY u.name`
    )
    .bind(params.id)
    .all();

  return { user, game, rsvps: rsvps.results };
}

export async function action({ request, context, params }: Route.ActionArgs) {
  const db = context.cloudflare.env.DB;
  await requireAdmin(request, db);
  const form = await request.formData();

  const noShows = form.getAll("no_show") as string[];

  // Reset all no-shows for this game, then set the flagged ones
  await db
    .prepare("UPDATE rsvps SET no_show = 0 WHERE game_id = ?")
    .bind(params.id)
    .run();

  if (noShows.length > 0) {
    const stmts = noShows.map((userId) =>
      db
        .prepare(
          "UPDATE rsvps SET no_show = 1 WHERE game_id = ? AND user_id = ?"
        )
        .bind(params.id, userId)
    );
    await db.batch(stmts);
  }

  return { success: `No-shows updated. ${noShows.length} player(s) flagged.` };
}

export default function AdminNoShowPage({ loaderData, actionData }: Route.ComponentProps) {
  const { user, game, rsvps } = loaderData;

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

      <Typography variant="h4" fontWeight={700} gutterBottom>
        No-Show Tracking
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        {game.field_name as string} — {game.date as string}
      </Typography>
      <Typography variant="body2" color="warning.main" sx={{ mb: 3 }}>
        Flag players who RSVP'd but didn't show up. This is only visible to admins.
      </Typography>

      {actionData?.error && <Alert severity="error" sx={{ mb: 2 }}>{actionData.error}</Alert>}
      {actionData?.success && <Alert severity="success" sx={{ mb: 2 }}>{actionData.success}</Alert>}

      <Card sx={{ maxWidth: 500 }}>
        <CardContent>
          {rsvps.length > 0 ? (
            <Form method="post">
              {rsvps.map((r) => (
                <FormControlLabel
                  key={r.user_id as string}
                  control={
                    <Checkbox
                      name="no_show"
                      value={r.user_id as string}
                      defaultChecked={(r.no_show as number) === 1}
                      color="error"
                    />
                  }
                  label={r.user_name as string}
                  sx={{ display: "block", mb: 1 }}
                />
              ))}
              <Button
                type="submit"
                variant="contained"
                color="warning"
                fullWidth
                sx={{ mt: 2 }}
              >
                Save No-Shows
              </Button>
            </Form>
          ) : (
            <Typography color="text.secondary">
              No players RSVP'd for this game.
            </Typography>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
