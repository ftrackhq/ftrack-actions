import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  afterEach,
  beforeEach,
  vi,
} from "vitest";
import { server } from "../../test_server.js";
import {
  generateReleaseNotes,
  getTaskDataFromReleaseBody,
} from "./generate_release_notes.js";
import { rest } from "msw";

// Start server before all tests
beforeAll(() => {
  process.env.FTRACK_URL = "http://ftrackinstance.example";
  process.env.FTRACK_LOGIN_EMAIL = "email@example.com";
  process.env.FTRACK_USER_ID = "user-id";
  process.env.GITHUB_TOKEN = "github-token";
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2023, 6, 2, 0, 0, 0));
  server.listen({
    onUnhandledRequest(req) {
      throw new Error(
        `Found an unhandled ${req.method} request to ${req.url.href}`,
      );
    },
  });
});

//  Close server after all tests
afterAll(() => server.close());

// Reset handlers after each test `important for test isolation`
afterEach(() => server.resetHandlers());

const releaseData = {
  repository_owner: "test-organization",
  owner: "test-owner",
  repository_owner_id: "000000000",
  repositoryUrl: "git://github.com/test-organization/test-repo.git",
  event: {
    action: "released",
    release: {
      body: "<!-- Release notes generated using configuration in .github/release.yml at main -->\r\n\r\n## What's Changed\r\n### Product 1\r\n* feat: (New feature): PR number 1 by @user55 in https://github.com/test-organization/test-repo/pull/510\r\n* feat(Feature): PR number 2 @user2 in https://github.com/test-organization/test-repo/pull/515\r\n* fix: Bug fix by @user1 in https://github.com/test-organization/test-repo/pull/499\r\n* fix: Bug fix by @user1 in https://github.com/test-organization/test-repo/pull/516",
      draft: false,
      name: "v1.0.1",
      prerelease: false,
      tag_name: "v1.0.1",
    },
    repository: {
      name: "test-repo",
    },
  },
} as const;
describe("Generate release notes", () => {
  beforeEach(() => {
    server.use(
      rest.get(
        "https://api.github.com/repos/test-owner/test-repo/pulls/510",
        (req, res, ctx) => {
          return res(ctx.json({ body: "Resolves FT-1234" }));
        },
      ),
      rest.get(
        "https://api.github.com/repos/test-owner/test-repo/pulls/515",
        (req, res, ctx) => {
          return res(ctx.json({ body: "Partially Resolves FT-4567" }));
        },
      ),
      rest.get(
        "https://api.github.com/repos/test-owner/test-repo/pulls/516",
        (req, res, ctx) => {
          return res(ctx.json({ body: "Partially Resolves FT-4567" }));
        },
      ),
      rest.get(
        "https://api.github.com/repos/test-owner/test-repo/pulls/499",
        (req, res, ctx) => {
          return res(ctx.json({ body: "Resolves FT-8910  FT-1231" }));
        },
      ),

      rest.post(process.env.FTRACK_URL + "/api", async (req, res, ctx) => {
        // Ignoring session initalization request with query_schemas etc
        const requestBody = await req.json();

        if (requestBody.length > 1) return;
        const mocks = {
          1234: {
            name: "Test 1",
            products: ["studio"],
            releaseNote: "",
            internal: false,
            type: "Feature",
            link: [
              {
                type: "Project",
                id: "dc34b754-79e8-11e3-b4d0-040102b7e101",
                name: "ftrack development",
              },
              {
                type: "TypedContext",
                id: "2465912c-2441-11ed-8edb-9e89dc32fb4f",
                name: "Backlog",
              },
              {
                type: "TypedContext",
                id: "7b0deaa8-76df-44e0-9598-eb4926575773",
                name: "link 1",
              },
              {
                type: "TypedContext",
                id: "ffb48575-3100-4638-b4ea-fe7435944569",
                name: "link 2",
              },
              {
                type: "TypedContext",
                id: "437652a1-dc0b-4d79-b6d5-2a07d160a6d5",
                name: "Test 1",
              },
            ],
          },
          4567: {
            name: "Test 2",
            type: "Bug",
            link: [
              {
                type: "Project",
                id: "dc34b754-79e8-11e3-b4d0-040102b7e101",
                name: "ftrack development",
              },
              {
                type: "TypedContext",
                id: "2465912c-2441-11ed-8edb-9e89dc32fb4f",
                name: "Backlog",
              },
            ],
            products: ["studio", "review"],
            internal: true,
            releaseNote: "",
          },
          8910: {
            name: "Test 3",
            type: "Documentation",
            releaseNote: "",
            internal: false,
            products: ["review", "studio", "default"],
            link: [],
          },
          1231: {
            name: "Test 4",
            type: "Bug",
            releaseNote: "Special release note",
            internal: false,
            products: [],
            link: [],
          },
        } as const;

        // Ignoring session initalization request with query_schemas etc
        if (requestBody.length > 1) {
          return res(ctx.json([{}, []]));
        }

        const taskId = requestBody[0].expression.match(
          /where id is (.+)$/,
        )[1] as keyof typeof mocks;
        return res(
          ctx.json([
            {
              action: "query",
              data: [
                {
                  name: mocks[taskId].name ?? "Unknown task",
                  id: taskId,
                  __entity_type__: "Task",
                  link: mocks[taskId].link,
                  type: {
                    name: mocks[taskId].type,
                  },
                  custom_attributes: [
                    {
                      value: mocks[taskId].products,
                      key: "products",
                    },
                    {
                      value: mocks[taskId].releaseNote,
                      key: "release_note",
                    },
                    {
                      value: mocks[taskId].internal,
                      key: "internal_change",
                    },
                  ],
                },
              ],
            },
          ]),
        );
      }),
    );
  });

  it("Generates release notes from release data", async () => {
    const releaseNotes = await generateReleaseNotes(
      "studio",
      await getTaskDataFromReleaseBody(
        releaseData.event.release.body,
        releaseData.owner,
        releaseData.event.repository.name,
      ),
      releaseData.owner,
      releaseData.event.repository.name,
      releaseData.event.release.tag_name,
      `<p id="header">Here are the latest release notes</p>`,
    );
    expect(releaseNotes).toEqual(
      `<p id="header">Here are the latest release notes</p><h2>Latest changes</h2><ul><li data-taskid="1234" data-repo="test-owner/test-repo" data-tagname="v1.0.1"><strong>NEW</strong> Test 1</li><li data-taskid="8910" data-repo="test-owner/test-repo" data-tagname="v1.0.1"><strong>NEW</strong> Test 3</li></ul>`,
    );
  });

  it("Generates release notes from release data when already having earlier data", async () => {
    const releaseNotes = await generateReleaseNotes(
      "studio",
      await getTaskDataFromReleaseBody(
        releaseData.event.release.body,
        releaseData.owner,
        releaseData.event.repository.name,
      ),
      releaseData.owner,
      releaseData.event.repository.name,
      releaseData.event.release.tag_name,
      `<h2>2023-06.1</h2><ul><li id="0123">Previous release note 1</li><li id="345">Previous release note 2</li></ul>`,
    );

    expect(releaseNotes).toEqual(
      `<h2>Latest changes</h2><ul><li data-taskid="1234" data-repo="test-owner/test-repo" data-tagname="v1.0.1"><strong>NEW</strong> Test 1</li><li data-taskid="8910" data-repo="test-owner/test-repo" data-tagname="v1.0.1"><strong>NEW</strong> Test 3</li></ul><h2>2023-06.1</h2><ul><li id="0123">Previous release note 1</li><li id="345">Previous release note 2</li></ul>`,
    );
  });

  it("Skips release notes if the same ID has already been posted", async () => {
    const releaseNotes = await generateReleaseNotes(
      "studio",
      await getTaskDataFromReleaseBody(
        releaseData.event.release.body,
        releaseData.owner,
        releaseData.event.repository.name,
      ),
      releaseData.owner,
      releaseData.event.repository.name,
      releaseData.event.release.tag_name,
      `<h2>2023-06.1</h2><ul><li data-taskid="8910">Previous release note 1</li><li data-taskid="345">Previous release note 2</li></ul>`,
    );

    expect(releaseNotes).toEqual(
      `<h2>Latest changes</h2><ul><li data-taskid="1234" data-repo="test-owner/test-repo" data-tagname="v1.0.1"><strong>NEW</strong> Test 1</li></ul><h2>2023-06.1</h2><ul><li data-taskid="8910">Previous release note 1</li><li data-taskid="345">Previous release note 2</li></ul>`,
    );
  });
});
