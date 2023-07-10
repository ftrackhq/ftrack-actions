import { v5 as uuid } from "uuid";
import {
  Action,
  NoteRequestBody,
  createNotes,
  getNotesFromIds,
} from "./ftrack.js";
import { PullRequest, getPullRequest } from "./github.js";

const UUID_NAMESPACE = "1b671a64-40d5-491e-99b0-da01ff1f3341";

export function getTaskIdsFromBody(body: string) {
  return Array.from(body.matchAll(/(FTRACK|FT)-([\w\d-]+)/g))
    .map((match) => match[2])
    .flat();
}

function getTaskIdsAndNoteIdsFromBody(body: string, prUrl: string) {
  const taskIds = getTaskIdsFromBody(body);
  // generate a unique id for each note based on PR.html_url and taskId
  const uuids = taskIds.map((taskId) => ({
    noteId: uuid(prUrl + taskId, UUID_NAMESPACE),
    taskId,
  }));

  return uuids;
}

async function groupIntoExistingAndNewNoteIds(
  noteIds: { noteId: string; taskId: string }[]
) {
  const response = await getNotesFromIds(noteIds.map(({ noteId }) => noteId));
  try {
    const existingIds = response.data.map((note: any) => ({
      noteId: note.id,
      taskId: note.parent_id,
    }));
    const newIds = noteIds.filter(
      ({ noteId }) =>
        !existingIds
          .map(({ noteId }: { noteId: string }) => noteId)
          .includes(noteId)
    );
    return { existingIds, newIds };
  } catch (error) {
    console.error("Error fetching existing notes - response:", response);
    throw error;
  }
}

function getPrStatus(pr: PullRequest) {
  if (!!pr.merged_at) {
    return "merged";
  }
  if (pr.draft) {
    return "draft";
  }
  if (!!pr.state) {
    return pr.state;
  }
  return "unknown";
}

function getNoteRequestBody(
  action: Action,
  pr: PullRequest,
  { noteId, taskId }: { noteId: string; taskId: string | null }
): NoteRequestBody {
  const prUrl = pr.html_url;
  const linkDescription = prUrl!.match(/\.com\/(.+)/)?.[1];
  const prStatus = getPrStatus(pr);
  const content = `PR opened: [${linkDescription}](${prUrl})

Last change: ${new Date()
    .toISOString()
    .replace("T", " ")
    .slice(0, -8)} GMT<br />
Current status: ${prStatus}`;

  return {
    action,
    entity_key: noteId,
    entity_type: "Note",
    entity_data: {
      id: noteId,
      parent_id: taskId,
      content,
      parent_type: "TypedContext",
      user_id: process.env.FTRACK_USER_ID!,
    },
  };
}

export async function getNotesRequestBody(
  PR: PullRequest
): Promise<NoteRequestBody[]> {
  if (!PR.body || !PR.html_url) return [];
  const taskIds = getTaskIdsAndNoteIdsFromBody(PR.body, PR.html_url);
  if (taskIds.length === 0) return [];
  const { existingIds, newIds } = await groupIntoExistingAndNewNoteIds(taskIds);
  return [
    ...newIds.map(getNoteRequestBody.bind(null, "create", PR)),
    ...existingIds.map(getNoteRequestBody.bind(null, "update", PR)),
  ];
}

async function main() {
  if (!process.env.FTRACK_API_KEY || !process.env.PR_JSON) {
    console.error(`This script is intended to be run in CI only. To run locally for development, use:
FTRACK_API_KEY="[dev api key]" PR_JSON='{"url":"https://github.com/ftrackhq/frontend/pull/120","body":"Resolves FTRACK-c018c026-3599-11ed-8012-aab5768efa1e"}' yarn pr-status
`);
    process.exit(1);
  }

  const pullRequest = getPullRequest();
  console.log("Input:", pullRequest);

  const notes = await getNotesRequestBody(pullRequest);

  if (notes.length === 0) {
    console.log("Couldn't find any notes to update, exiting...");
    process.exit(0);
  }

  console.log("Creating notes:", notes);
  const response = await createNotes(notes);
  console.log("Response: ", response);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
