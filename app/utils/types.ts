export type UserRole = "superadmin" | "admin" | "user";

export type Position =
  | "GK"
  | "CB"
  | "LB"
  | "RB"
  | "CDM"
  | "CM"
  | "CAM"
  | "LM"
  | "RM"
  | "LW"
  | "RW"
  | "ST"
  | "CF";

export type GameStatus = "scheduled" | "in_progress" | "completed" | "cancelled";

export type RSVPStatus = "in" | "out" | "late";

export type Team = "A" | "B";

export type AwardType =
  | "mvp"
  | "rookie_of_year"
  | "most_dedicated"
  | "golden_boot"
  | "playmaker";

export interface User {
  id: string;
  name: string;
  email: string | null;
  whatsapp: string | null;
  avatar_key: string | null;
  role: UserRole;
  positions: Position[];
  notify_email: boolean;
  notify_whatsapp: boolean;
  notify_game_reminder: boolean;
  notify_schedule_change: boolean;
  notify_stats_posted: boolean;
  created_at: string;
  updated_at: string;
}

export interface Field {
  id: string;
  name: string;
  address: string;
  is_default: boolean;
}

export interface Game {
  id: string;
  field_id: string;
  date: string;
  time: string;
  status: GameStatus;
  max_players: number | null;
  notes: string | null;
  reminder_sent: boolean;
  teams_published: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface GameWithField extends Game {
  field_name: string;
  field_address: string;
}

export interface RSVP {
  game_id: string;
  user_id: string;
  status: RSVPStatus;
  no_show: boolean;
  created_at: string;
  updated_at: string;
}

export interface Match {
  id: string;
  game_id: string;
  label: string;
  created_at: string;
}

export interface GameStat {
  id: string;
  match_id: string;
  user_id: string;
  team: Team | null;
  goals: number;
  assists: number;
}

export interface GameTeam {
  match_id: string;
  user_id: string;
  team: Team;
}

export interface Season {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
}

export interface SeasonAward {
  id: string;
  season_id: string;
  user_id: string;
  award: AwardType;
}

export interface PlayerStats {
  user_id: string;
  name: string;
  total_goals: number;
  total_assists: number;
  games_played: number;
  goals_per_game: number;
  assists_per_game: number;
}
