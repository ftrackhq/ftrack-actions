import { ensureReleaseTagExists, getSession } from "./ftrack.js";
import { checkEnvironment } from "./utils.js";
import type GithubPayload from "./fixtures/github_payload_on_push_tag.json";

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

type Context = {
  status: keyof typeof APPROVAL_STATUS;
};

export async function updateReleaseApprovalStatus(
  githubPayload: typeof GithubPayload,
  context: Context,
) {
  const approvalStatus = APPROVAL_STATUS[context.status];
  if (!approvalStatus) {
    throw new Error(
      `Invalid status passed to context: ${context.status}, should be one of: ${Object.keys(APPROVAL_STATUS).join(", ")}`,
    );
  }

  const tagName = githubPayload.ref_name;
  const repo = githubPayload.event.repository.name;
  const releaseTag = await ensureReleaseTagExists(repo, tagName);
  const response = await getSession().update<Release>(
    "Release",
    [releaseTag.id],
    {
      status_id: APPROVAL_STATUS[context.status],
    },
  );
  return response;
}

async function main() {
  console.log("Github payload:\n", process.env.GITHUB_PAYLOAD);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  checkEnvironment();
  main();
}
