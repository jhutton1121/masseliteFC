import { useSearchParams, useSubmit } from "react-router";
import type { Route } from "./+types/stats";
import { requireUser } from "~/lib/middleware.server";
import { AppShell } from "~/components/AppShell";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Chip from "@mui/material/Chip";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import SportsSoccerIcon from "@mui/icons-material/SportsSoccer";
import AssistIcon from "@mui/icons-material/Handshake";

export function meta() {
  return [{ title: "Stats & Rankings | MassEliteFC" }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const db = context.cloudflare.env.DB;
  const user = await requireUser(request, db);

  const url = new URL(request.url);
  const seasonId = url.searchParams.get("season") || "";

  const seasons = await db
    .prepare("SELECT id, name FROM seasons ORDER BY start_date DESC")
    .all();

  let rankings;
  if (seasonId) {
    rankings = await db
      .prepare(
        `SELECT u.id, u.name,
                COALESCE(SUM(gs.goals), 0) as total_goals,
                COALESCE(SUM(gs.assists), 0) as total_assists,
                COALESCE(SUM(gs.goals), 0) + COALESCE(SUM(gs.assists), 0) as total_ga,
                COUNT(gs.id) as games_played
         FROM users u
         JOIN game_stats gs ON u.id = gs.user_id
         JOIN matches m ON gs.match_id = m.id
         JOIN games g ON m.game_id = g.id
         JOIN seasons s ON g.date BETWEEN s.start_date AND s.end_date
         WHERE s.id = ?
         GROUP BY u.id
         HAVING games_played > 0
         ORDER BY total_ga DESC`
      )
      .bind(seasonId)
      .all();
  } else {
    rankings = await db
      .prepare(
        `SELECT u.id, u.name,
                COALESCE(SUM(gs.goals), 0) as total_goals,
                COALESCE(SUM(gs.assists), 0) as total_assists,
                COALESCE(SUM(gs.goals), 0) + COALESCE(SUM(gs.assists), 0) as total_ga,
                COUNT(gs.id) as games_played
         FROM users u
         LEFT JOIN game_stats gs ON u.id = gs.user_id
         GROUP BY u.id
         HAVING games_played > 0
         ORDER BY total_ga DESC`
      )
      .all();
  }

  return {
    user,
    rankings: rankings.results,
    seasons: seasons.results,
    selectedSeason: seasonId,
  };
}

export default function StatsPage({ loaderData }: Route.ComponentProps) {
  const { user, rankings, seasons, selectedSeason } = loaderData;
  const [searchParams] = useSearchParams();
  const submit = useSubmit();

  const selectedSeasonName = selectedSeason
    ? (seasons.find((s) => s.id === selectedSeason)?.name as string) || "Season"
    : "All Time";

  const topScorer = rankings.length > 0 ? rankings.reduce((a, b) =>
    (a.total_goals as number) > (b.total_goals as number) ? a : b
  ) : null;

  const topAssister = rankings.length > 0 ? rankings.reduce((a, b) =>
    (a.total_assists as number) > (b.total_assists as number) ? a : b
  ) : null;

  const mostGames = rankings.length > 0 ? rankings.reduce((a, b) =>
    (a.games_played as number) > (b.games_played as number) ? a : b
  ) : null;

  return (
    <AppShell user={user}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2, flexWrap: "wrap", gap: 2 }}>
        <Typography variant="h4" fontWeight={700}>
          Power Rankings {selectedSeason ? `\u2014 ${selectedSeasonName}` : ""}
        </Typography>
        {seasons.length > 0 && (
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Season</InputLabel>
            <Select
              label="Season"
              value={selectedSeason}
              onChange={(e) => {
                const params = new URLSearchParams(searchParams);
                if (e.target.value) {
                  params.set("season", e.target.value as string);
                } else {
                  params.delete("season");
                }
                submit(params, { method: "get" });
              }}
            >
              <MenuItem value="">All Time</MenuItem>
              {seasons.map((s) => (
                <MenuItem key={s.id as string} value={s.id as string}>
                  {s.name as string}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
      </Box>

      {/* Leaders */}
      {rankings.length > 0 && (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr 1fr" },
            gap: 2,
            mb: 4,
          }}
        >
          <Card>
            <CardContent sx={{ textAlign: "center" }}>
              <SportsSoccerIcon sx={{ color: "warning.main", fontSize: 32 }} />
              <Typography variant="overline" display="block">
                Golden Boot
              </Typography>
              <Typography variant="h6" fontWeight={700}>
                {topScorer?.name as string}
              </Typography>
              <Typography
                variant="h4"
                fontWeight={700}
                fontFamily="'JetBrains Mono', monospace"
                color="warning.main"
              >
                {topScorer?.total_goals as number}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                goals
              </Typography>
            </CardContent>
          </Card>

          <Card>
            <CardContent sx={{ textAlign: "center" }}>
              <AssistIcon sx={{ color: "info.main", fontSize: 32 }} />
              <Typography variant="overline" display="block">
                Playmaker
              </Typography>
              <Typography variant="h6" fontWeight={700}>
                {topAssister?.name as string}
              </Typography>
              <Typography
                variant="h4"
                fontWeight={700}
                fontFamily="'JetBrains Mono', monospace"
                color="info.main"
              >
                {topAssister?.total_assists as number}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                assists
              </Typography>
            </CardContent>
          </Card>

          <Card>
            <CardContent sx={{ textAlign: "center" }}>
              <EmojiEventsIcon sx={{ color: "success.main", fontSize: 32 }} />
              <Typography variant="overline" display="block">
                Most Dedicated
              </Typography>
              <Typography variant="h6" fontWeight={700}>
                {mostGames?.name as string}
              </Typography>
              <Typography
                variant="h4"
                fontWeight={700}
                fontFamily="'JetBrains Mono', monospace"
                color="success.main"
              >
                {mostGames?.games_played as number}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                games played
              </Typography>
            </CardContent>
          </Card>
        </Box>
      )}

      {/* Full Table */}
      <Card>
        <CardContent>
          <Typography variant="h6" fontWeight={600} gutterBottom>
            All Players
          </Typography>
          {rankings.length > 0 ? (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>#</TableCell>
                    <TableCell>Player</TableCell>
                    <TableCell align="right">Goals</TableCell>
                    <TableCell align="right">Assists</TableCell>
                    <TableCell align="right" sx={{ display: { xs: "none", sm: "table-cell" } }}>G+A</TableCell>
                    <TableCell align="right" sx={{ display: { xs: "none", sm: "table-cell" } }}>Games</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rankings.map((r, i) => (
                    <TableRow key={r.id as string}>
                      <TableCell>
                        <Typography
                          fontFamily="'JetBrains Mono', monospace"
                          variant="body2"
                        >
                          {i + 1}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography fontWeight={500} noWrap>
                          {r.name as string}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography fontFamily="'JetBrains Mono', monospace">
                          {r.total_goals as number}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography fontFamily="'JetBrains Mono', monospace">
                          {r.total_assists as number}
                        </Typography>
                      </TableCell>
                      <TableCell align="right" sx={{ display: { xs: "none", sm: "table-cell" } }}>
                        <Typography
                          fontFamily="'JetBrains Mono', monospace"
                          fontWeight={700}
                        >
                          {r.total_ga as number}
                        </Typography>
                      </TableCell>
                      <TableCell align="right" sx={{ display: { xs: "none", sm: "table-cell" } }}>
                        <Typography fontFamily="'JetBrains Mono', monospace">
                          {r.games_played as number}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Box sx={{ textAlign: "center", py: 4 }}>
              <Typography color="text.secondary">
                No stats yet. Play some games first!
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
