import type PRPayload from "./fixtures/pr_payload.json";

export type PullRequest = Partial<typeof PRPayload>;

export function getPullRequest(): typeof PRPayload {
  return JSON.parse(process.env.PR_PAYLOAD as string);
}

export async function getPullRequestBody(
  prNumber: string,
  repo: string,
  owner: string,
): Promise<string> {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`,
      {
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
          "X-GitHub-Api-Version": "2022-11-28",
        },
      },
    );
    if (!response.ok)
      throw new Error(
        `Failed to fetch PR: ${JSON.stringify(await response.json())}`,
      );
    return (await response.json()).body;
  } catch (error) {
    console.error(
      "Failed to fetch PR:",
      owner,
      repo,
      prNumber,
      (error as { message: string }).message,
    );
    throw error;
  }
}

interface Approval {
  user: {
    login: "bjornrydahl";
  };
  state: "approved" | "denied";
  comment: string;
  environments: {
    id: 2268336714;
    name: "production";
  }[];
}

export async function getApprovals(repo: string, owner: string, runId: string) {
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/actions/runs/${runId}/approvals`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    },
  );
  return (await response.json()) as Approval[];
}
