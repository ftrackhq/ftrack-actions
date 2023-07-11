import { describe, it, expect } from "vitest";
import { assertTasksHaveProductFieldSet } from "./check_tasks.js";

import { server } from "../../test_server.js";
import { rest } from "msw";

describe("ftrack sync", () => {
  it("Should fail if a task does not have a product, or internal_change set", () => {
    server.use(
      rest.post(process.env.FTRACK_URL + "/api", async (req, res, ctx) => {
        // Ignoring session initalization request with query_schemas etc
        if ((await req.json()).length > 1) return;
        return res(
          ctx.json([
            {
              action: "query",
              data: [
                {
                  id: "1234",
                  __entity_type__: "Task",
                  custom_attributes: [
                    { key: "products", value: [] },
                    { key: "internal_change", value: false },
                  ],
                },
              ],
            },
          ]),
        );
      }),
    );
    expect(() =>
      assertTasksHaveProductFieldSet({
        body: "Resolves FT-1234",
        draft: false,
        merged_at: "",
        state: "",
      }),
    ).rejects.toThrow(
      `Task 1234 is missing products or internal_change attribute, please set them in ftrack `,
    );
  });

  it("Should pass if a task does have a product", () => {
    server.use(
      rest.post(process.env.FTRACK_URL + "/api", async (req, res, ctx) => {
        // Ignoring session initalization request with query_schemas etc
        if ((await req.json()).length > 1) return;
        return res(
          ctx.json([
            {
              action: "query",
              data: [
                {
                  id: "1234",
                  __entity_type__: "Task",
                  custom_attributes: [
                    { key: "products", value: ["studio"] },
                    { key: "internal_change", value: false },
                  ],
                },
              ],
            },
          ]),
        );
      }),
    );
    expect(
      assertTasksHaveProductFieldSet({
        body: "Resolves FT-1234",
        draft: false,
        merged_at: "",
        state: "",
      }),
    ).resolves.not.toThrow();
  });

  it("Should pass if a task has internal set", () => {
    server.use(
      rest.post(process.env.FTRACK_URL + "/api", async (req, res, ctx) => {
        // Ignoring session initalization request with query_schemas etc
        if ((await req.json()).length > 1) return;
        return res(
          ctx.json([
            {
              action: "query",
              data: [
                {
                  id: "1234",
                  __entity_type__: "Task",
                  custom_attributes: [
                    { key: "products", value: [] },
                    { key: "internal_change", value: true },
                  ],
                },
              ],
            },
          ]),
        );
      }),
    );
    expect(
      assertTasksHaveProductFieldSet({
        body: "Resolves FT-1234",
        draft: false,
        merged_at: "",
        state: "",
      }),
    ).resolves.not.toThrow();
  });

  it("Should pass if a task has both set", () => {
    server.use(
      rest.post(process.env.FTRACK_URL + "/api", (req, res, ctx) => {
        return res(
          ctx.json([
            {
              action: "query",
              data: [
                {
                  id: "1234",
                  __entity_type__: "Task",
                  custom_attributes: [
                    { key: "products", value: ["studio"] },
                    { key: "internal_change", value: true },
                  ],
                },
              ],
            },
          ]),
        );
      }),
    );
    expect(
      assertTasksHaveProductFieldSet({
        body: "Resolves FT-1234",
        draft: false,
        merged_at: "",
        state: "",
      }),
    ).resolves.not.toThrow();
  });
});
