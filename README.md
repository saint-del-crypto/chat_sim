# 曖昧 · chat sim

一個純靜態的曖昧對話遊戲原型。玩家挑一個角色，透過聊天室慢慢認識她；
當後台判定她真的有意願時，她會在對話中自然地提出或答應見面 —— 那就是成功結局。

**好感度全程不顯示、不暗示。**

## 玩法

1. 開啟網站，右上角 ⚙ 填入自己的 Anthropic API Key（路線 1：BYOK）
2. 選一個角色，開始聊
3. 聊到她願意出門為止

## 設計重點

| 機制 | 做法 |
|---|---|
| 人設 | 每個角色一份完整生命史（家庭、求學、工作、感情史、興趣、價值觀、說話習慣、地雷、軟肋），整份注入系統提示詞。玩家不可見。 |
| 黑箱 | 評分由**獨立的第二次 LLM 呼叫**執行（裁判層），演角色的模型不知道分數，提示詞中明確禁止透露任何系統狀態。 |
| 五維評分 | 自我揭露、回應品質、共感與記憶、節奏與邊界感、獨特性。各角色權重不同。 |
| 難度 | 多重門檻（總分 + 共感下限 + 節奏下限 + 最少回合數），到門檻後還有隨機延遲，玩家摸不出規律。 |
| 致命失誤 | 踩地雷直接倒退並**降低分數上限**，三次則結局為對方不再回覆。 |
| 心情噪音 | 角色每 8 句換一次「今天的狀態」（忙、累、心情好…），與好感度無關，用來掩蓋態度變化的訊號。 |
| 記憶 | 裁判層同時抽取「她會記在心上的事」回寫進提示詞，讓她記得玩家提過的細節。 |
| 邊際遞減 | 分數越高越難再加分。 |

## 檔案結構

```
index.html              選角 + 聊天室 + 設定
css/style.css
data/characters.js      人設檔（已編碼，玩家讀不到）
js/personas.js          解碼層
js/avatar.js            程序化 SVG 頭像（零素材授權風險）
js/store.js             localStorage 存檔 / 匯出匯入
js/llm.js               API 呼叫層（換成 proxy 只需改這一支）
js/engine.js            人設注入、心情噪音、裁判層、門檻判定
tools/codec.mjs         人設編碼/解碼工具
```

## 編輯人設

人設以 XOR + 雙層 base64 編碼後才進 repo，明文的 `tools/characters.src.json` 不進版控。

```bash
node tools/codec.mjs decode   # data/characters.js → tools/characters.src.json
# 編輯 tools/characters.src.json
node tools/codec.mjs encode   # 寫回 data/characters.js
```

這是**混淆，不是加密**。有決心的人按 F12 仍能從記憶體挖出人設與分數。
要真正鎖住，必須升級到路線 2。

## 部署（GitHub Pages）

Settings → Pages → Source 選 `Deploy from a branch`，Branch 選 `main` / `/ (root)`，存檔即可。
沒有建置步驟，push 就上線。

## 升級路線 2（proxy，讓 key 與分數都安全）

1. 在 Cloudflare Workers 或 Vercel Functions 放一支 proxy，API key 放環境變數
2. 把 `js/llm.js` 的 `ENDPOINT` 換成 proxy 網址，移除 `x-api-key` 與
   `anthropic-dangerous-direct-browser-access` 兩個 header
3. 把 `js/engine.js` 的裁判層與門檻判定搬到伺服器端，前端只收到角色的回話

前端其餘程式不需要改動。

## 注意

- 角色皆為虛構成年人物，不使用任何真人照片或外部素材
- 對話內容由 LLM 即時生成，可能偏離設定
