import type { Route } from "./+types/api.avatar.$";

/**
 * Serves avatar images from R2.
 * GET /api/avatar/avatars/userId.jpg
 */
export async function loader({ context, params }: Route.LoaderArgs) {
  const key = params["*"];
  if (!key) {
    return new Response("Not found", { status: 404 });
  }

  const object = await context.cloudflare.env.AVATARS.get(key);
  if (!object) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(object.body, {
    headers: {
      "Content-Type": object.httpMetadata?.contentType || "image/jpeg",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
