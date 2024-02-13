export function checkEnvironment() {
  if (
    !process.env.FTRACK_API_KEY ||
    !process.env.FTRACK_LOGIN_EMAIL ||
    !process.env.FTRACK_URL ||
    !process.env.GITHUB_PAYLOAD ||
    !process.env.GITHUB_TOKEN
  ) {
    console.error(
      "This script is intended to be run in CI only. To run locally for development, please check the README.",
    );
    console.debug("Set environment variables: ", {
      FTRACK_API_KEY: process.env.FTRACK_API_KEY,
      FTRACK_LOGIN_EMAIL: process.env.FTRACK_LOGIN_EMAIL,
      FTRACK_URL: process.env.FTRACK_URL,
      GITHUB_PAYLOAD: process.env.GITHUB_PAYLOAD,
      GITHUB_TOKEN: process.env.GITHUB_TOKEN,
    });
    process.exit(1);
  }
}
