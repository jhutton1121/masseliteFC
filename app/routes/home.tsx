import { Link } from "react-router";
import type { Route } from "./+types/home";
import { requireUser } from "~/lib/middleware.server";
import { AppShell } from "~/components/AppShell";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import EventIcon from "@mui/icons-material/Event";
import LeaderboardIcon from "@mui/icons-material/Leaderboard";
import SportsSoccerIcon from "@mui/icons-material/SportsSoccer";

export function meta() {
  return [
    { title: "Dashboard | MassEliteFC" },
    { name: "description", content: "MassEliteFC - Pickup Soccer Scheduling" },
  ];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const db = context.cloudflare.env.DB;
  const user = await requireUser(request, db);

  // Get next upcoming game
  const nextGame = await db
    .prepare(
      `SELECT g.*, f.name as field_name, f.address as field_address,
              (SELECT COUNT(*) + COALESCE(SUM(extra_players), 0) FROM rsvps WHERE game_id = g.id AND status IN ('in', 'late')) as rsvp_count
       FROM games g
       JOIN fields f ON g.field_id = f.id
       WHERE g.status = 'scheduled' AND g.date >= date('now')
       ORDER BY g.date ASC, g.time ASC
       LIMIT 1`
    )
    .first();

  // Get user's stats summary
  const stats = await db
    .prepare(
      `SELECT
         COALESCE(SUM(goals), 0) as total_goals,
         COALESCE(SUM(assists), 0) as total_assists,
         COUNT(*) as games_played
       FROM game_stats WHERE user_id = ?`
    )
    .bind(user.id)
    .first();

  return { user, nextGame, stats };
}

export default function Dashboard({ loaderData }: Route.ComponentProps) {
  const { user, nextGame, stats } = loaderData;

  return (
    <AppShell user={user}>
      <Typography variant="h5" fontWeight={700} gutterBottom>
        Welcome, {user.name.split(" ")[0]}
      </Typography>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "1fr 1fr 1fr" },
          gap: 2,
          mb: 4,
        }}
      >
        {/* Next Game Card */}
        <Card>
          {nextGame ? (
            <CardActionArea component={Link} to={`/games/${nextGame.id}`}>
              <CardContent>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
                  <EventIcon color="primary" />
                  <Typography variant="h6" fontWeight={600}>
                    Next Game
                  </Typography>
                </Box>
                <Typography variant="body1" fontWeight={500}>
                  {nextGame.field_name as string}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {nextGame.date as string} at {nextGame.time as string}
                </Typography>
                <Chip
                  label={`${nextGame.rsvp_count} players in`}
                  color="success"
                  size="small"
                  sx={{ mt: 1 }}
                />
              </CardContent>
            </CardActionArea>
          ) : (
            <CardContent>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
                <EventIcon color="primary" />
                <Typography variant="h6" fontWeight={600}>
                  Next Game
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                No upcoming games scheduled.
              </Typography>
            </CardContent>
          )}
        </Card>

        {/* Stats Card */}
        <Card>
          <CardContent>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
              <LeaderboardIcon color="primary" />
              <Typography variant="h6" fontWeight={600}>
                Your Stats
              </Typography>
            </Box>
            <Box sx={{ display: "flex", gap: 3 }}>
              <Box>
                <Typography
                  variant="h4"
                  fontWeight={700}
                  fontFamily="'JetBrains Mono', monospace"
                >
                  {(stats?.total_goals as number) || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Goals
                </Typography>
              </Box>
              <Box>
                <Typography
                  variant="h4"
                  fontWeight={700}
                  fontFamily="'JetBrains Mono', monospace"
                >
                  {(stats?.total_assists as number) || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Assists
                </Typography>
              </Box>
              <Box>
                <Typography
                  variant="h4"
                  fontWeight={700}
                  fontFamily="'JetBrains Mono', monospace"
                >
                  {(stats?.games_played as number) || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Games
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>

        {/* Quick Info Card */}
        <Card>
          <CardContent>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
              <SportsSoccerIcon color="primary" />
              <Typography variant="h6" fontWeight={600}>
                Your Role
              </Typography>
            </Box>
            <Chip
              label={
                user.role === "superadmin"
                  ? "Super Admin"
                  : user.role === "admin"
                    ? "Admin"
                    : "Player"
              }
              color={user.role !== "user" ? "primary" : "default"}
              size="small"
            />
            {user.positions.length > 0 && (
              <Box
                sx={{ mt: 1.5, display: "flex", gap: 0.5, flexWrap: "wrap" }}
              >
                {user.positions.map((pos) => (
                  <Chip
                    key={pos}
                    label={pos}
                    size="small"
                    variant="outlined"
                  />
                ))}
              </Box>
            )}
          </CardContent>
        </Card>
      </Box>
    </AppShell>
  );
}
