import { ensureReleaseTagExists, ensureChangeRequestExists } from "./ftrack.js";
import { checkEnvironment } from "./utils.js";

export async function preDeploy(
  repo: string,
  tagName: string,
  actor: string,
  runId: string,
) {
  const releaseUrl = `https://github.com/ftrackhq/${repo}/releases/tag/${tagName}`;
  const ciUrl = `https://github.com/ftrackhq/${repo}/actions/runs/${runId}`;
  const releaseTag = await ensureReleaseTagExists(repo, tagName);
  await ensureChangeRequestExists(releaseTag, actor, ciUrl, releaseUrl);
}

async function main() {
  console.log("Github payload:\n", process.env.GITHUB_PAYLOAD);
  const githubPayload = JSON.parse(process.env.GITHUB_PAYLOAD!);
  await preDeploy(
    githubPayload.event.repository.name,
    githubPayload.ref_name,
    githubPayload.actor,
    githubPayload.run_id,
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  checkEnvironment();
  main();
}
