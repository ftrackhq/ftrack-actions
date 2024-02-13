import { describe, it, expect, vi } from "vitest";
import { server } from "./test_server.js";
import {
  APPROVAL_STATUS,
  updateReleaseApprovalStatus,
} from "./sync_deployment_approval.js";
import { HttpResponse, http, type PathParams } from "msw";
import githubPayload from "./fixtures/github_payload_on_push_tag.json";

describe("sync release approval status", () => {
  it("should update release approval status", async () => {
    const requestSpy = vi.fn();
    server.use(
      http.post<PathParams, any>(
        process.env.FTRACK_URL + "/api",
        async ({ request }) => {
          const requestBody = await request.clone().json();
          // Ignoring session initalization request with query_schemas etc
          if (requestBody.length > 1) return;

          requestSpy(requestBody);

          if (
            requestBody[0].action === "query" &&
            requestBody[0].expression.includes("Change")
          ) {
            return HttpResponse.json([
              {
                action: "query",
                data: [
                  {
                    id: "1234",
                    __entity_type__: "Change",
                    status_id: "1234",
                  },
                ],
              },
            ]);
          }

          if (
            requestBody[0].action === "query" &&
            requestBody[0].expression.includes("Release")
          ) {
            return HttpResponse.json([
              {
                action: "query",
                data: [
                  {
                    id: "1234",
                    name: "ftrack-actions v0.0.0-test.15",
                    __entity_type__: "Release",
                  },
                ],
              },
            ]);
          }

          if (
            requestBody[0].action === "query" &&
            requestBody[0].expression.includes("User")
          ) {
            return HttpResponse.json([
              {
                action: "query",
                data: [
                  {
                    id: "1234",
                    first_name: "John",
                    last_name: "Doe",
                    email: "john.doe@example.com",
                  },
                ],
              },
            ]);
          }

          if (requestBody[0].action === "update") {
            return HttpResponse.json([
              {
                action: "update",
                data: { status_id: "1234" },
              },
            ]);
          }

          if (
            requestBody[0].action === "create" &&
            requestBody[0].entity_type === "Note"
          ) {
            return HttpResponse.json([
              {
                action: "create",
                data: {},
              },
            ]);
          }
        },
      ),
      http.get(
        "https://api.github.com/repos/ftrackhq/ftrack-actions/actions/runs/8360537201/approvals",
        () => {
          return HttpResponse.json([
            {
              user: {
                login: "test",
              },
              state: "approved",
              comment: "comment",
            },
          ]);
        },
      ),
    );

    await updateReleaseApprovalStatus(githubPayload, "APPROVED");
    expect(requestSpy).toHaveBeenCalledWith([
      {
        action: "query",
        expression:
          'select id from Change where name is "Deploy ftrack-actions v0.0.0-test.15"',
      },
    ]);
    expect(requestSpy).toHaveBeenCalledWith([
      {
        action: "update",
        entity_key: ["1234"],
        entity_type: "Change",
        entity_data: {
          __entity_type__: "Change",
          status_id: APPROVAL_STATUS.APPROVED,
        },
      },
    ]);

    requestSpy.mockClear();

    await updateReleaseApprovalStatus(githubPayload, "REJECTED");
    expect(requestSpy).toHaveBeenCalledWith([
      {
        action: "query",
        expression:
          'select id from Change where name is "Deploy ftrack-actions v0.0.0-test.15"',
      },
    ]);
    expect(requestSpy).toHaveBeenCalledWith([
      {
        action: "update",
        entity_key: ["1234"],
        entity_type: "Change",
        entity_data: {
          __entity_type__: "Change",
          status_id: APPROVAL_STATUS.REJECTED,
        },
      },
    ]);
  });
});
