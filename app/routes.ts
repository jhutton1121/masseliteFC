import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  // Dashboard
  index("routes/home.tsx"),

  // Auth
  route("auth/login", "routes/auth.login.tsx"),
  route("auth/register", "routes/auth.register.tsx"),
  route("auth/whatsapp", "routes/auth.whatsapp.tsx"),
  route("auth/whatsapp/verify", "routes/auth.whatsapp.verify.tsx"),
  route("auth/logout", "routes/auth.logout.tsx"),

  // Games
  route("games", "routes/games.tsx"),
  route("games/new", "routes/games.new.tsx"),
  route("games/:id", "routes/games.$id.tsx"),
  route("games/:id/rsvp", "routes/games.$id.rsvp.tsx"),

  // Stats
  route("stats", "routes/stats.tsx"),
  route("stats/awards", "routes/stats.awards.tsx"),

  // Profile
  route("profile", "routes/profile.tsx"),

  // API
  route("api/avatar/*", "routes/api.avatar.$.tsx"),

  // Admin
  route("admin/users", "routes/admin.users.tsx"),
  route("admin/fields", "routes/admin.fields.tsx"),
  route("admin/awards", "routes/admin.awards.tsx"),
  route("admin/games/:id/stats", "routes/admin.games.$id.stats.tsx"),
  route("admin/games/:id/noshow", "routes/admin.games.$id.noshow.tsx"),
  route("admin/games/:id/teams", "routes/admin.games.$id.teams.tsx"),
  route("admin/games/:id/edit", "routes/admin.games.$id.edit.tsx"),
] satisfies RouteConfig;
