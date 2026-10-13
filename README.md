This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## PWA and Web Push

1. Apply `database/schema.sql` to the Neon database. This creates the
   `push_subscriptions` and `push_notification_deliveries` tables.
2. Generate VAPID keys with `npx web-push generate-vapid-keys` and configure:
   - `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (public key)
   - `VAPID_PRIVATE_KEY` (server-only private key; do not expose it to the browser)
   - `VAPID_SUBJECT` (for example, `mailto:admin@example.com`)
   - `CRON_SECRET` (a long random secret used by the scheduled sender)
3. Deploy over HTTPS. iPhone notifications require iOS 16.4 or later, Safari,
   and opening the app from its Home Screen icon. The manifest and service worker
   are served from `/manifest.webmanifest` and `/sw.js`.
4. Configure a trusted scheduler to send a daily `POST /api/push/send` request
   with a bearer authorization token whose value is `CRON_SECRET`. The job uses Japan Standard Time,
   sends the today/tomorrow reminder once per friend and day, and only sends for
   birthday profiles that allow birthday notifications and are connected to
   the recipient by a friendship.

The subscription endpoint is available to signed-in users at
`/api/push/subscription`. Browser permission can only be requested by a user
gesture. Turning notifications off removes the server subscription and
unsubscribes the browser PushSubscription; a browser-level permission already
granted must be revoked separately in browser or device settings.

Birthday card messages are limited to 1,000 characters. Apply the updated
`database/schema.sql` to add the matching database constraint; the constraint
is added `NOT VALID` so older cards remain readable while new writes are checked.

You can start editing the page by modifying `app/page.js`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
