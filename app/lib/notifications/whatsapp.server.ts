interface SendWhatsAppOptions {
  to: string; // E.164 format
  templateName: string;
  templateParams: string[];
  token: string;
  phoneId: string;
}

/**
 * Send a WhatsApp message via the Cloud API using pre-approved templates.
 *
 * Template names must be pre-approved in Meta Business Manager.
 * Expected templates:
 *   - game_scheduled: {{1}} field, {{2}} date, {{3}} time
 *   - game_updated: {{1}} field, {{2}} date, {{3}} time
 *   - game_cancelled: {{1}} field, {{2}} date
 *   - game_reminder: {{1}} field, {{2}} date, {{3}} time, {{4}} address
 *   - stats_posted: {{1}} field, {{2}} date
 */
export async function sendWhatsApp({
  to,
  templateName,
  templateParams,
  token,
  phoneId,
}: SendWhatsAppOptions): Promise<boolean> {
  try {
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
          to: to.replace("+", ""), // API expects without +
          type: "template",
          template: {
            name: templateName,
            language: { code: "en_US" },
            components: [
              {
                type: "body",
                parameters: templateParams.map((text) => ({
                  type: "text",
                  text,
                })),
              },
            ],
          },
        }),
      }
    );

    if (!response.ok) {
      console.error(
        "WhatsApp API error:",
        response.status,
        await response.text()
      );
      return false;
    }

    return true;
  } catch (error) {
    console.error("WhatsApp send error:", error);
    return false;
  }
}

/**
 * Map notification type to WhatsApp template name and params.
 */
export function buildWhatsAppTemplate(
  type: string,
  payload: Record<string, string>
): { templateName: string; params: string[] } {
  switch (type) {
    case "game_created":
      return {
        templateName: "game_scheduled",
        params: [payload.fieldName, payload.date, payload.time],
      };
    case "game_updated":
      return {
        templateName: "game_updated",
        params: [payload.fieldName, payload.date, payload.time],
      };
    case "game_cancelled":
      return {
        templateName: "game_cancelled",
        params: [payload.fieldName, payload.date],
      };
    case "game_reminder":
      return {
        templateName: "game_reminder",
        params: [
          payload.fieldName,
          payload.date,
          payload.time,
          payload.fieldAddress,
        ],
      };
    case "stats_posted":
      return {
        templateName: "stats_posted",
        params: [payload.fieldName, payload.date],
      };
    default:
      return { templateName: "generic_notification", params: [] };
  }
}
