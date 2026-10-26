// 电商图片下载助手 - 弹窗逻辑
const grid = document.getElementById('grid');
const empty = document.getElementById('empty');
const statusEl = document.getElementById('status');
const countEl = document.getElementById('count');
const selectAllBtn = document.getElementById('selectAll');
const downloadOneBtn = document.getElementById('downloadOne');
const downloadZipBtn = document.getElementById('downloadZip');

let allUrls = [];
let selected = new Set();

function setStatus(text, show) {
  statusEl.textContent = text || '';
  statusEl.style.display = show ? 'block' : 'none';
}

function refreshButtons() {
  const n = selected.size;
  downloadOneBtn.disabled = n === 0;
  downloadZipBtn.disabled = allUrls.length === 0;
  countEl.textContent = `共 ${allUrls.length} 张，已选 ${n} 张`;
}

function safeName(url, i) {
  try {
    const path = new URL(url).pathname;
    const name = path.split('/').pop().split('?')[0];
    const clean = decodeURIComponent(name);
    if (clean && clean.includes('.')) return clean.replace(/[\\/:*?"<>|]/g, '_');
  } catch (e) {}
  return `image_${i + 1}.png`;
}

function render(urls) {
  allUrls = urls;
  selected = new Set();
  grid.innerHTML = '';
  empty.style.display = urls.length === 0 ? 'block' : 'none';
  urls.forEach((url, i) => {
    const item = document.createElement('div');
    item.className = 'item';
    const img = document.createElement('img');
    img.src = url;
    img.referrerPolicy = 'no-referrer';
    img.onerror = () => { item.style.display = 'none'; };
    const check = document.createElement('span');
    check.className = 'check';
    check.textContent = '✓';
    const dl = document.createElement('button');
    dl.className = 'dl';
    dl.textContent = '⤓';
    dl.title = '下载这张';
    item.appendChild(img);
    item.appendChild(check);
    item.appendChild(dl);
    check.addEventListener('click', () => {
      if (selected.has(i)) { selected.delete(i); item.classList.remove('selected'); }
      else { selected.add(i); item.classList.add('selected'); }
      refreshButtons();
    });
    dl.addEventListener('click', (e) => {
      e.stopPropagation();
      chrome.downloads.download({ url, filename: `电商图片/${safeName(url, i)}`, conflictAction: 'uniquify' });
    });
    grid.appendChild(item);
  });
  refreshButtons();
}

selectAllBtn.addEventListener('click', () => {
  if (selected.size === allUrls.length) {
    selected.clear();
    document.querySelectorAll('.item').forEach((el) => el.classList.remove('selected'));
  } else {
    selected = new Set(allUrls.map((_, i) => i));
    document.querySelectorAll('.item').forEach((el) => el.classList.add('selected'));
  }
  refreshButtons();
});

async function downloadZip(urls) {
  setStatus('正在抓取并打包图片，请稍候…', true);
  downloadZipBtn.disabled = true;
  try {
    const zip = new JSZip();
    let ok = 0;
    for (let i = 0; i < urls.length; i++) {
      try {
        const res = await fetch(urls[i], { mode: 'cors' });
        const blob = await res.blob();
        let ext = (urls[i].split('.').pop().split('?')[0] || 'png').toLowerCase();
        if (!/^[a-z0-9]{2,5}$/.test(ext)) ext = 'png';
        zip.file(`image_${i + 1}.${ext}`, blob);
        ok++;
      } catch (e) { /* 单张失败跳过 */ }
    }
    if (ok === 0) { setStatus('打包失败：图片无法读取（可能受防盗链限制）', true); return; }
    const content = await zip.generateAsync({ type: 'blob' });
    const objUrl = URL.createObjectURL(content);
    chrome.downloads.download({ url: objUrl, filename: '电商图片打包.zip', conflictAction: 'uniquify' });
    setStatus(`打包完成：成功 ${ok} 张（${urls.length - ok} 张失败跳过）`, true);
  } catch (e) {
    setStatus('打包失败：' + (e && e.message ? e.message : e), true);
  } finally {
    downloadZipBtn.disabled = allUrls.length === 0;
  }
}

downloadOneBtn.addEventListener('click', () => {
  const idx = [...selected];
  idx.forEach((i) => {
    chrome.downloads.download({ url: allUrls[i], filename: `电商图片/${safeName(allUrls[i], i)}`, conflictAction: 'uniquify' });
  });
  setStatus(`已开始下载 ${idx.length} 张图片`, true);
  setTimeout(() => setStatus('', false), 2500);
});

downloadZipBtn.addEventListener('click', () => {
  const idx = selected.size ? [...selected] : allUrls.map((_, i) => i);
  downloadZip(idx.map((i) => allUrls[i]));
});

// 获取当前标签页的图片
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const tab = tabs[0];
  if (!tab) return;
  chrome.tabs.sendMessage(tab.id, { type: 'collect-images' }, (resp) => {
    if (chrome.runtime.lastError || !resp || !resp.urls) {
      // content script 可能尚未注入，动态注入后重试
      chrome.scripting.executeScript(
        { target: { tabId: tab.id }, files: ['content.js'] },
        () => {
          chrome.tabs.sendMessage(tab.id, { type: 'collect-images' }, (r2) => {
            if (chrome.runtime.lastError || !r2 || !r2.urls) {
              empty.style.display = 'block';
            } else {
              render(r2.urls);
            }
          });
        }
      );
    } else {
      render(resp.urls);
    }
  });
});
