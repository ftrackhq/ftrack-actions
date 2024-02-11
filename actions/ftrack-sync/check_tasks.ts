import { getTaskFromId } from "./ftrack.js";
import { type PullRequest, getPullRequest } from "./github.js";

export function getTaskIdsFromBody(body: string) {
  return Array.from(body.matchAll(/(FTRACK|FT)-([\w\d-]+)/g))
    .map((match) => match[2])
    .flat();
}

export async function assertTasksHaveProductFieldSet(PR: PullRequest) {
  if (!PR.body) return;
  const taskIds = getTaskIdsFromBody(PR.body);
  const tasks = await Promise.all(
    taskIds.map((taskId) => getTaskFromId(taskId)),
  );
  if (taskIds.length === 0) return [];
  for (const task of tasks) {
    const hasProductSet = task.custom_attributes.some((attribute) => {
      return attribute.key === "products" && attribute.value.length > 0;
    });

    const hasInternalSet = task.custom_attributes.some((attribute) => {
      return attribute.key === "internal_change" && attribute.value === true;
    });
    if (!hasProductSet && !hasInternalSet) {
      throw Error(
        `Task ${task.id} is missing products or internal_change attribute, please set them in ftrack `,
      );
    }
  }
}

async function main() {
  if (!process.env.FTRACK_API_KEY || !process.env.EVENT_PR_PAYLOAD) {
    console.error(`This script is intended to be run in CI only. To run locally for development, use:
FTRACK_API_KEY="[dev api key]" EVENT_PR_PAYLOAD='{"url":"https://github.com/ftrackhq/frontend/pull/120","body":"Resolves FTRACK-c018c026-3599-11ed-8012-aab5768efa1e"}' yarn check-tasks
`);
    process.exit(1);
  }

  const pullRequest = getPullRequest();

  await assertTasksHaveProductFieldSet(pullRequest);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
