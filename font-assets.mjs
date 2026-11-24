import { posix } from 'node:path';
import { parse } from 'parse5';

export const fontPath = /\.(?:woff2?|ttf|otf)$/i;

export function archivePageURL(bytes) {
  const marker = /<!--\s*saved from url=\(\d+\)(https:\/\/[^\r\n]+?)\s+-->/i.exec(Buffer.from(bytes.subarray(0,4096)).toString('utf8'));
  if (!marker) return null;
  try { return new URL(marker[1]).href; }
  catch { return null; }
}

export function stylesheetOrigins(html,pageURL) {
  const byId = new Map();
  const byName = new Map();
  const visit = node => {
    if (node.nodeName === 'link') {
      const attrs = Object.fromEntries(node.attrs.map(({name,value})=>[name,value]));
      if (attrs.href && attrs.rel?.toLowerCase().split(/\s+/).includes('stylesheet')) {
        try {
          const url = new URL(attrs.href,pageURL);
          if (url.protocol === 'https:' && !url.username && !url.password) {
            const name = decodeURIComponent(posix.basename(url.pathname));
            if (attrs.id) byId.set(attrs.id,byId.has(attrs.id)?null:url);
            if (name) byName.set(name,byName.has(name)?null:url);
          }
        } catch { /* Ignore malformed or non-public stylesheet URLs. */ }
      }
    }
    node.childNodes?.forEach(visit);
  };
  visit(parse(html));
  return (id,localPath) => {
    const name = posix.basename(localPath);
    // Chrome may add (1), (2), … when stylesheet basenames collide.
    const originalName = name.replace(/\(\d+\)(?=\.[^.]+$|$)/,'');
    const tagged = id && byId.get(id);
    if (tagged && decodeURIComponent(posix.basename(tagged.pathname))===originalName) return tagged;
    return byName.get(name) || byName.get(originalName) || null;
  };
}
