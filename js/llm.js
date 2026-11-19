/* LLM 呼叫層（BYOK：瀏覽器直連 Anthropic API）
 * 升級成 proxy 時只需改 ENDPOINT，並移除 x-api-key 與
 * anthropic-dangerous-direct-browser-access 兩個 header。
 */
window.LLM = (function () {
  const ENDPOINT = "https://api.anthropic.com/v1/messages";

  async function post(body) {
    const key = Store.getApiKey();
    if (!key) throw new Error("NO_KEY");

    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true"
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      if (res.status === 401) throw new Error("BAD_KEY");
      if (res.status === 429) throw new Error("RATE_LIMIT");
      const err = new Error("API_" + res.status + ": " + text.slice(0, 200));
      err.status = res.status;
      err.body = text;
      throw err;
    }
    return res.json();
  }

  async function call({ system, messages, model, maxTokens = 400, temperature }) {
    const body = {
      model: model || Store.getModel(),
      max_tokens: maxTokens,
      system,
      messages
    };
    // 有些模型已不接受 temperature，預設就不送
    if (typeof temperature === "number") body.temperature = temperature;

    let data;
    try {
      data = await post(body);
    } catch (e) {
      // 若是 temperature 被拒，拿掉重送一次
      if (e.status === 400 && /temperature/i.test(e.body || "") && "temperature" in body) {
        delete body.temperature;
        data = await post(body);
      } else {
        throw e;
      }
    }

    return (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
  }

  return { call };
})();
