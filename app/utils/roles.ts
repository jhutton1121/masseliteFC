import type { User } from "./types";

export function isAdmin(user: User): boolean {
  return user.role === "admin" || user.role === "superadmin";
}

export function isSuperadmin(user: User): boolean {
  return user.role === "superadmin";
}
