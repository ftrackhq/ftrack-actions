import { describe, it, expect, beforeAll, vi } from "vitest";
import { getNotesRequestBody } from "./sync_pr_status.js";
import { server } from "../../test_server.js";
import { rest } from "msw";

// Start server before all tests
beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2022, 0, 1, 0, 0, 0));
});

describe("ftrack sync", () => {
  it("shouldn't do anything if not finding a FT-xxxxx in the PR body", async () => {
    expect(
      await getNotesRequestBody({
        body: null,
        html_url: "http://github.com/ftrackhq/javascript-api/pulls/14",
        draft: false,
        merged_at: "",
        state: "",
      }),
    ).toEqual([]);

    expect(
      await getNotesRequestBody({
        body: "hello world",
        html_url: "http://github.com/ftrackhq/javascript-api/pulls/14",
        draft: false,
        merged_at: "",
        state: "",
      }),
    ).toEqual([]);

    expect(
      await getNotesRequestBody({
        body: "hello FT- world",
        html_url: "http://github.com/ftrackhq/javascript-api/pulls/14",
        draft: false,
        merged_at: "",
        state: "",
      }),
    ).toEqual([]);
  });

  it("should update a note for FT-1234 in the PR body if already exists a note for it", async () => {
    server.use(
      rest.post(process.env.FTRACK_URL + "/api", (req, res, ctx) => {
        return res(
          ctx.json([
            {
              action: "query",
              data: [
                {
                  parent_id: "1234",
                  id: "a2cd73b2-6981-584a-97ec-05b3698740d8",
                  __entity_type__: "Note",
                },
              ],
            },
          ]),
        );
      }),
    );
    expect(
      await getNotesRequestBody({
        body: "hello FT-1234 world",
        html_url: "http://github.com/ftrackhq/javascript-api/pulls/14",
        draft: false,
        merged_at: "",
        state: "",
      }),
    ).toEqual([
      {
        action: "update",
        entity_key: "a2cd73b2-6981-584a-97ec-05b3698740d8",
        entity_type: "Note",
        entity_data: {
          id: "a2cd73b2-6981-584a-97ec-05b3698740d8",
          parent_id: "1234",
          content:
            "PR opened: [ftrackhq/javascript-api/pulls/14](http://github.com/ftrackhq/javascript-api/pulls/14)\n" +
            "\n" +
            "Last change: 2022-01-01 00:00 GMT<br />\n" +
            "Current status: unknown",
          parent_type: "TypedContext",
          user_id: "user-id",
        },
      },
    ]);
  });

  it("should create a note for FT-1234 in the PR body if not already existing", async () => {
    server.use(
      rest.post(process.env.FTRACK_URL + "/api", (req, res, ctx) => {
        return res(
          ctx.json([
            {
              action: "query",
              data: [],
            },
          ]),
        );
      }),
    );
    expect(
      await getNotesRequestBody({
        body: "hello FT-1234 world",
        html_url: "http://github.com/ftrackhq/javascript-api/pulls/14",
        draft: false,
        merged_at: "",
        state: "",
      }),
    ).toEqual([
      {
        action: "create",
        entity_key: "a2cd73b2-6981-584a-97ec-05b3698740d8",
        entity_type: "Note",
        entity_data: {
          id: "a2cd73b2-6981-584a-97ec-05b3698740d8",
          parent_id: "1234",
          content:
            "PR opened: [ftrackhq/javascript-api/pulls/14](http://github.com/ftrackhq/javascript-api/pulls/14)\n" +
            "\n" +
            "Last change: 2022-01-01 00:00 GMT<br />\n" +
            "Current status: unknown",
          parent_type: "TypedContext",
          user_id: "user-id",
        },
      },
    ]);
  });

  it("should create notes for FT-1234 and FT-5678 in the PR body, updating 1234 and creating 5678", async () => {
    server.use(
      rest.post(process.env.FTRACK_URL + "/api", (req, res, ctx) => {
        return res(
          ctx.json([
            {
              action: "query",
              data: [
                {
                  parent_id: "1234",
                  id: "a2cd73b2-6981-584a-97ec-05b3698740d8",
                  __entity_type__: "Note",
                },
              ],
            },
          ]),
        );
      }),
    );

    expect(
      await getNotesRequestBody({
        body: "hello FT-1234 FT-5678 world",
        html_url: "http://github.com/ftrackhq/javascript-api/pulls/14",
        draft: false,
        merged_at: "",
        state: "",
      }),
    ).toEqual([
      {
        action: "create",
        entity_key: "c51d043b-1914-52f0-958b-754d1ef772c5",
        entity_type: "Note",
        entity_data: {
          id: "c51d043b-1914-52f0-958b-754d1ef772c5",
          parent_id: "5678",
          content:
            "PR opened: [ftrackhq/javascript-api/pulls/14](http://github.com/ftrackhq/javascript-api/pulls/14)\n" +
            "\n" +
            "Last change: 2022-01-01 00:00 GMT<br />\n" +
            "Current status: unknown",
          parent_type: "TypedContext",
          user_id: "user-id",
        },
      },
      {
        action: "update",
        entity_key: "a2cd73b2-6981-584a-97ec-05b3698740d8",
        entity_type: "Note",
        entity_data: {
          id: "a2cd73b2-6981-584a-97ec-05b3698740d8",
          parent_id: "1234",
          content:
            "PR opened: [ftrackhq/javascript-api/pulls/14](http://github.com/ftrackhq/javascript-api/pulls/14)\n" +
            "\n" +
            "Last change: 2022-01-01 00:00 GMT<br />\n" +
            "Current status: unknown",
          parent_type: "TypedContext",
          user_id: "user-id",
        },
      },
    ]);
  });
  it("show give correct status for draft PRs", async () => {
    server.use(
      rest.post(process.env.FTRACK_URL + "/api", (req, res, ctx) => {
        return res(
          ctx.json([
            {
              action: "query",
              data: [
                {
                  parent_id: "1234",
                  id: "a2cd73b2-6981-584a-97ec-05b3698740d8",
                  __entity_type__: "Note",
                },
              ],
            },
          ]),
        );
      }),
    );
    expect(
      await getNotesRequestBody({
        body: "hello FT-1234 world",
        html_url: "http://github.com/ftrackhq/javascript-api/pulls/14",
        merged_at: "",
        state: "",
        draft: true,
      }),
    ).toEqual([
      {
        action: "update",
        entity_key: "a2cd73b2-6981-584a-97ec-05b3698740d8",
        entity_type: "Note",
        entity_data: {
          id: "a2cd73b2-6981-584a-97ec-05b3698740d8",
          parent_id: "1234",
          content:
            "PR opened: [ftrackhq/javascript-api/pulls/14](http://github.com/ftrackhq/javascript-api/pulls/14)\n" +
            "\n" +
            "Last change: 2022-01-01 00:00 GMT<br />\n" +
            "Current status: draft",
          parent_type: "TypedContext",
          user_id: "user-id",
        },
      },
    ]);
  });
  it("show give correct status for merged PRs", async () => {
    server.use(
      rest.post(process.env.FTRACK_URL + "/api", (req, res, ctx) => {
        return res(
          ctx.json([
            {
              action: "query",
              data: [
                {
                  parent_id: "1234",
                  id: "a2cd73b2-6981-584a-97ec-05b3698740d8",
                  __entity_type__: "Note",
                },
              ],
            },
          ]),
        );
      }),
    );
    expect(
      await getNotesRequestBody({
        body: "hello FT-1234 world",
        html_url: "http://github.com/ftrackhq/javascript-api/pulls/14",
        merged_at: "2022-10-17T07:58:36Z",
        draft: false,
        state: "",
      }),
    ).toEqual([
      {
        action: "update",
        entity_key: "a2cd73b2-6981-584a-97ec-05b3698740d8",
        entity_type: "Note",
        entity_data: {
          id: "a2cd73b2-6981-584a-97ec-05b3698740d8",
          parent_id: "1234",
          content:
            "PR opened: [ftrackhq/javascript-api/pulls/14](http://github.com/ftrackhq/javascript-api/pulls/14)\n" +
            "\n" +
            "Last change: 2022-01-01 00:00 GMT<br />\n" +
            "Current status: merged",
          parent_type: "TypedContext",
          user_id: "user-id",
        },
      },
    ]);
  });
  it("should give correct status for open PRs", async () => {
    server.use(
      rest.post(process.env.FTRACK_URL + "/api", (req, res, ctx) => {
        return res(
          ctx.json([
            {
              action: "query",
              data: [
                {
                  parent_id: "1234",
                  id: "a2cd73b2-6981-584a-97ec-05b3698740d8",
                  __entity_type__: "Note",
                },
              ],
            },
          ]),
        );
      }),
    );
    expect(
      await getNotesRequestBody({
        body: "hello FT-1234 world",
        html_url: "http://github.com/ftrackhq/javascript-api/pulls/14",
        state: "open",
        draft: false,
        merged_at: "",
      }),
    ).toEqual([
      {
        action: "update",
        entity_key: "a2cd73b2-6981-584a-97ec-05b3698740d8",
        entity_type: "Note",
        entity_data: {
          id: "a2cd73b2-6981-584a-97ec-05b3698740d8",
          parent_id: "1234",
          content:
            "PR opened: [ftrackhq/javascript-api/pulls/14](http://github.com/ftrackhq/javascript-api/pulls/14)\n" +
            "\n" +
            "Last change: 2022-01-01 00:00 GMT<br />\n" +
            "Current status: open",
          parent_type: "TypedContext",
          user_id: "user-id",
        },
      },
    ]);
  });

  it("should make sure that each task has products or internal set", async () => {
    server.use(
      rest.post(process.env.FTRACK_URL + "/api", (req, res, ctx) => {
        return res(
          ctx.json([
            {
              action: "query",
              data: [
                {
                  parent_id: "1234",
                  id: "a2cd73b2-6981-584a-97ec-05b3698740d8",
                  __entity_type__: "Note",
                },
              ],
            },
          ]),
        );
      }),
    );
  });
});