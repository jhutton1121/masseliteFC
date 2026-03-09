import { Form, Link, redirect, useActionData } from "react-router";
import type { Route } from "./+types/auth.whatsapp";
import { createOtp } from "~/lib/auth/otp.server";
import {
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
import WhatsAppIcon from "@mui/icons-material/WhatsApp";

export function meta() {
  return [{ title: "WhatsApp Login | MassEliteFC" }];
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
  let phone = (form.get("phone") as string)?.trim();

  if (!phone) {
    return { error: "Phone number is required." };
  }

  // Normalize to E.164 format
  phone = phone.replace(/\D/g, "");
  if (!phone.startsWith("1")) {
    phone = "1" + phone;
  }
  phone = "+" + phone;

  if (phone.length < 11 || phone.length > 15) {
    return { error: "Please enter a valid phone number." };
  }

  const code = await createOtp(db, phone);

  // TODO: Send OTP via WhatsApp Cloud API
  // For now, log it in dev mode
  console.log(`[DEV] OTP for ${phone}: ${code}`);

  return redirect(`/auth/whatsapp/verify?phone=${encodeURIComponent(phone)}`);
}

export default function WhatsAppLoginPage() {
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
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
            <WhatsAppIcon sx={{ color: "#25D366" }} />
            <Typography variant="h5" fontWeight={600}>
              WhatsApp Login
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            We'll send a verification code to your WhatsApp.
          </Typography>

          {actionData?.error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {actionData.error}
            </Alert>
          )}

          <Form method="post">
            <TextField
              name="phone"
              label="Phone Number"
              placeholder="(555) 123-4567"
              fullWidth
              required
              margin="normal"
              autoComplete="tel"
            />
            <Button
              type="submit"
              variant="contained"
              fullWidth
              size="large"
              sx={{ mt: 2 }}
            >
              Send Code
            </Button>
          </Form>

          <Box sx={{ mt: 3, textAlign: "center" }}>
            <Typography variant="body2" color="text.secondary">
              Or{" "}
              <Typography
                component={Link}
                to="/auth/login"
                variant="body2"
                color="primary"
                sx={{ textDecoration: "none" }}
              >
                sign in with email
              </Typography>
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
