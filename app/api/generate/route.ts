import { NextResponse } from "next/server";
import { getCommitsBetweenTags } from "@/lib/github";
import { generateChangelog } from "@/lib/changelog";

type GenerateRequestBody = {
  owner: string;
  repo: string;
  fromTag: string;
  toTag: string;
  token?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<GenerateRequestBody>;
    const { owner, repo, fromTag, toTag, token } = body;

    if (!owner || !repo || !fromTag || !toTag) {
      return NextResponse.json(
        { error: "owner, repo, fromTag, and toTag are required" },
        { status: 400 }
      );
    }

    const commits = await getCommitsBetweenTags(owner, repo, fromTag, toTag, token);

    if (commits.length === 0) {
      return NextResponse.json(
        { message: "No commits found between these tags" },
        { status: 200 }
      );
    }

    const changelog = await generateChangelog(commits, repo, toTag);

    return NextResponse.json({ changelog }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
