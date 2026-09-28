This is a [Next.js](https://nextjs.org/) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Getting Started

Use Node.js 22 for this project. The current Google authentication dependencies
use `SlowBuffer`, which was removed in Node.js 25.

With nvm installed, select the version in `.nvmrc` and install dependencies:

```bash
nvm install
nvm use
npm ci
```

Set `NEXT_PUBLIC_BASE_URL=http://localhost:3000` in your local `.env.local`,
along with the Google Calendar and Supabase credentials. The Google OAuth client
must allow `http://localhost:3000/api/auth/callback/calendar` as a redirect URI.

Then run the development server:

The `dev`, `build` and `start` commands select Node 22 automatically when it is
active in your shell, installed through Homebrew (`node@22`), or installed locally
at `~/.local/share/coco/node22/bin/node`. If it is unavailable, they stop with a
setup instruction before loading the app.

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

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/basic-features/font-optimization) to automatically optimize and load Inter, a custom Google Font.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js/) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/deployment) for more details.
