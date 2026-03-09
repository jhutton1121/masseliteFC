export type NotificationType =
  | "game_created"
  | "game_updated"
  | "game_cancelled"
  | "game_reminder"
  | "stats_posted";

export interface NotificationRecipient {
  userId: string;
  email: string | null;
  whatsapp: string | null;
  channels: ("email" | "whatsapp")[];
}

export interface NotificationJob {
  type: NotificationType;
  recipients: NotificationRecipient[];
  payload: Record<string, string>;
}
