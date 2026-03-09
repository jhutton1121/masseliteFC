import type { Route } from "./+types/stats.awards";
import { requireUser } from "~/lib/middleware.server";
import { AppShell } from "~/components/AppShell";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import { AWARD_LABELS } from "~/utils/constants";

export function meta() {
  return [{ title: "Awards | MassEliteFC" }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const db = context.cloudflare.env.DB;
  const user = await requireUser(request, db);

  const awards = await db
    .prepare(
      `SELECT sa.*, s.name as season_name, u.name as user_name
       FROM season_awards sa
       JOIN seasons s ON sa.season_id = s.id
       JOIN users u ON sa.user_id = u.id
       ORDER BY s.end_date DESC`
    )
    .all();

  return { user, awards: awards.results };
}

export default function AwardsPage({ loaderData }: Route.ComponentProps) {
  const { user, awards } = loaderData;

  return (
    <AppShell user={user}>
      <Typography variant="h4" fontWeight={700} gutterBottom>
        Season Awards
      </Typography>

      {awards.length > 0 ? (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
            gap: 2,
          }}
        >
          {awards.map((a) => (
            <Card key={a.id as string}>
              <CardContent sx={{ textAlign: "center" }}>
                <EmojiEventsIcon
                  sx={{ color: "warning.main", fontSize: 40, mb: 1 }}
                />
                <Typography variant="overline" display="block">
                  {a.season_name as string}
                </Typography>
                <Typography variant="h6" fontWeight={700}>
                  {AWARD_LABELS[a.award as string] || (a.award as string)}
                </Typography>
                <Typography color="primary" fontWeight={500}>
                  {a.user_name as string}
                </Typography>
              </CardContent>
            </Card>
          ))}
        </Box>
      ) : (
        <Box sx={{ textAlign: "center", py: 6 }}>
          <EmojiEventsIcon sx={{ fontSize: 48, color: "text.disabled", mb: 2 }} />
          <Typography variant="h6" color="text.primary">
            No awards yet
          </Typography>
          <Typography color="text.secondary">
            Awards will be displayed here at the end of each season.
          </Typography>
        </Box>
      )}
    </AppShell>
  );
}
