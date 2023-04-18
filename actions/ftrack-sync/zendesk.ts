// Sends a request to Zendesk to create a new article draft

const ZENDESK_BASE_URL = "https://backlight-support-staging.zendesk.com";
const ZENDESK_USERNAME = process.env.ZENDESK_USERNAME;
const ZENDESK_API_KEY = process.env.ZENDESK_API_KEY;

const headers = {
  "Content-Type": "application/json",
  Authorization: `Basic ${Buffer.from(
    ZENDESK_USERNAME + ":" + ZENDESK_API_KEY,
  ).toString("base64")}`,
};

export async function getArticle(articleId: string) {
  return (
    await fetch(
      `${ZENDESK_BASE_URL}/api/v2/help_center/articles/${articleId}`,
      { headers },
    )
  ).json();
}

export async function updateArticle(body: string, articleId: string) {
  const result = await fetch(
    `${ZENDESK_BASE_URL}/api/v2/help_center/articles/${articleId}/translations/en-us`,
    { method: "PUT", headers, body: JSON.stringify({ translation: { body } }) },
  );

  return await result.json();
}
