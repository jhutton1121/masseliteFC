import { useState } from "react";
import { Form, useFetcher, Link, useRevalidator } from "react-router";
import type { Route } from "./+types/admin.games.$id.teams";
import { requireAdmin } from "~/lib/middleware.server";
import {
  randomizeTeams,
  informedTeamBuilder,
  smartSplit,
} from "~/lib/team-builder/algorithm.server";
import { AppShell } from "~/components/AppShell";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import Chip from "@mui/material/Chip";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Avatar from "@mui/material/Avatar";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import IconButton from "@mui/material/IconButton";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ShuffleIcon from "@mui/icons-material/Shuffle";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import SaveIcon from "@mui/icons-material/Save";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import PublishIcon from "@mui/icons-material/Publish";

export function meta() {
  return [{ title: "Team Builder | Admin | MassEliteFC" }];
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

  // Get players who RSVP'd in/late with their all-time stats
  const players = await db
    .prepare(
      `SELECT r.user_id, u.name, u.positions,
              COALESCE(stats.total_goals, 0) as total_goals,
              COALESCE(stats.total_assists, 0) as total_assists,
              COALESCE(stats.games_played, 0) as games_played
       FROM rsvps r
       JOIN users u ON r.user_id = u.id
       LEFT JOIN (
         SELECT user_id,
                SUM(goals) as total_goals,
                SUM(assists) as total_assists,
                COUNT(*) as games_played
         FROM game_stats GROUP BY user_id
       ) stats ON stats.user_id = r.user_id
       WHERE r.game_id = ? AND r.status IN ('in', 'late')
       ORDER BY u.name`
    )
    .bind(params.id)
    .all();

  // Get matches for this game day
  const matches = await db
    .prepare(
      `SELECT * FROM matches WHERE game_id = ? ORDER BY created_at ASC`
    )
    .bind(params.id)
    .all();

  // Get all team assignments across all matches
  const teams = await db
    .prepare(
      `SELECT gt.match_id, gt.user_id, gt.team
       FROM game_teams gt
       JOIN matches m ON gt.match_id = m.id
       WHERE m.game_id = ?`
    )
    .bind(params.id)
    .all();

  return {
    user,
    game,
    players: players.results,
    matches: matches.results,
    teamAssignments: teams.results,
  };
}

