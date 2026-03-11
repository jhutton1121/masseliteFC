/**
 * Queue Consumer Worker
 *
 * Receives notification jobs from the Cloudflare Queue and sends them
 * via Resend (email) and WhatsApp Cloud API.
 *
 * Deploy separately: cd queue-consumer && wrangler deploy
 */

interface Env {
  RESEND_API_KEY: string;
  WHATSAPP_TOKEN: string;
  WHATSAPP_PHONE_ID: string;
}

interface NotificationRecipient {
  userId: string;
  email: string | null;
  whatsapp: string | null;
  channels: ("email" | "whatsapp")[];
}

interface NotificationJob {
  type: string;
  recipients: NotificationRecipient[];
  payload: Record<string, string>;
}

export default {
  async queue(
    batch: MessageBatch<NotificationJob>,
    env: Env
  ): Promise<void> {
    for (const message of batch.messages) {
      const job = message.body;

      for (const recipient of job.recipients) {
        for (const channel of recipient.channels) {
          try {
            if (channel === "email" && recipient.email) {
              await sendEmail(recipient.email, job.type, job.payload, env.RESEND_API_KEY);
            } else if (channel === "whatsapp" && recipient.whatsapp) {
              await sendWhatsApp(
                recipient.whatsapp,
                job.type,
                job.payload,
                env.WHATSAPP_TOKEN,
                env.WHATSAPP_PHONE_ID
              );
            }
          } catch (error) {
            console.error(
              `Failed to send ${channel} to ${recipient.userId}:`,
              error
            );
          }
        }
      }

      message.ack();
    }
  },
};

async function sendEmail(
  to: string,
  type: string,
  payload: Record<string, string>,
  apiKey: string
): Promise<void> {
  const { subject, html } = buildEmailContent(type, payload);

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "MassEliteFC <notifications@masselitefc.com>",
      to,
      subject,
      html,
    }),
  });

  if (!response.ok) {
    throw new Error(`Resend error ${response.status}: ${await response.text()}`);
  }
}

async function sendWhatsApp(
  to: string,
  type: string,
  payload: Record<string, string>,
  token: string,
  phoneId: string
): Promise<void> {
  const { templateName, params } = buildWhatsAppContent(type, payload);

  const response = await fetch(
    `https://graph.facebook.com/v21.0/${phoneId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: to.replace("+", ""),
        type: "template",
        template: {
          name: templateName,
          language: { code: "en_US" },
          components: [
            {
              type: "body",
              parameters: params.map((text) => ({ type: "text", text })),
            },
          ],
        },
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`WhatsApp error ${response.status}: ${await response.text()}`);
  }
}

function buildEmailContent(
  type: string,
  payload: Record<string, string>
): { subject: string; html: string } {
  const wrap = (title: string, color: string, body: string) => `
    <div style="font-family:'DM Sans',sans-serif;max-width:500px;margin:0 auto;background:#111827;color:#E2E8F0;padding:24px;border-radius:8px;">
      <h2 style="color:${color};margin-top:0;">${title}</h2>
      ${body}
    </div>`;

  const btn = (url: string, label: string) =>
    `<a href="${url}" style="display:inline-block;background:#5B8DEF;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;margin-top:12px;">${label}</a>`;

  switch (type) {
    case "game_created":
      return {
        subject: `New game at ${payload.fieldName}`,
        html: wrap("New Game Scheduled", "#5B8DEF", `
          <p><strong>Field:</strong> ${payload.fieldName}</p>
          <p><strong>Date:</strong> ${payload.date} at ${payload.time}</p>
          <p><strong>Address:</strong> ${payload.fieldAddress}</p>
          ${payload.notes ? `<p><strong>Notes:</strong> ${payload.notes}</p>` : ""}
          ${btn(`${payload.appUrl}/games/${payload.gameId}`, "RSVP Now")}
        `),
      };
    case "game_cancelled":
      return {
        subject: `Game cancelled: ${payload.fieldName} on ${payload.date}`,
        html: wrap("Game Cancelled", "#EF4444", `
          <p>The game at <strong>${payload.fieldName}</strong> on <strong>${payload.date}</strong> has been cancelled.</p>
        `),
      };
    case "game_reminder":
      return {
        subject: `Reminder: Game tomorrow at ${payload.fieldName}`,
        html: wrap("Game Reminder", "#5B8DEF", `
          <p><strong>Field:</strong> ${payload.fieldName}</p>
          <p><strong>Date:</strong> ${payload.date} at ${payload.time}</p>
          <p><strong>Address:</strong> ${payload.fieldAddress}</p>
          ${btn(`${payload.appUrl}/games/${payload.gameId}`, "View Game")}
        `),
      };
    case "stats_posted":
      return {
        subject: `Stats posted for ${payload.fieldName}`,
        html: wrap("Stats Posted", "#10B981", `
          <p>Stats have been posted for the game at <strong>${payload.fieldName}</strong> on <strong>${payload.date}</strong>.</p>
          ${btn(`${payload.appUrl}/stats`, "View Rankings")}
        `),
      };
    case "waitlist_promoted":
      return {
        subject: `You're In! Spot opened at ${payload.fieldName}`,
        html: wrap("Waitlist Update: You're In!", "#10B981", `
          <p>Great news! A spot opened up and you've been promoted from the waitlist for the game at <strong>${payload.fieldName}</strong>.</p>
          <p><strong>Date:</strong> ${payload.date} at ${payload.time}</p>
          <p>If you can no longer make it, please update your RSVP so the next person on the waitlist can play.</p>
          ${btn(`${payload.appUrl}/games/${payload.gameId}`, "View Game")}
        `),
      };
    default:
      return {
        subject: `Game update: ${payload.fieldName}`,
        html: wrap("Game Updated", "#F59E0B", `
          <p><strong>Field:</strong> ${payload.fieldName}</p>
          <p><strong>Date:</strong> ${payload.date} at ${payload.time}</p>
          ${btn(`${payload.appUrl}/games/${payload.gameId}`, "View Game")}
        `),
      };
  }
}

function buildWhatsAppContent(
  type: string,
  payload: Record<string, string>
): { templateName: string; params: string[] } {
  switch (type) {
    case "game_created":
      return { templateName: "game_scheduled", params: [payload.fieldName, payload.date, payload.time] };
    case "game_cancelled":
      return { templateName: "game_cancelled", params: [payload.fieldName, payload.date] };
    case "game_reminder":
      return { templateName: "game_reminder", params: [payload.fieldName, payload.date, payload.time, payload.fieldAddress] };
    case "stats_posted":
      return { templateName: "stats_posted", params: [payload.fieldName, payload.date] };
    case "waitlist_promoted":
      // Since there isn't a pre-defined Meta template for waitlist, using `game_updated` with specific parameters for now
      // Or if there is a real template `waitlist_promoted`, then we would use that.
      // Usually users will have to create it. Let me just use `game_updated` template but with clear waitlist params.
      return { templateName: "game_updated", params: [payload.fieldName, payload.date, payload.time] };
    default:
      return { templateName: "game_updated", params: [payload.fieldName, payload.date, payload.time] };
  }
}
