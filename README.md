# Hermes PWA

Reference implementation of the newly released [shadcn/ui](https://ui.shadcn.com) chat components, built as a PWA frontend for the Hermes agent backend running on a VPS.

## Stack

- **Next.js 16** + **TypeScript** + **Tailwind CSS**
- **shadcn/ui** chat components:
  - `MessageScroller`
  - `Message`
  - `Bubble`
  - `Attachment`
  - `Marker`
- **PWA** via `@ducanh2912/next-pwa` (service worker, web manifest, theme-color)
- **Streaming chat UI** with auto-scroll, Enter-to-send, loading state, markers, and attachment support
- **API proxy route** at `src/app/api/chat/route.ts` that fans out to `NEXT_PUBLIC_HERMES_API_URL` and streams the response back to the UI

## Getting Started

```bash
npm install
```

Create a local env file:

```bash
cp .env.example .env.local
```

Edit `.env.local` and point `NEXT_PUBLIC_HERMES_API_URL` at your Hermes backend on the VPS.

Run the dev server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Production Build

```bash
npm run build --webpack
npm run start
```

## Connecting to Hermes Backend

The PWA does not embed credentials. Set these in `.env.local`:

```
NEXT_PUBLIC_HERMES_API_URL=https://your-hermes-backend.example.com
HERMES_API_KEY=your-api-key
```

The `/api/chat` route proxies requests to the backend and returns a streaming response.

## Deploy

Deploy anywhere that runs Node.js. For Vercel:

```bash
vercel deploy
```

Make sure `NEXT_PUBLIC_HERMES_API_URL` is set in your hosting environment.