export async function action({ request, context, params }: Route.ActionArgs) {
  const db = context.cloudflare.env.DB;
  await requireAdmin(request, db);
  const form = await request.formData();
  const intent = form.get("intent");

  if (intent === "add_match") {
    const count = await db
      .prepare("SELECT COUNT(*) as c FROM matches WHERE game_id = ?")
      .bind(params.id)
      .first();
    const label = `Game ${((count?.c as number) || 0) + 1}`;

    await db
      .prepare("INSERT INTO matches (game_id, label) VALUES (?, ?)")
      .bind(params.id, label)
      .run();

    return { success: `${label} added.` };
  }

  if (intent === "delete_match") {
    const matchId = form.get("match_id") as string;
    await db
      .prepare("DELETE FROM matches WHERE id = ? AND game_id = ?")
      .bind(matchId, params.id)
      .run();
    return { success: "Match removed." };
  }

  if (intent === "randomize") {
    const matchId = form.get("match_id") as string;
    const playerIds = form.getAll("player_id") as string[];
    const assignments = randomizeTeams(playerIds);

    await db
      .prepare("DELETE FROM game_teams WHERE match_id = ?")
      .bind(matchId)
      .run();

    if (assignments.length > 0) {
      const stmts = assignments.map((a) =>
        db
          .prepare(
            "INSERT INTO game_teams (match_id, user_id, team) VALUES (?, ?, ?)"
          )
          .bind(matchId, a.user_id, a.team)
      );
      await db.batch(stmts);
    }

    return { success: "Teams randomized." };
  }

  if (intent === "informed") {
    const matchId = form.get("match_id") as string;
    const playerIds = form.getAll("player_id") as string[];
    const names = form.getAll("player_name") as string[];
    const positionsArr = form.getAll("player_positions") as string[];
    const goalsArr = form.getAll("player_goals") as string[];
    const assistsArr = form.getAll("player_assists") as string[];
    const gamesArr = form.getAll("player_games") as string[];

    const players = playerIds.map((id, i) => {
      const gp = parseInt(gamesArr[i]) || 0;
      const goals = parseInt(goalsArr[i]) || 0;
      const assists = parseInt(assistsArr[i]) || 0;
      const rating =
        gp > 0 ? (goals * 1.0 + assists * 0.7) / gp : 0.5;

      return {
        user_id: id,
        name: names[i],
        positions: JSON.parse(positionsArr[i] || "[]"),
        rating,
      };
    });

    const assignments = informedTeamBuilder(players);

    await db
      .prepare("DELETE FROM game_teams WHERE match_id = ?")
      .bind(matchId)
      .run();

    if (assignments.length > 0) {
      const stmts = assignments.map((a) =>
        db
          .prepare(
            "INSERT INTO game_teams (match_id, user_id, team) VALUES (?, ?, ?)"
          )
          .bind(matchId, a.user_id, a.team)
      );
      await db.batch(stmts);
    }

    return { success: "Teams balanced using informed builder." };
  }

  if (intent === "smart_split") {
    const playerIds = form.getAll("player_id") as string[];
    const names = form.getAll("player_name") as string[];
    const positionsArr = form.getAll("player_positions") as string[];
    const goalsArr = form.getAll("player_goals") as string[];
    const assistsArr = form.getAll("player_assists") as string[];
    const gamesArr = form.getAll("player_games") as string[];

    const players = playerIds.map((id, i) => {
      const gp = parseInt(gamesArr[i]) || 0;
      const goals = parseInt(goalsArr[i]) || 0;
      const assists = parseInt(assistsArr[i]) || 0;
      const rating =
        gp > 0 ? (goals * 1.0 + assists * 0.7) / gp : 0.5;
      return {
        user_id: id,
        name: names[i],
        positions: JSON.parse(positionsArr[i] || "[]"),
        rating,
      };
    });

    // Get existing matches
    const existingMatches = await db
      .prepare("SELECT id FROM matches WHERE game_id = ? ORDER BY created_at ASC")
      .bind(params.id)
      .all();

    const matchCount = existingMatches.results.length;
    if (matchCount === 0) {
      return { error: "Add at least one match first." };
    }

    const splitResult = smartSplit(players, matchCount);

    // Clear all existing assignments for this game day's matches
    const clearStmts = existingMatches.results.map((m) =>
      db.prepare("DELETE FROM game_teams WHERE match_id = ?").bind(m.id as string)
    );
    await db.batch(clearStmts);

    // Insert new assignments
    const insertStmts: ReturnType<typeof db.prepare>[] = [];
    for (let i = 0; i < matchCount; i++) {
      const matchId = existingMatches.results[i].id as string;
      const assignments = splitResult.get(i) || [];
      for (const a of assignments) {
        insertStmts.push(
          db
            .prepare("INSERT INTO game_teams (match_id, user_id, team) VALUES (?, ?, ?)")
            .bind(matchId, a.user_id, a.team)
        );
      }
    }
    if (insertStmts.length > 0) {
      await db.batch(insertStmts);
    }

    return { success: `Players split across ${matchCount} match${matchCount > 1 ? "es" : ""}.` };
  }

  if (intent === "save_manual") {
    const matchId = form.get("match_id") as string;
    const assignments = JSON.parse(form.get("assignments") as string) as {
      user_id: string;
      team: string;
    }[];

    await db
      .prepare("DELETE FROM game_teams WHERE match_id = ?")
      .bind(matchId)
      .run();

    if (assignments.length > 0) {
      const stmts = assignments.map((a) =>
        db
          .prepare(
            "INSERT INTO game_teams (match_id, user_id, team) VALUES (?, ?, ?)"
          )
          .bind(matchId, a.user_id, a.team)
      );
      await db.batch(stmts);
    }

    return { success: "Teams saved." };
  }

  if (intent === "publish") {
    await db
      .prepare("UPDATE games SET teams_published = 1, updated_at = datetime('now') WHERE id = ?")
      .bind(params.id)
      .run();
    return { success: "Teams published! Players can now see their assignments." };
  }

  if (intent === "unpublish") {
    await db
      .prepare("UPDATE games SET teams_published = 0, updated_at = datetime('now') WHERE id = ?")
      .bind(params.id)
      .run();
    return { success: "Teams unpublished." };
  }

  return { error: "Unknown action." };
}

