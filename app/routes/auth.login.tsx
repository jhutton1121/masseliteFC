import { Form, Link, redirect, useActionData } from "react-router";
import type { Route } from "./+types/auth.login";
import { verifyPassword } from "~/lib/auth/password.server";
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
  return [{ title: "Login | MassEliteFC" }];
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
  const email = form.get("email") as string;
  const password = form.get("password") as string;

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const user = await db
    .prepare("SELECT id, password_hash FROM users WHERE email = ?")
    .bind(email.toLowerCase().trim())
    .first();

  if (!user || !user.password_hash) {
    return { error: "Invalid email or password." };
  }

  const valid = await verifyPassword(password, user.password_hash as string);
  if (!valid) {
    return { error: "Invalid email or password." };
  }

  const sessionId = await createSession(db, user.id as string);
  return redirect("/", {
    headers: { "Set-Cookie": sessionCookie(sessionId) },
  });
}

export default function LoginPage() {
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
            Sign In
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Welcome back! Enter your credentials to continue.
          </Typography>

          {actionData?.error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {actionData.error}
            </Alert>
          )}

          <Form method="post">
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
              autoComplete="current-password"
            />
            <Button
              type="submit"
              variant="contained"
              fullWidth
              size="large"
              sx={{ mt: 2 }}
            >
              Sign In
            </Button>
          </Form>

          <Box sx={{ mt: 3, textAlign: "center" }}>
            <Typography variant="body2" color="text.secondary">
              Don't have an account?{" "}
              <Typography
                component={Link}
                to="/auth/register"
                variant="body2"
                color="primary"
                sx={{ textDecoration: "none" }}
              >
                Sign up
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
                sign in with WhatsApp
              </Typography>
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
