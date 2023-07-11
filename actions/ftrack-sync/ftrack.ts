import { Session } from "@ftrack/api";

let _session: Session;

function getSession() {
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

export async function getNotesFromIds(noteIds: string[]) {
  return await getSession().query<Note>(
    `select id, parent_id from Note where id in (${noteIds.join(",")})`,
  );
}

export async function createNotes(notes: NoteRequestBody[]) {
  return await Promise.all(
    notes.map((note) => getSession().create("Note", note)),
  );
}
