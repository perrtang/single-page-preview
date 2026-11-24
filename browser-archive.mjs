import { Buffer } from 'node:buffer';

const imageExtensions = new Map([
  ['image/jpeg','.jpg'],['image/png','.png'],['image/gif','.gif'],
  ['image/webp','.webp'],['image/avif','.avif'],['image/x-icon','.ico']
]);

function headers(block) {
  const result = new Map();
  for (const line of block.replace(/\r?\n[ \t]+/g,' ').split(/\r?\n/)) {
    const colon = line.indexOf(':');
    if (colon > 0) result.set(line.slice(0,colon).toLowerCase(),line.slice(colon+1).trim());
  }
  return result;
}

export function browserImages(bytes) {
  const input = bytes.toString('latin1');
  const separator = /\r?\n\r?\n/.exec(input);
  if (!separator) throw Error('無法讀取 Chrome 網頁封存。');
  const root = headers(input.slice(0,separator.index));
  const contentType = root.get('content-type') || '';
  const boundary = /\bboundary\s*=\s*(?:"([^"]+)"|([^;\s]+))/i.exec(contentType);
  if (!/^multipart\/related\b/i.test(contentType) || !boundary) throw Error('請選取 Chrome「單一檔案」另存的 MHTML。');
  const marker = (boundary[1] || boundary[2]).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const parts = input.split(new RegExp('(?:^|\\r?\\n)--'+marker+'(?:--)?[ \\t]*(?:\\r?\\n|$)'));
  const images = new Map();
  for (const part of parts.slice(1)) {
    const split = /\r?\n\r?\n/.exec(part);
    if (!split) continue;
    const meta = headers(part.slice(0,split.index));
    const url = meta.get('content-location');
    const extension = imageExtensions.get(meta.get('content-type')?.split(';')[0].trim().toLowerCase());
    if (!url || !extension || !/^https:\/\//i.test(url) || meta.get('content-transfer-encoding')?.toLowerCase() !== 'base64') continue;
    const data = Buffer.from(part.slice(split.index+split[0].length),'base64');
    if (data.length && data.length <= 8*1024*1024) images.set(url,{extension,data});
  }
  return images;
}
