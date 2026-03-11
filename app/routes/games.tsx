import { Link } from "react-router";
import type { Route } from "./+types/games";
import { requireUser } from "~/lib/middleware.server";
import { isAdmin } from "~/utils/roles";
import { AppShell } from "~/components/AppShell";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardActionArea from "@mui/material/CardActionArea";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import AddIcon from "@mui/icons-material/Add";
import PlaceIcon from "@mui/icons-material/Place";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import EventIcon from "@mui/icons-material/Event";
import { GAME_STATUS_LABELS } from "~/utils/constants";

export function meta() {
  return [{ title: "Games | MassEliteFC" }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const db = context.cloudflare.env.DB;
  const user = await requireUser(request, db);

  const games = await db
    .prepare(
      `SELECT g.*, f.name as field_name, f.address as field_address,
              (SELECT COUNT(*) + COALESCE(SUM(extra_players), 0) FROM rsvps WHERE game_id = g.id AND status IN ('in', 'late')) as rsvp_count,
              (SELECT status FROM rsvps WHERE game_id = g.id AND user_id = ?) as my_rsvp,
              (SELECT s.name FROM seasons s WHERE g.date BETWEEN s.start_date AND s.end_date LIMIT 1) as season_name
       FROM games g
       JOIN fields f ON g.field_id = f.id
       ORDER BY g.date DESC, g.time DESC`
    )
    .bind(user.id)
    .all();

  return { user, games: games.results };
}

export default function GamesPage({ loaderData }: Route.ComponentProps) {
  const { user, games } = loaderData;
  const isAdminUser = isAdmin(user);

  const today = new Date().toISOString().split("T")[0];

  const upcoming = games.filter(
    (g) =>
      g.status !== "cancelled" &&
      g.status !== "completed" &&
      (g.date as string) >= today
  );
  const past = games.filter(
    (g) =>
      g.status === "cancelled" ||
      g.status === "completed" ||
      (g.date as string) < today
  );

  return (
    <AppShell user={user}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 3,
        }}
      >
        <Typography variant="h4" fontWeight={700}>
          Games
        </Typography>
        {isAdminUser && (
          <Button
            component={Link}
            to="/games/new"
            variant="contained"
            startIcon={<AddIcon />}
          >
            New Game
          </Button>
        )}
      </Box>

      {upcoming.length > 0 && (
        <>
          <Typography
            variant="h6"
            fontWeight={600}
            color="text.secondary"
            sx={{ mb: 2 }}
          >
            Upcoming
          </Typography>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mb: 4 }}>
            {upcoming.map((game) => (
              <GameCard key={game.id as string} game={game} />
            ))}
          </Box>
        </>
      )}

      {past.length > 0 && (
        <>
          <Typography
            variant="h6"
            fontWeight={600}
            color="text.secondary"
            sx={{ mb: 2 }}
          >
            Past Games
          </Typography>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {past.map((game) => (
              <GameCard key={game.id as string} game={game} />
            ))}
          </Box>
        </>
      )}

      {games.length === 0 && (
        <Box sx={{ textAlign: "center", py: 6 }}>
          <EventIcon sx={{ fontSize: 48, color: "text.disabled", mb: 2 }} />
          <Typography variant="h6" color="text.primary">
            No games yet
          </Typography>
          <Typography color="text.secondary">
            {isAdminUser
              ? "Create your first game to get started."
              : "Check back soon for upcoming games."}
          </Typography>
        </Box>
      )}
    </AppShell>
  );
}

function GameCard({ game }: { game: Record<string, unknown> }) {
  const statusColor =
    game.status === "scheduled"
      ? "info"
      : game.status === "completed"
        ? "success"
        : game.status === "cancelled"
          ? "error"
          : "warning";

  const rsvpColor =
    game.my_rsvp === "in"
      ? "success"
      : game.my_rsvp === "late"
        ? "warning"
        : game.my_rsvp === "out"
          ? "error"
          : game.my_rsvp === "waitlist"
            ? "info"
            : "default";

  return (
    <Card>
      <CardActionArea component={Link} to={`/games/${game.id}`}>
        <CardContent sx={{ p: { xs: 1.5, sm: 2 }, "&:last-child": { pb: { xs: 1.5, sm: 2 } } }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5, flexWrap: "wrap" }}>
            <PlaceIcon fontSize="small" color="primary" />
            <Typography variant="body1" fontWeight={600} noWrap sx={{ flex: 1, minWidth: 100 }}>
              {game.field_name as string}
            </Typography>
            {game.season_name && (
              <Chip
                label={game.season_name as string}
                color="primary"
                size="small"
                variant="outlined"
              />
            )}
            <Chip
              label={GAME_STATUS_LABELS[game.status as string] || game.status}
              color={statusColor as any}
              size="small"
              variant="outlined"
            />
            {game.max_players && (game.rsvp_count as number) >= (game.max_players as number) && (
              <Chip
                label="Waitlist"
                color="warning"
                size="small"
                variant="outlined"
              />
            )}
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
            <AccessTimeIcon fontSize="small" sx={{ color: "text.secondary" }} />
            <Typography variant="body2" color="text.secondary">
              {game.date as string} at {game.time as string}
            </Typography>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography
              variant="body2"
              color="text.secondary"
              fontFamily="'JetBrains Mono', monospace"
              sx={{ flex: 1 }}
            >
              {game.rsvp_count as number} player{(game.rsvp_count as number) !== 1 ? "s" : ""} in
            </Typography>
            {game.my_rsvp && (
              <Chip
                label={
                  game.my_rsvp === "in"
                    ? "Going"
                    : game.my_rsvp === "late"
                      ? "Late"
                      : game.my_rsvp === "waitlist"
                        ? "Waitlisted"
                        : "Not Going"
                }
                color={rsvpColor as any}
                size="small"
              />
            )}
          </Box>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}
