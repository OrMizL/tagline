const GITHUB_API_BASE = "https://api.github.com";

export type GitHubTag = {
  name: string;
  sha: string;
};

export type GitHubCommit = {
  sha: string;
  message: string;
  author: string;
  date: string;
};

type GitHubTagResponse = {
  name: string;
  commit: {
    sha: string;
  };
};

type GitHubCommitResponse = {
  sha: string;
  commit: {
    message: string;
    author: {
      name: string;
      date: string;
    } | null;
  };
  author: {
    login: string;
  } | null;
};

type GitHubCompareResponse = {
  total_commits: number;
  commits: GitHubCommitResponse[];
  base_commit: {
    sha: string;
  };
};

function githubHeaders(token?: string): HeadersInit {
  const headers: HeadersInit = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

async function githubFetch(url: string, token?: string): Promise<Response> {
  const response = await fetch(url, { headers: githubHeaders(token) });

  if (!response.ok) {
    let detail: string;

    try {
      const body = (await response.json()) as { message?: string };
      detail = body.message ?? JSON.stringify(body);
    } catch {
      detail = await response.text();
    }

    throw new Error(`GitHub API error (${response.status}): ${detail}`);
  }

  return response;
}

function firstLine(message: string): string {
  return message.split("\n")[0] ?? "";
}

function mapCommit(commit: GitHubCommitResponse): GitHubCommit {
  return {
    sha: commit.sha,
    message: firstLine(commit.commit.message),
    author: commit.commit.author?.name ?? commit.author?.login ?? "Unknown",
    date: commit.commit.author?.date ?? "",
  };
}

export async function getLatestTags(
  owner: string,
  repo: string,
  count = 10,
  token?: string
): Promise<GitHubTag[]> {
  const url = `${GITHUB_API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/tags?per_page=${count}`;
  const response = await githubFetch(url, token);
  const tags = (await response.json()) as GitHubTagResponse[];

  return tags.map((tag) => ({
    name: tag.name,
    sha: tag.commit.sha,
  }));
}

async function fetchCommitsPage(
  owner: string,
  repo: string,
  sha: string,
  page: number,
  token?: string
): Promise<GitHubCommitResponse[]> {
  const url = `${GITHUB_API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits?sha=${encodeURIComponent(sha)}&per_page=100&page=${page}`;
  const response = await githubFetch(url, token);
  return (await response.json()) as GitHubCommitResponse[];
}

export async function getCommitsBetweenTags(
  owner: string,
  repo: string,
  base: string,
  head: string,
  token?: string
): Promise<GitHubCommit[]> {
  const compareUrl = `${GITHUB_API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/compare/${encodeURIComponent(base)}...${encodeURIComponent(head)}`;
  const compareResponse = await githubFetch(compareUrl, token);
  const comparison = (await compareResponse.json()) as GitHubCompareResponse;

  if (comparison.total_commits === 0) {
    return [];
  }

  if (comparison.total_commits <= comparison.commits.length) {
    return comparison.commits.map(mapCommit);
  }

  const baseSha = comparison.base_commit.sha;
  const collected: GitHubCommitResponse[] = [];
  let page = 1;

  while (collected.length < comparison.total_commits) {
    const pageCommits = await fetchCommitsPage(owner, repo, head, page, token);

    if (pageCommits.length === 0) {
      break;
    }

    for (const commit of pageCommits) {
      if (commit.sha === baseSha) {
        return collected.reverse().map(mapCommit);
      }

      collected.push(commit);
    }

    page += 1;
  }

  return collected.reverse().map(mapCommit);
}
