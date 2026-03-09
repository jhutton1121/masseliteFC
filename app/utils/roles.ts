import type { User } from "./types";

export function isAdmin(user: User): boolean {
  return user.role === "admin" || user.role === "superadmin";
}

export function isSuperadmin(user: User): boolean {
  return user.role === "superadmin";
}

export function canWriteRecaps(user: User): boolean {
  return user.can_write_recaps || user.role === "admin" || user.role === "superadmin";
}
