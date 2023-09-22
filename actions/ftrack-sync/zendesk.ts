// Sends a request to Zendesk to create a new article draft

const ZENDESK_USERNAME = process.env.ZENDESK_USERNAME;
const ZENDESK_API_KEY = process.env.ZENDESK_API_KEY;

const headers = {
  "Content-Type": "application/json",
  Authorization: `Basic ${Buffer.from(
    ZENDESK_USERNAME + ":" + ZENDESK_API_KEY,
  ).toString("base64")}`,
};

export async function getArticle(baseUrl: string, articleId: string) {
  return (
    await fetch(`${baseUrl}/api/v2/help_center/articles/${articleId}`, {
      headers,
    })
  ).json();
}

export async function updateArticle(
  baseUrl: string,
  body: string,
  articleId: string,
) {
  const result = await fetch(
    `${baseUrl}/api/v2/help_center/articles/${articleId}/translations/en-us`,
    { method: "PUT", headers, body: JSON.stringify({ translation: { body } }) },
  );

  return await result.json();
}
