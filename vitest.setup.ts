import { beforeAll, afterAll, afterEach, beforeEach } from "vitest";
import fetch from "cross-fetch";
import { HttpResponse, http } from "msw";
import { server } from "./test_server.js";

global.fetch = fetch;

// Start server before all tests
beforeAll(() => {
  process.env.FTRACK_URL = "http://ftrackinstance.example";
  process.env.FTRACK_LOGIN_EMAIL = "email@example.com";
  process.env.FTRACK_API_KEY = "test-key";
  process.env.FTRACK_USER_ID = "user-id";
  server.listen({
    onUnhandledRequest(req) {
      throw new Error(
        `Found an unhandled ${req.method} request to ${new URL(req.url).href}`,
      );
    },
  });
});

beforeEach(() => {
  server.use(
    http.post(process.env.FTRACK_URL + "/api", async ({ request }) => {
      const requestBody = await request.json();
      // Ignoring session initalization request with query_schemas etc
      if (
        Array.isArray(requestBody) &&
        requestBody.length === 2 &&
        requestBody[0].action === "query_server_information" &&
        requestBody[1].action === "query_schemas"
      ) {
        console.log("Ignoring session initalization request", requestBody);
        return HttpResponse.json([{}, []]);
      }
    }),
  );
});

//  Close server after all tests
afterAll(() => server.close());

// Reset handlers after each test `important for test isolation`
afterEach(() => server.resetHandlers());
