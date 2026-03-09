import { Form, Link, redirect, useActionData } from "react-router";
import type { Route } from "./+types/auth.register";
import { hashPassword } from "~/lib/auth/password.server";
import {
  createSession,
  sessionCookie,
  getSessionId,
  getSessionUser,
} from "~/lib/auth/session.server";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";

export function meta() {
  return [{ title: "Register | MassEliteFC" }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const db = context.cloudflare.env.DB;
  const sessionId = getSessionId(request);
  const user = await getSessionUser(db, sessionId);
  if (user) throw redirect("/");
  return null;
}

export async function action({ request, context }: Route.ActionArgs) {
  const db = context.cloudflare.env.DB;
  const form = await request.formData();
  const name = (form.get("name") as string)?.trim();
  const email = (form.get("email") as string)?.toLowerCase().trim();
  const password = form.get("password") as string;

  if (!name || !email || !password) {
    return { error: "All fields are required." };
  }

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  const existing = await db
    .prepare("SELECT id FROM users WHERE email = ?")
    .bind(email)
    .first();

  if (existing) {
    return { error: "An account with this email already exists." };
  }

  const passwordHash = await hashPassword(password);
  const result = await db
    .prepare(
      "INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?) RETURNING id"
    )
    .bind(name, email, passwordHash)
    .first();

  if (!result) {
    return { error: "Failed to create account. Please try again." };
  }

  const sessionId = await createSession(db, result.id as string);
  return redirect("/", {
    headers: { "Set-Cookie": sessionCookie(sessionId) },
  });
}

export default function RegisterPage() {
  const actionData = useActionData<typeof action>();

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        p: 2,
        bgcolor: "background.default",
      }}
    >
      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", mb: 4 }}>
        <Box
          component="img"
          src="/logo.jpeg"
          alt="MassEliteFC"
          sx={{ width: 80, height: 80, borderRadius: "50%", mb: 1 }}
        />
        <Typography variant="h4" fontWeight={700} color="text.primary">
          MassEliteFC
        </Typography>
      </Box>

      <Card sx={{ width: "100%", maxWidth: 400 }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h5" fontWeight={600} gutterBottom>
            Create Account
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Join MassEliteFC to RSVP for games and track your stats.
          </Typography>

          {actionData?.error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {actionData.error}
            </Alert>
          )}

          <Form method="post">
            <TextField
              name="name"
              label="Full Name"
              fullWidth
              required
              margin="normal"
              autoComplete="name"
            />
            <TextField
              name="email"
              label="Email"
              type="email"
              fullWidth
              required
              margin="normal"
              autoComplete="email"
            />
            <TextField
              name="password"
              label="Password"
              type="password"
              fullWidth
              required
              margin="normal"
              autoComplete="new-password"
              helperText="At least 8 characters"
            />
            <Button
              type="submit"
              variant="contained"
              fullWidth
              size="large"
              sx={{ mt: 2 }}
            >
              Create Account
            </Button>
          </Form>

          <Box sx={{ mt: 3, textAlign: "center" }}>
            <Typography variant="body2" color="text.secondary">
              Already have an account?{" "}
              <Typography
                component={Link}
                to="/auth/login"
                variant="body2"
                color="primary"
                sx={{ textDecoration: "none" }}
              >
                Sign in
              </Typography>
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Or{" "}
              <Typography
                component={Link}
                to="/auth/whatsapp"
                variant="body2"
                color="primary"
                sx={{ textDecoration: "none" }}
              >
                sign up with WhatsApp
              </Typography>
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
