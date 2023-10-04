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
  const url = `${baseUrl}/api/v2/help_center/articles/${articleId}`;
  console.log(
    "Fetching zendesk with url:",
    `${baseUrl}/api/v2/help_center/articles/${articleId}`,
  );
  return (
    await fetch(url, {
      headers,
    })
  ).json();
}

export async function updateArticle(
  baseUrl: string,
  body: string,
  articleId: string,
) {
  const url = `${baseUrl}/api/v2/help_center/articles/${articleId}/translations/en-us`;
  console.log("Updating zendesk article on url:", url);
  const result = await fetch(url, {
    method: "PUT",
    headers,
    body: JSON.stringify({ translation: { body } }),
  });

  return await result.json();
}
