import { getTaskFromId } from "./ftrack.js";
import { type PullRequest, getPullRequest } from "./github.js";
import { checkEnvironment } from "./utils.js";

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
  await assertTasksHaveProductFieldSet(getPullRequest());
}

if (import.meta.url === `file://${process.argv[1]}`) {
  checkEnvironment();
  main();
}
