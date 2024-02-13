import {
  createUserSession,
  ensureChangeRequestExists,
  ensureReleaseTagExists,
  getUserFromGithubUsername,
} from "./ftrack.js";
import { checkEnvironment } from "./utils.js";
import type GithubPayload from "./fixtures/github_payload_on_push_tag.json";
import { getApprovals } from "./github.js";

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
  githubPayload: typeof GithubPayload,
  updatedStatus: keyof typeof APPROVAL_STATUS,
) {
  const approvalStatus = APPROVAL_STATUS[updatedStatus];
  if (!approvalStatus) {
    throw new Error(
      `Invalid status passed to context: ${updatedStatus}, should be one of: ${Object.keys(APPROVAL_STATUS).join(", ")}`,
    );
  }

  const tagName = githubPayload.ref_name;
  const repo = githubPayload.event.repository.name;
  const runId = githubPayload.run_id;
  const owner = githubPayload.repository_owner;
  const ciUrl = `https://github.com/ftrackhq/${repo}/actions/runs/${runId}`;
  const releaseUrl = `https://github.com/ftrackhq/${repo}/releases/tag/${tagName}`;
  const releaseTag = await ensureReleaseTagExists(repo, tagName);
  const changeRequest = await ensureChangeRequestExists(
    releaseTag,
    githubPayload.actor,
    ciUrl,
    releaseUrl,
  );
  console.log("Getting approval for runId:", runId);
  const approvals = await getApprovals(repo, owner, runId);
  const approval = approvals[0];
  console.log("Approval:", JSON.stringify(approval, null, 2));
  const approvee = await getUserFromGithubUsername(approval.user.login);
  console.log("Approvee:", JSON.stringify(approvee, null, 2));
  const userSession = createUserSession(approvee.username);

  let noteContent = `Updated to status '${approval.state}'`;
  if (approval.comment) {
    noteContent += ` with comment:\n\n${approval.comment}`;
  }
  await Promise.all([
    await userSession.update("Change", [changeRequest.id], {
      status_id: APPROVAL_STATUS[updatedStatus],
    }),
    userSession.create("Note", {
      parent_id: changeRequest.id,
      content: noteContent,
      parent_type: "TypedContext",
      user_id: approvee.id,
    }),
  ]);
}

async function main() {
  console.log("Github payload:\n", process.env.GITHUB_PAYLOAD);
  const githubPayload = JSON.parse(process.env.GITHUB_PAYLOAD!);
  const context = JSON.parse(process.env.CONTEXT!);
  return updateReleaseApprovalStatus(githubPayload, context.status);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  checkEnvironment();
  main();
}
