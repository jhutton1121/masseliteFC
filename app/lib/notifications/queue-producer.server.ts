import type { NotificationJob, NotificationType, NotificationRecipient } from "./types";

/**
 * Enqueue a notification job to the Cloudflare Queue.
 * The queue consumer Worker will process these and send via Resend/WhatsApp.
 */
export async function enqueueNotification(
  queue: Queue,
  job: NotificationJob
): Promise<void> {
  await queue.send(job);
}

/**
 * Fetch eligible recipients for a notification type from the database.
 * Filters by user notification preferences.
 */
export async function getNotificationRecipients(
  db: D1Database,
  type: NotificationType,
  excludeUserId?: string
): Promise<NotificationRecipient[]> {
  // Map notification type to the user preference column
  const prefColumn =
    type === "game_created" || type === "game_updated" || type === "game_cancelled"
      ? "notify_schedule_change"
      : type === "game_reminder"
        ? "notify_game_reminder"
        : "notify_stats_posted";

  let query = `
    SELECT id, email, whatsapp, notify_email, notify_whatsapp
    FROM users
    WHERE ${prefColumn} = 1
  `;
  const binds: string[] = [];

  if (excludeUserId) {
    query += " AND id != ?";
    binds.push(excludeUserId);
  }

  const stmt = binds.length > 0
    ? db.prepare(query).bind(...binds)
    : db.prepare(query);

  const result = await stmt.all();

  return result.results
    .map((row) => {
      const channels: ("email" | "whatsapp")[] = [];
      if (row.notify_email && row.email) channels.push("email");
      if (row.notify_whatsapp && row.whatsapp) channels.push("whatsapp");
      return {
        userId: row.id as string,
        email: row.email as string | null,
        whatsapp: row.whatsapp as string | null,
        channels,
      };
    })
    .filter((r) => r.channels.length > 0);
}
