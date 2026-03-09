import { redirect } from "react-router";
import type { Route } from "./+types/auth.logout";
import {
  getSessionId,
  destroySession,
  clearSessionCookie,
} from "~/lib/auth/session.server";

export async function loader({ request, context }: Route.LoaderArgs) {
  const db = context.cloudflare.env.DB;
  const sessionId = getSessionId(request);
  if (sessionId) {
    await destroySession(db, sessionId);
  }
  return redirect("/auth/login", {
    headers: { "Set-Cookie": clearSessionCookie() },
  });
}

export async function action({ request, context }: Route.ActionArgs) {
  const db = context.cloudflare.env.DB;
  const sessionId = getSessionId(request);
  if (sessionId) {
    await destroySession(db, sessionId);
  }
  return redirect("/auth/login", {
    headers: { "Set-Cookie": clearSessionCookie() },
  });
}
