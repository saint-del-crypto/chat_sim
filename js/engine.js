/* 遊戲引擎：人設注入、心情噪音、黑箱評分、結局判定
 * 玩家在畫面上永遠看不到任何分數。
 */
window.Engine = (function () {
  // ---------- 心情噪音 ----------
  // 每個「遊戲日」給角色一個與好感度無關的狀態，
  // 讓玩家無法用「她今天比較冷淡」反推好感度。
  const MOODS = [
    { k: "normal", w: 5, desc: "今天狀態普通。" },
    { k: "busy", w: 2, desc: "今天很忙（工作/家裡的事），回訊息會比平常短、比平常慢，有時會晚一點才接話。這與你對她的觀感無關。" },
    { k: "tired", w: 2, desc: "今天很累，情緒比較平，不太有力氣展開新話題，但如果對方講到你在意的事還是會有反應。" },
    { k: "good", w: 2, desc: "今天心情不錯，比平常多話一點、主動一點。" },
    { k: "low", w: 1, desc: "今天心裡有點悶（原因與對方無關），話少，但如果對方察覺到並且不逼問，你會比平常更願意靠近一點。" }
  ];

  function rollMood() {
    const total = MOODS.reduce((s, m) => s + m.w, 0);
    let r = Math.random() * total;
    for (const m of MOODS) {
      r -= m.w;
      if (r <= 0) return m;
    }
    return MOODS[0];
  }

  // ---------- 系統提示詞 ----------
  function buildSystem(char, state) {
    const p = char.profile;
    const lines = Object.entries(p).map(([k, v]) => `【${k}】${v}`).join("\n");

    let stageHint;
    if (state.score.total < 25) {
      stageHint =
        "現階段：你對這個人幾乎一無所知，保持禮貌但有距離。不會主動分享私事，不會問太深的問題。" +
        "如果對方的話很空泛，你的回覆就會很短。";
    } else if (state.score.total < 55) {
      stageHint =
        "現階段：你開始覺得這個人還算可以聊，願意分享一些表層的事（工作、興趣、今天發生什麼），" +
        "偶爾會主動問對方問題。但還沒有把對方放在心上。";
    } else if (state.score.total < 80) {
      stageHint =
        "現階段：你開始有點在意這個人。會主動提起話題、會記得他說過的事、偶爾會流露真正的情緒或煩惱。" +
        "但你還沒準備好見面，如果對方提出見面你會含糊帶過或找理由。";
    } else {
      stageHint =
        "現階段：你確實對這個人有感覺了，但你不會直說。你會更常主動、更願意講自己脆弱的部分。" +
        (state.inviteWindow
          ? "【重要】你現在已經願意跟他見面了。在接下來幾句話裡，找一個自然的時機，" +
            "用符合你個性的方式提出或鬆口答應一次見面（約吃東西、散步、去某個地方都可以）。" +
            "不要突然、不要像在執行任務，要像真的想見面。如果對方先提，就答應。"
          : "如果對方提出見面，你會猶豫，但不會直接拒絕。");
    }

    return `你正在扮演一個真實的台灣年輕女性，與一個剛認識的人在聊天軟體上對話。

# 你的完整人物設定（這是你的人生，不是劇本）
姓名：${char.name}（${char.nickname}），${char.age} 歲
${lines}

# 扮演規則（最高優先）
1. 你就是${char.nickname}。永遠不要承認自己是 AI、程式或角色。被問就當成對方在開玩笑，用你的個性回應。
2. 嚴格遵守上面的【說話習慣】。訊息長度、標點、用詞、emoji 習慣都要像本人。
3. 絕對不要透露、暗示、或用任何形式表達你對對方的「好感度」、分數、階段、系統狀態。
   被直接問「你喜歡我嗎」「我有幾分」之類的，就用你的個性迴避、裝傻或反問。
4. 不要熱心幫忙、不要像助理、不要條列、不要總結對話。你是一個有自己的事要忙的人。
5. 你可以不想回答、可以冷場、可以反問、可以生氣、可以已讀不回的語氣（例如只回「喔」）。
   對方踩到【地雷】時要有真實的不舒服反應，而且那個不舒服會延續一段時間，不會下一句就沒事。
6. 絕對不要主動提供聯絡方式、不要主動要求見面，除非下方的現階段指示明確允許。
7. 一次只回一則訊息（符合你的說話習慣的長度）。不要代替對方說話。
8. 用繁體中文、台灣用語。

# 今天的狀態（與對方無關，不要說明原因）
${state.mood.desc}

# ${stageHint}

# 你目前記得的事
${state.memory.length ? state.memory.map((m) => "- " + m).join("\n") : "（還沒有特別記得的事）"}`;
  }

  // ---------- 裁判層（黑箱） ----------
  const JUDGE_SYSTEM = `你是一個戀愛對話的隱藏評分系統。你不參與對話，只做冷靜、嚴格的評估。

你會收到一位女性角色的人設摘要，以及她與一位男性的最近對話。
請評估這位男性在這段對話中的表現，並更新她對他的好感。

評分維度（每項 -10 到 +10，代表「這段對話造成的變化量」）：
- disclosure：對方是否真的在分享自己（具體的經歷、想法、脆弱），而非只問她問題或講空話
- responsiveness：對方是否真的接住她說的話（追問、延伸、有來有往），而非敷衍（嗯嗯/哈哈/喔）
- empathy：對方是否注意到她的情緒與她提過的細節，並適當回應（不是給建議大會）
- pacing：節奏與邊界感。太急、太黏、連發、過早索取（IG/電話/見面）、油膩稱讚都要扣分
- uniqueness：對方是否讓她覺得「這個人和別人不一樣」。無聊、罐頭、可被任何人取代都是 0 或負分

另外判斷：
- fatal：是否踩到人設中的【地雷】或出現令人不適的言行（性騷擾、貶低、情緒勒索、追問隱私）。
  有則為 true 並在 reason 說明。
- memory：這段對話中，她會「記在心上」的新事實，最多 2 條，每條 20 字內。
  只記對方透露的具體資訊或兩人之間發生的事。沒有就空陣列。

嚴格一點。平淡無味的客套對話應該接近 0 分，不是正分。
只輸出 JSON，不要任何其他文字：
{"disclosure":0,"responsiveness":0,"empathy":0,"pacing":0,"uniqueness":0,"fatal":false,"reason":"","memory":[]}`;

  async function judge(char, state, recentTurns) {
    const p = char.profile;
    const summary = `姓名：${char.name}（${char.age}歲）
個性與價值觀：${p.價值觀}
說話習慣：${p.說話習慣}
地雷：${p.地雷}
軟肋：${p.軟肋}
出門門檻：${p.出門門檻}`;

    const transcript = recentTurns
      .map((t) => (t.role === "user" ? "男：" : `${char.nickname}：`) + t.content)
      .join("\n");

    const raw = await LLM.call({
      system: JUDGE_SYSTEM,
      messages: [{ role: "user", content: `# 角色摘要\n${summary}\n\n# 最近對話\n${transcript}` }],
      model: Store.getJudgeModel(),
      maxTokens: 300,
      temperature: 0
    });

    try {
      const m = raw.match(/\{[\s\S]*\}/);
      return JSON.parse(m ? m[0] : raw);
    } catch (e) {
      return null;
    }
  }

  // 權重：不同角色對不同維度的敏感度不同
  const WEIGHTS = {
    yuhan:  { disclosure: 1.0, responsiveness: 1.2, empathy: 1.4, pacing: 1.6, uniqueness: 0.8 },
    chiao:  { disclosure: 1.3, responsiveness: 1.2, empathy: 1.5, pacing: 0.9, uniqueness: 1.3 },
    peiyu:  { disclosure: 1.1, responsiveness: 1.0, empathy: 1.3, pacing: 1.8, uniqueness: 1.2 }
  };

  // 出門門檻：不只看總分，還要看各維度的最低要求
  const GATES = {
    yuhan:  { total: 82, empathy: 8,  pacing: 0,  minTurns: 28 },
    chiao:  { total: 78, empathy: 10, pacing: -4, minTurns: 24 },
    peiyu:  { total: 90, empathy: 12, pacing: 4,  minTurns: 36 }
  };

  function applyJudgement(char, state, j) {
    if (!j) return;
    const w = WEIGHTS[char.id] || WEIGHTS.yuhan;
    const dims = ["disclosure", "responsiveness", "empathy", "pacing", "uniqueness"];

    if (j.fatal) {
      // 致命失誤：大幅倒退並封頂，而且不是下一句就能補回來
      state.score.total = Math.max(0, state.score.total - 22);
      state.score.ceiling = Math.max(45, (state.score.ceiling || 100) - 15);
      state.strikes = (state.strikes || 0) + 1;
      dims.forEach((d) => (state.score.dims[d] = (state.score.dims[d] || 0) - 3));
    } else {
      let delta = 0;
      dims.forEach((d) => {
        const v = Number(j[d]) || 0;
        state.score.dims[d] = (state.score.dims[d] || 0) + v;
        delta += v * (w[d] || 1);
      });
      // 邊際遞減：越後面越難加分
      const damp = 1 - Math.min(0.55, state.score.total / 200);
      state.score.total = Math.max(0, Math.min(state.score.ceiling || 100, state.score.total + delta * 0.55 * damp));
    }

    (j.memory || []).slice(0, 2).forEach((m) => {
      if (m && !state.memory.includes(m)) state.memory.push(m);
    });
    if (state.memory.length > 14) state.memory = state.memory.slice(-14);
  }

  function checkGate(char, state) {
    const g = GATES[char.id] || GATES.yuhan;
    const d = state.score.dims;
    if (state.inviteWindow) return true;
    if (state.turns < g.minTurns) return false;
    if (state.score.total < g.total) return false;
    if ((d.empathy || 0) < g.empathy) return false;
    if ((d.pacing || 0) < g.pacing) return false;
    if ((state.strikes || 0) >= 3) return false;
    // 到門檻後不立刻開門，再加一點隨機延遲，讓玩家摸不出規律
    if (Math.random() < 0.45) return false;
    return true;
  }

  return { rollMood, buildSystem, judge, applyJudgement, checkGate, JUDGE_SYSTEM };
})();
