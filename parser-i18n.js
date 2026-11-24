(() => {
  'use strict';

  const storageKey = 'single-page-parser:locale';
  const embedded = window.parent !== window && new URLSearchParams(location.search).get('embedded') === '1';
  const normalizeLocale = value => /^zh(?:-|$)/i.test(String(value || '')) ? 'zh-TW' : 'en';
  const dictionary = {
    'Single-Page Parser 網頁解析器': 'Single-Page Parser',
    '頁面操作': 'Page actions',
    '開啟工具選單': 'Open toolbar menu',
    '關閉工具選單': 'Close toolbar menu',
    '匯入': 'Import',
    '重新匯入': 'Re-import',
    '重置': 'Reset',
    '下載': 'Download',
    '帳號': 'Account',
    '重置為原始的解析畫面': 'Reset to the original parsed page',
    '下載頁面 ZIP': 'Download page ZIP',
    '下載頁面 ZIP（包含目前調整）': 'Download page ZIP (including current changes)',
    '匯入網頁': 'Import page',
    '來源': 'Source',
    '完整資料夾': 'Full folder',
    '選擇 ZIP 檔': 'Choose ZIP file',
    '選擇 HTML 檔': 'Choose HTML file',
    '選擇素材資料夾': 'Choose assets folder',
    '選擇完整網頁資料夾': 'Choose complete webpage folder',
    '選擇 Chrome 網頁封存': 'Choose Chrome webpage archive',
    '清除 ZIP': 'Clear ZIP',
    '清除 HTML': 'Clear HTML',
    '清除搭配的素材資料夾': 'Clear assets folder',
    '清除網頁資料夾': 'Clear webpage folder',
    '清除 Chrome 網頁封存': 'Clear Chrome archive',
    '選擇包含 HTML 和素材的 ZIP 檔。': 'Choose a ZIP file that contains the HTML and assets.',
    '在 Chrome 選「網頁，完整」另存，再選擇 HTML 檔。': 'In Chrome, save as “Webpage, Complete”, then select the HTML file.',
    '若 Chrome 另存時產生了素材資料夾，請一併選取。': 'If Chrome created an assets folder, select it too.',
    '選擇同時包含 HTML 和素材的上層資料夾。': 'Choose the parent folder containing both the HTML and assets.',
    '選擇檔案': 'Choose file',
    '選擇素材資料夾': 'Choose assets folder',
    '選擇資料夾': 'Choose folder',
    '清除': 'Clear',
    '缺圖時加入 Chrome 封存（選填）': 'Add Chrome archive for missing images (optional)',
    '選擇同一頁以「單一檔案」另存的 .mhtml 或 .mht，補回封存中有收錄的圖片。': 'Choose an .mhtml or .mht saved from the same page to restore images contained in the archive.',
    '自動下載缺少的 HTTPS 圖片與字型': 'Automatically download missing HTTPS images and fonts',
    '解析網頁': 'Parse page',
    '網頁解析進度': 'Page parsing progress',
    'RWD 檢查結果': 'Responsive check',
    '查看各寬度與缺少的素材': 'View widths and missing assets',
    '寬度': 'Width',
    '修正前溢出': 'Overflow before repair',
    '修正後溢出': 'Overflow after repair',
    '展示與調整': 'Preview & adjust',
    '預覽裝置': 'Preview device',
    '手機': 'Mobile',
    '平板': 'Tablet',
    '桌機': 'Desktop',
    '預覽寬度': 'Preview width',
    '預覽寬度滑桿': 'Preview width slider',
    '自動寬度': 'Automatic width',
    '自動填滿預覽寬度': 'Fit available preview width',
    '調整功能': 'Adjustment tools',
    'Logo 替換': 'Replace logo',
    '導覽項目': 'Navigation',
    '輪播設定': 'Slideshow settings',
    '上傳圖片，一次替換': 'Upload image to replace all',
    '替換全部 Logo': 'Replace all logos',
    '裁除透明留白': 'Trim transparent padding',
    '個別調整目前預覽的 Logo': 'Adjust logos in this preview',
    'Logo 位置': 'Logo positions',
    '轉場': 'Transition',
    '淡入淡出': 'Fade',
    '左右滑動': 'Slide horizontally',
    '前後堆疊': 'Layered depth',
    '遮罩滑入': 'Masked reveal',
    '速度曲線': 'Easing',
    '更換輪播圖片': 'Replace slideshow images',
    '要更換的圖片': 'Image to replace',
    '更換圖片': 'Replace image',
    '上傳輪播圖片': 'Upload slideshow image',
    '新增項目': 'Add item',
    '套用導覽': 'Apply navigation',
    '重置導覽': 'Reset navigation',
    '轉換後的網頁': 'Converted webpage',
    '讀取本機檔案': 'Reading local files',
    '送出檔案供解析': 'Sending files for parsing',
    '解析完成': 'Parsing complete',
    '容器': 'Containers',
    '卡片群組': 'Card groups',
    '圖片／影片': 'Images / videos',
    '未套用版面修正。': 'No layout repairs applied.',
    '各檢測寬度均無水平溢出。': 'No horizontal overflow at any checked width.',
    '未偵測到缺少的素材。': 'No missing assets detected.',
    '操作失敗。': 'Operation failed.',
    '正在更新尺寸…': 'Updating size…',
    '正在更換圖片…': 'Replacing image…',
    '正在更新顯示設定…': 'Updating visibility…',
    '顯示 Logo': 'Show logo',
    '隱藏 Logo': 'Hide logo',
    '寬度': 'Width',
    '高度': 'Height',
    '鎖定比例': 'Lock aspect ratio',
    '解除比例鎖定': 'Unlock aspect ratio',
    '位置微調': 'Fine-tune position',
    '水平（px）': 'Horizontal (px)',
    '垂直（px）': 'Vertical (px)',
    '重置位置': 'Reset position',
    '原網頁圖片': 'Original webpage image',
    '刪除': 'Delete',
    '正在套用導覽…': 'Applying navigation…',
    '正在重置導覽…': 'Resetting navigation…',
    '已重置為原始導覽。': 'Navigation reset to the original.',
    '正在還原…': 'Resetting…',
    '已還原到剛解析完的樣子。': 'Restored to the freshly parsed state.',
    '正在更新轉場…': 'Updating transition…',
    '已更新，ZIP 會保留這組設定。': 'Updated. The ZIP will keep these settings.',
    '正在更新輪播圖片…': 'Updating slideshow image…',
    '尚無此寬度的量測結果。': 'No measurements are available for this width yet.',
    '這個寬度沒有可調整的 Logo。': 'There are no adjustable logos at this width.',
    '正在確認 Logo 位置…': 'Checking logo positions…',
    '無法確認 Logo 位置。可重新輸入寬度再試。': 'Logo positions could not be confirmed. Enter the width again to retry.',
    '請輸入 240–4096 px。': 'Enter a value between 240 and 4096 px.',
    '解析網頁失敗。': 'Page parsing failed.',
    '解析進度中斷，請重新解析。': 'Parsing progress was interrupted. Please parse again.',
    '匯入上限為 80 MB。': 'Imports are limited to 80 MB.',
    '這張 Logo 是全透明的，請選擇有圖案的圖片。': 'This logo is fully transparent. Choose an image with visible artwork.',
    '圖片上限為 5 MB。': 'Images are limited to 5 MB.',
    '圖片無法開啟，請選擇可正常顯示的圖片。': 'This image cannot be opened. Choose an image that displays correctly.',
    '無法更新，請重試。': 'Unable to update. Please try again.',
    '請輸入導覽文字。': 'Enter navigation text.',
    '請使用頁內錨點，例如 #contact。': 'Use an in-page anchor, for example #contact.',
    '頁內連結（選填）': 'In-page link (optional)',
    'Logo、輪播和導覽會回到剛解析完的設定。確定還原？': 'Logo, slideshow, and navigation settings will return to the freshly parsed state. Reset now?'
  };

  const attributes = new Set(['aria-label', 'title', 'placeholder']);
  const reverseDictionary = new Map(Object.entries(dictionary).map(([zh, en]) => [en, zh]));
  const textSources = new WeakMap();
  const attributeSources = new WeakMap();
  let locale = 'zh-TW';
  let mutating = false;
  let queued = false;

  const translateDynamic = value => {
    let text = value;
    if (locale === 'en') {
      text = text
        .replace(/^已修正 (.+)。$/, 'Repaired $1.')
        .replace(/其中 (\d+) 種寬度仍有水平溢出。/, '$1 checked widths still have horizontal overflow.')
        .replace(/已保留 (\d+) 組可操作的輪播。/, 'Preserved $1 interactive slideshows.')
        .replace(/(\d+) 組輪播無法辨識完整結構或轉場，已保留封存中的可見畫面。/, '$1 slideshows could not be fully identified; the visible archived state was preserved.')
        .replace(/(\d+) 組多圖層輪播缺少部分圖片。/, '$1 multi-layer slideshows are missing some images.')
        .replace(/^缺少的素材：/, 'Missing assets: ')
        .replace(/ 有 (\d+) 處動態媒體使用封存內的靜態備用圖。/, ' $1 dynamic media items use archived static fallbacks.')
        .replace(/遠端圖片已下載 (\d+) 張，未下載 (\d+) 張。/, 'Downloaded $1 remote images; $2 were not downloaded.')
        .replace(/從 Chrome 網頁封存補回 (\d+) 張。/, 'Recovered $1 images from the Chrome archive.')
        .replace(/字型已下載 (\d+) 個/, 'Downloaded $1 fonts')
        .replace(/，未下載 (\d+) 個。/, '; $1 were not downloaded.')
        .replace(/^未取得的字型來源：/, 'Unresolved font sources: ')
        .replace(/^已匯入 (.+)$/, 'Imported $1')
        .replace(/^已找到 (\d+) 個 Logo 位置。$/, 'Found $1 logo positions.')
        .replace(/^已用「(.+)」更換 (\d+) 個 Logo。$/, 'Replaced $2 logos with “$1”.')
        .replace(/^(.+)尺寸已更新。$/, '$1 size updated.')
        .replace(/^(.+)圖片已更換。$/, '$1 image replaced.')
        .replace(/^(.+)(已顯示。|已隱藏。)$/, (_, label, state) => `${label} ${state === '已顯示。' ? 'is shown.' : 'is hidden.'}`)
        .replace(/^正在預覽「(.+)」。匯出後會依原網頁狀態切換。$/, 'Previewing “$1”. The export will switch according to the original webpage state.')
        .replace(/^暫時顯示 (\d+) px 的 Logo 位置。$/, 'Temporarily showing logo positions for $1 px.')
        .replace(/^只列出適用於 (\d+) px 的 Logo 位置。$/, 'Only logo positions for $1 px are listed.')
        .replace(/^此寬度有 (\d+) 個 Logo 位置。$/, 'There are $1 logo positions at this width.')
        .replace(/^(.+)第 (\d+) 張已換成「(.+)」，ZIP 會包含新圖。$/, '$1slide $2 was replaced with “$3”; the ZIP will include the new image.')
        .replace(/^輪播 (\d+) · 第 (\d+) 張/, 'Slideshow $1 · Slide $2')
        .replace(/^第 (\d+) 張/, 'Slide $1')
        .replace(/ · 圖片 (\d+)$/, ' · Image $1')
        .replace(/^項目 (\d+)$/, 'Item $1')
        .replace(/^刪除項目 (\d+)$/, 'Delete item $1')
        .replace(/^更換 (.+)$/, 'Replace $1')
        .replace(/^Logo (.+)滑桿$/, 'Logo $1 slider');
    } else {
      text = text
        .replace(/^Imported (.+)$/, '已匯入 $1')
        .replace(/^Found (\d+) logo positions\.$/, '已找到 $1 個 Logo 位置。')
        .replace(/^There are no adjustable logos at this width\.$/, '這個寬度沒有可調整的 Logo。')
        .replace(/^No measurements are available for this width yet\.$/, '尚無此寬度的量測結果。')
        .replace(/^Checking logo positions…$/, '正在確認 Logo 位置…');
    }
    return text;
  };

  const translate = value => {
    const raw = String(value ?? '');
    if (!raw) return raw;
    const direct = locale === 'en' ? dictionary[raw] : reverseDictionary.get(raw);
    return direct || translateDynamic(raw);
  };

  const translateTextNode = node => {
    const original = node.nodeValue;
    const leading = original.match(/^\s*/)[0];
    const trailing = original.match(/\s*$/)[0];
    const middle = original.slice(leading.length, original.length - trailing.length);
    if (locale === 'zh-TW' && textSources.has(node)) {
      node.nodeValue = leading + textSources.get(node) + trailing;
      textSources.delete(node);
      return;
    }
    const translated = translate(middle);
    if (locale === 'en' && translated !== middle) textSources.set(node, middle);
    if (translated !== middle) node.nodeValue = leading + translated + trailing;
  };

  const shouldSkip = element => element.closest('script,style,iframe,[data-i18n-exclude]');
  const translateTree = root => {
    if (!root || mutating) return;
    mutating = true;
    try {
      if (root.nodeType === Node.TEXT_NODE) translateTextNode(root);
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      for (const node of nodes) {
        if (!shouldSkip(node.parentElement)) translateTextNode(node);
      }
      const elements = root.nodeType === Node.ELEMENT_NODE ? [root, ...root.querySelectorAll?.('*') || []] : [...document.querySelectorAll('[aria-label],[title],[placeholder]')];
      for (const element of elements) {
        if (shouldSkip(element)) continue;
        for (const attribute of attributes) {
          if (!element.hasAttribute?.(attribute)) continue;
          const original = element.getAttribute(attribute);
          if (locale === 'zh-TW' && attributeSources.get(element)?.[attribute] !== undefined) {
            element.setAttribute(attribute, attributeSources.get(element)[attribute]);
            delete attributeSources.get(element)[attribute];
            continue;
          }
          const translated = translate(original);
          if (translated !== original) {
            const saved = attributeSources.get(element) || {};
            saved[attribute] = original;
            attributeSources.set(element, saved);
            element.setAttribute(attribute, translated);
          }
        }
      }
    } finally {
      mutating = false;
    }
  };

  const updateLanguageButton = () => {
    const button = document.getElementById('language-toggle');
    if (!button) return;
    button.hidden = false;
    button.textContent = locale === 'zh-TW' ? 'EN' : '中文';
    button.setAttribute('aria-label', locale === 'zh-TW' ? '切換為英文' : 'Switch to Traditional Chinese');
    button.title = button.getAttribute('aria-label');
  };

  const parentOrigin = () => {
    try { return document.referrer ? new URL(document.referrer).origin : location.origin; }
    catch { return location.origin; }
  };

  const setLocale = (nextLocale, { persist = !embedded, notify = false } = {}) => {
    locale = normalizeLocale(nextLocale);
    document.documentElement.lang = locale === 'zh-TW' ? 'zh-TW' : 'en';
    document.title = locale === 'zh-TW' ? 'Single-Page Parser 網頁解析器' : 'Single-Page Parser';
    if (persist) {
      try { localStorage.setItem(storageKey, locale); } catch {}
    }
    translateTree(document.body);
    updateLanguageButton();
    window.dispatchEvent(new CustomEvent('single-page-parser:locale-changed', { detail: { locale } }));
    if (notify && embedded) window.parent.postMessage({ type: 'single-page-parser:locale-change', locale }, parentOrigin());
    return locale;
  };

  const initialize = () => {
    let initial = navigator.language;
    if (!embedded) {
      try { initial = localStorage.getItem(storageKey) || initial; } catch {}
    }
    setLocale(initial, { persist: !embedded });
    const button = document.getElementById('language-toggle');
    button?.addEventListener('click', () => setLocale(locale === 'zh-TW' ? 'en' : 'zh-TW', { notify: true }));
    const observer = new MutationObserver(records => {
      if (mutating || queued) return;
      if (!records.some(record => [...record.addedNodes].some(node => node.nodeType === Node.TEXT_NODE || node.nodeType === Node.ELEMENT_NODE) || record.type === 'characterData' || record.type === 'attributes')) return;
      queued = true;
      queueMicrotask(() => {
        queued = false;
        translateTree(document.body);
      });
    });
    observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...attributes] });
    if (embedded) window.parent.postMessage({ type: 'single-page-parser:locale-ready', locale }, parentOrigin());
  };

  window.parserI18n = { get locale() { return locale; }, normalizeLocale, setLocale, t: translate };
  window.addEventListener('message', event => {
    if (event.source !== window.parent || !event.data || event.data.type !== 'single-page-parser:locale') return;
    if (!['en', 'zh-TW'].includes(event.data.locale)) return;
    setLocale(event.data.locale, { persist: false });
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
  else initialize();
})();
