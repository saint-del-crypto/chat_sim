/* UI 與流程控制 */
(function () {
  const $ = (s) => document.querySelector(s);
  const el = (t, c) => { const n = document.createElement(t); if (c) n.className = c; return n; };

  let current = null;   // 當前角色
  let state = null;     // 當前存檔
  let busy = false;
  let lastRole = null;  // 用來收緊連續訊息的間距

  // ---------- 存檔 ----------
  function freshState() {
    return {
      turns: 0, strikes: 0, inviteWindow: false, ended: null,
      mood: Engine.rollMood(), moodTurn: 0,
      memory: [],
      score: { total: 8, ceiling: 100, dims: {} },
      history: []
    };
  }
  function loadState(id) {
    const s = Store.loadAll()[id];
    if (!s) return null;
    if (!s.mood) s.mood = Engine.rollMood();
    return s;
  }
  function persist() {
    const all = Store.loadAll();
    all[current.id] = state;
    Store.saveAll(all);
  }

  // ---------- 選角 ----------
  function renderSelect() {
    $("#view-chat").hidden = true;
    $("#view-select").hidden = false;
    document.body.style.overflow = "";
    const list = $("#char-list");
    list.innerHTML = "";
    const all = Store.loadAll();

    CHARACTERS.forEach((c) => {
      const saved = all[c.id];
      const done = saved && saved.ended === "success";
      const row = el("div", "item");
      row.innerHTML = `
        <div class="av">
          ${Avatar.render(c, 66)}
          <button class="pbtn" type="button" aria-label="更換頭像">⌾</button>
        </div>
        <div class="txt">
          <div class="nm">${c.name}<i>${c.age}</i></div>
          <div class="tg">${c.tagline}</div>
          <div class="st${done ? " on" : ""}">${
            done ? "已經約出門了"
                 : saved ? `聊到第 ${saved.turns} 句`
                         : "還沒說過話"
          }</div>
        </div>
        <div class="chev">›</div>`;
      row.onclick = () => openChat(c);
      row.querySelector(".pbtn").onclick = (e) => {
        e.stopPropagation();
        pickPhoto(c);
      };
      list.appendChild(row);
    });
  }

  // ---------- 自訂頭像 ----------
  let photoTarget = null;
  function pickPhoto(c) {
    if (Store.getPhoto(c.id)) {
      if (confirm(`${c.name} 已經有自訂頭像。要換成另一張嗎？\n（按「取消」則恢復成預設頭像）`)) {
        photoTarget = c; $("#photo-file").click();
      } else {
        Store.clearPhoto(c.id); renderSelect();
      }
      return;
    }
    photoTarget = c;
    $("#photo-file").click();
  }

  // ---------- 聊天室 ----------
  function openChat(c) {
    current = c;
    state = loadState(c.id) || freshState();
    lastRole = null;
    $("#view-select").hidden = true;
    $("#view-chat").hidden = false;
    document.body.style.overflow = "hidden";
    $("#peer-av").innerHTML = Avatar.render(c, 38);
    $("#peer-name").textContent = c.name;
    $("#log").innerHTML = "";
    setPeerState();

    if (!state.history.length) {
      state.history.push({ role: "assistant", content: c.opening });
      pushMsg("assistant", c.opening);
      persist();
    } else {
      state.history.forEach((m) => pushMsg(m.role, m.content));
    }
    if (state.ended) lockInput(state.ended);
    requestAnimationFrame(() => scrollDown(true));
  }

  function setPeerState(txt) {
    $("#peer-state").textContent =
      txt || (state.ended === "success" ? "已約好見面"
            : state.ended === "ghosted" ? "沒有再回覆"
            : "線上");
  }

  function pushMsg(role, text) {
    const cont = role === lastRole;
    const row = el("div", "row " + (role === "user" ? "me" : "you") + (cont ? " cont" : ""));
    const b = el("div", "bubble");
    b.textContent = text;
    row.appendChild(b);
    $("#log").appendChild(row);
    lastRole = role;
  }

  function typing(on) {
    let t = $("#typing");
    if (on) {
      if (t) return;
      t = el("div", "row you");
      t.id = "typing";
      t.innerHTML = '<div class="bubble dots"><span></span><span></span><span></span></div>';
      $("#log").appendChild(t);
      setPeerState("正在輸入…");
      scrollDown();
    } else if (t) {
      t.remove();
      setPeerState();
    }
  }

  function scrollDown(instant) {
    const l = $("#log");
    l.scrollTo({ top: l.scrollHeight, behavior: instant ? "auto" : "smooth" });
  }

  function note(text) {
    const n = el("div", "note");
    n.textContent = text;
    $("#log").appendChild(n);
    lastRole = null;
    scrollDown();
  }

  function lockInput(kind) {
    $("#input").disabled = true;
    $("#send").disabled = true;
    $("#input").placeholder = kind === "success" ? "你們約好了。" : "她已經不太想回了。";
    setPeerState();
  }

  // 輸入框隨內容長高
  function autoGrow() {
    const i = $("#input");
    i.style.height = "auto";
    i.style.height = Math.min(i.scrollHeight, 124) + "px";
  }

  // ---------- 送出 ----------
  async function send() {
    if (busy || state.ended) return;
    const input = $("#input");
    const text = input.value.trim();
    if (!text) return;
    if (!Store.getApiKey()) { openSettings(); return; }

    input.value = "";
    autoGrow();
    pushMsg("user", text);
    state.history.push({ role: "user", content: text });
    state.turns++;
    scrollDown();

    if (state.turns - state.moodTurn >= 8) {
      state.mood = Engine.rollMood();
      state.moodTurn = state.turns;
    }

    busy = true;
    $("#send").disabled = true;

    try {
      // 模擬真人的回訊息節奏
      const base = state.mood.k === "busy" ? 1800 : 700;
      await new Promise((r) => setTimeout(r, base + Math.random() * 1400));
      typing(true);

      const msgs = state.history.slice(-24).map((m) => ({ role: m.role, content: m.content }));
      if (msgs[0] && msgs[0].role !== "user") msgs.shift();

      const reply = await LLM.call({
        system: Engine.buildSystem(current, state),
        messages: msgs,
        maxTokens: 300
      });

      typing(false);
      pushMsg("assistant", reply);
      state.history.push({ role: "assistant", content: reply });
      scrollDown();

      // 黑箱評分：每 3 句一次
      if (state.turns % 3 === 0) {
        const j = await Engine.judge(current, state, state.history.slice(-8));
        Engine.applyJudgement(current, state, j);
        if (!state.inviteWindow && Engine.checkGate(current, state)) state.inviteWindow = true;
        if ((state.strikes || 0) >= 3) {
          state.ended = "ghosted";
          note("她已讀了，但沒有再回。");
          lockInput("ghosted");
        }
      }

      if (state.inviteWindow && !state.ended && (await detectSuccess(reply))) {
        state.ended = "success";
        note(`你和${current.nickname}約好要見面了。`);
        lockInput("success");
      }
    } catch (e) {
      typing(false);
      const keyIssue = e.message === "NO_KEY" || e.message === "BAD_KEY";
      note(
        keyIssue ? "API Key 有問題，請重新設定。"
        : e.message === "RATE_LIMIT" ? "訊息送太快了，等幾秒再試。"
        : "訊息沒送出去，再試一次。"
      );
      if (keyIssue) openSettings();
      else console.error(e);
    } finally {
      busy = false;
      if (!state.ended) $("#send").disabled = false;
      persist();
    }
  }

  async function detectSuccess(lastReply) {
    try {
      const out = await LLM.call({
        system:
          "判斷下面這句話，是否構成「她主動提出見面」或「她明確答應見面」。" +
          "含糊、客套、說再看看、改天之類的都不算。只回 YES 或 NO。",
        messages: [{ role: "user", content: lastReply }],
        model: Store.getJudgeModel(),
        maxTokens: 5
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

    const input = $("#input");
    $("#send").onclick = send;
    input.addEventListener("input", autoGrow);
    input.addEventListener("keydown", (e) => {
      // 手機上 Enter 換行比較自然，桌機 Enter 送出
      const desktop = window.matchMedia("(min-width:600px)").matches;
      if (e.key === "Enter" && desktop && !e.shiftKey) { e.preventDefault(); send(); }
    });
    // 鍵盤彈出時把最新訊息頂上來
    input.addEventListener("focus", () => setTimeout(() => scrollDown(true), 300));
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", () => {
        if (!$("#view-chat").hidden) scrollDown(true);
      });
    }

    $("#back").onclick = () => { persist(); renderSelect(); };
    $("#gear").onclick = openSettings;

    $("#photo-file").onchange = async (ev) => {
      const f = ev.target.files[0];
      ev.target.value = "";
      if (!f || !photoTarget) return;
      try {
        Store.setPhoto(photoTarget.id, await Avatar.fromFile(f));
        renderSelect();
      } catch (err) {
        alert(err.message);
      }
      photoTarget = null;
    };

    $("#dlg").querySelector("form").addEventListener("submit", (e) => {
      e.preventDefault();
      Store.setApiKey($("#dlg-key").value);
      Store.setModel($("#dlg-model").value.trim() || Store.DEFAULT_MODEL);
      Store.setJudgeModel($("#dlg-judge").value.trim() || Store.DEFAULT_JUDGE);
      $("#dlg").close();
    });
    $("#dlg-close").onclick = () => $("#dlg").close();

    $("#dlg-export").onclick = () => {
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
        try { Store.importSave(r.result); location.reload(); }
        catch (err) { alert("匯入失敗：" + err.message); }
      };
      r.readAsText(f);
    };
    $("#dlg-reset").onclick = () => {
      if (confirm("清除所有聊天進度？此動作無法復原。")) { Store.wipe(); location.reload(); }
    };
  });
})();
