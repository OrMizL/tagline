import type { GitHubCommit } from "./github";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-haiku-4-5-20251001";

const SYSTEM_PROMPT = `You are a changelog writer. Given a list of git commits, produce a clean markdown changelog section.

Rules:
- Group commits into these categories: Features, Bug Fixes, Improvements, Chores
- Omit categories that have no entries
- Skip noise commits: wip, typo fixes, console.log removal, merge commits, dependency bumps
- Write each entry in plain English — do not copy raw commit messages
- Use one concise line per commit, no fluff
- Return only the markdown changelog section, no preamble or explanation`;

type AnthropicTextBlock = {
  type: "text";
  text: string;
};

type AnthropicMessageResponse = {
  content: AnthropicTextBlock[];
};

type AnthropicErrorResponse = {
  error?: {
    type?: string;
    message?: string;
  };
};

function formatCommitList(commits: GitHubCommit[]): string {
  return commits
    .map(
      (commit) =>
        `- ${commit.sha.slice(0, 7)} | ${commit.date} | ${commit.author} | ${commit.message}`
    )
    .join("\n");
}

function extractText(response: AnthropicMessageResponse): string {
  const text = response.content
    .filter((block): block is AnthropicTextBlock => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();

  if (!text) {
    throw new Error("Anthropic API error: empty response content");
  }

  return text;
}

export async function generateChangelog(
  commits: GitHubCommit[],
  repoName: string,
  tagName: string
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }

  const today = new Date().toISOString().slice(0, 10);
  const userMessage = `Repository: ${repoName}
Tag: ${tagName}
Date: ${today}

Commits:
${formatCommitList(commits)}

Write a markdown changelog section for tag "${tagName}" dated ${today}.`;

  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  if (!response.ok) {
    let detail: string;

    try {
      const body = (await response.json()) as AnthropicErrorResponse;
      detail = body.error?.message ?? JSON.stringify(body);
    } catch {
      detail = await response.text();
    }

    throw new Error(`Anthropic API error (${response.status}): ${detail}`);
  }

  const body = (await response.json()) as AnthropicMessageResponse;
  return extractText(body);
}
