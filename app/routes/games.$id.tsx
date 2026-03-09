import { useState } from "react";
import { Link, useFetcher, Form } from "react-router";
import type { Route } from "./+types/games.$id";
import { requireUser, requireAdmin } from "~/lib/middleware.server";
import { isAdmin, canWriteRecaps } from "~/utils/roles";
import {
  enqueueNotification,
  getNotificationRecipients,
} from "~/lib/notifications/queue-producer.server";
import { AppShell } from "~/components/AppShell";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Divider from "@mui/material/Divider";
import Avatar from "@mui/material/Avatar";
import AvatarGroup from "@mui/material/AvatarGroup";
import Tooltip from "@mui/material/Tooltip";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import PlaceIcon from "@mui/icons-material/Place";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import GroupsIcon from "@mui/icons-material/Groups";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ScheduleIcon from "@mui/icons-material/Schedule";
import CancelIcon from "@mui/icons-material/Cancel";
import BarChartIcon from "@mui/icons-material/BarChart";
import EditIcon from "@mui/icons-material/Edit";
import EditNoteIcon from "@mui/icons-material/EditNote";
import { GAME_STATUS_LABELS } from "~/utils/constants";

export function meta() {
  return [{ title: "Game Details | MassEliteFC" }];
}

export async function loader({ request, context, params }: Route.LoaderArgs) {
  const db = context.cloudflare.env.DB;
  const user = await requireUser(request, db);

  const game = await db
    .prepare(
      `SELECT g.*, f.name as field_name, f.address as field_address
       FROM games g
       JOIN fields f ON g.field_id = f.id
       WHERE g.id = ?`
    )
    .bind(params.id)
    .first();

  if (!game) {
    throw new Response("Game not found", { status: 404 });
  }

  const rsvps = await db
    .prepare(
      `SELECT r.*, u.name as user_name, u.positions as user_positions
       FROM rsvps r
       JOIN users u ON r.user_id = u.id
       WHERE r.game_id = ?
       ORDER BY r.status ASC, r.updated_at ASC`
    )
    .bind(params.id)
    .all();

  const myRsvp = rsvps.results.find((r) => r.user_id === user.id);

  // Get matches and team assignments (match-based)
  const matches = await db
    .prepare("SELECT * FROM matches WHERE game_id = ? ORDER BY created_at ASC")
    .bind(params.id)
    .all();

  const teamAssignments = await db
    .prepare(
      `SELECT gt.match_id, gt.user_id, gt.team, u.name as user_name, m.label as match_label
       FROM game_teams gt
       JOIN users u ON gt.user_id = u.id
       JOIN matches m ON gt.match_id = m.id
       WHERE m.game_id = ?
       ORDER BY m.created_at ASC, gt.team ASC, u.name ASC`
    )
    .bind(params.id)
    .all();

  const season = await db
    .prepare(
      `SELECT id, name FROM seasons
       WHERE ? BETWEEN start_date AND end_date
       LIMIT 1`
    )
    .bind(game.date as string)
    .first();

  const writeup = await db
    .prepare(
      `SELECT w.*, u.name as author_name
       FROM game_writeups w
       JOIN users u ON w.author_id = u.id
       WHERE w.game_id = ?`
    )
    .bind(params.id)
    .first();

  return {
    user,
    game,
    rsvps: rsvps.results,
    myRsvp: myRsvp ? (myRsvp.status as string) : null,
    myExtraPlayers: myRsvp ? (myRsvp.extra_players as number) || 0 : 0,
    myExtraPlayerNames: myRsvp ? JSON.parse((myRsvp.extra_player_names as string) || "[]") as string[] : [],
    matches: matches.results,
    teamAssignments: teamAssignments.results,
    season: season ? { id: season.id as string, name: season.name as string } : null,
    writeup,
    canWriteRecap: canWriteRecaps(user),
  };
}

