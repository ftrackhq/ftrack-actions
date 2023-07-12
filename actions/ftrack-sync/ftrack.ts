import { Session } from "@ftrack/api";

let _session: Session;

export function getSession() {
  if (!_session) {
    _session = new Session(
      process.env.FTRACK_URL!,
      process.env.FTRACK_LOGIN_EMAIL!,
      process.env.FTRACK_API_KEY!,
      { additionalHeaders: { "ftrack-bulk": true } },
    );
  }
  return _session;
}

export type ProductsAttribute = { key: "products"; value: string[] };
export type ReleaseNoteAttribute = { key: "release_note"; value: string };
export type InternalChangeAttribute = {
  key: "internal_change";
  value: boolean;
};

export type CustomAttribute =
  | ProductsAttribute
  | ReleaseNoteAttribute
  | InternalChangeAttribute;

interface Task {
  id: string;
  name: string;
  custom_attributes: CustomAttribute[];
  type: { name: string };
  link: { name: string }[];
}

interface Release {
  id: string;
  parent_id: string;
  project_id: string;
  name: string;
  description: string;
}

interface Note {
  id: string;
  parent_id: string | null;
  content: string;
  parent_type: "TypedContext";
  user_id: string;
}

export type Action = "create" | "update";

export interface NoteRequestBody {
  action: Action;
  entity_key: string;
  entity_type: "Note";
  entity_data: Note;
}

export async function getTaskFromId(taskId: string): Promise<Task> {
  return (
    await getSession().query<Task>(
      `select id, name, custom_attributes.key, custom_attributes.value, type.name, link from Task where id is ${taskId}`,
    )
  ).data[0];
}

async function getReleaseFromName(
  repo: string,
  tagName: string,
): Promise<Release> {
  return (
    await getSession().query<Release>(
      `select id, name from Release where name is "${repo} ${tagName}"`,
    )
  ).data[0];
}

async function createRelease(repo: string, tagName: string): Promise<Release> {
  return (
    await getSession().create("Release", {
      name: `${repo} ${tagName}`,
      description: `<a href="https://github.com/ftrackhq/${repo}/releases/tag/${tagName}">Find release on GitHub</a>`,
      parent_id: "036f1f70-2d88-11ec-a4f5-ca3b22452d4a",
      project_id: "dc34b754-79e8-11e3-b4d0-040102b7e101",
    } as Release)
  ).data;
}

export async function ensureReleaseTagExists(
  repo: string,
  tagName: string,
): Promise<Release> {
  const tagExists = await getReleaseFromName(repo, tagName);
  if (!tagExists) {
    return await createRelease(repo, tagName);
  }
  return tagExists;
}

export async function getNotesFromIds(noteIds: string[]) {
  return await getSession().query<Note>(
    `select id, parent_id from Note where id in (${noteIds.join(",")})`,
  );
}
