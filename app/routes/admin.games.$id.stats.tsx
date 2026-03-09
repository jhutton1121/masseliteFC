import { useState } from "react";
import { Form, Link } from "react-router";
import type { Route } from "./+types/admin.games.$id.stats";
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
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

export function meta() {
  return [{ title: "Enter Stats | Admin | MassEliteFC" }];
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

  // Get matches for this game day
  const matches = await db
    .prepare("SELECT * FROM matches WHERE game_id = ? ORDER BY created_at ASC")
    .bind(params.id)
    .all();

  // Get players assigned to each match (via game_teams), plus any existing stats
  const matchPlayers: Record<string, Record<string, unknown>[]> = {};

  for (const match of matches.results) {
    const mid = match.id as string;
    const players = await db
      .prepare(
        `SELECT gt.user_id, u.name, gt.team,
                COALESCE(gs.goals, 0) as goals,
                COALESCE(gs.assists, 0) as assists
         FROM game_teams gt
         JOIN users u ON gt.user_id = u.id
         LEFT JOIN game_stats gs ON gs.match_id = gt.match_id AND gs.user_id = gt.user_id
         WHERE gt.match_id = ?
         ORDER BY gt.team ASC, u.name ASC`
      )
      .bind(mid)
      .all();
    matchPlayers[mid] = players.results;
  }

  return { user, game, matches: matches.results, matchPlayers };
}

export async function action({ request, context, params }: Route.ActionArgs) {
  const db = context.cloudflare.env.DB;
  await requireAdmin(request, db);
  const form = await request.formData();

  const matchId = form.get("match_id") as string;
  const playerIds = form.getAll("player_id") as string[];

  if (!matchId) return { error: "No match selected." };

  const stmts = playerIds.map((playerId) => {
    const goals = parseInt(form.get(`goals_${playerId}`) as string) || 0;
    const assists = parseInt(form.get(`assists_${playerId}`) as string) || 0;

    return db
      .prepare(
        `INSERT INTO game_stats (match_id, user_id, goals, assists)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(match_id, user_id) DO UPDATE SET goals = ?, assists = ?`
      )
      .bind(matchId, playerId, goals, assists, goals, assists);
  });

  if (stmts.length > 0) {
    await db.batch(stmts);
  }

  // Send notification
  try {
    const game = await db
      .prepare(
        `SELECT g.date, g.time, f.name as field_name
         FROM games g JOIN fields f ON g.field_id = f.id WHERE g.id = ?`
      )
      .bind(params.id)
      .first();

    if (game) {
      const recipients = await getNotificationRecipients(db, "stats_posted");
      if (recipients.length > 0) {
        await enqueueNotification(context.cloudflare.env.NOTIFICATION_QUEUE, {
          type: "stats_posted",
          recipients,
          payload: {
            gameId: params.id,
            fieldName: game.field_name as string,
            date: game.date as string,
            time: game.time as string,
            appUrl: context.cloudflare.env.APP_URL,
          },
        });
      }
    }
  } catch (e) {
    console.error("Failed to enqueue notification:", e);
  }

  return { success: "Stats saved." };
}

export default function AdminGameStatsPage({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { user, game, matches, matchPlayers } = loaderData;
  const [selectedTab, setSelectedTab] = useState(0);

  const currentMatch = matches[selectedTab];
  const currentMatchId = currentMatch?.id as string | undefined;
  const players = currentMatchId ? matchPlayers[currentMatchId] || [] : [];

  return (
    <AppShell user={user}>
      <Button
        component={Link}
        to={`/games/${game.id}`}
        startIcon={<ArrowBackIcon />}
        sx={{ mb: 2 }}
      >
        Back to Game Day
      </Button>

      <Typography variant="h4" fontWeight={700} gutterBottom>
        Enter Stats — {game.field_name as string}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        {game.date as string} at {game.time as string}
      </Typography>

      {actionData?.error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {actionData.error}
        </Alert>
      )}
      {actionData?.success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {actionData.success}
        </Alert>
      )}

      {matches.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: "center", py: 4 }}>
            <Typography color="text.secondary">
              No matches created yet. Use the Team Builder to create matches and
              assign teams first.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <>
          {matches.length > 1 && (
            <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 2 }}>
              <Tabs
                value={Math.min(selectedTab, matches.length - 1)}
                onChange={(_, v) => setSelectedTab(v)}
                variant="scrollable"
                scrollButtons="auto"
              >
                {matches.map((m) => (
                  <Tab key={m.id as string} label={m.label as string} />
                ))}
              </Tabs>
            </Box>
          )}

          <Card sx={{ maxWidth: 600 }}>
            <CardContent>
              {currentMatch && matches.length === 1 && (
                <Typography variant="h6" fontWeight={600} gutterBottom>
                  {currentMatch.label as string}
                </Typography>
              )}

              {players.length > 0 ? (
                <Form method="post" key={currentMatchId}>
                  <input
                    type="hidden"
                    name="match_id"
                    value={currentMatchId!}
                  />
                  {players.map((p) => (
                    <Box
                      key={p.user_id as string}
                      sx={{
                        display: "flex",
                        flexWrap: "wrap",
                        alignItems: "center",
                        gap: 1,
                        mb: 2,
                        pb: 2,
                        borderBottom: 1,
                        borderColor: "divider",
                      }}
                    >
                      <input
                        type="hidden"
                        name="player_id"
                        value={p.user_id as string}
                      />
                      <Typography
                        sx={{
                          minWidth: { xs: "100%", sm: 140 },
                          fontWeight: 500,
                        }}
                      >
                        {p.name as string}
                        <Typography
                          component="span"
                          variant="body2"
                          color="text.secondary"
                          sx={{ ml: 1 }}
                        >
                          Team {p.team as string}
                        </Typography>
                      </Typography>
                      <TextField
                        name={`goals_${p.user_id}`}
                        label="Goals"
                        type="number"
                        size="small"
                        defaultValue={p.goals as number}
                        sx={{ width: 80 }}
                        inputProps={{ min: 0 }}
                      />
                      <TextField
                        name={`assists_${p.user_id}`}
                        label="Assists"
                        type="number"
                        size="small"
                        defaultValue={p.assists as number}
                        sx={{ width: 80 }}
                        inputProps={{ min: 0 }}
                      />
                    </Box>
                  ))}
                  <Button
                    type="submit"
                    variant="contained"
                    fullWidth
                    sx={{ mt: 2 }}
                  >
                    Save Stats
                  </Button>
                </Form>
              ) : (
                <Typography color="text.secondary">
                  No players assigned to this match. Use the Team Builder to
                  assign teams first.
                </Typography>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </AppShell>
  );
}
