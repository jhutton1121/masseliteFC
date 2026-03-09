import { Form, useActionData } from "react-router";
import type { Route } from "./+types/profile";
import { requireUser } from "~/lib/middleware.server";
import { uploadAvatar } from "~/lib/storage/avatar.server";
import { hashPassword, verifyPassword } from "~/lib/auth/password.server";
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
import Switch from "@mui/material/Switch";
import FormControlLabel from "@mui/material/FormControlLabel";
import Divider from "@mui/material/Divider";
import Avatar from "@mui/material/Avatar";
import PhotoCameraIcon from "@mui/icons-material/PhotoCamera";
import { POSITIONS } from "~/utils/constants";
import type { Position } from "~/utils/types";

export function meta() {
  return [{ title: "Profile | MassEliteFC" }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const db = context.cloudflare.env.DB;
  const user = await requireUser(request, db);
  return { user };
}

export async function action({ request, context }: Route.ActionArgs) {
  const db = context.cloudflare.env.DB;
  const user = await requireUser(request, db);
  const form = await request.formData();
  const intent = form.get("intent");

  if (intent === "update_profile") {
    const name = (form.get("name") as string)?.trim();
    const email = (form.get("email") as string)?.toLowerCase().trim() || null;
    const whatsapp = (form.get("whatsapp") as string)?.trim() || null;
    const positions = form.getAll("positions") as string[];

    if (!name) {
      return { error: "Name is required." };
    }

    if (!email && !whatsapp) {
      return { error: "At least one of email or WhatsApp is required." };
    }

    await db
      .prepare(
        `UPDATE users SET name = ?, email = ?, whatsapp = ?, positions = ?, updated_at = datetime('now')
         WHERE id = ?`
      )
      .bind(name, email, whatsapp, JSON.stringify(positions), user.id)
      .run();

    return { success: "Profile updated." };
  }

  if (intent === "update_notifications") {
    const notify_email = form.get("notify_email") === "on" ? 1 : 0;
    const notify_whatsapp = form.get("notify_whatsapp") === "on" ? 1 : 0;
    const notify_game_reminder = form.get("notify_game_reminder") === "on" ? 1 : 0;
    const notify_schedule_change = form.get("notify_schedule_change") === "on" ? 1 : 0;
    const notify_stats_posted = form.get("notify_stats_posted") === "on" ? 1 : 0;

    await db
      .prepare(
        `UPDATE users SET
           notify_email = ?, notify_whatsapp = ?,
           notify_game_reminder = ?, notify_schedule_change = ?, notify_stats_posted = ?,
           updated_at = datetime('now')
         WHERE id = ?`
      )
      .bind(
        notify_email, notify_whatsapp,
        notify_game_reminder, notify_schedule_change, notify_stats_posted,
        user.id
      )
      .run();

    return { success: "Notification preferences updated." };
  }

  if (intent === "change_password") {
    const currentPassword = form.get("current_password") as string;
    const newPassword = form.get("new_password") as string;
    const confirmPassword = form.get("confirm_password") as string;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return { error: "All password fields are required." };
    }

    if (newPassword.length < 8) {
      return { error: "New password must be at least 8 characters." };
    }

    if (newPassword !== confirmPassword) {
      return { error: "New passwords do not match." };
    }

    const row = await db
      .prepare("SELECT password_hash FROM users WHERE id = ?")
      .bind(user.id)
      .first<{ password_hash: string }>();

    if (!row || !(await verifyPassword(currentPassword, row.password_hash))) {
      return { error: "Current password is incorrect." };
    }

    const hash = await hashPassword(newPassword);
    await db
      .prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?")
      .bind(hash, user.id)
      .run();

    return { success: "Password changed successfully." };
  }

  if (intent === "upload_avatar") {
    const file = form.get("avatar") as File;
    if (!file || file.size === 0) {
      return { error: "Please select a file." };
    }

    try {
      const key = await uploadAvatar(context.cloudflare.env.AVATARS, user.id, file);

      await db
        .prepare("UPDATE users SET avatar_key = ?, updated_at = datetime('now') WHERE id = ?")
        .bind(key, user.id)
        .run();

      return { success: "Profile picture updated." };
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Failed to upload." };
    }
  }

  return { error: "Unknown action." };
}

