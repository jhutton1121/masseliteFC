# MassEliteFC

Pickup soccer scheduling and performance analytics for [masselitefc.com](https://masselitefc.com).

## Key Features

- **Game Scheduling** — Admins create games with field, date, time, and player cap. Players RSVP as In / Late / Out.
- **Guest Players** — Members can bring extra players (up to 10) with optional names, included in all headcounts.
- **Team Builder** — Randomized or rating-based team balancing across multiple matches per game day. Drag-and-drop manual adjustments.
- **Stats Tracking** — Per-match goals and assists, season leaderboards, per-game averages.
- **Post-Game Recaps** — Designated recap writers can publish game writeups visible on the game detail page.
- **Season Awards** — MVP, Golden Boot, Playmaker, Most Dedicated, Rookie of the Year.
- **Notifications** — Email (Resend) and WhatsApp Cloud API for game creation, updates, cancellations, and reminders.
- **Dual Auth** — Email + password or WhatsApp OTP login, same user record.
- **Profile Management** — Avatar upload, position selection, notification preferences, password change.
- **Admin Panel** — User role management, field management, no-show tracking, reliability scores, recap writer permissions.

## Current State

- Core app is live at [masselitefc.com](https://masselitefc.com)
- Auth, games, RSVPs, team builder, stats, awards, and profiles are all functional
- Notification queue consumer is deployed but email/WhatsApp sending requires API keys to be configured
- Max user capacity ~1000

## Tech Stack

- **Framework**: React Router v7 (Remix successor) — server-rendered on Cloudflare Workers
- **UI**: Material UI (MUI) — dark theme, DM Sans + JetBrains Mono fonts
- **Database**: Cloudflare D1 (serverless SQLite)
- **Storage**: Cloudflare R2 (avatar images)
- **Notifications**: Cloudflare Queues → Resend (email) + WhatsApp Cloud API
- **Auth**: bcryptjs (passwords) + WhatsApp OTP
- **Deploy**: GitHub Actions → Wrangler (auto-deploy on push to main)

## Local Development Setup

### Prerequisites

- Node.js 22+
- npm

### Getting Started

```bash
git clone https://github.com/jhutton1121/masseliteFC.git
cd masseliteFC
npm install
npm run db:migrate    # creates local D1 database and applies all migrations
npm run dev           # starts dev server at http://localhost:5173
```

The default superadmin login is `jhutton1121@gmail.com` / `changeme123` (seeded by the migrations).

### No API keys needed for local dev

Wrangler automatically emulates D1, R2, and Queues locally. The only things that won't work without secrets are outbound notifications (email/WhatsApp), which fail silently.

### Useful Commands

| Command | Description |
|---|---|
| `npm run dev` | Start local dev server |
| `npm run build` | Production build |
| `npm run typecheck` | Run TypeScript type checking |
| `npm run db:migrate` | Apply migrations to local D1 |
| `npm run db:migrate:prod` | Apply migrations to production D1 (requires Cloudflare auth) |
| `npm run deploy` | Build and deploy to Cloudflare (requires Cloudflare auth) |

### Project Structure

```
app/
  routes/          # React Router route files (loader + action + component)
  components/      # Shared React components (AppShell, etc.)
  lib/             # Server-side logic
    auth/          # Session, password, OTP handling
    notifications/ # Queue producer and notification types
    team-builder/  # Team balancing algorithms
    storage/       # R2 avatar upload
  utils/           # Shared client+server utilities (types, roles, constants)
migrations/        # D1 SQL migration files (applied in order)
queue-consumer/    # Separate Worker for processing notification queue
workers/           # Cloudflare Workers entry point
```
