import { Form, useActionData, useFetcher } from "react-router";
import type { Route } from "./+types/admin.users";
import { requireAdmin } from "~/lib/middleware.server";
import { isSuperadmin } from "~/utils/roles";
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
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import EditNoteIcon from "@mui/icons-material/EditNote";

export function meta() {
  return [{ title: "Users | Admin | MassEliteFC" }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const db = context.cloudflare.env.DB;
  const user = await requireAdmin(request, db);

  const users = await db
    .prepare(
      `SELECT u.*,
              (SELECT COUNT(*) FROM rsvps WHERE user_id = u.id AND no_show = 1) as no_show_count,
              (SELECT COUNT(*) FROM rsvps WHERE user_id = u.id AND status IN ('in', 'late')) as rsvp_count
       FROM users u
       ORDER BY u.created_at DESC`
    )
    .all();

  return { user, users: users.results };
}

export async function action({ request, context }: Route.ActionArgs) {
  const db = context.cloudflare.env.DB;
  const user = await requireAdmin(request, db);
  const form = await request.formData();
  const intent = form.get("intent") as string;
  const targetId = form.get("user_id") as string;

  if (intent === "toggle_recaps") {
    if (!targetId) return { error: "Invalid request." };
    const target = await db
      .prepare("SELECT id, can_write_recaps FROM users WHERE id = ?")
      .bind(targetId)
      .first();
    if (!target) return { error: "User not found." };
    const newVal = target.can_write_recaps ? 0 : 1;
    await db
      .prepare("UPDATE users SET can_write_recaps = ?, updated_at = datetime('now') WHERE id = ?")
      .bind(newVal, targetId)
      .run();
    return { success: newVal ? "Recap writer enabled." : "Recap writer disabled." };
  }

  const newRole = form.get("role") as string;

  if (!targetId || !["user", "admin"].includes(newRole)) {
    return { error: "Invalid request." };
  }

  const target = await db
    .prepare("SELECT id, role FROM users WHERE id = ?")
    .bind(targetId)
    .first();

  if (!target) return { error: "User not found." };

  // Only superadmin can change admin roles
  if (target.role === "admin" && !isSuperadmin(user)) {
    return { error: "Only the superadmin can demote other admins." };
  }

  // Cannot modify superadmin
  if (target.role === "superadmin") {
    return { error: "Cannot modify superadmin role." };
  }

  await db
    .prepare("UPDATE users SET role = ?, updated_at = datetime('now') WHERE id = ?")
    .bind(newRole, targetId)
    .run();

  return { success: `Role updated to ${newRole}.` };
}

export default function AdminUsersPage({ loaderData, actionData }: Route.ComponentProps) {
  const { user, users } = loaderData;
  const isSuperadminUser = isSuperadmin(user);

  return (
    <AppShell user={user}>
      <Typography variant="h4" fontWeight={700} gutterBottom>
        User Management
      </Typography>

      {actionData?.error && <Alert severity="error" sx={{ mb: 2 }}>{actionData.error}</Alert>}
      {actionData?.success && <Alert severity="success" sx={{ mb: 2 }}>{actionData.success}</Alert>}

      <Card>
        <CardContent>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>Email</TableCell>
                  <TableCell>Role</TableCell>
                  <TableCell align="right" sx={{ display: { xs: "none", md: "table-cell" } }}>Games</TableCell>
                  <TableCell align="right" sx={{ display: { xs: "none", md: "table-cell" } }}>No-Shows</TableCell>
                  <TableCell align="right">Reliability</TableCell>
                  <TableCell align="center" sx={{ display: { xs: "none", md: "table-cell" } }}>Recaps</TableCell>
                  {isSuperadminUser && <TableCell>Actions</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {users.map((u) => {
                  const rsvpCount = u.rsvp_count as number;
                  const noShowCount = u.no_show_count as number;
                  const reliability = rsvpCount > 0
                    ? Math.round(((rsvpCount - noShowCount) / rsvpCount) * 100)
                    : 100;

                  return (
                    <TableRow key={u.id as string}>
                      <TableCell>
                        <Typography fontWeight={500} noWrap>{u.name as string}</Typography>
                      </TableCell>
                      <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>
                        <Typography variant="body2" color="text.secondary" noWrap>
                          {(u.email as string) || (u.whatsapp as string) || "—"}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={u.role as string}
                          size="small"
                          color={u.role !== "user" ? "primary" : "default"}
                        />
                      </TableCell>
                      <TableCell align="right" sx={{ display: { xs: "none", md: "table-cell" } }}>
                        <Typography fontFamily="'JetBrains Mono', monospace" variant="body2">
                          {rsvpCount}
                        </Typography>
                      </TableCell>
                      <TableCell align="right" sx={{ display: { xs: "none", md: "table-cell" } }}>
                        <Typography
                          fontFamily="'JetBrains Mono', monospace"
                          variant="body2"
                          color={noShowCount > 0 ? "error.main" : "text.secondary"}
                        >
                          {noShowCount}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Chip
                          label={`${reliability}%`}
                          size="small"
                          color={reliability >= 80 ? "success" : reliability >= 50 ? "warning" : "error"}
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell align="center" sx={{ display: { xs: "none", md: "table-cell" } }}>
                        <RecapToggle userId={u.id as string} enabled={Boolean(u.can_write_recaps)} />
                      </TableCell>
                      {isSuperadminUser && (
                        <TableCell>
                          {u.role !== "superadmin" && (
                            <Form method="post" style={{ display: "inline" }}>
                              <input type="hidden" name="user_id" value={u.id as string} />
                              <Select
                                name="role"
                                size="small"
                                defaultValue={u.role as string}
                                sx={{ mr: 1, minWidth: 90 }}
                              >
                                <MenuItem value="user">User</MenuItem>
                                <MenuItem value="admin">Admin</MenuItem>
                              </Select>
                              <Button type="submit" size="small" variant="outlined">
                                Save
                              </Button>
                            </Form>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </AppShell>
  );
}

function RecapToggle({ userId, enabled }: { userId: string; enabled: boolean }) {
  const fetcher = useFetcher();
  const optimistic = fetcher.formData
    ? fetcher.formData.get("intent") === "toggle_recaps"
      ? !enabled
      : enabled
    : enabled;

  return (
    <fetcher.Form method="post">
      <input type="hidden" name="intent" value="toggle_recaps" />
      <input type="hidden" name="user_id" value={userId} />
      <Tooltip title={optimistic ? "Recap writer (click to revoke)" : "Grant recap writer"} arrow>
        <IconButton
          type="submit"
          size="small"
          color={optimistic ? "primary" : "default"}
          sx={{ opacity: optimistic ? 1 : 0.4 }}
        >
          <EditNoteIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </fetcher.Form>
  );
}
