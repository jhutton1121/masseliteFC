import { Form, useActionData } from "react-router";
import type { Route } from "./+types/admin.awards";
import { requireAdmin } from "~/lib/middleware.server";
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
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import { AWARD_LABELS } from "~/utils/constants";

export function meta() {
  return [{ title: "Awards | Admin | MassEliteFC" }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const db = context.cloudflare.env.DB;
  const user = await requireAdmin(request, db);

  const seasons = await db
    .prepare(
      `SELECT s.*,
              (SELECT COUNT(*) FROM games g WHERE g.date BETWEEN s.start_date AND s.end_date) as game_count
       FROM seasons s ORDER BY s.end_date DESC`
    )
    .all();

  const users = await db
    .prepare("SELECT id, name FROM users ORDER BY name")
    .all();

  const awards = await db
    .prepare(
      `SELECT sa.*, s.name as season_name, u.name as user_name
       FROM season_awards sa
       JOIN seasons s ON sa.season_id = s.id
       JOIN users u ON sa.user_id = u.id
       ORDER BY s.end_date DESC`
    )
    .all();

  return {
    user,
    seasons: seasons.results,
    users: users.results,
    awards: awards.results,
  };
}

export async function action({ request, context }: Route.ActionArgs) {
  const db = context.cloudflare.env.DB;
  await requireAdmin(request, db);
  const form = await request.formData();
  const intent = form.get("intent");

  if (intent === "create_season") {
    const name = (form.get("name") as string)?.trim();
    const start_date = form.get("start_date") as string;
    const end_date = form.get("end_date") as string;

    if (!name || !start_date || !end_date) {
      return { error: "All fields are required." };
    }

    await db
      .prepare("INSERT INTO seasons (name, start_date, end_date) VALUES (?, ?, ?)")
      .bind(name, start_date, end_date)
      .run();

    return { success: `Season "${name}" created.` };
  }

  if (intent === "assign_award") {
    const season_id = form.get("season_id") as string;
    const user_id = form.get("user_id") as string;
    const award = form.get("award") as string;

    if (!season_id || !user_id || !award) {
      return { error: "All fields are required." };
    }

    try {
      await db
        .prepare(
          "INSERT INTO season_awards (season_id, user_id, award) VALUES (?, ?, ?)"
        )
        .bind(season_id, user_id, award)
        .run();
    } catch {
      return { error: "This award has already been assigned for this season." };
    }

    return { success: "Award assigned." };
  }

  return { error: "Unknown action." };
}

export default function AdminAwardsPage({ loaderData, actionData }: Route.ComponentProps) {
  const { user, seasons, users, awards } = loaderData;

  return (
    <AppShell user={user}>
      <Typography variant="h4" fontWeight={700} gutterBottom>
        Manage Awards
      </Typography>

      {actionData?.error && <Alert severity="error" sx={{ mb: 2 }}>{actionData.error}</Alert>}
      {actionData?.success && <Alert severity="success" sx={{ mb: 2 }}>{actionData.success}</Alert>}

      <Box sx={{ display: "flex", flexDirection: "column", gap: 3, maxWidth: 500 }}>
        {/* Existing Seasons */}
        {seasons.length > 0 && (
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" fontWeight={600} gutterBottom>
                Seasons
              </Typography>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                {seasons.map((s) => (
                  <Box
                    key={s.id as string}
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      pb: 1.5,
                      borderBottom: 1,
                      borderColor: "divider",
                      "&:last-child": { borderBottom: 0, pb: 0 },
                    }}
                  >
                    <Box>
                      <Typography fontWeight={500}>{s.name as string}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {s.start_date as string} — {s.end_date as string}
                      </Typography>
                    </Box>
                    <Chip
                      label={`${s.game_count as number} game${(s.game_count as number) === 1 ? "" : "s"}`}
                      size="small"
                      variant="outlined"
                    />
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>
        )}

        {/* Create Season */}
        <Card>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight={600} gutterBottom>
              Create Season
            </Typography>
            <Form method="post">
              <input type="hidden" name="intent" value="create_season" />
              <TextField
                name="name"
                label="Season Name"
                fullWidth
                required
                margin="normal"
                placeholder="Spring 2026"
              />
              <TextField
                name="start_date"
                label="Start Date"
                type="date"
                fullWidth
                required
                margin="normal"
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <TextField
                name="end_date"
                label="End Date"
                type="date"
                fullWidth
                required
                margin="normal"
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <Button type="submit" variant="contained" sx={{ mt: 2 }}>
                Create Season
              </Button>
            </Form>
          </CardContent>
        </Card>

        {/* Assign Award */}
        {seasons.length > 0 && (
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" fontWeight={600} gutterBottom>
                Assign Award
              </Typography>
              <Form method="post">
                <input type="hidden" name="intent" value="assign_award" />
                <FormControl fullWidth margin="normal" required>
                  <InputLabel>Season</InputLabel>
                  <Select name="season_id" label="Season" defaultValue="">
                    {seasons.map((s) => (
                      <MenuItem key={s.id as string} value={s.id as string}>
                        {s.name as string}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl fullWidth margin="normal" required>
                  <InputLabel>Player</InputLabel>
                  <Select name="user_id" label="Player" defaultValue="">
                    {users.map((u) => (
                      <MenuItem key={u.id as string} value={u.id as string}>
                        {u.name as string}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl fullWidth margin="normal" required>
                  <InputLabel>Award</InputLabel>
                  <Select name="award" label="Award" defaultValue="">
                    {Object.entries(AWARD_LABELS).map(([value, label]) => (
                      <MenuItem key={value} value={value}>
                        {label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Button type="submit" variant="contained" sx={{ mt: 2 }}>
                  Assign Award
                </Button>
              </Form>
            </CardContent>
          </Card>
        )}
      </Box>
    </AppShell>
  );
}
