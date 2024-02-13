import { ensureReleaseTagExists, getSession } from "./ftrack.js";
import { checkEnvironment } from "./utils.js";

export type Release = {
  status_id: string;
};

export const APPROVAL_STATUS = {
  RELEASED: "ba008734-2d87-11ec-a4f5-ca3b22452d4a",
  APPROVED: "44de097a-4164-11df-9218-0019bb4983d8",
  PENDING_APPROVAL: "44dded64-4164-11df-9218-0019bb4983d8",
  IN_ROLLOUT: "3961f582-99f1-11ec-8f87-224ef9a30185",
  REJECTED: "5c74bae6-5659-11e1-b145-f23c91df25eb",
} as const;

export async function updateReleaseApprovalStatus(
  repo: string,
  tagName: string,
  statusId: string,
) {
  const releaseTag = await ensureReleaseTagExists(repo, tagName);
  const response = await getSession().update<Release>(
    "Release",
    [releaseTag.id],
    {
      status_id: statusId,
    },
  );
  return response;
}

async function main() {
  console.log("Github payload:\n", process.env.GITHUB_PAYLOAD);
  const githubPayload = JSON.parse(process.env.GITHUB_PAYLOAD!);
  const context = JSON.parse(process.env.CONTEXT!) as {
    status: keyof typeof APPROVAL_STATUS;
  };

  if (!githubPayload.status || !APPROVAL_STATUS[context.status]) {
    throw new Error(
      `Invalid status passed to context: ${context.status}, should be one of: ${Object.keys(APPROVAL_STATUS).join(", ")}`,
    );
  }

  const tagName = githubPayload.event.release.tag_name;
  const repo = githubPayload.event.repository.name;
  const approvalStatus = APPROVAL_STATUS[context.status];

  return updateReleaseApprovalStatus(repo, tagName, approvalStatus);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  checkEnvironment();
  main();
}
