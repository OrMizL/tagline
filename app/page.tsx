"use client";

import { useRef, useState, type FormEvent } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import type { GitHubTag } from "@/lib/github";

type ParsedRepo = {
  owner: string;
  repo: string;
};

type GenerateResponse =
  | { changelog: string }
  | { message: string }
  | { error: string };

type TagsResponse = { tags: GitHubTag[] } | { error: string };

function parseRepoUrl(input: string): ParsedRepo | null {
  const match = input
    .trim()
    .match(/github\.com\/([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/i);

  if (!match) {
    return null;
  }

  return { owner: match[1], repo: match[2] };
}

const markdownComponents: Components = {
  h1: ({ children }) => (
    <h2 className="mb-3 mt-8 text-lg font-bold tracking-tight text-stone-100 first:mt-0">
      {children}
    </h2>
  ),
  h2: ({ children }) => (
    <h3 className="mb-2 mt-7 text-xs font-bold uppercase tracking-[0.2em] text-amber-400 first:mt-0">
      {children}
    </h3>
  ),
  h3: ({ children }) => (
    <h4 className="mb-2 mt-4 text-sm font-semibold text-stone-200">
      {children}
    </h4>
  ),
  p: ({ children }) => (
    <p className="mb-3 text-sm leading-relaxed text-stone-400">{children}</p>
  ),
  ul: ({ children }) => <ul className="mb-4 space-y-1.5">{children}</ul>,
  ol: ({ children }) => <ol className="mb-4 space-y-1.5">{children}</ol>,
  li: ({ children }) => (
    <li className="flex gap-2 text-sm leading-relaxed text-stone-400">
      <span className="mt-0.5 text-amber-400">&rsaquo;</span>
      <span>{children}</span>
    </li>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-stone-200">{children}</strong>
  ),
  code: ({ children }) => (
    <code className="rounded bg-stone-800 px-1.5 py-0.5 font-mono text-[0.8em] text-amber-300">
      {children}
    </code>
  ),
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-amber-400 underline underline-offset-2 hover:text-amber-300"
    >
      {children}
    </a>
  ),
};

export default function Home() {
  const [repoUrl, setRepoUrl] = useState("");
  const [fromTag, setFromTag] = useState("");
  const [toTag, setToTag] = useState("");
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [changelog, setChangelog] = useState<string | null>(null);
  const [tags, setTags] = useState<GitHubTag[]>([]);
  const [tagsLoading, setTagsLoading] = useState(false);
  const [tagsError, setTagsError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const tagsRequestRef = useRef<string | null>(null);

  async function loadTags() {
    const parsed = parseRepoUrl(repoUrl);

    if (!parsed) {
      return;
    }

    if (tags.length > 0) {
      return;
    }

    const requestKey = `${parsed.owner}/${parsed.repo}`;
    tagsRequestRef.current = requestKey;

    setTagsLoading(true);
    setTagsError(null);

    try {
      const params = new URLSearchParams({
        owner: parsed.owner,
        repo: parsed.repo,
      });

      const response = await fetch(`/api/tags?${params.toString()}`, {
        headers: token ? { "x-github-token": token } : undefined,
      });

      const data = (await response.json()) as TagsResponse;

      if (tagsRequestRef.current !== requestKey) {
        return;
      }

      if (!response.ok || "error" in data) {
        setTags([]);
        setTagsError("error" in data ? data.error : "Failed to load tags");
        return;
      }

      setTags(data.tags);
      setFromTag((prev) =>
        data.tags.some((tag) => tag.name === prev) ? prev : ""
      );
      setToTag((prev) =>
        data.tags.some((tag) => tag.name === prev) ? prev : ""
      );
    } catch (err) {
      if (tagsRequestRef.current !== requestKey) {
        return;
      }

      setTags([]);
      setTagsError(err instanceof Error ? err.message : "Failed to load tags");
    } finally {
      if (tagsRequestRef.current === requestKey) {
        setTagsLoading(false);
      }
    }
  }

  async function handleCopy() {
    if (!changelog) {
      return;
    }

    try {
      await navigator.clipboard.writeText(changelog);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be denied (e.g. insecure context, permissions) — fail silently.
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading) {
      return;
    }

    setError(null);
    setInfo(null);
    setChangelog(null);
    setCopied(false);

    const parsed = parseRepoUrl(repoUrl);

    if (!parsed) {
      setError(
        "Enter a valid GitHub repo URL, e.g. https://github.com/vercel/next.js"
      );
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner: parsed.owner,
          repo: parsed.repo,
          fromTag,
          toTag,
          token: token || undefined,
        }),
      });

      const data = (await response.json()) as GenerateResponse;

      if ("error" in data) {
        setError(data.error);
        return;
      }

      if (!response.ok) {
        setError("Something went wrong");
        return;
      }

      if ("message" in data) {
        setInfo(data.message);
        return;
      }

      setChangelog(data.changelog);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center px-6 py-20 sm:py-28">
      <div className="w-full max-w-xl">
        <header className="mb-12 animate-fade-up">
          <h1 className="font-mono text-4xl font-bold tracking-tight text-stone-100 sm:text-5xl">
            Tagline
            <span className="cursor-blink text-amber-400">_</span>
          </h1>
          <p className="mt-3 text-sm text-stone-500">
            <span className="text-amber-400">&gt;</span> Turn your commits
            into a changelog
          </p>
        </header>

        <form
          onSubmit={handleSubmit}
          className="animate-fade-up rounded-lg border border-stone-800 bg-stone-900/60 p-6 [animation-delay:100ms]"
        >
          <fieldset disabled={loading} className="space-y-5">
            <div>
              <label
                htmlFor="repoUrl"
                className="mb-1.5 block text-xs font-medium uppercase tracking-[0.15em] text-stone-500"
              >
                Repository
              </label>
              <input
                id="repoUrl"
                type="text"
                required
                value={repoUrl}
                onChange={(e) => {
                  setRepoUrl(e.target.value);
                  setTags([]);
                  setTagsError(null);
                }}
                onBlur={loadTags}
                placeholder="https://github.com/vercel/next.js"
                className="w-full rounded-md border border-stone-700 bg-stone-950 px-3 py-2.5 font-mono text-sm text-stone-100 placeholder:text-stone-600 focus:border-amber-400/60 focus:outline-none focus:ring-1 focus:ring-amber-400/30"
              />
              {tagsLoading && (
                <p className="mt-1.5 flex items-center gap-1.5 text-xs text-stone-600">
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-stone-700 border-t-amber-400" />
                  Loading tags
                </p>
              )}
              {tagsError && !tagsLoading && (
                <p className="mt-1.5 text-xs text-stone-600">
                  Tag list unavailable &mdash; enter tags manually
                </p>
              )}
            </div>

            <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3">
              <div>
                <label
                  htmlFor="fromTag"
                  className="mb-1.5 block text-xs font-medium uppercase tracking-[0.15em] text-stone-500"
                >
                  From tag
                </label>
                {tags.length > 0 ? (
                  <select
                    id="fromTag"
                    required
                    value={fromTag}
                    onChange={(e) => setFromTag(e.target.value)}
                    className="w-full rounded-md border border-stone-700 bg-stone-950 px-3 py-2.5 font-mono text-sm text-stone-100 focus:border-amber-400/60 focus:outline-none focus:ring-1 focus:ring-amber-400/30"
                  >
                    <option value="" disabled>
                      Select a tag
                    </option>
                    {tags.map((tag) => (
                      <option key={tag.name} value={tag.name}>
                        {tag.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    id="fromTag"
                    type="text"
                    required
                    value={fromTag}
                    onChange={(e) => setFromTag(e.target.value)}
                    placeholder="v18.0.0"
                    className="w-full rounded-md border border-stone-700 bg-stone-950 px-3 py-2.5 font-mono text-sm text-stone-100 placeholder:text-stone-600 focus:border-amber-400/60 focus:outline-none focus:ring-1 focus:ring-amber-400/30"
                  />
                )}
              </div>
              <span className="pb-2.5 text-stone-600">&rarr;</span>
              <div>
                <label
                  htmlFor="toTag"
                  className="mb-1.5 block text-xs font-medium uppercase tracking-[0.15em] text-stone-500"
                >
                  To tag
                </label>
                {tags.length > 0 ? (
                  <select
                    id="toTag"
                    required
                    value={toTag}
                    onChange={(e) => setToTag(e.target.value)}
                    className="w-full rounded-md border border-stone-700 bg-stone-950 px-3 py-2.5 font-mono text-sm text-stone-100 focus:border-amber-400/60 focus:outline-none focus:ring-1 focus:ring-amber-400/30"
                  >
                    <option value="" disabled>
                      Select a tag
                    </option>
                    {tags.map((tag) => (
                      <option key={tag.name} value={tag.name}>
                        {tag.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    id="toTag"
                    type="text"
                    required
                    value={toTag}
                    onChange={(e) => setToTag(e.target.value)}
                    placeholder="v18.1.0"
                    className="w-full rounded-md border border-stone-700 bg-stone-950 px-3 py-2.5 font-mono text-sm text-stone-100 placeholder:text-stone-600 focus:border-amber-400/60 focus:outline-none focus:ring-1 focus:ring-amber-400/30"
                  />
                )}
              </div>
            </div>

            <div>
              <label
                htmlFor="token"
                className="mb-1.5 block text-xs font-medium uppercase tracking-[0.15em] text-stone-500"
              >
                GitHub token <span className="text-stone-600">(optional)</span>
              </label>
              <input
                id="token"
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="ghp_••••••••••••••••"
                className="w-full rounded-md border border-stone-700 bg-stone-950 px-3 py-2.5 font-mono text-sm text-stone-100 placeholder:text-stone-600 focus:border-amber-400/60 focus:outline-none focus:ring-1 focus:ring-amber-400/30"
              />
              <p className="mt-1.5 text-xs text-stone-600">
                Required for private repos
              </p>
            </div>

            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-md bg-amber-400 px-4 py-2.5 text-sm font-semibold text-stone-950 transition-colors hover:bg-amber-300 disabled:cursor-not-allowed disabled:bg-stone-700 disabled:text-stone-400"
            >
              {loading ? (
                <>
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-stone-500 border-t-stone-950" />
                  Generating
                </>
              ) : (
                "Generate"
              )}
            </button>
          </fieldset>
        </form>

        {error && (
          <div className="mt-6 animate-fade-up rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {info && (
          <div className="mt-6 animate-fade-up rounded-lg border border-stone-800 bg-stone-900/60 px-4 py-3 text-sm text-stone-400">
            {info}
          </div>
        )}

        {changelog && (
          <div className="mt-6 animate-fade-up rounded-lg border border-stone-800 bg-stone-900/60 p-6">
            <div className="mb-4 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-stone-500">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                Changelog
              </div>
              <button
                type="button"
                onClick={handleCopy}
                className="rounded-md border border-stone-700 px-2.5 py-1 text-xs font-medium text-stone-400 transition-colors hover:border-stone-600 hover:text-stone-200"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            <ReactMarkdown components={markdownComponents}>
              {changelog}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </main>
  );
}
