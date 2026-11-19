/* 存檔層：localStorage
 * 分數以 base64 輕度混淆 —— 只是防止一眼看到，不是真正的安全。
 * 真正的黑箱必須把評分搬到伺服器端（見 README 的路線 2）。
 */
window.Store = (function () {
  const K_KEY = "cs_api_key";
  const K_MODEL = "cs_model";
  const K_JUDGE = "cs_judge_model";
  const K_SAVE = "cs_save_v1";
  const K_PHOTO = "cs_photos_v1";

  const DEFAULT_MODEL = "claude-sonnet-5-5";
  const DEFAULT_JUDGE = "claude-haiku-5-5";

  function enc(obj) {
    return btoa(unescape(encodeURIComponent(JSON.stringify(obj))));
  }
  function dec(s) {
    try {
      return JSON.parse(decodeURIComponent(escape(atob(s))));
    } catch (e) {
      return null;
    }
  }

  return {
    getApiKey: () => localStorage.getItem(K_KEY) || "",
    setApiKey: (v) => localStorage.setItem(K_KEY, v.trim()),
    clearApiKey: () => localStorage.removeItem(K_KEY),

    getModel: () => localStorage.getItem(K_MODEL) || DEFAULT_MODEL,
    setModel: (v) => localStorage.setItem(K_MODEL, v),
    getJudgeModel: () => localStorage.getItem(K_JUDGE) || DEFAULT_JUDGE,
    setJudgeModel: (v) => localStorage.setItem(K_JUDGE, v),

    saveAll(all) {
      localStorage.setItem(K_SAVE, enc(all));
    },
    loadAll() {
      const raw = localStorage.getItem(K_SAVE);
      return (raw && dec(raw)) || {};
    },
    // ---- 自訂頭像 ----
    allPhotos() {
      try { return JSON.parse(localStorage.getItem(K_PHOTO) || "{}"); }
      catch (e) { return {}; }
    },
    getPhoto(id) {
      return this.allPhotos()[id] || "";
    },
    setPhoto(id, dataUrl) {
      const all = this.allPhotos();
      all[id] = dataUrl;
      try { localStorage.setItem(K_PHOTO, JSON.stringify(all)); }
      catch (e) { throw new Error("瀏覽器儲存空間不足，請先清除其他頭像"); }
    },
    clearPhoto(id) {
      const all = this.allPhotos();
      delete all[id];
      localStorage.setItem(K_PHOTO, JSON.stringify(all));
    },

    exportSave() {
      return JSON.stringify(
        { version: 1, model: this.getModel(), saves: this.loadAll(), photos: this.allPhotos() },
        null,
        2
      );
    },
    importSave(text) {
      const o = JSON.parse(text);
      if (!o || !o.saves) throw new Error("格式不符");
      this.saveAll(o.saves);
      if (o.photos) localStorage.setItem(K_PHOTO, JSON.stringify(o.photos));
    },
    wipe() {
      localStorage.removeItem(K_SAVE);
    },

    DEFAULT_MODEL,
    DEFAULT_JUDGE
  };
})();
