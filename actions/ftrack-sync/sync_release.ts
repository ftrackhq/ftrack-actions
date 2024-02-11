import * as R from "remeda";
import { getTaskIdsFromBody } from "./sync_pr_status.js";
import { getPullRequestBody } from "./github.js";
import {
  type ProductsAttribute,
  type InternalChangeAttribute,
  type ReleaseNoteAttribute,
  getTaskFromId,
  ensureReleaseTagExists,
  getSession,
} from "./ftrack.js";

export function getPrUrlsFromReleaseData(releaseBody: string): string[] {
  return (
    releaseBody
      .match(/\bhttps?:\/\/\S+\/pull\/\S+/gi)
      ?.map((url) => url.trim()) ?? []
  );
}
export function getPrNumberFromUrl(urls: string[]): string[] {
  return urls.map((url) => {
    return url.split("/").pop() as string;
  });
}

interface TaskData {
  id: string;
  products: string[];
  story: string;
  type: string;
  internal: boolean;
  releaseNote: string;
}

export interface MessageData {
  [story: string]: (Omit<TaskData, "products"> & {
    product: string;
  })[];
}

export interface GroupedMessageData {
  [stream: string]: MessageData;
}

async function getTaskDataFromTaskId(taskId: string): Promise<TaskData> {
  const task = await getTaskFromId(taskId);
  return {
    id: task.id,
    products: task.custom_attributes.find((attr): attr is ProductsAttribute => {
      return attr.key === "products";
    })?.value ?? ["default"],
    story: (
      task.link
        ?.map(({ name }: { name: string }) => name)
        .filter(
          (name: string) => !["ftrack development", "Backlog"].includes(name),
        ) ?? []
    )
      .slice(0, -1)
      .join(" / "),
    type: task.type.name,
    internal:
      task.custom_attributes.find((attr): attr is InternalChangeAttribute => {
        return attr.key === "internal_change";
      })?.value ?? false,
    releaseNote:
      task.custom_attributes.find((attr): attr is ReleaseNoteAttribute => {
        return attr.key === "release_note";
      })?.value || task.name,
  };
}

export async function getTaskDataFromReleaseBody(
  releaseBody: string,
  owner: string,
  repo: string,
) {
  const matchedUrl = getPrUrlsFromReleaseData(releaseBody);
  return (
    await Promise.all(
      getPrNumberFromUrl(matchedUrl).map(async (prNumber) => {
        const body = await getPullRequestBody(prNumber, repo, owner);
        const taskIds = getTaskIdsFromBody(body);
        return Promise.all(taskIds.map(getTaskDataFromTaskId));
      }),
    )
  ).flat();
}

const RELEASES_CONFIGURATION_ID = "61f235ab-6109-4742-bba7-85bde3739c41";
export async function updateTasksWithReleaseTag(
  taskData: TaskData[],
  repo: string,
  tagName: string,
) {
  const releaseTag = await ensureReleaseTagExists(repo, tagName);
  const existingLinks = (
    await getSession().query(
      `select from_id, to_id from CustomAttributeLink where to_id is '${
        releaseTag.id
      }' and from_id in (${taskData.map((task) => task.id).join(",")})`,
    )
  ).data.map((link) => link.from_id);
  console.log("Existing links, not updating", existingLinks);
  const customAttributeLinks = R.uniq(taskData.map((task) => task.id))
    .filter((taskId) => !existingLinks.includes(taskId))
    .map((taskId) => ({
      action: "create",
      entity_type: "CustomAttributeLink",
      entity_data: {
        configuration_id: RELEASES_CONFIGURATION_ID,
        from_id: taskId,
        to_id: releaseTag.id,
      },
    }));
  console.log("Creating links", customAttributeLinks);
  if (customAttributeLinks.length === 0) return;
  const response = await getSession().call(customAttributeLinks);
  return response;
}

async function main() {
  if (
    !process.env.FTRACK_API_KEY ||
    !process.env.FTRACK_LOGIN_EMAIL ||
    !process.env.FTRACK_URL ||
    !process.env.RELEASE_JSON ||
    !process.env.GITHUB_TOKEN
  ) {
    console.error(`This script is intended to be run in CI only. To run locally for development, use:
FTRACK_URL="[url]" GITHUB_TOKEN="[github pat]" RELEASE_JSON=[github release object] FTRACK_API_KEY=[ftrack api key] FTRACK_LOGIN_EMAIL=[ftrack user email] yarn release-notes
`);
    process.exit(1);
  }

  const releaseData = JSON.parse(process.env.RELEASE_JSON);
  const releaseBody = releaseData.event.release.body;
  const owner = releaseData.repository_owner;
  const repo = releaseData.event.repository.name;
  const tagName = releaseData.event.release.tag_name;

  const taskData = await getTaskDataFromReleaseBody(releaseBody, owner, repo);

  if (taskData.length === 0) {
    console.log("No tasks found in release body, skipping.");
    return;
  }

  await updateTasksWithReleaseTag(taskData, repo, tagName);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
