# Skill Self Evolution

A Vercel-ready Next.js baseline for a skill evaluation and self-evolution platform.

This project is not a skill marketplace or download site. The first implementation targets a single trusted workspace with no login state. Multi-tenant behavior can be introduced later by expanding the explicit tenant boundary in `src/lib/app-config.ts`.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- ESLint
- npm

## Local Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

```bash
npm run lint
npm run build
```

## Deployment

Deploy the repository directly on Vercel. The generated project uses the default Next.js build output and does not require custom Vercel settings for the initial single-tenant version.
