import { describe, it, expect } from "vitest";
import { assertTasksHaveProductFieldSet } from "./check_tasks.js";

import { server } from "../../test_server.js";
import { HttpResponse, http } from "msw";

describe("ftrack sync", () => {
  it("Should fail if a task does not have a product, or internal_change set", () => {
    server.use(
      http.post(process.env.FTRACK_URL + "/api", async ({ request }) => {
        // Ignoring session initalization request with query_schemas etc
        if (((await request.clone().json()) as unknown[]).length > 1) return;
        return HttpResponse.json([
          {
            action: "query",
            data: [
              {
                id: "123a",
                __entity_type__: "Task",
                custom_attributes: [
                  { key: "products", value: [] },
                  { key: "internal_change", value: false },
                ],
              },
            ],
          },
        ]);
      }),
    );
    expect(() =>
      assertTasksHaveProductFieldSet({
        body: "Resolves FT-123a",
        draft: false,
        merged_at: "",
        state: "",
      }),
    ).rejects.toThrow(
      `Task 123a is missing products or internal_change attribute, please set them in ftrack `,
    );
  });

  it("Should pass if a task does have a product", () => {
    server.use(
      http.post(process.env.FTRACK_URL + "/api", async ({ request }) => {
        // Ignoring session initalization request with query_schemas etc
        if (((await request.json()) as unknown[]).length > 1) return;
        return HttpResponse.json([
          {
            action: "query",
            data: [
              {
                id: "123a",
                __entity_type__: "Task",
                custom_attributes: [
                  { key: "products", value: ["studio"] },
                  { key: "internal_change", value: false },
                ],
              },
            ],
          },
        ]);
      }),
    );
    expect(
      assertTasksHaveProductFieldSet({
        body: "Resolves FT-123a",
        draft: false,
        merged_at: "",
        state: "",
      }),
    ).resolves.not.toThrow();
  });

  it("Should pass if a task has internal set", () => {
    server.use(
      http.post(process.env.FTRACK_URL + "/api", async ({ request }) => {
        // Ignoring session initalization request with query_schemas etc
        if (((await request.json()) as unknown[]).length > 1) return;
        return HttpResponse.json([
          {
            action: "query",
            data: [
              {
                id: "123a",
                __entity_type__: "Task",
                custom_attributes: [
                  { key: "products", value: [] },
                  { key: "internal_change", value: true },
                ],
              },
            ],
          },
        ]);
      }),
    );
    expect(
      assertTasksHaveProductFieldSet({
        body: "Resolves FT-123a",
        draft: false,
        merged_at: "",
        state: "",
      }),
    ).resolves.not.toThrow();
  });

  it("Should pass if a task has both set", () => {
    server.use(
      http.post(process.env.FTRACK_URL + "/api", () => {
        return HttpResponse.json([
          {
            action: "query",
            data: [
              {
                id: "123a",
                __entity_type__: "Task",
                custom_attributes: [
                  { key: "products", value: ["studio"] },
                  { key: "internal_change", value: true },
                ],
              },
            ],
          },
        ]);
      }),
    );
    expect(
      assertTasksHaveProductFieldSet({
        body: "Resolves FT-123a",
        draft: false,
        merged_at: "",
        state: "",
      }),
    ).resolves.not.toThrow();
  });
});
