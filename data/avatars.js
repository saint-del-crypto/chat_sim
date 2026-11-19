/* 角色頭像（後台設定）
 *
 * 把圖片放進 assets/avatars/，再把檔名填到下面對應的角色 id。
 * 留空字串就會使用內建的程序化 SVG 頭像。
 * 圖片若不存在或載入失敗，也會自動退回 SVG，不會出現破圖。
 *
 * 建議尺寸：寬 320px 以上，比例接近 96:110（略為直式），JPG 或 WebP。
 */
window.AVATAR_FILES = {
  yuhan: "assets/avatars/yuhan.jpg",
  chiao: "assets/avatars/chiao.jpg",
  peiyu: "assets/avatars/peiyu.jpg"
};
