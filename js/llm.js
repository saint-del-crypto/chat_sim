/* LLM 呼叫層（BYOK：瀏覽器直連 Anthropic API）
 * 注意：路線 1 原型 —— API key 存在玩家自己的 localStorage，由玩家自備。
 * 未來升級成 proxy 時，只需要把 ENDPOINT 換成自家 Worker 的網址，
 * 並移除 x-api-key / anthropic-dangerous-direct-browser-access 兩個 header。
 */
window.LLM = (function () {
  const ENDPOINT = "https://api.anthropic.com/v1/messages";

  async function call({ system, messages, model, maxTokens = 400, temperature = 1 }) {
    const key = Store.getApiKey();
    if (!key) throw new Error("NO_KEY");

    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        // 瀏覽器直連必須的 header；走 proxy 時不需要
        "anthropic-dangerous-direct-browser-access": "true"
      },
      body: JSON.stringify({
        model: model || Store.getModel(),
        max_tokens: maxTokens,
        temperature,
        system,
        messages
      })
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      if (res.status === 401) throw new Error("BAD_KEY");
      if (res.status === 429) throw new Error("RATE_LIMIT");
      throw new Error("API_" + res.status + ": " + text.slice(0, 200));
    }

    const data = await res.json();
    return (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
  }

  return { call };
})();
