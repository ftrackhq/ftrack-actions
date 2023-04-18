import * as R from "remeda";
import { getTaskIdsFromBody } from "./sync_pr_status.js";
import { getPullRequestBody } from "./github.js";
import {
  ProductsAttribute,
  InternalChangeAttribute,
  ReleaseNoteAttribute,
  getTaskFromId,
} from "./ftrack.js";
import * as zendesk from "./zendesk.js";
import { parse } from "node-html-parser";

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

function processData(taskData: TaskData[]): GroupedMessageData {
  // Unroll tasks with multiple products into multiple tasks with a single product
  const unrolledByProduct = R.uniqWith(
    taskData.flatMap((task) => {
      const product = task.products.length > 0 ? task.products : ["default"];
      return product.map((stream) => {
        return { ...task, product: stream };
      });
    }),
    R.equals,
  );

  const groupedByProduct = R.groupBy.strict(
    unrolledByProduct,
    (task) => task.product,
  );

  const groupStreamValuesByStory = R.mapValues(groupedByProduct, (tasks) => {
    return R.groupBy.strict(tasks, (task) => task.story || "default");
  });

  return groupStreamValuesByStory;
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

async function getTaskDataFromReleaseBody(
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

function toHtml(
  data: MessageData,
  originalBody: string,
  owner: string,
  repo: string,
  tagName: string,
) {
  const parsed = parse(originalBody);

  let latestChangesH2 = parsed
    .querySelectorAll("h2")
    ?.find((node) => node.innerText.includes("Latest changes"));

  if (!latestChangesH2) {
    const header = parsed.querySelector("#header");
    const latestChangesHtml = `<h2>Latest changes</h2><ul></ul>`;
    if (header) {
      header.insertAdjacentHTML("afterend", latestChangesHtml);
    } else {
      parsed.insertAdjacentHTML("afterbegin", latestChangesHtml);
    }

    latestChangesH2 =
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion, @typescript-eslint/no-non-null-asserted-optional-chain
      parsed
        .querySelectorAll("h2")
        ?.find((node) => node.innerText.includes("Latest changes"))!;
  }

  const latestChangesUl = latestChangesH2.nextElementSibling;
  for (const tasks of Object.values(data)) {
    for (const task of tasks) {
      if (task.internal) continue;
      const taskType = task.type.toLowerCase() == "bug" ? "FIXED" : "NEW";
      const taskNode = parse(
        `<li data-taskid="${task.id}" data-repo="${owner}/${repo}" data-tagname="${tagName}"><strong>${taskType}</strong> ${task.releaseNote}</li>`,
      );
      if (parsed.querySelector(`[data-taskid=${task.id}]`)) {
        continue;
      }
      latestChangesUl.appendChild(taskNode);
    }
  }
  return parsed.outerHTML;
}

export async function generateReleaseNotes(
  product: "studio" | "review",
  releaseBody: string,
  owner: string,
  repo: string,
  tagName: string,
  originalBody: string,
) {
  const taskData = await getTaskDataFromReleaseBody(releaseBody, owner, repo);
  const massagedData = processData(taskData);
  if (!massagedData[product]) return;
  const html = toHtml(
    massagedData[product],
    originalBody,
    owner,
    repo,
    tagName,
  );
  return html;
}

const RELEASE_NOTES_STUDIO_ARTICLE_ID = "15780555181719";
const RELEASE_NOTES_REVIEW_ARTICLE_ID = "14865283276951";

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
  const studioArticle = await zendesk.getArticle(
    RELEASE_NOTES_STUDIO_ARTICLE_ID,
  );
  const reviewArticle = await zendesk.getArticle(
    RELEASE_NOTES_REVIEW_ARTICLE_ID,
  );

  const studioReleaseNotes = await generateReleaseNotes(
    "studio",
    releaseBody,
    owner,
    repo,
    tagName,
    studioArticle.article.body,
  );

  const reviewReleaseNotes = await generateReleaseNotes(
    "review",
    releaseBody,
    owner,
    repo,
    tagName,
    reviewArticle.article.body,
  );

  const [studioResult, reviewResult] = await Promise.all([
    studioReleaseNotes &&
      zendesk.updateArticle(
        studioReleaseNotes,
        RELEASE_NOTES_STUDIO_ARTICLE_ID,
      ),
    reviewReleaseNotes &&
      zendesk.updateArticle(
        reviewReleaseNotes,
        RELEASE_NOTES_REVIEW_ARTICLE_ID,
      ),
  ]);

  console.log("Result", studioResult, reviewResult);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
