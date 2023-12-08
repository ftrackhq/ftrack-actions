import { setupServer } from "msw/node";

process.env.FTRACK_URL = "http://ftrackinstance.example";
process.env.FTRACK_LOGIN_EMAIL = "email@example.com";
process.env.FTRACK_USER_ID = "user-id";
process.env.GITHUB_TOKEN = "github-token";

export const server = setupServer();
