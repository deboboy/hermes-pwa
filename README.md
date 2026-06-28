# Hermes PWA

I've had fun using a PWA as one of the channels to message with Hermes Agent.  But it was a manually built web app with components that didn't natuarally compose into a nice mobile web experience.  

Then shadcn dropped a post on X with this philosophical take: "MessageScroller handles the parts that are easy to get wrong: Anchored turns. Streamed replies. Saved thread restore. Prepended History. Jump-to-message. Scroll Controls. Visibility Tracking. It owns the behavior. You bring the data, transport, persistence, or model state."

This seemed like a perfect fit for Hermes Agent.  So that's what this repo is for; an experiment to validate that assumption. It's a reference implementation of the newly released [shadcn/ui](https://ui.shadcn.com) chat components, built as a PWA frontend for the Hermes agent backend running on a VPS.

## Stack

- **Next.js 16** + **TypeScript** + **Tailwind CSS**
- **shadcn/ui** chat components:
  - `MessageScroller`
  - `Message`
  - `Bubble`
  - `Attachment`
  - `Marker`
- **PWA** via hand-written service worker (`public/sw.js`): offline caching, web manifest, installable standalone app
- **Native push notifications** via Web Push + VAPID (pattern ported from agent-phone)
- **Streaming chat UI** with auto-scroll, Enter-to-send, loading state, markers, and attachment support
- **API proxy route** at `src/app/api/chat/route.ts` that fans out to `HERMES_API_URL` and streams the response back to the UI

## Setup for Developers

Complete checklist for cloning this repo and running the reference implementation locally.

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Edit `.env.local`:

| Variable | Required for | Notes |
|----------|--------------|-------|
| `HERMES_API_URL` | Chat | Hermes backend base URL (e.g. `https://your-vps.example.com`) |
| `HERMES_API_KEY` | Chat (optional) | If your backend expects an API key |
| `VAPID_PUBLIC_KEY` | Push subscribe | From `npm run vapid:generate` |
| `VAPID_PRIVATE_KEY` | Push send | Server-only secret |
| `VAPID_SUBJECT` | Push send | e.g. `mailto:you@example.com` |
| `PUSH_WEBHOOK_SECRET` | Push webhook | Secret for `POST /api/push/send` from Hermes backend |

Generate VAPID keys:

```bash
npm run vapid:generate
```

Copy the printed values into `.env.local`.

### 3. Run the chat UI (development)

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The chat UI and shadcn components work in dev; styling loads via the registered service worker.

### 4. Test push notifications

Push requires **HTTPS**, a **registered service worker**, and VAPID env vars. For local testing, use a production build:

```bash
npm run build
npm run start
```

Then open the app over HTTPS (deployed URL or a tunnel like ngrok). On **iOS**, you must **Add to Home Screen** before notifications can be enabled.

In the app:

1. Tap **Enable notifications** (below the header)
2. Tap **Send test** to verify delivery
3. Copy your `clientId` from DevTools → Application → Local Storage → `hermes-pwa-client-id` (needed for webhook testing)

### 5. Add PWA icons (recommended)

Add these files for install prompts and notification icons:

- `public/icon-192.png`
- `public/icon-512.png`

They are referenced by `manifest.json` and `public/sw.js`.

### 6. Production deploy

Deploy anywhere Node.js can write to `.data/` (subscription store), or replace `src/lib/push-subscriptions-store.ts` with your own DB. Set all env vars from step 2 in your hosting environment.

```bash
npm run build
npm run start
```

See [Push Notifications](#push-notifications) for webhook integration and API routes.

## Production Build

```bash
npm run build
npm run start
```

Push notifications require HTTPS and a registered service worker. Test on a production build or deployed environment — iOS also requires **Add to Home Screen** before push will work.

## Connecting to Hermes Backend

The PWA does not embed credentials. Set these in `.env.local`:

```
HERMES_API_URL=https://your-hermes-backend.example.com
HERMES_API_KEY=your-api-key
```

The `/api/chat` route proxies requests to the backend and returns a streaming response.

## Push Notifications

Each browser install gets a stable `clientId` (stored in `localStorage` under `hermes-pwa-client-id`). Subscriptions are persisted in `.data/push-subscriptions.json` on the server — swap this for Turso, Postgres, or your Hermes backend in production.

### Enable flow

1. Deploy with VAPID env vars set
2. Open the PWA from the Home Screen (required on iOS)
3. Tap **Enable notifications** in the chat UI
4. Use **Send test** to verify delivery

### Webhook from Hermes backend

When an async job completes, POST to `/api/push/send`:

```bash
curl -X POST https://your-app.example.com/api/push/send \
  -H "Authorization: Bearer $PUSH_WEBHOOK_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "<from localStorage hermes-pwa-client-id>",
    "title": "Hermes",
    "body": "Your research is ready",
    "url": "/",
    "tag": "job-123"
  }'
```

### API routes

| Route | Auth | Purpose |
|-------|------|---------|
| `GET /api/push/vapid-public-key` | — | VAPID public key for subscribe |
| `POST /api/push/subscribe` | `X-Client-Id` header | Save push subscription |
| `DELETE /api/push/subscribe` | `X-Client-Id` header | Remove subscription |
| `POST /api/push/test` | `X-Client-Id` header | Send test notification to this device |
| `POST /api/push/send` | `PUSH_WEBHOOK_SECRET` | Send from Hermes backend / cron |

Add `public/icon-192.png` and `public/icon-512.png` for install and notification icons (referenced by `manifest.json` and the service worker).

## Deploy

Deploy anywhere that runs Node.js with a writable `.data/` directory (or replace the subscription store). For Vercel:

```bash
vercel deploy
```

Make sure `HERMES_API_URL`, VAPID keys, and `PUSH_WEBHOOK_SECRET` are set in your hosting environment.