export default function TeamBuilderPage({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { user, game, players, matches, teamAssignments } = loaderData;
  const [selectedTab, setSelectedTab] = useState(0);
  const fetcher = useFetcher();

  // Build assignment maps per match
  const matchAssignments = new Map<string, Map<string, string>>();
  for (const ta of teamAssignments) {
    const mid = ta.match_id as string;
    if (!matchAssignments.has(mid)) matchAssignments.set(mid, new Map());
    matchAssignments.get(mid)!.set(ta.user_id as string, ta.team as string);
  }

  // Track which players are assigned to any match
  const assignedPlayerIds = new Set<string>();
  for (const ta of teamAssignments) {
    assignedPlayerIds.add(ta.user_id as string);
  }

  const unassignedPlayers = players.filter(
    (p) => !assignedPlayerIds.has(p.user_id as string)
  );

  const currentMatch = matches[selectedTab];
  const currentMatchId = currentMatch?.id as string | undefined;
  const currentAssignments = currentMatchId
    ? matchAssignments.get(currentMatchId) || new Map<string, string>()
    : new Map<string, string>();

  // Local state for manual editing of current match
  const [manualEdits, setManualEdits] = useState<Map<string, string>>(new Map());

  // When tab changes, reset manual edits
  const handleTabChange = (_: unknown, newValue: number) => {
    setSelectedTab(newValue);
    setManualEdits(new Map());
  };

  // Effective assignments for current match = server state + local edits
  const effectiveAssignments = new Map(currentAssignments);
  for (const [uid, team] of manualEdits) {
    if (team === "") {
      effectiveAssignments.delete(uid);
    } else {
      effectiveAssignments.set(uid, team);
    }
  }

  // Compute lists for current match
  const effectiveAssignedIds = new Set<string>();
  for (const [, assignments] of matchAssignments) {
    for (const uid of assignments.keys()) {
      effectiveAssignedIds.add(uid);
    }
  }
  // Apply manual edits for current match
  for (const [uid, team] of manualEdits) {
    if (team === "") {
      effectiveAssignedIds.delete(uid);
    } else {
      effectiveAssignedIds.add(uid);
    }
  }

  const currentTeamA = players.filter(
    (p) => effectiveAssignments.get(p.user_id as string) === "A"
  );
  const currentTeamB = players.filter(
    (p) => effectiveAssignments.get(p.user_id as string) === "B"
  );
  const currentUnassigned = players.filter(
    (p) => !effectiveAssignedIds.has(p.user_id as string)
  );

  const cycleTeam = (userId: string) => {
    setManualEdits((prev) => {
      const next = new Map(prev);
      const current = effectiveAssignments.get(userId);
      if (!current) next.set(userId, "A");
      else if (current === "A") next.set(userId, "B");
      else next.set(userId, ""); // Remove
      return next;
    });
  };

  const saveManual = () => {
    if (!currentMatchId) return;
    const data = Array.from(effectiveAssignments.entries()).map(
      ([user_id, team]) => ({ user_id, team })
    );
    fetcher.submit(
      {
        intent: "save_manual",
        match_id: currentMatchId,
        assignments: JSON.stringify(data),
      },
      { method: "post" }
    );
    setManualEdits(new Map());
  };

  const isPublished = !!(game.teams_published as number);

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
        Team Builder
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        {game.field_name as string} — {game.date as string} — {players.length}{" "}
        players RSVP'd
      </Typography>

      {(actionData?.error || fetcher.data?.error) && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {actionData?.error || fetcher.data?.error}
        </Alert>
      )}
      {(actionData?.success || fetcher.data?.success) && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {actionData?.success || fetcher.data?.success}
        </Alert>
      )}

      {/* Global Actions */}
      <Box sx={{ display: "flex", gap: 1, mb: 2, flexWrap: "wrap" }}>
        <Form method="post">
          <input type="hidden" name="intent" value="add_match" />
          <Button type="submit" variant="outlined" startIcon={<AddIcon />}>
            Add Match
          </Button>
        </Form>

        {matches.length > 0 && (
          <Form method="post">
            <input type="hidden" name="intent" value="smart_split" />
            {players.map((p) => (
              <span key={p.user_id as string}>
                <input type="hidden" name="player_id" value={p.user_id as string} />
                <input type="hidden" name="player_name" value={p.name as string} />
                <input type="hidden" name="player_positions" value={p.positions as string} />
                <input type="hidden" name="player_goals" value={String(p.total_goals)} />
                <input type="hidden" name="player_assists" value={String(p.total_assists)} />
                <input type="hidden" name="player_games" value={String(p.games_played)} />
              </span>
            ))}
            <Button
              type="submit"
              variant="outlined"
              startIcon={<AutoFixHighIcon />}
            >
              Smart Split All
            </Button>
          </Form>
        )}

        <Form method="post">
          <input
            type="hidden"
            name="intent"
            value={isPublished ? "unpublish" : "publish"}
          />
          <Button
            type="submit"
            variant={isPublished ? "outlined" : "contained"}
            color={isPublished ? "warning" : "success"}
            startIcon={<PublishIcon />}
            disabled={matches.length === 0}
          >
            {isPublished ? "Unpublish" : "Publish Teams"}
          </Button>
        </Form>
      </Box>

      {isPublished && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Teams are published. Players can see their assignments.
        </Alert>
      )}

      {matches.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: "center", py: 4 }}>
            <Typography color="text.secondary">
              Add a match to start building teams.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Match Tabs */}
          <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 2 }}>
            <Tabs
              value={Math.min(selectedTab, matches.length - 1)}
              onChange={handleTabChange}
              variant="scrollable"
              scrollButtons="auto"
            >
              {matches.map((m, i) => {
                const mAssignments = matchAssignments.get(m.id as string);
                const count = mAssignments ? mAssignments.size : 0;
                return (
                  <Tab
                    key={m.id as string}
                    label={`${m.label as string} (${count})`}
                  />
                );
              })}
            </Tabs>
          </Box>

          {currentMatch && (
            <>
              {/* Per-Match Actions */}
              <Box sx={{ display: "flex", gap: 1, mb: 2, flexWrap: "wrap", alignItems: "center" }}>
                <Form method="post">
                  <input type="hidden" name="intent" value="randomize" />
                  <input type="hidden" name="match_id" value={currentMatchId!} />
                  {currentUnassigned.map((p) => (
                    <input
                      key={p.user_id as string}
                      type="hidden"
                      name="player_id"
                      value={p.user_id as string}
                    />
                  ))}
                  <Button
                    type="submit"
                    variant="outlined"
                    size="small"
                    startIcon={<ShuffleIcon />}
                    disabled={currentUnassigned.length === 0}
                  >
                    Randomize Unassigned
                  </Button>
                </Form>

                <Form method="post">
                  <input type="hidden" name="intent" value="informed" />
                  <input type="hidden" name="match_id" value={currentMatchId!} />
                  {currentUnassigned.map((p) => (
                    <span key={p.user_id as string}>
                      <input type="hidden" name="player_id" value={p.user_id as string} />
                      <input type="hidden" name="player_name" value={p.name as string} />
                      <input type="hidden" name="player_positions" value={p.positions as string} />
                      <input type="hidden" name="player_goals" value={String(p.total_goals)} />
                      <input type="hidden" name="player_assists" value={String(p.total_assists)} />
                      <input type="hidden" name="player_games" value={String(p.games_played)} />
                    </span>
                  ))}
                  <Button
                    type="submit"
                    variant="outlined"
                    size="small"
                    startIcon={<AutoFixHighIcon />}
                    disabled={currentUnassigned.length === 0}
                  >
                    Balanced Fill
                  </Button>
                </Form>

                <Button
                  variant="contained"
                  size="small"
                  startIcon={<SaveIcon />}
                  onClick={saveManual}
                  disabled={manualEdits.size === 0}
                >
                  Save
                </Button>

                <Box sx={{ flex: 1 }} />

                <Form method="post">
                  <input type="hidden" name="intent" value="delete_match" />
                  <input type="hidden" name="match_id" value={currentMatchId!} />
                  <IconButton
                    type="submit"
                    color="error"
                    size="small"
                    onClick={(e) => {
                      if (!confirm(`Delete ${currentMatch.label as string}?`)) {
                        e.preventDefault();
                      }
                    }}
                  >
                    <DeleteIcon />
                  </IconButton>
                </Form>
              </Box>

              {/* Team Columns */}
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", md: "1fr 1fr 1fr" },
                  gap: 2,
                }}
              >
                <TeamColumn
                  title="Unassigned"
                  players={currentUnassigned}
                  onCycle={cycleTeam}
                  color="text.secondary"
                />
                <TeamColumn
                  title="Team A"
                  players={currentTeamA}
                  onCycle={cycleTeam}
                  color="primary.main"
                />
                <TeamColumn
                  title="Team B"
                  players={currentTeamB}
                  onCycle={cycleTeam}
                  color="error.main"
                />
              </Box>

              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                Click a player to cycle: Unassigned → Team A → Team B → Unassigned
              </Typography>
            </>
          )}
        </>
      )}
    </AppShell>
  );
}

