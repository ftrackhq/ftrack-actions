import { ensureReleaseTagExists, ensureChangeRequestExists } from "./ftrack.js";
import { checkEnvironment } from "./utils.js";

export async function preDeploy(repo: string, tagName: string) {
  const releaseTag = await ensureReleaseTagExists(repo, tagName);
  await ensureChangeRequestExists(repo, releaseTag.id);
}

async function main() {
  console.log("Github payload:\n", process.env.GITHUB_PAYLOAD);
  const githubPayload = JSON.parse(process.env.GITHUB_PAYLOAD!);
  await preDeploy(githubPayload.event.repository.name, githubPayload.ref_name);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  checkEnvironment();
  main();
}
