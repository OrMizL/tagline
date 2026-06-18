# Tagline

AI-powered changelog generator. Paste a GitHub repo URL, pick two tags, and get a clean human-readable changelog in seconds.

## How it works

1. Enter a GitHub repository URL
2. Select a **from** and **to** tag (auto-loaded from the repo, or type manually)
3. Click **Generate** — Tagline fetches the commits between the tags and uses Claude to write a formatted markdown changelog
4. Copy the result with one click

## Setup

```bash
npm install
```

Create a `.env.local` file:

```
ANTHROPIC_API_KEY=your_anthropic_api_key
```

A GitHub token is optional but recommended to avoid rate limits — it can be entered directly in the UI.

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Stack

- [Next.js](https://nextjs.org) 14 (App Router)
- [Claude](https://anthropic.com) via the Anthropic API
- [GitHub REST API](https://docs.github.com/en/rest)
- Tailwind CSS
