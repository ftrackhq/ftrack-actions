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
  try {
    console.log(
      "Fetching zendesk with url:",
      `${baseUrl}/api/v2/help_center/articles/${articleId}`,
    );
    return (
      await fetch(url, {
        headers,
      })
    ).json();
  } catch (e) {
    console.error("Error fetching zendesk article for url:", url, e);
    throw e;
  }
}

export async function updateArticle(
  baseUrl: string,
  body: string,
  articleId: string,
) {
  const url = `${baseUrl}/api/v2/help_center/articles/${articleId}/translations/en-us`;
  try {
    console.log("Updating zendesk article on url:", url);
    const result = await fetch(url, {
      method: "PUT",
      headers,
      body: JSON.stringify({ translation: { body, draft: true } }),
    });
    return await result.json();
  } catch (e) {
    console.error("Error updating zendesk article for url:", url, e);
    throw e;
  }
}
