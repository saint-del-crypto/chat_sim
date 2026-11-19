// 人設檔編碼/解碼工具
//   node tools/codec.mjs encode   → 讀 tools/characters.src.json，寫出 data/characters.js
//   node tools/codec.mjs decode   → 讀 data/characters.js，還原成 tools/characters.src.json
//
// 這只是「混淆」，不是加密：目的是讓玩家翻 repo 或按 F12 時看不到人設，
// 而不是防止有決心的人破解。真正要鎖住人設必須把它放在伺服器端（見 README 路線 2）。
import fs from "node:fs";

const KEY = "chat_sim_persona_v1";

function xor(buf) {
  const k = Buffer.from(KEY, "utf8");
  const out = Buffer.alloc(buf.length);
  for (let i = 0; i < buf.length; i++) out[i] = buf[i] ^ k[i % k.length];
  return out;
}

function encode(text) {
  const once = Buffer.from(text, "utf8").toString("base64");
  return xor(Buffer.from(once, "utf8")).toString("base64");
}

function decode(blob) {
  const once = xor(Buffer.from(blob, "base64")).toString("utf8");
  return Buffer.from(once, "base64").toString("utf8");
}

const mode = process.argv[2];

if (mode === "encode") {
  const json = fs.readFileSync("tools/characters.src.json", "utf8");
  const blob = encode(JSON.stringify(JSON.parse(json)));
  const lines = blob.match(/.{1,120}/g).map((l) => '  "' + l + '"').join(",\n");
  fs.writeFileSync(
    "data/characters.js",
    `/* 角色人設檔（已編碼）
 * 內容為玩家不應看到的人設資料，故不以明文存放。
 * 編輯方式：node tools/codec.mjs decode → 改 tools/characters.src.json → node tools/codec.mjs encode
 */
window.__CS_DATA = [
${lines}
].join("");
`,
    "utf8"
  );
  console.log("encoded →  data/characters.js  (" + blob.length + " chars)");
} else if (mode === "decode") {
  const js = fs.readFileSync("data/characters.js", "utf8");
  const blob = (js.match(/"[A-Za-z0-9+/=]{4,}"/g) || []).map((s) => s.slice(1, -1)).join("");
  const text = decode(blob);
  fs.writeFileSync("tools/characters.src.json", JSON.stringify(JSON.parse(text), null, 2), "utf8");
  console.log("decoded →  tools/characters.src.json");
} else {
  console.log("用法：node tools/codec.mjs encode | decode");
  process.exit(1);
}
