import { createRequestHandler } from "react-router";

declare module "react-router" {
  export interface AppLoadContext {
    cloudflare: {
      env: Env;
      ctx: ExecutionContext;
    };
  }
}

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE
);

export default {
  async fetch(request, env, ctx) {
    return requestHandler(request, {
      cloudflare: { env, ctx },
    });
  },

  /**
   * Cron trigger: runs hourly, finds games tomorrow that haven't had reminders sent,
   * enqueues reminder notifications, and marks them as sent.
   */
  async scheduled(_event, env, _ctx) {
    const db = env.DB;
    const queue = env.NOTIFICATION_QUEUE;

    // Get tomorrow's date in YYYY-MM-DD format (UTC)
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];

    const games = await db
      .prepare(
        `SELECT g.id, g.date, g.time, f.name as field_name, f.address as field_address
         FROM games g
         JOIN fields f ON g.field_id = f.id
         WHERE g.date = ? AND g.status = 'scheduled' AND g.reminder_sent = 0`
      )
      .bind(tomorrowStr)
      .all();

    for (const game of games.results) {
      // Get users who want game reminders
      const users = await db
        .prepare(
          `SELECT id, email, whatsapp, notify_email, notify_whatsapp
           FROM users WHERE notify_game_reminder = 1`
        )
        .all();

      const recipients = users.results
        .map((u) => {
          const channels: ("email" | "whatsapp")[] = [];
          if (u.notify_email && u.email) channels.push("email");
          if (u.notify_whatsapp && u.whatsapp) channels.push("whatsapp");
          return {
            userId: u.id as string,
            email: u.email as string | null,
            whatsapp: u.whatsapp as string | null,
            channels,
          };
        })
        .filter((r) => r.channels.length > 0);

      if (recipients.length > 0) {
        await queue.send({
          type: "game_reminder",
          recipients,
          payload: {
            gameId: game.id as string,
            fieldName: game.field_name as string,
            fieldAddress: game.field_address as string,
            date: game.date as string,
            time: game.time as string,
            appUrl: env.APP_URL,
          },
        });
      }

      // Mark reminder as sent
      await db
        .prepare("UPDATE games SET reminder_sent = 1 WHERE id = ?")
        .bind(game.id)
        .run();
    }
  },
} satisfies ExportedHandler<Env>;
