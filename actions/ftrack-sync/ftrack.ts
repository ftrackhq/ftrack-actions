import { Session } from "@ftrack/api";

let _session: Session;

export function getSession() {
  if (!_session) {
    _session = createUserSession(process.env.FTRACK_LOGIN_EMAIL!, true);
  }
  return _session;
}

export function createUserSession(
  userEmail: string,
  dontStoreAsActivity = false,
) {
  return new Session(
    process.env.FTRACK_URL!,
    userEmail,
    process.env.FTRACK_API_KEY!,
    {
      additionalHeaders: dontStoreAsActivity
        ? { "ftrack-bulk": true }
        : undefined,
      autoConnectEventHub: false,
    },
  );
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

export async function getUserFromGithubUsername(username: string) {
  return (
    await getSession().query(
      `select id, first_name, last_name, username from User where custom_attributes.key is 'github_user' and custom_attributes.value is ${username}`,
    )
  ).data[0];
}

export async function ensureChangeRequestExists(
  release: Release,
  actor: string,
  ciUrl: string,
  releaseUrl: string,
) {
  const changeRequestName = `Deploy ${release.name}`;
  let changeRequest = (
    await getSession().query(
      `select id from Change where name is "${changeRequestName}"`,
    )
  ).data[0];
  if (!changeRequest) {
    const user = await getUserFromGithubUsername(actor);
    const userSession = createUserSession(user.username, false);
    changeRequest = (
      await userSession.create("Change", {
        name: changeRequestName,
        parent_id: "f9497d8b-3026-46b4-96f4-a47aa9a73804",
        project_id: "dc34b754-79e8-11e3-b4d0-040102b7e101",
        description: "Follow the standard procedure.",
      })
    ).data;
    const changeRequestId = changeRequest.id;

    const TESTING_PROCEDURE_CONFIGURATION_ID =
      "f723af2f-51fa-4d6d-ba2d-f813c4190db4";
    const RELEVANT_DOCUMENTS_CONFIGURATION_ID =
      "c431b396-30ab-415f-8784-b576a25df118";
    const BACKOUT_PROCEDURE_CONFIGURATION_ID =
      "a90b6217-8242-44a6-925f-31e5de1b7d9a";
    const RISK_RATING_CONFIGURATION_ID = "93d705ee-d33e-4045-b899-0e9cbfb14ef0";
    const APPROVAL_REQUIREMENT_CONFIGURATION_ID =
      "0d779438-b7cc-48c1-bcc4-3adcae62d775";
    const IMPACT_CONFIGURATION_ID = "03177562-6efa-47bd-8d7f-02e58ae6e070";
    const GITHUB_CI_CONFIGURATION_ID = "e724e83d-8356-4ced-ac50-0987c222c526";
    const GITHUB_RELEASE_CONFIGURATION_ID =
      "7f1eedab-9eab-4a08-8210-c211af2fe290";
    const RELEASE_LINK_CONFIGURATION_ID =
      "8d962a2e-f756-466a-8f2c-418de09bcb56";

    const customAttributes = [];
    customAttributes.push(
      getSession().create("CustomAttributeValue", {
        configuration_id: TESTING_PROCEDURE_CONFIGURATION_ID,
        entity_id: changeRequestId,
        value: [
          {
            url: "https://docs.google.com/document/d/1z_gbXx9vMKho80UKYEW6d5POcFrdzdngeCtxibH90qw/edit#heading=h.lmq93bry7zi4",
            name: "Google Docs",
          },
        ],
      }),
    );
    customAttributes.push(
      userSession.create("CustomAttributeValue", {
        configuration_id: RELEVANT_DOCUMENTS_CONFIGURATION_ID,
        entity_id: changeRequestId,
        value: [
          {
            url: "https://docs.google.com/document/d/1z_gbXx9vMKho80UKYEW6d5POcFrdzdngeCtxibH90qw/edit#heading=h.lmq93bry7zi4",
            name: "Google Docs",
          },
        ],
      }),
    );
    customAttributes.push(
      userSession.create("CustomAttributeValue", {
        configuration_id: BACKOUT_PROCEDURE_CONFIGURATION_ID,
        entity_id: changeRequestId,
        value: [
          {
            url: "https://docs.google.com/document/d/1z_gbXx9vMKho80UKYEW6d5POcFrdzdngeCtxibH90qw/edit#heading=h.qfeny2946uh",
            name: "Google Docs",
          },
        ],
      }),
    );
    if (ciUrl) {
      customAttributes.push(
        userSession.create("CustomAttributeValue", {
          configuration_id: GITHUB_CI_CONFIGURATION_ID,
          entity_id: changeRequestId,
          value: [
            {
              url: ciUrl,
              name: "GitHub CI",
            },
          ],
        }),
      );
    }
    if (releaseUrl) {
      customAttributes.push(
        userSession.create("CustomAttributeValue", {
          configuration_id: GITHUB_RELEASE_CONFIGURATION_ID,
          entity_id: changeRequestId,
          value: [
            {
              url: releaseUrl,
              name: "GitHub Release",
            },
          ],
        }),
      );
    }
    customAttributes.push(
      userSession.create("CustomAttributeValue", {
        configuration_id: RISK_RATING_CONFIGURATION_ID,
        entity_id: changeRequestId,
        value: "low",
      }),
    );
    customAttributes.push(
      userSession.create("CustomAttributeValue", {
        configuration_id: APPROVAL_REQUIREMENT_CONFIGURATION_ID,
        entity_id: changeRequestId,
        value: "peer",
      }),
    );
    customAttributes.push(
      userSession.create("CustomAttributeValue", {
        configuration_id: IMPACT_CONFIGURATION_ID,
        entity_id: changeRequestId,
        value: "low",
      }),
    );

    if (release.id) {
      customAttributes.push(
        userSession.create("CustomAttributeLink", {
          configuration_id: RELEASE_LINK_CONFIGURATION_ID,
          from_id: changeRequestId,
          to_id: release.id,
        }),
      );
    }
    await Promise.all(customAttributes);
  }
  return changeRequest;
}

export async function getNotesFromIds(noteIds: string[]) {
  return await getSession().query<Note>(
    `select id, parent_id from Note where id in (${noteIds.join(",")})`,
  );
}
