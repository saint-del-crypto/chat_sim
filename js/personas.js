/* 人設解碼層。window.__CS_DATA 由 data/characters.js 提供（已編碼）。 */
window.CHARACTERS = (function () {
  const KEY = "chat_sim_persona_v1";

  function b64ToBytes(b64) {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function bytesToStr(bytes) {
    return new TextDecoder("utf-8").decode(bytes);
  }

  try {
    const bytes = b64ToBytes(window.__CS_DATA);
    const k = new TextEncoder().encode(KEY);
    const xored = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) xored[i] = bytes[i] ^ k[i % k.length];
    const inner = bytesToStr(xored);           // 仍是 base64
    const json = bytesToStr(b64ToBytes(inner)); // 還原成 JSON
    delete window.__CS_DATA;                    // 用完就從全域移除
    return JSON.parse(json);
  } catch (e) {
    console.error("角色資料載入失敗", e);
    return [];
  }
})();
