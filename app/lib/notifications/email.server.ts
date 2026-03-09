interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  apiKey: string;
}

/**
 * Send an email via the Resend API.
 */
export async function sendEmail({
  to,
  subject,
  html,
  apiKey,
}: SendEmailOptions): Promise<boolean> {
  try {
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
      console.error("Resend API error:", response.status, await response.text());
      return false;
    }

    return true;
  } catch (error) {
    console.error("Email send error:", error);
    return false;
  }
}

/**
 * Build email HTML for different notification types.
 */
export function buildEmailHtml(
  type: string,
  payload: Record<string, string>
): { subject: string; html: string } {
  switch (type) {
    case "game_created":
      return {
        subject: `New game scheduled at ${payload.fieldName}`,
        html: `
          <div style="font-family: 'DM Sans', sans-serif; max-width: 500px; margin: 0 auto; background: #111827; color: #E2E8F0; padding: 24px; border-radius: 8px;">
            <h2 style="color: #5B8DEF; margin-top: 0;">New Game Scheduled</h2>
            <p><strong>Field:</strong> ${payload.fieldName}</p>
            <p><strong>Date:</strong> ${payload.date} at ${payload.time}</p>
            <p><strong>Address:</strong> ${payload.fieldAddress}</p>
            ${payload.notes ? `<p><strong>Notes:</strong> ${payload.notes}</p>` : ""}
            <a href="${payload.appUrl}/games/${payload.gameId}" style="display: inline-block; background: #5B8DEF; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; margin-top: 12px;">RSVP Now</a>
          </div>
        `,
      };

    case "game_updated":
      return {
        subject: `Game updated: ${payload.fieldName}`,
        html: `
          <div style="font-family: 'DM Sans', sans-serif; max-width: 500px; margin: 0 auto; background: #111827; color: #E2E8F0; padding: 24px; border-radius: 8px;">
            <h2 style="color: #F59E0B; margin-top: 0;">Game Updated</h2>
            <p>A game has been updated. Please check the details.</p>
            <p><strong>Field:</strong> ${payload.fieldName}</p>
            <p><strong>Date:</strong> ${payload.date} at ${payload.time}</p>
            <a href="${payload.appUrl}/games/${payload.gameId}" style="display: inline-block; background: #5B8DEF; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; margin-top: 12px;">View Game</a>
          </div>
        `,
      };

    case "game_cancelled":
      return {
        subject: `Game cancelled: ${payload.fieldName} on ${payload.date}`,
        html: `
          <div style="font-family: 'DM Sans', sans-serif; max-width: 500px; margin: 0 auto; background: #111827; color: #E2E8F0; padding: 24px; border-radius: 8px;">
            <h2 style="color: #EF4444; margin-top: 0;">Game Cancelled</h2>
            <p>The game at <strong>${payload.fieldName}</strong> on <strong>${payload.date}</strong> has been cancelled.</p>
          </div>
        `,
      };

    case "game_reminder":
      return {
        subject: `Reminder: Game tomorrow at ${payload.fieldName}`,
        html: `
          <div style="font-family: 'DM Sans', sans-serif; max-width: 500px; margin: 0 auto; background: #111827; color: #E2E8F0; padding: 24px; border-radius: 8px;">
            <h2 style="color: #5B8DEF; margin-top: 0;">Game Reminder</h2>
            <p>You have a game coming up!</p>
            <p><strong>Field:</strong> ${payload.fieldName}</p>
            <p><strong>Date:</strong> ${payload.date} at ${payload.time}</p>
            <p><strong>Address:</strong> ${payload.fieldAddress}</p>
            <a href="${payload.appUrl}/games/${payload.gameId}" style="display: inline-block; background: #5B8DEF; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; margin-top: 12px;">View Game</a>
          </div>
        `,
      };

    case "stats_posted":
      return {
        subject: `Stats posted for ${payload.fieldName}`,
        html: `
          <div style="font-family: 'DM Sans', sans-serif; max-width: 500px; margin: 0 auto; background: #111827; color: #E2E8F0; padding: 24px; border-radius: 8px;">
            <h2 style="color: #10B981; margin-top: 0;">Stats Posted</h2>
            <p>Stats have been posted for the game at <strong>${payload.fieldName}</strong> on <strong>${payload.date}</strong>.</p>
            <a href="${payload.appUrl}/stats" style="display: inline-block; background: #5B8DEF; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; margin-top: 12px;">View Rankings</a>
          </div>
        `,
      };

    default:
      return { subject: "MassEliteFC Notification", html: "<p>You have a new notification.</p>" };
  }
}
