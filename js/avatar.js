/* 頭像：玩家自己上傳的照片優先，否則用程序化 SVG（零素材授權風險） */
window.Avatar = (function () {
  const RATIO = 110 / 96;

  function hair(style, c) {
    switch (style) {
      case "bob":
        return `<path d="M22 46c0-16 9-26 26-26s26 10 26 26c0 8-2 14-4 18l-6-2c2-6 2-12 1-16-5 5-12 7-17 7s-12-2-17-7c-1 4-1 10 1 16l-6 2c-2-4-4-10-4-18z" fill="${c}"/>`;
      case "tie":
        return `<path d="M24 44c0-15 10-24 24-24s24 9 24 24c0 5-1 9-2 12l-5-2c1-5 1-11 0-15-5 5-11 7-17 7s-12-2-17-7c-1 4-1 10 0 15l-5 2c-1-3-2-7-2-12z" fill="${c}"/><circle cx="48" cy="17" r="8" fill="${c}"/>`;
      default:
        return `<path d="M21 48c0-17 10-28 27-28s27 11 27 28c0 14 2 24 5 34l-11 2c1-10 1-22-1-30-5 6-12 8-20 8s-15-2-20-8c-2 8-2 20-1 30l-11-2c3-10 5-20 5-34z" fill="${c}"/>`;
    }
  }

  function svg(a, size) {
    const w = size || 96;
    return `<svg viewBox="0 0 96 110" width="${w}" height="${Math.round(w * RATIO)}" aria-hidden="true">
<rect width="96" height="110" rx="16" fill="${a.bg}"/>
<path d="M30 96c0-11 8-18 18-18s18 7 18 18v14H30z" fill="#ffffff" opacity=".85"/>
<ellipse cx="48" cy="52" rx="19" ry="23" fill="${a.skin}"/>
${hair(a.style, a.hair)}
<circle cx="41" cy="53" r="2.4" fill="#3a3340"/>
<circle cx="55" cy="53" r="2.4" fill="#3a3340"/>
<path d="M44 63q4 3 8 0" stroke="#c98a86" stroke-width="1.8" fill="none" stroke-linecap="round"/>
</svg>`;
  }

  // 角色的頭像（有上傳照片就用照片）
  function render(char, size) {
    const w = size || 96;
    const h = Math.round(w * RATIO);
    const photo = Store.getPhoto(char.id);
    if (photo) {
      return `<img src="${photo}" width="${w}" height="${h}" alt=""
        style="width:${w}px;height:${h}px;object-fit:cover;border-radius:${Math.round(w / 4.4)}px;display:block">`;
    }
    return svg(char.avatar, w);
  }

  /* 把上傳的圖縮到 320px 寬、轉成 JPEG dataURL，避免塞爆 localStorage */
  function fromFile(file) {
    return new Promise((resolve, reject) => {
      if (!/^image\//.test(file.type)) return reject(new Error("請選擇圖片檔"));
      const fr = new FileReader();
      fr.onerror = () => reject(new Error("讀取失敗"));
      fr.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error("這個圖片無法讀取"));
        img.onload = () => {
          const TW = 320, TH = Math.round(TW * RATIO);
          const cv = document.createElement("canvas");
          cv.width = TW; cv.height = TH;
          const ctx = cv.getContext("2d");
          // 置中裁切成相同比例
          const s = Math.max(TW / img.width, TH / img.height);
          const dw = img.width * s, dh = img.height * s;
          ctx.drawImage(img, (TW - dw) / 2, (TH - dh) / 2, dw, dh);
          resolve(cv.toDataURL("image/jpeg", 0.85));
        };
        img.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  }

  return { svg, render, fromFile, RATIO };
})();