export async function action({ request, context, params }: Route.ActionArgs) {
  const db = context.cloudflare.env.DB;
  const user = await requireAdmin(request, db);
  const form = await request.formData();
  const intent = form.get("intent");

  if (intent === "cancel") {
    const game = await db
      .prepare(
        `SELECT g.date, g.time, f.name as field_name
         FROM games g JOIN fields f ON g.field_id = f.id WHERE g.id = ?`
      )
      .bind(params.id)
      .first();

    await db
      .prepare("UPDATE games SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?")
      .bind(params.id)
      .run();

    // Notify everyone
    try {
      if (game) {
        const recipients = await getNotificationRecipients(db, "game_cancelled");
        if (recipients.length > 0) {
          await enqueueNotification(context.cloudflare.env.NOTIFICATION_QUEUE, {
            type: "game_cancelled",
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
      console.error("Failed to enqueue cancellation notification:", e);
    }

    return { success: "Game cancelled." };
  }

  return { error: "Unknown action." };
}

export default function GameDetailPage({ loaderData }: Route.ComponentProps) {
  const { user, game, rsvps, myRsvp, myExtraPlayers, myExtraPlayerNames, matches, teamAssignments, season, writeup, canWriteRecap } = loaderData;
  const fetcher = useFetcher();
  const extraFetcher = useFetcher();
  const isAdminUser = isAdmin(user);

  const [extraCount, setExtraCount] = useState(myExtraPlayers);
  const [extraNames, setExtraNames] = useState<string[]>(myExtraPlayerNames);

  const optimisticRsvp =
    fetcher.formData?.get("status")?.toString() || myRsvp;

  const playersOnTime = rsvps.filter((r) => r.status === "in");
  const playersLate = rsvps.filter((r) => r.status === "late");
  const playersOut = rsvps.filter((r) => r.status === "out");
  const totalExtras = rsvps.reduce((sum, r) => sum + ((r.extra_players as number) || 0), 0);
  const totalIn = playersOnTime.length + playersLate.length + totalExtras;

  const handleRsvp = (
    _: React.MouseEvent<HTMLElement>,
    newStatus: string | null
  ) => {
    if (newStatus) {
      fetcher.submit(
        { status: newStatus },
        { method: "post", action: `/games/${game.id}/rsvp` }
      );
    }
  };

  return (
    <AppShell user={user}>
      <Button
        component={Link}
        to="/games"
        startIcon={<ArrowBackIcon />}
        sx={{ mb: 2 }}
      >
        Back to Games
      </Button>

      <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {/* Game Info */}
        <Card>
          <CardContent>
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                mb: 2,
              }}
            >
              <Typography variant="h5" fontWeight={700}>
                {game.field_name as string}
              </Typography>
              <Box sx={{ display: "flex", gap: 1 }}>
                {season && (
                  <Chip
                    label={season.name}
                    variant="outlined"
                    color="primary"
                    size="small"
                  />
                )}
                <Chip
                  label={GAME_STATUS_LABELS[game.status as string]}
                  color={
                    game.status === "scheduled"
                      ? "info"
                      : game.status === "completed"
                        ? "success"
                        : game.status === "cancelled"
                          ? "error"
                          : "warning"
                  }
                  size="small"
                />
              </Box>
            </Box>

            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
              <AccessTimeIcon fontSize="small" sx={{ color: "text.secondary" }} />
              <Typography color="text.secondary">
                {game.date as string} at {game.time as string}
              </Typography>
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
              <PlaceIcon fontSize="small" sx={{ color: "text.secondary" }} />
              <Typography color="text.secondary">
                {game.field_address as string}
              </Typography>
            </Box>

            {game.notes && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {game.notes as string}
              </Typography>
            )}

            {/* RSVP Controls */}
            {game.status === "scheduled" && (
              <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Your RSVP
                </Typography>
                <ToggleButtonGroup
                  value={optimisticRsvp}
                  exclusive
                  onChange={handleRsvp}
                  fullWidth
                  sx={{
                    "& .MuiToggleButton-root": {
                      py: { xs: 1.5, sm: 1 },
                      fontSize: { xs: "0.9rem", sm: "0.8125rem" },
                    },
                  }}
                >
                  <ToggleButton value="in" color="success">
                    <CheckCircleIcon sx={{ mr: 0.5 }} fontSize="small" />
                    In
                  </ToggleButton>
                  <ToggleButton value="late" color="warning">
                    <ScheduleIcon sx={{ mr: 0.5 }} fontSize="small" />
                    Late
                  </ToggleButton>
                  <ToggleButton value="out" color="error">
                    <CancelIcon sx={{ mr: 0.5 }} fontSize="small" />
                    Out
                  </ToggleButton>
                </ToggleButtonGroup>

                {/* Extra Players */}
                {(optimisticRsvp === "in" || optimisticRsvp === "late") && (
                  <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: "divider" }}>
                    <extraFetcher.Form
                      method="post"
                      action={`/games/${game.id}/rsvp`}
                    >
                      <input type="hidden" name="intent" value="extra_players" />
                      <Typography variant="subtitle2" gutterBottom>
                        Bringing extra players?
                      </Typography>
                      <TextField
                        name="extra_players"
                        type="number"
                        size="small"
                        value={extraCount}
                        onChange={(e) => {
                          const val = Math.max(0, Math.min(10, parseInt(e.target.value) || 0));
                          setExtraCount(val);
                          // Resize names array
                          setExtraNames((prev) => {
                            const next = [...prev];
                            while (next.length < val) next.push("");
                            return next.slice(0, val);
                          });
                        }}
                        inputProps={{ min: 0, max: 10 }}
                        sx={{ width: 80 }}
                      />
                      {extraCount > 0 && (
                        <Box sx={{ mt: 1.5, display: "flex", flexDirection: "column", gap: 1 }}>
                          {Array.from({ length: extraCount }, (_, i) => (
                            <TextField
                              key={i}
                              name={`extra_name_${i}`}
                              size="small"
                              placeholder={`Guest ${i + 1} name (optional)`}
                              value={extraNames[i] || ""}
                              onChange={(e) => {
                                setExtraNames((prev) => {
                                  const next = [...prev];
                                  next[i] = e.target.value;
                                  return next;
                                });
                              }}
                              fullWidth
                            />
                          ))}
                        </Box>
                      )}
                      <Button
                        type="submit"
                        size="small"
                        variant="outlined"
                        sx={{ mt: 1.5 }}
                        disabled={extraFetcher.state !== "idle"}
                      >
                        {extraCount > 0 ? "Save Guests" : "Clear Guests"}
                      </Button>
                    </extraFetcher.Form>
                  </Box>
                )}
              </Box>
            )}
          </CardContent>
        </Card>

        {/* Player List */}
        <Card>
          <CardContent>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 3 }}>
              <GroupsIcon color="primary" />
              <Typography variant="h6" fontWeight={600}>
                Players ({totalIn})
              </Typography>
            </Box>

            {totalIn > 0 || playersOut.length > 0 ? (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
                {/* On Time */}
                {playersOnTime.length > 0 && (
                  <RsvpGroup
                    label="On Time"
                    count={playersOnTime.length}
                    players={playersOnTime}
                    color="success.main"
                  />
                )}

                {/* Late */}
                {playersLate.length > 0 && (
                  <RsvpGroup
                    label="Late"
                    count={playersLate.length}
                    players={playersLate}
                    color="warning.main"
                  />
                )}

                {/* Out */}
                {playersOut.length > 0 && (
                  <>
                    <Divider />
                    <RsvpGroup
                      label="Out"
                      count={playersOut.length}
                      players={playersOut}
                      color="text.disabled"
                    />
                  </>
                )}
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No one has RSVP'd yet.
              </Typography>
            )}
          </CardContent>
        </Card>

        {/* Published Teams */}
        {!!(game.teams_published as number) && matches.length > 0 && (
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight={600} gutterBottom>
                Matches
              </Typography>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {matches.map((match) => {
                  const matchTeams = teamAssignments.filter(
                    (t) => t.match_id === match.id
                  );
                  const teamA = matchTeams.filter((t) => t.team === "A");
                  const teamB = matchTeams.filter((t) => t.team === "B");

                  return (
                    <Box key={match.id as string}>
                      <Typography
                        variant="subtitle1"
                        fontWeight={600}
                        gutterBottom
                      >
                        {match.label as string}
                      </Typography>
                      <Box
                        sx={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          gap: 2,
                        }}
                      >
                        <Box>
                          <Typography
                            variant="subtitle2"
                            color="primary.main"
                            gutterBottom
                          >
                            Team A ({teamA.length})
                          </Typography>
                          {teamA.map((t) => (
                            <Typography
                              key={t.user_id as string}
                              variant="body2"
                            >
                              {t.user_name as string}
                            </Typography>
                          ))}
                        </Box>
                        <Box>
                          <Typography
                            variant="subtitle2"
                            color="error.main"
                            gutterBottom
                          >
                            Team B ({teamB.length})
                          </Typography>
                          {teamB.map((t) => (
                            <Typography
                              key={t.user_id as string}
                              variant="body2"
                            >
                              {t.user_name as string}
                            </Typography>
                          ))}
                        </Box>
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            </CardContent>
          </Card>
        )}

        {/* Game Recap */}
        {writeup && (
          <Card>
            <CardContent>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <EditNoteIcon color="primary" />
                  <Typography variant="h6" fontWeight={600}>
                    Game Recap
                  </Typography>
                </Box>
                {canWriteRecap && (
                  <Button
                    component={Link}
                    to={`/games/${game.id}/writeup`}
                    size="small"
                    startIcon={<EditIcon />}
                  >
                    Edit
                  </Button>
                )}
              </Box>
              <Typography
                variant="body1"
                sx={{ whiteSpace: "pre-line", lineHeight: 1.7 }}
              >
                {writeup.content as string}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: "block" }}>
                — {writeup.author_name as string}
              </Typography>
            </CardContent>
          </Card>
        )}

        {!writeup && canWriteRecap && game.status === "completed" && (
          <Button
            component={Link}
            to={`/games/${game.id}/writeup`}
            variant="outlined"
            startIcon={<EditNoteIcon />}
          >
            Write Game Recap
          </Button>
        )}

        {/* Admin Actions */}
        {isAdminUser && (
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight={600} gutterBottom>
                Admin Actions
              </Typography>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr 1fr", sm: "auto auto auto auto auto" },
                  gap: 1,
                }}
              >
                <Button
                  component={Link}
                  to={`/admin/games/${game.id}/edit`}
                  variant="outlined"
                  startIcon={<EditIcon />}
                >
                  Edit
                </Button>
                <Button
                  component={Link}
                  to={`/admin/games/${game.id}/teams`}
                  variant="outlined"
                >
                  Team Builder
                </Button>
                <Button
                  component={Link}
                  to={`/admin/games/${game.id}/stats`}
                  variant="outlined"
                  startIcon={<BarChartIcon />}
                >
                  Stats
                </Button>
                <Button
                  component={Link}
                  to={`/admin/games/${game.id}/noshow`}
                  variant="outlined"
                  color="warning"
                >
                  No-Shows
                </Button>
                {game.status === "scheduled" && (
                  <Form method="post">
                    <input type="hidden" name="intent" value="cancel" />
                    <Button
                      type="submit"
                      variant="outlined"
                      color="error"
                      fullWidth
                      startIcon={<CancelIcon />}
                      onClick={(e) => {
                        if (!confirm("Cancel this game? All players will be notified.")) {
                          e.preventDefault();
                        }
                      }}
                    >
                      Cancel
                    </Button>
                  </Form>
                )}
              </Box>
            </CardContent>
          </Card>
        )}
      </Box>
    </AppShell>
  );
}