function TeamColumn({
  title,
  players,
  onCycle,
  color,
}: {
  title: string;
  players: Record<string, unknown>[];
  onCycle: (userId: string) => void;
  color: string;
}) {
  return (
    <Card>
      <CardContent>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
          <Typography variant="h6" fontWeight={600} sx={{ color }}>
            {title}
          </Typography>
          <Chip label={players.length} size="small" />
        </Box>
        <List dense>
          {players.map((p) => (
            <ListItem
              key={p.user_id as string}
              component="button"
              onClick={() => onCycle(p.user_id as string)}
              sx={{
                cursor: "pointer",
                borderRadius: 1,
                "&:hover": { bgcolor: "action.hover" },
              }}
            >
              <Avatar
                sx={{
                  width: 28,
                  height: 28,
                  mr: 1.5,
                  bgcolor: color,
                  fontSize: 12,
                }}
              >
                {(p.name as string)
                  .split(" ")
                  .map((n: string) => n[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2)}
              </Avatar>
              <ListItemText
                primary={p.name as string}
                secondary={
                  (p.games_played as number) > 0
                    ? `${p.total_goals}G ${p.total_assists}A (${p.games_played} games)`
                    : "No stats yet"
                }
              />
            </ListItem>
          ))}
          {players.length === 0 && (
            <Typography
              variant="body2"
              color="text.disabled"
              sx={{ py: 2, textAlign: "center" }}
            >
              No players
            </Typography>
          )}
        </List>
      </CardContent>
    </Card>
  );
}
