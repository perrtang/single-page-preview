import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { posix, join } from 'node:path';
import { tmpdir } from 'node:os';
import { browserImages } from './browser-archive.mjs';
import { downloadImages, downloadFonts, readOriginPage } from './remote-images.mjs';
import { archivePageURL, fontPath, prioritizeIconFonts, stylesheetOrigins } from './font-assets.mjs';
import { identifyNavigation, resetNavigation, updateNavigation } from './navigation-editor.mjs';
import { prepare, repair, measurePreviewLogos, replaceLogo, setLogoVisibility, restoreLogo, restoreParsedPage, previewMarkup, defaultLogoSize, logoDevices, logoSizeLimits, policy } from './engine.mjs';
import { zipSync, unzipSync } from 'fflate';
import { tokenize, isTokenURL, isTokenFunction, isTokenString, isTokenCloseParen, isTokenWhitespace }
  from '@csstools/css-tokenizer';
import { chromium } from 'playwright-core';

const port = Number(process.env.PORT || 8882);
let origin;
const browser = await chromium.launch({executablePath:process.env.CHROME_PATH});
const app = await readFile(new URL('./index.html',import.meta.url));
const projects = new Map();
const maxBytes = 80*1024*1024;
let busy = false;
const types = {
  '.html':'text/html;charset=utf-8','.css':'text/css','.woff':'font/woff','.woff2':'font/woff2',
  '.png':'image/png','.webp':'image/webp','.gif':'image/gif','.jpeg':'image/jpeg','.jpg':'image/jpeg',
  '.avif':'image/avif','.svg':'image/svg+xml','.ico':'image/x-icon','.mp4':'video/mp4',
  '.webm':'video/webm','.ttf':'font/ttf','.otf':'font/otf'
};
function send(res,status,body,headers={}) {
  res.writeHead(status,{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers});
  res.end(body);
}
function json(res,status,value) {
  send(res,status,JSON.stringify(value),{'Content-Type':'application/json;charset=utf-8'});
}
async function body(req) {
  const chunks = [];
  let length = 0;
  for await (const chunk of req) {
    length += chunk.length;
    if (length > maxBytes*1.4) throw Error('匯入檔案過大。');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString());
}
function pathName(name) {
  if (typeof name !== 'string' || !name || name.length>500 || /[\\\x00-\x1f]/.test(name) ||
      name.startsWith('/') || name.split('/').some(part => !part || part === '..' || part === '.')) return null;
  return name;
}
const utf8 = new TextDecoder('utf-8',{fatal:true});
function archivePath(name) {
  // Finder can write UTF-8 filenames without setting the ZIP UTF-8 flag.
  // fflate exposes those unflagged name bytes as Latin-1.
  if (/^[\x00-\xff]+$/.test(name) && /[^\x00-\x7f]/.test(name)) {
    try { return utf8.decode(Buffer.from(name,'latin1')).normalize('NFC'); }
    catch { /* Keep the name when its bytes are not UTF-8. */ }
  }
  return name.normalize('NFC');
}
function inputFiles(items) {
  const files = new Map();
  let bytes = 0;
  const add = (path,data) => {
    path = typeof path === 'string' ? path.normalize('NFC') : path;
    if (!pathName(path) || files.has(path)) throw Error('素材包含重複或無效的路徑。');
    bytes += data.length;
    if (bytes > maxBytes || files.size >= 2500) throw Error('匯入上限為 80 MB 與 2,500 個檔案。');
    files.set(path,data);
  };
  if (items.length === 1 && /\.zip$/i.test(items[0].path)) {
    let expanded = 0;
    let count = 0;
    let archive;
    try {
      archive = unzipSync(Buffer.from(items[0].data,'base64'),{filter(entry) {
        if (entry.name.endsWith('/') || entry.name.startsWith('__MACOSX/')) return false;
        expanded += entry.originalSize;
        if (++count > 2500 || expanded > maxBytes) throw Error('ZIP 解壓後超過匯入上限。');
        return true;
      }});
    } catch (error) {
      if (typeof error.code !== 'number') throw error;
      throw Error('無法解開 ZIP，請確認檔案完整後再試。',{cause:error});
    }
    for (const [path,data] of Object.entries(archive)) add(archivePath(path),data);
  } else {
    for (const {path,data} of items) add(path,Buffer.from(data,'base64'));
  }
  return files;
}
function requireImage(data) {
  const mime = typeof data === 'string' && data.length <= 7*1024*1024 &&
    /^data:image\/(png|jpeg|webp|gif|avif);base64,([A-Za-z0-9+/=]+)$/.exec(data);
  if (!mime || Buffer.from(mime[2],'base64').length > 5*1024*1024) {
    throw Error('請上傳 5 MB 以下的 PNG、JPG、WebP、GIF 或 AVIF。');
  }
}
const pageURL = (id,entry) => '/preview/'+id+'/'+entry.split('/').map(encodeURIComponent).join('/');
function rewriteCssAssets(css, resolve) {
  const tokens = tokenize({css});
  let result = '';
  let position = 0;
  for (let i=0; i<tokens.length; i++) {
    const token = tokens[i];
    let last = token;
    let source;
    if (isTokenURL(token)) source = token[4].value;
    else if (isTokenFunction(token) && token[4].value.toLowerCase() === 'url') {
      let end = i+1;
      while (isTokenWhitespace(tokens[end])) end++;
      if (!isTokenString(tokens[end])) continue;
      source = tokens[end++][4].value;
      while (isTokenWhitespace(tokens[end])) end++;
      if (!isTokenCloseParen(tokens[end])) continue;
      last = tokens[end];
      i = end;
    }
    if (!source || /^data:/i.test(source)) continue;
    const path = source.split(/[?#]/,1)[0];
    const kind = fontPath.test(path) ? 'font' : /\.(?:avif|gif|ico|jpe?g|png|svg|webp)$/i.test(path) ? 'image' : null;
    if (!kind) continue;
    const local = resolve(source,kind);
    if (local) {
      result += css.slice(position,token[2])+'url("'+local+'")';
      position = last[3]+1;
    }
  }
  return position ? result+css.slice(position) : css;
}
const portalOrigins = [
  'https://single-page-parse.thesense.biz',
  'https://thesense-single-page-parse.web.app',
  'https://thesense-single-page-parse.firebaseapp.com',
];
if (process.env.PAGE_PARSER_PORTAL_PREVIEW === '1') portalOrigins.push('http://127.0.0.1:8936');
const frameAncestors = () => [origin, ...portalOrigins].join(' ');
const server = http.createServer(async (req,res) => {
  if (req.headers.host !== new URL(origin).host) return send(res,403,'Forbidden');
  const url = new URL(req.url,origin);
  const parts = url.pathname.split('/').slice(1);
  const [action,id,...segments] = parts;
  const project = projects.get(id);
  try {
    if (url.pathname === '/parser-i18n.js' && req.method === 'GET') {
      const script = await readFile(new URL('./parser-i18n.js', import.meta.url));
      return send(res, 200, script, { 'Content-Type': 'text/javascript; charset=utf-8' });
    }
    if (url.pathname === '/' && req.method === 'GET') {
      const ancestors = url.searchParams.get('embedded') === '1' ? frameAncestors() : "'none'";
      return send(res,200,app,{'Content-Type':types['.html'],'Content-Security-Policy':'frame-ancestors '+ancestors});
    }
    if (action === 'preview' && project && req.method === 'GET') {
      const isolated = {'Content-Security-Policy':policy+'; sandbox allow-scripts; frame-ancestors '+frameAncestors(), 'Referrer-Policy':'no-referrer'};
      const path = pathName(segments.map(decodeURIComponent).join('/').normalize('NFC'));
      if (path === project.entry) {
        const html = url.searchParams.has('initial') && project.initialMarkup
          ? project.initialMarkup
          : previewMarkup(project,url.searchParams.get('logoFocus'),url.searchParams.get('slideFocus'),
            url.searchParams.has('highlightLogo'));
        return send(res,200,html,{...isolated,'Content-Type':types['.html']});
      }
      const file = project.files.get(path);
      const type = path && types[posix.extname(path).toLowerCase()];
      if (file && type && type !== types['.html']) {
        // The imported preview iframe runs with an opaque origin.
        const cors = type.startsWith('font/') ? {'Access-Control-Allow-Origin':'*'} : {};
        return send(res,200,file,{...isolated,...cors,'Content-Type':type});
      }
      return send(res,404,'找不到素材');
    }
    if (action === 'export' && project && !project.processing && req.method === 'GET') {
      const entries = Object.create(null);
      for (const [path,data] of project.files) {
        const type = types[posix.extname(path).toLowerCase()];
        if (type && type !== types['.html']) entries[path]=data;
      }
      entries[project.entry] = Buffer.from(project.dom.serialize());
      return send(res,200,zipSync(entries,{level:3}),{'Content-Type':'application/zip','Content-Disposition':'attachment; filename="page-converted.zip"'});
    }
    if (req.method !== 'POST' || req.headers.origin !== origin) return send(res,404,'Not found');
    if (action === 'import') {
      if (busy) return json(res,409,{error:'正在解析另一份頁面，請稍候。'});
      busy = true;
      const key = randomUUID();
      const streaming = req.headers.accept === 'application/x-ndjson';
      const reportProgress = (percent,label) => {
        if (streaming && !res.destroyed) res.write(JSON.stringify({percent,label})+'\n');
      };
      let imageCache;
      try {
        const {items,fetchImages,fetchFonts,browserArchive} = await body(req);
        if (streaming) {
          res.writeHead(200,{'Content-Type':'application/x-ndjson;charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
          reportProgress(15,'解讀匯入檔案');
        }
        const browserAssets = browserArchive ? browserImages(Buffer.from(browserArchive,'base64')) : new Map();
        const files = inputFiles(items);
        const html = [...files.keys()].filter(path => /\.html?$/i.test(path)).sort((a,b) => a.split('/').length-b.split('/').length);
        const entry = html.find(path => /(^|\/)index\.html?$/i.test(path)) || html[0];
        if (!entry) throw Error('請選擇包含 HTML 的資料夾或 ZIP。');
        const base = new URL(pageURL(key,entry),'https://import.invalid');
        const prefix = '/preview/'+key+'/';
        const hasAsset = source => {
          if (!source) return false;
          if (/^data:/i.test(source)) return true;
          try {
            const target = new URL(source,base);
            return target.origin === base.origin && target.pathname.startsWith(prefix) &&
              files.has(decodeURIComponent(target.pathname.slice(prefix.length)).normalize('NFC'));
          } catch { return false; }
        };
        const byName = new Map();
        for (const path of files.keys()) {
          if (!types[posix.extname(path).toLowerCase()]?.startsWith('image/')) continue;
          const name = posix.basename(path);
          byName.set(name,byName.has(name) ? null : path);
        }
        const localURL = path => './'+posix.relative(posix.dirname(entry),path).split('/').map(encodeURIComponent).join('/');
        const aliasFor = (path,extension) => {
          let alias = path+extension;
          for (let index=1; files.has(alias) && files.get(alias) !== files.get(path); index++) {
            alias = path+'-'+index+extension;
          }
          files.set(alias,files.get(path));
          return localURL(alias);
        };
        const pendingImages = new Set();
        const pendingFonts = new Set();
        const savedFonts = new Map();
        const unresolvedFonts = new Set();
        const fontsByName = new Map();
        for (const path of files.keys()) {
          if (!fontPath.test(path)) continue;
          const name = posix.basename(path);
          fontsByName.set(name,fontsByName.has(name) ? null : path);
        }
        let needsStylesheetOrigins = false;
        let originalStylesheet = () => null;
        const sourcePage = archivePageURL(files.get(entry));
        const fontAsset = (reference,cssURL,sourceCSS) => {
          let target = new URL(reference,cssURL);
          const inArchive = target.origin === base.origin && target.pathname.startsWith(prefix);
          const filename = decodeURIComponent(posix.basename(target.pathname)).normalize('NFC');
          if (inArchive) {
            const directPath = decodeURIComponent(target.pathname.slice(prefix.length)).normalize('NFC');
            if (files.has(directPath)) return null;
          }
          const packed = fontsByName.get(filename);
          if (packed) return localURL(packed);
          if (target.origin === base.origin) {
            if (!sourceCSS) {
              needsStylesheetOrigins = true;
              unresolvedFonts.add(filename);
              return null;
            }
            target = new URL(reference,sourceCSS);
          }
          if (target.protocol !== 'https:') return null;
          target.hash = '';
          const href = target.href;
          const resolved = savedFonts.get(href);
          if (!resolved && fetchFonts === true) pendingFonts.add(href);
          if (!resolved) unresolvedFonts.add(filename);
          return resolved;
        };
        const downloaded = new Map();
        const imageAsset = (source, fetchMissing = true) => {
          if (downloaded.has(source)) return downloaded.get(source);
          if (hasAsset(source)) {
            if (/^data:/i.test(source)) return source;
            const path = decodeURIComponent(new URL(source,base).pathname.slice(prefix.length)).normalize('NFC');
            if (types[posix.extname(path).toLowerCase()]?.startsWith('image/')) return source;
            const bytes = Buffer.from(files.get(path).subarray(0,12));
            if (bytes.subarray(0,3).equals(Buffer.from([255,216,255]))) return aliasFor(path,'.jpg');
            if (bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return aliasFor(path,'.png');
            if (/^GIF8[79]a/.test(bytes.toString('ascii'))) return aliasFor(path,'.gif');
            if (bytes.toString('ascii',0,4) === 'RIFF' && bytes.toString('ascii',8,12) === 'WEBP') return aliasFor(path,'.webp');
            return null;
          }
          if (!source || !/^(?:https?:|\/|[^:]+$)/i.test(source)) return null;
          try {
            const name = posix.basename(decodeURIComponent(new URL(source,base).pathname).normalize('NFC'));
            const path = byName.get(name);
            if (path) return localURL(path);
            if (fetchMissing && (fetchImages === true || browserAssets.has(source)) && /^https:\/\//i.test(source)) pendingImages.add(source);
            return null;
          } catch { return null; }
        };
        const convertedStyles = new Map();
        const rewrite = (css,cssURL,sourceCSS) => rewriteCssAssets(css,(reference,kind) => {
          try {
            const target = new URL(reference,cssURL);
            let asset;
            if (kind === 'font') asset = fontAsset(reference,cssURL,sourceCSS);
            else {
              const inArchive = target.origin === base.origin && target.pathname.startsWith(prefix);
              if (inArchive && files.has(decodeURIComponent(target.pathname.slice(prefix.length)).normalize('NFC'))) return null;
              asset = imageAsset(inArchive ? localURL(decodeURIComponent(target.pathname.slice(prefix.length))) : target.href);
            }
            if (!asset) return null;
            const local = new URL(asset,base);
            return posix.relative(posix.dirname(cssURL.pathname),local.pathname)+local.search+target.hash;
          } catch { return null; }
        });
        const stylesheetAsset = (source,id) => {
          if (!hasAsset(source)) return null;
          const path = decodeURIComponent(new URL(source,base).pathname.slice(prefix.length)).normalize('NFC');
          const href = posix.extname(path).toLowerCase() === '.css' ? source : aliasFor(path,'.css');
          const cssURL = new URL(href,base);
          const cssPath = decodeURIComponent(cssURL.pathname.slice(prefix.length)).normalize('NFC');
          if (!convertedStyles.has(cssPath)) {
            const css = Buffer.from(files.get(path)).toString('utf8');
            const localized = rewrite(css,cssURL,originalStylesheet(id,path));
            if (localized !== css) convertedStyles.set(cssPath,Buffer.from(localized));
          }
          return href;
        };
        const preparePage = () => {
          convertedStyles.clear();
          // Rebuild the queue in stylesheet order once the original URLs are known.
          // Inline font subsets otherwise fill the bounded queue before icon fonts.
          pendingFonts.clear();
          unresolvedFonts.clear();
          return prepare(files.get(entry),hasAsset,imageAsset,stylesheetAsset,css=>rewrite(css,base,sourcePage));
        };
        reportProgress(25,'解析網頁結構與素材');
        let prepared = preparePage();
        if (fetchFonts === true && needsStylesheetOrigins && sourcePage) {
          const original = await readOriginPage(sourcePage).catch(()=>null);
          if (original) {
            originalStylesheet = stylesheetOrigins(original.html,original.url);
            prepared.dom.window.close();
            prepared = preparePage();
          }
        }
        let fontDownloads;
        let remaining = maxBytes-[...new Set(files.values())].reduce((total,file) => total+file.length,0);
        if (pendingFonts.size) {
          reportProgress(35,'補齊字型');
          fontDownloads = await downloadFonts(prioritizeIconFonts(pendingFonts),remaining,async (source,{extension,data})=>{
            const path = 'downloaded-fonts/'+randomUUID()+extension;
            files.set(path,data);
            savedFonts.set(source,localURL(path));
          },(done,total)=>reportProgress(35+Math.floor(14*done/total),'補齊字型'));
          remaining = fontDownloads.remaining;
        }
        let downloads;
        if (pendingImages.size) {
          reportProgress(50,'整理圖片素材');
          imageCache = await mkdtemp(join(tmpdir(),'single-page-preview-images-'));
          const save = async (source,{extension,data}) => {
            const name = randomUUID()+extension;
            await writeFile(join(imageCache,name),data);
            files.set('downloaded-images/'+name,data);
            downloaded.set(source,localURL('downloaded-images/'+name));
          };
          let recovered = 0;
          for (const source of pendingImages) {
            const resource = browserAssets.get(source);
            if (!resource || resource.data.length > remaining) continue;
            await save(source,resource);
            remaining -= resource.data.length;
            pendingImages.delete(source);
            recovered++;
          }
          if (fetchImages === true) downloads = await downloadImages(pendingImages,remaining,save,
            (done,total)=>reportProgress(50+Math.floor(12*done/total),'整理圖片素材'));
          if (downloads || recovered) downloads = {...(downloads || {saved:0,failed:[],skipped:0}),recovered};
        }
        if (pendingImages.size || downloads || fontDownloads) {
          prepared.dom.window.close();
          prepared = preparePage();
        }
        for (const [path,data] of convertedStyles) files.set(path,data);
        const state = {...prepared,entry,files,imageCache,logoSizes:new Map(),processing:true};
        const preview = pageURL(key,entry);
        projects.set(key,state);
        reportProgress(65,'檢查各裝置版面');
        const report = await repair(browser,state,origin+preview,(stage,done,total)=>{
          if (stage === 'scan') reportProgress(65+Math.floor(22*done/total),'檢查各裝置版面');
          else reportProgress(88+Math.floor(10*done/total),'驗證版面調整');
        });
        state.navigation = identifyNavigation(state.dom.window.document);
        state.initialMarkup = state.dom.serialize();
        state.processing = false;
        while (projects.size > 4) {
          const first = projects.keys().next().value;
          const previous = projects.get(first);
          previous.dom.window.close();
          if (previous.imageCache) await rm(previous.imageCache,{recursive:true,force:true});
          projects.delete(first);
        }
        const result = {id:key,preview,entry,navigationItems:state.navigation?.items,
          logos:state.logos,slideshowCount:state.slideshowCount,slideshowImages:state.slideshowImages,slideshowEffect:state.slideshowEffect,
          carousels:state.carousels,defaultLogoSize,logoSizeLimits,staticMedia:state.staticMedia,downloads,fontDownloads,
          unresolvedFonts:[...unresolvedFonts].slice(0,15),...report};
        if (streaming) return res.end(JSON.stringify({result})+'\n');
        return json(res,200,result);
      } catch (error) {
        projects.get(key)?.dom.window.close();
        projects.delete(key);
        if (imageCache) await rm(imageCache,{recursive:true,force:true});
        if (res.headersSent) return res.end(JSON.stringify({error:error.message})+'\n');
        throw error;
      } finally { busy = false; }
    }
    if (action === 'preview-width' && project && !project.processing) {
      const {width} = await body(req);
      if (!Number.isSafeInteger(width) || width < 240 || width > 4096) {
        throw Error('請輸入 240–4096 px 的預覽寬度。');
      }
      const preview = origin+pageURL(id,project.entry)+'?initial=1';
      const logos = project.logos.length ? await measurePreviewLogos(browser,preview,width) : [];
      return json(res,200,{width,logos});
    }
    if (action === 'restore' && project && !project.processing) {
      restoreParsedPage(project);
      if (project.navigation) project.navigation.items = project.navigation.initial;
      return json(res,200,{preview:pageURL(id,project.entry),navigationItems:project.navigation?.items});
    }
    if (action === 'navigation' && project?.navigation && !project.processing) {
      const {items,reset} = await body(req);
      const navigation = project.navigation;
      const document = project.dom.window.document;
      if (reset === true) resetNavigation(document,navigation);
      else updateNavigation(document,navigation,items);
      return json(res,200,{preview:pageURL(id,project.entry),items:navigation.items});
    }
    if (action === 'slideshow-image' && project && !project.processing) {
      const {id:imageId,data} = await body(req);
      const entry = project.slideshowImages.find(image => image.id === imageId);
      if (!entry) throw Error('找不到這張輪播圖片。');
      requireImage(data);
      const image = project.dom.window.document.querySelector('[data-converter-slideshow-image="'+entry.id+'"]');
      image.closest('picture')?.querySelectorAll('source').forEach(source => source.remove());
      for (const attr of ['srcset','sizes','data-src','data-srcset']) image.removeAttribute(attr);
      image.setAttribute('src',data);
      return json(res,200,{preview:pageURL(id,project.entry),slideFocus:entry.gallery+'-'+entry.slide});
    }
    if (action === 'slideshow' && project && !project.processing && project.slideshowCount) {
      const {transition,easing} = await body(req);
      const validTransition = ['fade','slide','ken-burns'].includes(transition) ||
        (['depth','reveal'].includes(transition) && project.slideshowEffect.transition === transition);
      if (!validTransition ||
          !['ease','ease-in','ease-out','ease-in-out'].includes(easing)) {
        throw Error('請選擇有效的輪播轉場與速度曲線。');
      }
      for (const gallery of project.dom.window.document.querySelectorAll('[data-converter-slideshow]')) {
        const unsupported = (transition === 'depth' && !gallery.hasAttribute('data-converter-sniper')) ||
          (transition === 'reveal' && !gallery.hasAttribute('data-converter-split'));
        gallery.dataset.converterTransition = unsupported ? 'fade' : transition;
        gallery.dataset.converterEasing = easing;
      }
      return json(res,200,{preview:pageURL(id,project.entry)});
    }
    if (action === 'logo' && project && !project.processing) {
      const {logo,data,visible,reset,size = {}} = await body(req);
      if (reset === true) {
        const logoId = Number(logo);
        if (!project.logos.some(entry => entry.id === logoId) || !['number','string'].includes(typeof logo) || logo === '') {
          throw Error('找不到這個 Logo。');
        }
        restoreLogo(project,logoId);
        return json(res,200,{preview:pageURL(id,project.entry)});
      }
      if (typeof visible === 'boolean') {
        setLogoVisibility(project.dom,logo,visible);
        return json(res,200,{preview:pageURL(id,project.entry),visible});
      }
      if (!size || logoDevices.some(device => {
        const height = size[device], width = size.widths?.[device], lock = size.locks?.[device];
        const offset = size.offsets?.[device];
        const outside = (value,min,max) => value != null && (!Number.isSafeInteger(value) || value < min || value > max);
        return outside(height,logoSizeLimits.min,logoSizeLimits[device]) ||
          outside(width,1,logoSizeLimits.width[device]) || (lock != null && typeof lock !== 'boolean') ||
          (offset != null && (typeof offset !== 'object' || !Number.isSafeInteger(offset.x) || !Number.isSafeInteger(offset.y) ||
            outside(offset.x,-logoSizeLimits.offset,logoSizeLimits.offset) || outside(offset.y,-logoSizeLimits.offset,logoSizeLimits.offset)));
      })) throw Error('Logo 尺寸或位置超出可用範圍，請檢查輸入值。');
      if (data !== undefined) requireImage(data);
      function saveLogo(logoId,dimensions) {
        const updated = data ? {...dimensions,widths:{...dimensions.widths}} : dimensions;
        if (data) {
          for (const device of logoDevices) {
            updated[device] ??= defaultLogoSize[device];
            if (updated.locks?.[device] !== false) updated.widths[device] = null;
          }
        }
        replaceLogo(project.dom,logoId,data,updated);
        project.logoSizes.set(logoId,updated);
        return updated;
      }
      if (logo === 'all') {
        if (!data || !project.logos.length) throw Error('請選擇替換全部 Logo 的圖片。');
        const sizes = Object.fromEntries(project.logos.map(({id:logoId}) =>
          [logoId,saveLogo(logoId,project.logoSizes.get(logoId) || defaultLogoSize)]));
        return json(res,200,{preview:pageURL(id,project.entry),sizes});
      }
      const logoId = Number(logo);
      const previous = project.logoSizes.get(logoId);
      const updated = saveLogo(logoId,{...previous,...size,
        widths:{...previous?.widths,...size.widths},
        locks:{...previous?.locks,...size.locks},
        offsets:{...previous?.offsets,...size.offsets}});
      return json(res,200,{preview:pageURL(id,project.entry),size:updated});
    }
    send(res,404,'Not found');
  } catch(error) {
    json(res,400,{error:error.message});
  }
});
server.listen(port,'127.0.0.1',() => {
  origin = 'http://127.0.0.1:'+server.address().port;
  if (process.send) process.send({origin});
  else console.log(origin);
});
async function shutdown() {
  server.close();
  await browser.close();
  await Promise.all([...projects.values()].map(p => p.imageCache && rm(p.imageCache,{recursive:true,force:true})));
}
for (const signal of ['SIGINT','SIGTERM','disconnect']) process.once(signal,shutdown);