function RsvpGroup({
  label,
  count,
  players,
  color,
}: {
  label: string;
  count: number;
  players: Record<string, unknown>[];
  color: string;
}) {
  const extraTotal = players.reduce((sum, r) => sum + ((r.extra_players as number) || 0), 0);
  const displayCount = count + extraTotal;

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
        <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: color }} />
        <Typography variant="subtitle2" color="text.secondary">
          {label} ({displayCount})
          {extraTotal > 0 && (
            <Typography component="span" variant="caption" color="text.disabled" sx={{ ml: 0.5 }}>
              incl. {extraTotal} guest{extraTotal !== 1 ? "s" : ""}
            </Typography>
          )}
        </Typography>
      </Box>
      <AvatarGroup
        max={12}
        sx={{
          justifyContent: "flex-start",
          "& .MuiAvatar-root": {
            width: 36,
            height: 36,
            fontSize: 13,
            fontWeight: 600,
            borderColor: "background.paper",
          },
        }}
      >
        {players.flatMap((r) => {
          const extras = (r.extra_players as number) || 0;
          const names: string[] = extras > 0
            ? JSON.parse((r.extra_player_names as string) || "[]")
            : [];
          const avatars = [
            <Tooltip key={r.user_id as string} title={
              extras > 0
                ? `${r.user_name as string} (+${extras} guest${extras !== 1 ? "s" : ""})`
                : (r.user_name as string)
            } arrow>
              <Avatar sx={{ bgcolor: color }}>
                {(r.user_name as string)
                  .split(" ")
                  .map((n: string) => n[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2)}
              </Avatar>
            </Tooltip>,
          ];
          for (let i = 0; i < extras; i++) {
            const guestName = names[i] || `Guest ${i + 1}`;
            avatars.push(
              <Tooltip key={`${r.user_id}-guest-${i}`} title={`${guestName} (w/ ${r.user_name})`} arrow>
                <Avatar sx={{ bgcolor: color, opacity: 0.7, fontSize: 11 }}>
                  {guestName
                    .split(" ")
                    .map((n: string) => n[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2)}
                </Avatar>
              </Tooltip>,
            );
          }
          return avatars;
        })}
      </AvatarGroup>
    </Box>
  );
}
