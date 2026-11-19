/* UI 與流程控制 */
(function () {
  const $ = (s) => document.querySelector(s);
  const el = (t, c) => { const n = document.createElement(t); if (c) n.className = c; return n; };

  let current = null;   // 當前角色
  let state = null;     // 當前存檔
  let busy = false;

  // ---------- 存檔 ----------
  function freshState() {
    return {
      turns: 0,
      strikes: 0,
      inviteWindow: false,
      ended: null,            // "success" | "ghosted" | null
      mood: Engine.rollMood(),
      moodTurn: 0,
      memory: [],
      score: { total: 8, ceiling: 100, dims: {} },
      history: []             // {role, content}
    };
  }
  function loadState(id) {
    const all = Store.loadAll();
    const s = all[id];
    if (!s) return null;
    if (!s.mood) s.mood = Engine.rollMood();
    return s;
  }
  function persist() {
    const all = Store.loadAll();
    all[current.id] = state;
    Store.saveAll(all);
  }

  // ---------- 畫面：角色選擇 ----------
  function renderSelect() {
    $("#view-chat").hidden = true;
    $("#view-select").hidden = false;
    const grid = $("#char-grid");
    grid.innerHTML = "";
    const all = Store.loadAll();

    CHARACTERS.forEach((c) => {
      const card = el("button", "card");
      const saved = all[c.id];
      card.innerHTML = `
        <div class="card-av">${Avatar.svg(c.avatar, 104)}</div>
        <div class="card-name">${c.name}<span>${c.age}</span></div>
        <div class="card-tag">${c.tagline}</div>
        <div class="card-foot">${
          saved
            ? saved.ended === "success"
              ? "✓ 已經約出門了"
              : `聊到第 ${saved.turns} 句`
            : "還沒聊過"
        }</div>`;
      card.onclick = () => openChat(c);
      grid.appendChild(card);
    });
  }

  // ---------- 畫面：聊天室 ----------
  function openChat(c) {
    current = c;
    state = loadState(c.id) || freshState();
    $("#view-select").hidden = true;
    $("#view-chat").hidden = false;
    $("#peer-av").innerHTML = Avatar.svg(c.avatar, 40);
    $("#peer-name").textContent = c.name;
    $("#log").innerHTML = "";

    if (!state.history.length) {
      pushMsg("assistant", c.opening);
      state.history.push({ role: "assistant", content: c.opening });
      persist();
    } else {
      state.history.forEach((m) => pushMsg(m.role, m.content));
    }
    if (state.ended) lockInput(state.ended);
    scrollDown();
    $("#input").focus();
  }

  function pushMsg(role, text) {
    const row = el("div", "row " + (role === "user" ? "me" : "you"));
        const b = el("div", "bubble");
    b.textContent = text;
    row.appendChild(b);
    $("#log").appendChild(row);
  }

  function typing(on) {
    let t = $("#typing");
    if (on) {
      if (t) return;
      t = el("div", "row you");
      t.id = "typing";
      t.innerHTML = '<div class="bubble dots"><span></span><span></span><span></span></div>';
      $("#log").appendChild(t);
      scrollDown();
    } else if (t) t.remove();
  }

  function scrollDown() {
    const l = $("#log");
    l.scrollTop = l.scrollHeight;
  }

  function sysNote(text) {
    const n = el("div", "sysnote");
    n.textContent = text;
    $("#log").appendChild(n);
    scrollDown();
  }

  function lockInput(kind) {
    $("#input").disabled = true;
    $("#send").disabled = true;
    $("#input").placeholder =
      kind === "success" ? "你們約好要見面了。" : "她已經不太想回了。";
  }

  // ---------- 送出訊息 ----------
  async function send() {
    if (busy || state.ended) return;
    const text = $("#input").value.trim();
    if (!text) return;
    if (!Store.getApiKey()) { openSettings(); return; }

    $("#input").value = "";
    pushMsg("user", text);
    state.history.push({ role: "user", content: text });
    state.turns++;
    scrollDown();

    // 每 8 句換一次心情（與好感度無關的噪音）
    if (state.turns - state.moodTurn >= 8) {
      state.mood = Engine.rollMood();
      state.moodTurn = state.turns;
    }

    busy = true;
    $("#send").disabled = true;
    typing(true);

    try {
      // 模擬真人回訊息的延遲（忙碌時更久）
      const base = state.mood.k === "busy" ? 1800 : 700;
      await new Promise((r) => setTimeout(r, base + Math.random() * 1400));

      const system = Engine.buildSystem(current, state);
      const msgs = state.history.slice(-24).map((m) => ({ role: m.role, content: m.content }));
      if (msgs[0] && msgs[0].role !== "user") msgs.shift();

      const reply = await LLM.call({
        system,
        messages: msgs,
        maxTokens: 300,
        temperature: 1
      });

      typing(false);
      pushMsg("assistant", reply);
      state.history.push({ role: "assistant", content: reply });

      // 黑箱評分：每 3 句跑一次
      if (state.turns % 3 === 0) {
        const recent = state.history.slice(-8);
        const j = await Engine.judge(current, state, recent);
        Engine.applyJudgement(current, state, j);
        if (!state.inviteWindow && Engine.checkGate(current, state)) state.inviteWindow = true;
        if ((state.strikes || 0) >= 3) {
          state.ended = "ghosted";
          sysNote("她已讀了，但沒有再回。");
          lockInput("ghosted");
        }
      }

      // 結局判定：在邀約窗開啟後，偵測是否真的約成
      if (state.inviteWindow && !state.ended) {
        if (await detectSuccess(reply)) {
          state.ended = "success";
          sysNote(`你和${current.nickname}約好要見面了。`);
          lockInput("success");
        }
      }
    } catch (e) {
      typing(false);
      const msg =
        e.message === "NO_KEY" ? "請先到右上角設定 API Key。"
        : e.message === "BAD_KEY" ? "API Key 無效，請重新設定。"
        : e.message === "RATE_LIMIT" ? "呼叫太頻繁，等幾秒再試。"
        : "連線失敗：" + e.message;
      sysNote(msg);
    } finally {
      busy = false;
      if (!state.ended) $("#send").disabled = false;
      persist();
      scrollDown();
    }
  }

  // 用一次極小的呼叫判斷「這句話是否成立了一次具體的見面約定」
  async function detectSuccess(lastReply) {
    try {
      const out = await LLM.call({
        system:
          "判斷下面這句話，是否構成「她主動提出見面」或「她明確答應見面」。" +
          "含糊、客套、說再看看、改天之類的都不算。只回 YES 或 NO。",
        messages: [{ role: "user", content: lastReply }],
        model: Store.getJudgeModel(),
        maxTokens: 5,
        temperature: 0
      });
      return /YES/i.test(out);
    } catch (e) {
      return false;
    }
  }

  // ---------- 設定 ----------
  function openSettings() {
    $("#dlg-key").value = Store.getApiKey();
    $("#dlg-model").value = Store.getModel();
    $("#dlg-judge").value = Store.getJudgeModel();
    $("#dlg").showModal();
  }

  // ---------- 綁定 ----------
  window.addEventListener("DOMContentLoaded", () => {
    renderSelect();

    $("#send").onclick = send;
    $("#input").addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
    });
    $("#back").onclick = () => { persist(); renderSelect(); };
    $("#gear").onclick = openSettings;
    $("#gear2").onclick = openSettings;

    $("#dlg-save").onclick = (e) => {
      e.preventDefault();
      Store.setApiKey($("#dlg-key").value);
      Store.setModel($("#dlg-model").value.trim() || Store.DEFAULT_MODEL);
      Store.setJudgeModel($("#dlg-judge").value.trim() || Store.DEFAULT_JUDGE);
      $("#dlg").close();
    };
    $("#dlg-close").onclick = (e) => { e.preventDefault(); $("#dlg").close(); };

    $("#dlg-export").onclick = (e) => {
      e.preventDefault();
      const blob = new Blob([Store.exportSave()], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "chat_sim_save.json";
      a.click();
    };
    $("#dlg-import").onchange = (ev) => {
      const f = ev.target.files[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = () => {
        try { Store.importSave(r.result); alert("存檔已匯入"); location.reload(); }
        catch (err) { alert("匯入失敗：" + err.message); }
      };
      r.readAsText(f);
    };
    $("#dlg-reset").onclick = (e) => {
      e.preventDefault();
      if (confirm("清除所有聊天進度？此動作無法復原。")) { Store.wipe(); location.reload(); }
    };
  });
})();
