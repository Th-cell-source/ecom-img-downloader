// 电商图片下载助手 - 内容脚本：扫描页面图片
(function () {
  // 从各种属性里收集图片地址：img src / data-src / 懒加载 / srcset / 背景图
  function collectImageUrls() {
    const urls = new Set();
    const push = (u) => {
      if (!u) return;
      const s = u.trim().replace(/^["']|["']$/g, '');
      if (!s || s.startsWith('data:') || s.startsWith('blob:') || s.startsWith('javascript:')) return;
      if (urls.has(s)) return;
      urls.add(s);
    };

    document.querySelectorAll('img').forEach((img) => {
      push(img.currentSrc || img.src);
      push(img.getAttribute('data-src'));
      push(img.getAttribute('data-original'));
      push(img.getAttribute('data-lazy-src'));
      push(img.getAttribute('data-srcset'));
      if (img.srcset) {
        img.srcset.split(',').forEach((part) => push(part.trim().split(/\s+/)[0]));
      }
    });

    // 背景图片
    document.querySelectorAll('div, section, li, a, span, figure, picture').forEach((el) => {
      const bg = getComputedStyle(el).backgroundImage;
      if (bg && bg.indexOf('url(') !== -1) {
        const m = bg.match(/url\(([^)]+)\)/g);
        if (m) m.forEach((x) => push(x.replace(/url\(|\)/g, '')));
      }
    });

    return Array.from(urls);
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg && msg.type === 'collect-images') {
      sendResponse({ urls: collectImageUrls() });
    }
    return true;
  });
})();
