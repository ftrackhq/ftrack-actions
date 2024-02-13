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
    process.exit(1);
  }
}
