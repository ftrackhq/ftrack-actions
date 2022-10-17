import { v5 as uuid } from "uuid";

const UUID_NAMESPACE = "1b671a64-40d5-491e-99b0-da01ff1f3341";

export const requestHeaders = {
  "ftrack-api-key": process.env.FTRACK_API_KEY,
  "Content-Type": "application/json",
  "Response-Type": "application/json",
  "ftrack-user": process.env.FTRACK_LOGIN_EMAIL,
  "ftrack-bulk": "true",
};

function getTaskIdsAndNoteIdsFromBody(body, prUrl) {
  const taskIds = Array.from(body.matchAll(/(FTRACK|FT)-([\w\d-]+)/g)).map(
    (match) => match[2]
  );
  // generate a unique id for each note based on PR.html_url and taskId
  const uuids = taskIds.map((taskId) => ({
    noteId: uuid(prUrl + taskId, UUID_NAMESPACE),
    taskId,
  }));

  return uuids;
}

async function groupIntoExistingAndNewNoteIds(noteIds) {
  const response = await (
    await fetch(process.env.FTRACK_URL + "/api", {
      method: "POST",
      headers: requestHeaders,
      body: JSON.stringify([
        {
          action: "query",
          expression: `select id, parent_id from Note where id in (${noteIds
            .map(({ noteId }) => noteId)
            .join(",")})`,
        },
      ]),
    })
  ).json();
  try {
    const existingIds = response[0].data.map((note) => ({
      noteId: note.id,
      taskId: note.parent_id,
    }));
    const newIds = noteIds.filter(
      ({ noteId }) =>
        !existingIds
          .map(({ noteId: existingNoteId }) => existingNoteId)
          .includes(noteId)
    );
    return { existingIds, newIds };
  } catch (error) {
    console.error("Error fetching existing notes - response:", response);
    throw error;
  }
}

function getPrStatus(pr) {
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

function getNoteRequestBody(action, pr, { noteId, taskId }) {
  const prUrl = pr.html_url;
  const linkDescription = prUrl.match(/\.com\/(.+)/)[1];
  const prStatus = getPrStatus(pr);
  const content = `PR opened: [${linkDescription}](${prUrl})

Last change: ${new Date().toISOString().replace("T", " ").slice(0, -8)} GMT
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
      user_id: process.env.FTRACK_USER_ID,
    },
  };
}

export async function getNotesRequestBody(PR) {
  if (!PR.body || !PR.html_url) return [];
  const taskIds = getTaskIdsAndNoteIdsFromBody(PR.body, PR.html_url);
  if (taskIds.length === 0) return [];
  const { existingIds, newIds } = await groupIntoExistingAndNewNoteIds(taskIds);
  return [
    ...newIds.map(getNoteRequestBody.bind(this, "create", PR)),
    ...existingIds.map(getNoteRequestBody.bind(this, "update", PR)),
  ];
}
