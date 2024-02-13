import { describe, it, expect, vi } from "vitest";
import { server } from "./test_server.js";
import {
  APPROVAL_STATUS,
  updateReleaseApprovalStatus,
} from "./sync_deployment_approval.js";
import { HttpResponse, http, type PathParams } from "msw";

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

          if (requestBody[0].action === "query") {
            return HttpResponse.json([
              {
                action: "query",
                data: [
                  {
                    id: "1234",
                    __entity_type__: "Release",
                    status_id: "1234",
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
        },
      ),
    );

    await updateReleaseApprovalStatus(
      "test-repo",
      "v1.0.1",
      APPROVAL_STATUS.APPROVED,
    );
    expect(requestSpy).toHaveBeenCalledWith([
      {
        action: "query",
        expression:
          'select id, name from Release where name is "test-repo v1.0.1"',
      },
    ]);
    expect(requestSpy).toHaveBeenCalledWith([
      {
        action: "update",
        entity_key: ["1234"],
        entity_type: "Release",
        entity_data: {
          __entity_type__: "Release",
          status_id: APPROVAL_STATUS.APPROVED,
        },
      },
    ]);

    requestSpy.mockClear();

    await updateReleaseApprovalStatus(
      "test-repo2",
      "v1.0.2",
      APPROVAL_STATUS.REJECTED,
    );
    expect(requestSpy).toHaveBeenCalledWith([
      {
        action: "query",
        expression:
          'select id, name from Release where name is "test-repo2 v1.0.2"',
      },
    ]);
    expect(requestSpy).toHaveBeenCalledWith([
      {
        action: "update",
        entity_key: ["1234"],
        entity_type: "Release",
        entity_data: {
          __entity_type__: "Release",
          status_id: APPROVAL_STATUS.REJECTED,
        },
      },
    ]);
  });
});
