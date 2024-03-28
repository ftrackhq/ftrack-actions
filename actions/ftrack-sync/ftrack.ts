import { Session } from "@ftrack/api";

let _session: Session;

export function getSession() {
  if (!_session) {
    _session = new Session(
      process.env.FTRACK_URL!,
      process.env.FTRACK_LOGIN_EMAIL!,
      process.env.FTRACK_API_KEY!,
      {
        additionalHeaders: { "ftrack-bulk": true },
        autoConnectEventHub: false,
      },
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

export async function ensureChangeRequestExists(repo: string, tag: string) {
  const packageName = tag.includes("/") ? tag.split("/")[0] : repo;
  const changeRequestName = `Deploy ${packageName} ${tag}`;
  const changeRequestExists = (
    await getSession().query(
      `select id from ChangeRequest where name is "${changeRequestName}"`,
    )
  ).data[0];
  if (!changeRequestExists) {
    const result = await getSession().create("ChangeRequest", {
      name: `Deploy ${repo} ${tag}`,
      parent_id: "f9497d8b-3026-46b4-96f4-a47aa9a73804",
      project_id: "dc34b754-79e8-11e3-b4d0-040102b7e101",
      description: "Follow the standard procedure",
    });
    const changeRequestId = result.data.id;

    const TESTING_PROCEDURE_CONFIGURATION_ID =
      "e1af1745-f50b-45ce-be44-594ecdd80e8a";
    const RELEVANT_DOCUMENTS_CONFIGURATION_ID =
      "c791f595-e47d-4846-ad90-906e9129f44c";
    const BACKOUT_PROCEDURE_CONFIGURATION_ID =
      "9de0955c-5320-4d04-89b9-d6db805acf38";
    const RISK_RATING_CONFIGURATION_ID = "93d705ee-d33e-4045-b899-0e9cbfb14ef0";
    const APPROVAL_REQUIREMENT_CONFIGURATION_ID =
      "0d779438-b7cc-48c1-bcc4-3adcae62d775";
    const IMPACT_CONFIGURATION_ID = "03177562-6efa-47bd-8d7f-02e58ae6e070";

    const customAttributes = [];
    customAttributes.push(
      getSession().create("CustomAttributeValue", {
        configuration_id: TESTING_PROCEDURE_CONFIGURATION_ID,
        entity_id: changeRequestId,
        value:
          "https://docs.google.com/document/d/1z_gbXx9vMKho80UKYEW6d5POcFrdzdngeCtxibH90qw/edit#heading=h.lmq93bry7zi4",
      }),
    );
    customAttributes.push(
      getSession().create("CustomAttributeValue", {
        configuration_id: RELEVANT_DOCUMENTS_CONFIGURATION_ID,
        entity_id: changeRequestId,
        value:
          "https://github.com/ftrackhq/ftrack-server/releases/tag/4.13.7\nhttps://docs.google.com/document/d/1z_gbXx9vMKho80UKYEW6d5POcFrdzdngeCtxibH90qw/edit#heading=h.lmq93bry7zi4",
      }),
    );
    customAttributes.push(
      getSession().create("CustomAttributeValue", {
        configuration_id: BACKOUT_PROCEDURE_CONFIGURATION_ID,
        entity_id: changeRequestId,
        value:
          "https://docs.google.com/document/d/1z_gbXx9vMKho80UKYEW6d5POcFrdzdngeCtxibH90qw/edit#heading=h.notdwrv0mb75",
      }),
    );
    customAttributes.push(
      getSession().create("CustomAttributeValue", {
        configuration_id: RISK_RATING_CONFIGURATION_ID,
        entity_id: changeRequestId,
        value: "low",
      }),
    );
    customAttributes.push(
      getSession().create("CustomAttributeValue", {
        configuration_id: APPROVAL_REQUIREMENT_CONFIGURATION_ID,
        entity_id: changeRequestId,
        value: "peer",
      }),
    );
    customAttributes.push(
      getSession().create("CustomAttributeValue", {
        configuration_id: IMPACT_CONFIGURATION_ID,
        entity_id: changeRequestId,
        value: "low",
      }),
    );
    await Promise.all(customAttributes);
  }
}

export async function getNotesFromIds(noteIds: string[]) {
  return await getSession().query<Note>(
    `select id, parent_id from Note where id in (${noteIds.join(",")})`,
  );
}
