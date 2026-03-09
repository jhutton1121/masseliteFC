import type { Position } from "./types";

export const POSITIONS: { value: Position; label: string }[] = [
  { value: "GK", label: "Goalkeeper" },
  { value: "CB", label: "Center Back" },
  { value: "LB", label: "Left Back" },
  { value: "RB", label: "Right Back" },
  { value: "CDM", label: "Defensive Mid" },
  { value: "CM", label: "Center Mid" },
  { value: "CAM", label: "Attacking Mid" },
  { value: "LM", label: "Left Mid" },
  { value: "RM", label: "Right Mid" },
  { value: "LW", label: "Left Wing" },
  { value: "RW", label: "Right Wing" },
  { value: "CF", label: "Center Forward" },
  { value: "ST", label: "Striker" },
];

export const AWARD_LABELS: Record<string, string> = {
  mvp: "MVP",
  rookie_of_year: "Rookie of the Year",
  most_dedicated: "Most Dedicated",
  golden_boot: "Golden Boot",
  playmaker: "Playmaker",
};

export const GAME_STATUS_LABELS: Record<string, string> = {
  scheduled: "Scheduled",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
};