export default function ProfilePage({ loaderData, actionData }: Route.ComponentProps) {
  const { user } = loaderData;

  return (
    <AppShell user={user}>
      <Typography variant="h4" fontWeight={700} gutterBottom>
        Profile
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

      <Box sx={{ display: "flex", flexDirection: "column", gap: 3, maxWidth: { sm: 500 } }}>
        {/* Avatar Upload */}
        <Card>
          <CardContent sx={{ p: 3, display: "flex", alignItems: "center", gap: 3 }}>
            <Avatar
              src={user.avatar_key ? `/api/avatar/${user.avatar_key}` : undefined}
              sx={{ width: 72, height: 72, bgcolor: "primary.main", fontSize: 28 }}
            >
              {user.name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase()
                .slice(0, 2)}
            </Avatar>
            <Box>
              <Typography variant="h6" fontWeight={600}>
                {user.name}
              </Typography>
              <Form method="post" encType="multipart/form-data">
                <input type="hidden" name="intent" value="upload_avatar" />
                <Button
                  component="label"
                  variant="outlined"
                  size="small"
                  startIcon={<PhotoCameraIcon />}
                  sx={{ mt: 1 }}
                >
                  Upload Photo
                  <input type="file" name="avatar" accept="image/*" hidden onChange={(e) => {
                    if (e.target.files?.[0]) {
                      e.target.form?.requestSubmit();
                    }
                  }} />
                </Button>
              </Form>
            </Box>
          </CardContent>
        </Card>

        {/* Profile Info */}
        <Card>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight={600} gutterBottom>
              Personal Info
            </Typography>
            <Form method="post">
              <input type="hidden" name="intent" value="update_profile" />
              <TextField
                name="name"
                label="Name"
                defaultValue={user.name}
                fullWidth
                required
                margin="normal"
              />
              <TextField
                name="email"
                label="Email"
                type="email"
                defaultValue={user.email || ""}
                fullWidth
                margin="normal"
              />
              <TextField
                name="whatsapp"
                label="WhatsApp Number"
                defaultValue={user.whatsapp || ""}
                fullWidth
                margin="normal"
                placeholder="+15551234567"
              />

              <FormControl fullWidth margin="normal">
                <InputLabel>Positions (in order of preference)</InputLabel>
                <Select
                  name="positions"
                  multiple
                  defaultValue={user.positions}
                  label="Positions (in order of preference)"
                  renderValue={(selected) => (
                    <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                      {(selected as string[]).map((val) => (
                        <Chip key={val} label={val} size="small" />
                      ))}
                    </Box>
                  )}
                >
                  {POSITIONS.map((p) => (
                    <MenuItem key={p.value} value={p.value}>
                      {p.value} — {p.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Button type="submit" variant="contained" sx={{ mt: 2 }}>
                Save Profile
              </Button>
            </Form>
          </CardContent>
        </Card>

        {/* Notification Preferences */}
        <Card>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight={600} gutterBottom>
              Notifications
            </Typography>
            <Form method="post">
              <input type="hidden" name="intent" value="update_notifications" />

              <Typography variant="subtitle2" sx={{ mt: 1, mb: 1 }}>
                Channels
              </Typography>
              <FormControlLabel
                control={
                  <Switch name="notify_email" defaultChecked={user.notify_email} />
                }
                label="Email"
              />
              <FormControlLabel
                control={
                  <Switch name="notify_whatsapp" defaultChecked={user.notify_whatsapp} />
                }
                label="WhatsApp"
              />

              <Divider sx={{ my: 2 }} />

              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Notification Types
              </Typography>
              <FormControlLabel
                control={
                  <Switch
                    name="notify_game_reminder"
                    defaultChecked={user.notify_game_reminder}
                  />
                }
                label="Game Reminders"
              />
              <FormControlLabel
                control={
                  <Switch
                    name="notify_schedule_change"
                    defaultChecked={user.notify_schedule_change}
                  />
                }
                label="Schedule Changes"
              />
              <FormControlLabel
                control={
                  <Switch
                    name="notify_stats_posted"
                    defaultChecked={user.notify_stats_posted}
                  />
                }
                label="Stats Posted"
              />

              <Box sx={{ mt: 2 }}>
                <Button type="submit" variant="contained">
                  Save Preferences
                </Button>
              </Box>
            </Form>
          </CardContent>
        </Card>
        {/* Change Password */}
        <Card>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight={600} gutterBottom>
              Change Password
            </Typography>
            <Form method="post">
              <input type="hidden" name="intent" value="change_password" />
              <TextField
                name="current_password"
                label="Current Password"
                type="password"
                fullWidth
                required
                margin="normal"
              />
              <TextField
                name="new_password"
                label="New Password"
                type="password"
                fullWidth
                required
                margin="normal"
                helperText="Minimum 8 characters"
              />
              <TextField
                name="confirm_password"
                label="Confirm New Password"
                type="password"
                fullWidth
                required
                margin="normal"
              />
              <Button type="submit" variant="contained" sx={{ mt: 2 }}>
                Change Password
              </Button>
            </Form>
          </CardContent>
        </Card>
      </Box>
    </AppShell>
  );
}
