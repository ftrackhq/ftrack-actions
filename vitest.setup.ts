import { beforeAll, afterAll, afterEach } from "vitest";
import fetch from "cross-fetch";
import { rest } from "msw";

global.fetch = fetch;

import { server } from "./test_server.js";

// Start server before all tests
beforeAll(() => {
  process.env.FTRACK_URL = "http://ftrackinstance.example";
  process.env.FTRACK_LOGIN_EMAIL = "email@example.com";
  process.env.FTRACK_API_KEY = "test-key";
  process.env.FTRACK_USER_ID = "user-id";
  server.listen({
    onUnhandledRequest(req) {
      throw new Error(
        `Found an unhandled ${req.method} request to ${req.url.href}`
      );
    },
  });
  server.use(
    rest.post(process.env.FTRACK_URL + "/api", async (req, res, ctx) => {
      const requestBody = await req.json();
      // Ignoring session initalization request with query_schemas etc
      if (requestBody.length > 1) {
        return res(ctx.json([{}, []]));
      }
    })
  );
});

//  Close server after all tests
afterAll(() => server.close());

// Reset handlers after each test `important for test isolation`
afterEach(() => server.resetHandlers());