import { getNotesRequestBody, requestHeaders } from "./ftrack_sync.js";

if (!process.env.FTRACK_API_KEY || !process.env.PR_JSON) {
  console.error(`This script is intended to be run in CI only. To run locally for development, use:
FTRACK_API_KEY="[dev api key]" PR_JSON='{"url":"https://github.com/ftrackhq/frontend/pull/120","body":"Resolves FTRACK-c018c026-3599-11ed-8012-aab5768efa1e"}' node ftrack-sync.js
`);
  process.exit(1);
}

const PR_JSON = JSON.parse(process.env.PR_JSON);
console.log("Input:", PR_JSON);

const notes = await getNotesRequestBody(PR_JSON);

if (notes.length === 0) {
  console.log("Couldn't find any notes to update, exiting...");
  process.exit(0);
}

console.log("Creating notes:", notes);

try {
  const response = await (
    await fetch("https://dev.ftrackapp.com/api", {
      method: "POST",
      headers: requestHeaders,
      body: JSON.stringify(notes),
    })
  ).json();
  console.log("Response: ", response);
} catch (err) {
  console.error(err);
}
