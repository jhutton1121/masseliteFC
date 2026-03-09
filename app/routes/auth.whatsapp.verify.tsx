import { Form, redirect, useActionData, useSearchParams } from "react-router";
import type { Route } from "./+types/auth.whatsapp.verify";
import { verifyOtp } from "~/lib/auth/otp.server";
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
  return [{ title: "Verify Code | MassEliteFC" }];
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
  const phone = form.get("phone") as string;
  const code = form.get("code") as string;

  if (!phone || !code) {
    return { error: "Phone and code are required." };
  }

  const valid = await verifyOtp(db, phone, code);
  if (!valid) {
    return { error: "Invalid or expired code. Please try again." };
  }

  // Find or create user
  let user = await db
    .prepare("SELECT id, name FROM users WHERE whatsapp = ?")
    .bind(phone)
    .first();

  if (!user) {
    // Create new user with WhatsApp number
    // TODO: Fetch WhatsApp profile name via API
    const name = "New Player";
    user = await db
      .prepare(
        "INSERT INTO users (name, whatsapp) VALUES (?, ?) RETURNING id, name"
      )
      .bind(name, phone)
      .first();
  }

  if (!user) {
    return { error: "Failed to create account. Please try again." };
  }

  const sessionId = await createSession(db, user.id as string);
  return redirect("/", {
    headers: { "Set-Cookie": sessionCookie(sessionId) },
  });
}

export default function VerifyOtpPage() {
  const actionData = useActionData<typeof action>();
  const [searchParams] = useSearchParams();
  const phone = searchParams.get("phone") || "";

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
            Enter Verification Code
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            We sent a 6-digit code to your WhatsApp at {phone}.
          </Typography>

          {actionData?.error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {actionData.error}
            </Alert>
          )}

          <Form method="post">
            <input type="hidden" name="phone" value={phone} />
            <TextField
              name="code"
              label="6-Digit Code"
              fullWidth
              required
              margin="normal"
              inputProps={{ maxLength: 6, pattern: "[0-9]*" }}
              autoFocus
              autoComplete="one-time-code"
            />
            <Button
              type="submit"
              variant="contained"
              fullWidth
              size="large"
              sx={{ mt: 2 }}
            >
              Verify
            </Button>
          </Form>
        </CardContent>
      </Card>
    </Box>
  );
}
