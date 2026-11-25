import { playerSource, playerPolicy } from './slideshow-player.mjs';
import { prepareMobileNavigation } from './mobile-navigation.mjs';
import { revolutionOptions, preserveRevolutionLayout, revolutionBullets } from './revolution-layout.mjs';
import { prepareSniperSlideshows } from './prime-slider.mjs';
import { revolution7Options, prepareLayeredSlideshows } from './revolution7-layout.mjs';
import { prepareCarouselTracks } from './carousel-layout.mjs';
import { prepareMarquees } from './marquee.mjs';
import { JSDOM } from 'jsdom';

export const widths = [1440, 1024, 834, 768, 600, 390, 320];
export const policy = "default-src 'none'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; media-src 'self' data:; base-uri 'none'; form-action 'none'" + '; ' + playerPolicy;

function missingStyles(names) {
  return Error('匯入缺少樣式檔（'+names.slice(0,3).join('、')+'）。請一併選取 Chrome 另存產生的素材資料夾，或匯入包含 HTML 與素材的 ZIP。');
}

export function prepare(html, hasAsset = () => false, imageAsset = source => hasAsset(source) ? source : null, stylesheetAsset = source => hasAsset(source) ? source : null, inlineStyles = css => css) {
  let input = html;
  if (typeof html !== 'string') {
    // Chrome's saved HTML may put its UTF-8 declaration after thousands of bytes.
    try { input = new TextDecoder('utf-8',{fatal:true}).decode(html); }
    catch { /* Let the HTML encoding detector handle legacy byte encodings. */ }
  }
  const dom = new JSDOM(input);
  const {document} = dom.window;
  const missing = [...document.querySelectorAll('link[rel~="stylesheet"][href]:not([disabled])')]
    .flatMap(link => {
      const href = link.getAttribute('href').trim();
      if (!href || /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(href)) return [];
      const resolved = stylesheetAsset(href,link.id);
      if (!resolved) return [href];
      if (resolved !== href) link.setAttribute('href',resolved);
      return [];
    })
    .map(href => {
      try { return decodeURIComponent(new URL(href,'https://import.invalid').pathname.split('/').at(-1)); }
      catch { return href; }
    });
  if (missing.length) {
    dom.window.close();
    throw missingStyles(missing);
  }
  const linkedStyles = [...document.querySelectorAll('link[rel~="stylesheet"][href]:not([disabled])')];
  const externalStyles = linkedStyles.filter(link => /^(?:https?:|\/\/)/i.test(link.getAttribute('href').trim()));
  if (externalStyles.length && externalStyles.length === linkedStyles.length && !document.querySelector('style')) {
    dom.window.close();
    throw Error('這份 HTML 的樣式需要外部檔案。請用 Chrome「網頁，完整」另存，再匯入 HTML 與素材資料夾。');
  }
  externalStyles.forEach(link => link.remove());
  const sliderOptions = revolutionOptions(document);
  const layerOptions = revolution7Options(document);
  document.querySelectorAll('script,iframe,object,embed,base,meta[http-equiv],link:not([rel~="stylesheet"])').forEach(node => node.remove());
  document.querySelectorAll('*').forEach(node => {
    for (const {name} of [...node.attributes]) {
      if (/^on/i.test(name) || /^data-converter-/.test(name)) node.removeAttribute(name);
    }
  });
  // The Qode cursor captures a stale position once the theme's mousemove handler is removed.
  document.body.classList.remove('qodef-custom-cursor-enabled');
  document.getElementById('qodef-custom-cursor')?.remove();
  // A saved ScrollSmoother viewport has a fixed shell and a synthetic body height.
  // Once its script is removed, let the content participate in native document scrolling.
  const smoothWrapper = document.querySelector('#smooth-wrapper:has(> #smooth-content)');
  const smoothContent = smoothWrapper?.querySelector(':scope > #smooth-content');
  if (smoothWrapper?.style.position==='fixed' && /^matrix(?:3d)?\(/.test(smoothContent?.style.transform)) {
    for (const property of ['inset','width','height','overflow']) smoothWrapper.style.removeProperty(property);
    smoothWrapper.style.setProperty('position','relative');
    smoothWrapper.style.setProperty('overflow-x','clip');
    for (const property of ['transform','translate','rotate','scale','will-change']) smoothContent.style.removeProperty(property);
    if (/^\d+(?:\.\d+)?px$/.test(document.body.style.height)) document.body.style.removeProperty('height');
  }
  const mobileNavigation = prepareMobileNavigation(document);
  document.querySelectorAll('a[href],area[href]').forEach(node => {
    const href = node.getAttribute('href');
    if (href.startsWith('#')) return;
    node.removeAttribute('href');
    // Chrome can rewrite a saved slide's in-page link to the original HTTPS URL.
    if (node.closest('sr7-slide') && /^https?:\/\/[^#]+#[^#]+$/i.test(href)) {
      const fragment = href.slice(href.indexOf('#'));
      try {
        if (document.getElementById(decodeURIComponent(fragment.slice(1)))) node.setAttribute('href',fragment);
      } catch { /* A malformed fragment cannot identify a local target. */ }
    }
  });
  const meta = document.createElement('meta');
  meta.httpEquiv = 'Content-Security-Policy';
  meta.content = policy;
  const charset = document.createElement('meta');
  charset.setAttribute('charset','utf-8');
  document.querySelectorAll('meta[charset]').forEach(node => node.remove());
  document.head.prepend(charset,meta);
  if (!document.querySelector('meta[name=viewport]')) {
    const viewport = document.createElement('meta');
    viewport.name = 'viewport';
    viewport.content = 'width=device-width, initial-scale=1';
    document.head.append(viewport);
  }
  const filename = source => {
    try { return decodeURIComponent(new URL(source,'https://import.invalid').pathname.split('/').at(-1)); }
    catch { return ''; }
  };
  for (const fallback of document.body.querySelectorAll('noscript')) {
    const images = [...fallback.querySelectorAll('img[src]')];
    const preceding = fallback.previousElementSibling;
    const originals = preceding?.matches('img[src]') ? [preceding] : [...(preceding?.querySelectorAll('img[src]') || [])];
    const originalsOnDisk = new Set(originals.filter(img => imageAsset(img.getAttribute('src'))).map(img => filename(img.getAttribute('src')).replace(/\(\d+\)(?=\.[^.]+$)/,'')));
    if (images.length && images.every(img => originalsOnDisk.has(filename(img.getAttribute('src'))))) fallback.remove();
  }
  for (const style of document.querySelectorAll('style')) style.textContent = inlineStyles(style.textContent);
  const missingBackgrounds = new Set();
  for (const node of document.querySelectorAll('[style]')) {
    const background = node.style.getPropertyValue('background-image');
    if (!background) continue;
    const resolved = background.replace(/url\((?:"([^"]*)"|'([^']*)'|([^)]*))\)/gi,(original,double,single,bare) => {
      const source = (double ?? single ?? bare).trim();
      if (!source) return original;
      const local = imageAsset(source);
      if (local && local !== source) return 'url("'+local+'")';
      if (!local) {
        const name = filename(source);
        if (name) missingBackgrounds.add(name);
      }
      return original;
    });
    if (background !== resolved) node.style.setProperty('background-image',resolved,node.style.getPropertyPriority('background-image'));
  }
  const localSrcset = (srcset, fetchMissing = true) => srcset.split(',').flatMap(candidate => {
    const [source,...descriptors] = candidate.trim().split(/\s+/);
    const local = imageAsset(source,fetchMissing);
    return local ? [[local,...descriptors].join(' ')] : [];
  }).join(', ');
  for (const img of document.querySelectorAll('img[srcset]')) {
    if (img.closest('picture')) continue;
    const original = img.getAttribute('srcset');
    if (original.trim().startsWith('data:')) continue;
    const localized = localSrcset(original,!imageAsset(img.getAttribute('src'),false));
    if (localized) img.setAttribute('srcset',localized);
    else img.removeAttribute('srcset');
  }
  for (const section of document.querySelectorAll('.elementor-section-stretched[style]')) {
    if (/^\d+(?:\.\d+)?px$/.test(section.style.width) && section.style.left === '0px') {
      section.style.width = '100%';
    }
  }
  if (document.querySelector('.qodef-qi-process,.qodef-addons-blog-slider')) {
    const style = document.createElement('style');
    style.textContent = `
      @media (min-width:769px) and (max-width:1024px) {
        .qodef-qi-process.qodef-responsive--predefined.qodef-col-num--4 .qodef-grid-item:nth-child(3n) .qodef-e-line { display:none; }
      }
      @media (min-width:681px) and (max-width:768px) {
        .qodef-qi-process.qodef-responsive--predefined.qodef-col-num--4 .qodef-grid-item:nth-child(2n) .qodef-e-line { display:none; }
      }
      @media (max-width:680px) {
        .qodef-qi-process.qodef-responsive--predefined.qodef-col-num--4 .qodef-e-line { display:none; }
      }
      @media (max-width:1024px) {
        .elementor-widget-qi_addons_for_elementor_blog_slider .swiper-button-next.swiper-button-outside { right:0 !important; }
        .elementor-widget-qi_addons_for_elementor_blog_slider .swiper-button-prev.swiper-button-outside { left:0 !important; }
      }
    `;
    document.head.append(style);
  }
  let staticSlideshows = prepareSniperSlideshows(document,0);
  const layered = prepareLayeredSlideshows(document,layerOptions,staticSlideshows,imageAsset,missingBackgrounds);
  staticSlideshows += layered.count;
  // Revolution Slider 6 saves both the frozen layer markup and the actual
  // background images. Rebuild the slides so they can run with local assets.
  for (const module of document.querySelectorAll('rs-module')) {
    const slides = [...module.querySelectorAll(':scope > rs-slides > rs-slide:not([data-key="static"]):not([data-key^="static-"])')];
    if (slides.length < 2) continue;
    const section = document.createElement('section');
    const options = sliderOptions.get(module.id);
    if (options) {
      section.dataset.converterDelay = options.duration;
      if (!options.hoverStop) section.dataset.converterAllowHover = '';
      if (options.swipe) section.dataset.converterSwipe = '';
    }
    const zooms = slides.map(slide=>/data-panzoom="d:(\d+);ss:(\d+(?:\.\d+)?);se:(\d+(?:\.\d+)?)%;"/.exec(slide.innerHTML))
      .map(match=>match?.slice(1).map(Number));
    if (zooms.every(Boolean)) {
      section.dataset.converterTransition = 'ken-burns';
    }
    const sourceLayers = [];
    const renderedLayers = [];
    section.dataset.converterSlideshow = '';
    section.dataset.converterHeroSlideshow = '';
    section.dataset.converterBackgroundSlideshow = '';
    section.setAttribute('aria-label','輪播內容');
    for (const [index,slide] of slides.entries()) {
      const entry = document.createElement('details');
      entry.setAttribute('name','converter-slides-'+staticSlideshows);
      entry.dataset.key = slide.dataset.key || '';
      if (zooms[index]) {
        const [duration,start,end] = zooms[index];
        if (start>=50 && end>=50 && start<=300 && end<=300) {
          entry.dataset.converterZoomDuration = duration;
          entry.dataset.converterZoomStart = start/100;
          entry.dataset.converterZoomEnd = end/100;
        }
      }
      const layers = [...slide.querySelectorAll('rs-layer[data-type="text"]')]
        .filter(layer => layer.textContent.trim())
        .sort((a,b) => layerOffset(a) - layerOffset(b));
      function layerOffset(layer) {
        return parseFloat(/(?:^|;)yo:([^;,]+)/.exec(layer.getAttribute('data-xy') || '')?.[1]) || 0;
      }
      const fontSizes = layers.map(layer =>
        parseFloat(/(?:^|;)s:([^;,]+)/.exec(layer.getAttribute('data-text') || '')?.[1]) || 0);
      const largest = Math.max(0,...fontSizes);
      const titleLayers = layers.filter((_,i) => fontSizes[i] >= largest*.65);
      const titleLines = titleLayers.map(layer => layer.textContent.replace(/\s+/g,' ').trim());
      const summary = document.createElement('summary');
      summary.textContent = titleLines.join(' ') || slide.getAttribute('data-title') || '第 '+(index+1)+' 張';
      const panel = document.createElement('article');
      const background = slide.querySelector('rs-sbg');
      const source = [background?.querySelector('img[src]')?.getAttribute('src'),
        background?.getAttribute('data-lazyload'),slide.querySelector('img.rev-slidebg')?.getAttribute('data-lazyload')]
        .filter(Boolean).map(url => imageAsset(url)).find(Boolean);
      if (source) {
        const image = document.createElement('img');
        image.src = source;
        image.alt = '';
        panel.append(image);
      } else {
        const name = filename(background?.getAttribute('data-lazyload') || '');
        if (name) missingBackgrounds.add(name);
      }
      const copy = document.createElement('div');
      const heading = document.createElement('h2');
      for (const [i,title] of titleLines.entries()) {
        const line = document.createElement('span');
        line.textContent = title;
        heading.append(line);
        sourceLayers.push(titleLayers[i]);
        renderedLayers.push(line);
      }
      if (heading.childElementCount) copy.append(heading);
      for (const [i,layer] of layers.entries()) {
        if (fontSizes[i] >= largest*.65) continue;
        const text = document.createElement('p');
        text.textContent = layer.textContent.trim();
        copy.append(text);
        sourceLayers.push(layer);
        renderedLayers.push(text);
      }
      panel.append(copy);
      entry.append(summary,panel);
      entry.open = slide.getAttribute('data-key') === module.getAttribute('data-slideactive');
      section.append(entry);
    }
    if (!section.querySelector('details[open]')) section.firstElementChild.open = true;
    preserveRevolutionLayout(section,sourceLayers,renderedLayers,options,staticSlideshows);
    revolutionBullets(section,module,options,[...section.children]);
    const wrapper = module.closest('rs-fullwidth-wrap,rs-module-wrap');
    const placeholder = wrapper?.closest('rs-fullwidth-wrap');
    (placeholder || wrapper || module).replaceWith(section);
    staticSlideshows++;
  }
  const carousels = prepareCarouselTracks(document);
  const marquees = prepareMarquees(document);
  carousels.incomplete = layered.incomplete;
  if (staticSlideshows) {
    for (const gallery of document.querySelectorAll('[data-converter-slideshow]')) {
      if (gallery.querySelector('[data-converter-player]')) continue;
      const entries = [...gallery.querySelectorAll(':scope > details')];
      if (entries.length < 2) continue;
      const controls = document.createElement('div');
      controls.dataset.converterPlayer = '';
      controls.hidden = true;
      const iconButton = (key,label,paths) => '<button type="button" data-converter-icon data-converter-'+key+' aria-label="'+label+'" title="'+label+'"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">'+paths+'</svg></button>';
      controls.innerHTML = iconButton('prev','上一張','<path d="M19 12H5m6-6-6 6 6 6"/>')+
        iconButton('next','下一張','<path d="M5 12h14m-6-6 6 6-6 6"/>')+
        iconButton('pause','暫停播放','<path d="M9 5v14m6-14v14"/><path d="m9 5 10 7-10 7z" data-converter-play-icon/>')+
        '<select aria-label="選擇輪播頁"></select><output aria-label="輪播頁數"></output>';
      const select = controls.querySelector('select');
      entries.forEach((entry,index) => {
        const option = document.createElement('option');
        option.value = String(index);
        option.textContent = entry.querySelector('summary').textContent;
        select.append(option);
      });
      if (gallery.hasAttribute('data-converter-hero-slideshow')) gallery.append(controls);
      else gallery.prepend(controls);
    }
    const style = document.createElement('style');
    style.textContent = `
      [data-converter-slideshow] { padding: clamp(16px, 4vw, 48px); background: #f9f6f3; color: #232323; }
      [data-converter-slideshow] details { max-width: 1200px; margin: 0 auto; border-bottom: 1px solid #d6ccc2; }
      [data-converter-slideshow] summary { padding: 12px 0; cursor: pointer; font-weight: 700; scroll-margin-top: 100px; }
      [data-converter-slideshow] > details:not([open]) > :not(summary),
      [data-converter-playing] > details[hidden],
      [data-converter-playing][data-converter-hero-slideshow] > details > summary { display: none !important; }
      [data-converter-slideshow] > details[open] > div { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 12px; padding-bottom: 16px; }
      [data-converter-player]:not([hidden]) { display:flex; flex-wrap:wrap; align-items:center; gap:8px; max-width:1200px; margin:0 auto 12px; }
      [data-converter-player] button, [data-converter-player] select { color:#232323; background:#fff; border:1px solid #ab9f94; padding:7px 10px; max-width:100%; }
      [data-converter-player] button { cursor:pointer; }
      [data-converter-player] > [data-converter-icon] {display:inline-grid;place-items:center;width:44px;height:44px;padding:0;border:0;border-radius:50%;background:transparent;color:inherit;box-shadow:none}
      [data-converter-player] > [data-converter-icon]:is(:hover,:focus-visible) {background:currentColor;background:color-mix(in srgb,currentColor 12%,transparent)}
      [data-converter-icon] svg {width:22px;height:22px}
      [data-converter-pause] [data-converter-play-icon], [data-converter-paused] path:not([data-converter-play-icon]) {display:none}
      [data-converter-paused] [data-converter-play-icon] {display:block}
      [data-converter-player] output { white-space:nowrap; }
      [data-converter-slideshow] img { display: block; width: 100%; aspect-ratio: 4/3; object-fit: contain; }
      [data-converter-hero-slideshow] { background:#f7f4f1; padding-inline:clamp(20px,7vw,100px); }
      [data-converter-hero-full-width] { box-sizing:border-box; width:100vw; max-width:none; margin-inline:calc(50% - 50vw); }
      [data-converter-hero-slideshow] > details { border:0; }
      [data-converter-background-slideshow] { position:relative; padding:0; background:#242321; color:#fff; }
      [data-converter-background-slideshow][data-converter-swipe] { touch-action:pan-y pinch-zoom; }
      [data-converter-background-slideshow] > details { max-width:none; }
      [data-converter-background-slideshow] article {
        position:relative; isolation:isolate; display:grid; align-items:center;
        min-height:clamp(465px, 58vw, 850px); padding:clamp(32px, 5vw, 80px);
      }
      [data-converter-background-slideshow] article > img {
        position:absolute; inset:0; z-index:-2; width:100%; height:100%; aspect-ratio:auto; object-fit:cover;
      }
      [data-converter-background-slideshow] article::before {
        content:''; position:absolute; inset:0; z-index:-1;
        background:linear-gradient(90deg, #111b, #1114 75%);
      }
      [data-converter-background-slideshow] article h2 {
        color:inherit; font-size:clamp(34px, 6vw, 96px); line-height:1.02; margin:0 0 20px;
      }
      [data-converter-background-slideshow] article h2 span { display:block; }
      [data-converter-background-slideshow] article p { color:inherit; max-width:28ch; margin:0; }
      [data-converter-background-slideshow] > [data-converter-player] { padding:12px 16px; }
      [data-converter-rev-layout] article { display:block; height:100svh; min-height:0; padding:0; overflow:hidden; }
      [data-converter-rev-layout] article::before { content:none; }
      [data-converter-rev-layout] article :is(h2,p) { max-width:none; margin:0; }
      [data-converter-rev-layout] article [data-converter-rev-layer] {
        display:block; position:absolute; inset:auto;
        left:var(--converter-rs-x); top:calc(50% + var(--converter-rs-y));
        width:var(--converter-rs-layer-width,auto); max-width:calc(100% - var(--converter-rs-x));
        font-size:var(--converter-rs-font); line-height:var(--converter-rs-line);
        transform:translateY(-50%);
      }
      [data-converter-background-slideshow] > [data-converter-rev-bullets]:not([hidden]) {
        position:absolute; z-index:1; left:calc(var(--converter-bullets-left) - 10px);
        bottom:calc(var(--converter-bullets-bottom) - 18px);
        display:flex; width:max-content; gap:0; padding:0; margin:0; align-items:center;
      }
      [data-converter-rev-bullets] button[data-converter-jump] {
        display:grid; place-items:center; flex:none; width:var(--converter-bullets-step);
        min-height:44px; padding:0; background:transparent; border:0; box-shadow:none;
      }
      [data-converter-rev-bullets] button::after {
        content:''; width:8px; height:8px; box-sizing:border-box;
        background:transparent; border:1px solid white;
      }
      [data-converter-rev-bullets] button:is([aria-current=true],:hover)::after { background:white; }
      [data-converter-rev-bullets] button:focus-visible { outline:2px solid white; outline-offset:-3px; }
      [data-converter-player]:not([hidden]) button, [data-converter-player]:not([hidden]) select { min-height:44px; }
      [data-converter-hero-panel] {
        display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1.2fr); align-items:center;
        gap:clamp(24px,5vw,80px); padding:clamp(28px,5vw,72px) 0;
      }
      [data-converter-hero-copy] > p { margin:0 0 12px; color:#79501f; font-size:clamp(13px,1.3vw,17px); line-height:1.5; text-wrap:balance; }
      [data-converter-hero-copy] > h2 {
        margin:0; color:#232323; font:750 clamp(32px,4.8vw,70px)/1.08 Poppins,system-ui,sans-serif;
        overflow-wrap:anywhere; text-wrap:balance; letter-spacing:-.025em;
      }
      [data-converter-hero-copy] > h2 > span { display:block; }
      [data-converter-hero-copy] > a {
        display:inline-flex; align-items:center; gap:12px; min-height:44px; margin-top:16px;
        font-weight:650; text-transform:uppercase; text-decoration:underline; text-underline-offset:4px; color:#232323;
      }
      [data-converter-hero-copy] > a::after { content:'→'; }
      [data-converter-hero-media] {
        display:grid; grid-template-columns:minmax(0,2.5fr) minmax(0,1fr); align-items:center;
        gap:clamp(8px,1.2vw,18px); background:#efe5d7; border-radius:clamp(16px,3vw,40px);
        padding:clamp(10px,2vw,24px); min-width:0;
      }
      [data-converter-hero-media] img { width:100%; height:auto; aspect-ratio:auto; max-height:440px; object-fit:contain; }
      [data-converter-hero-media] img:first-child { grid-row:span 2; }
      [data-converter-hero-media] img:only-child { grid-column:1 / -1; }
      [data-converter-hero-media] img:not(:first-child) { max-height:184px; }
      [data-converter-hero-slideshow] > [data-converter-player] { margin-bottom:0; }
      [data-converter-hero-slideshow] > [data-converter-player] select { width:auto; min-width:0; }
      @media (max-width:1024px) {
        body:has(#masthead) [data-converter-hero-slideshow] { padding-top:88px; }
      }
      @media (max-width:700px) {
        [data-converter-hero-panel] { grid-template-columns:minmax(0,1fr); padding-top:14px; text-align:center; }
        [data-converter-hero-media] { grid-row:1; }
        [data-converter-hero-media] img:not(:first-child) { max-height:105px; }
        [data-converter-hero-slideshow] > [data-converter-player] { justify-content:center; }
        [data-converter-hero-slideshow] > [data-converter-player] select { flex:0 1 min(17rem,calc(100% - 3rem)); }
      }
      @media (max-width:600px) { [data-converter-slideshow] > details[open] > div { grid-template-columns:repeat(2,minmax(0,1fr)); } }
    `;
    document.head.append(style);
  }
  const slideshows = [...document.querySelectorAll('[data-converter-slideshow]')]
    .filter(gallery => gallery.querySelector('[data-converter-player]'));
  const slideshowImages = [];
  for (const [galleryIndex,gallery] of slideshows.entries()) {
    gallery.dataset.converterSlideshowId = galleryIndex;
    gallery.dataset.converterTransition ||= 'fade';
    gallery.dataset.converterEasing = 'ease';
    const frames = [...gallery.querySelectorAll(':scope > details')];
    for (const [slideIndex,frame] of frames.entries()) {
      const title = frame.querySelector('summary')?.textContent.trim();
      const images = [...frame.querySelectorAll('img[src]')];
      for (const [imageIndex,image] of images.entries()) {
        const id = [galleryIndex,slideIndex,imageIndex].join('-');
        image.dataset.converterSlideshowImage = id;
        slideshowImages.push({id,gallery:galleryIndex,slide:slideIndex,title,imageIndex,
          imageCount:images.length,name:filename(image.getAttribute('src')).slice(0,140)});
      }
    }
  }
  if (staticSlideshows || carousels.rails || carousels.fades || mobileNavigation || marquees) {
    const player = document.createElement('script');
    player.textContent = playerSource;
    document.body.append(player);
  }
  let missingLazyImages = 0;
  for (const img of document.querySelectorAll('img[src]')) {
    const source = img.getAttribute('src');
    const deferred = img.getAttribute('data-src');
    const local = imageAsset(source) || (deferred && imageAsset(deferred));
    if (local && local !== source) img.setAttribute('src',local);
    else if (!local && deferred) missingLazyImages++;
  }
  let responsiveFallback = false;
  for (const picture of document.querySelectorAll('picture')) {
    const image = picture.querySelector('img[src]');
    if (!image || !hasAsset(image.getAttribute('src'))) continue;
    for (const node of picture.querySelectorAll('[srcset]')) {
      const srcset = node.getAttribute('srcset');
      if (node.localName === 'source' && node.hasAttribute('data-empty')) {
        node.remove();
        continue;
      }
      if (srcset.startsWith('data:')) continue;
      const available = localSrcset(srcset);
      if (available) node.setAttribute('srcset',available);
      else if (node.localName === 'source') {
        node.remove();
        responsiveFallback = true;
        image.dataset.converterPictureFallback = '';
      }
      else node.removeAttribute('srcset');
    }
  }
  if (responsiveFallback) {
    const style = document.createElement('style');
    style.textContent = '[data-converter-picture-fallback] { object-fit: contain !important; }';
    document.head.append(style);
  }
  // Saved pages can freeze before scripts reveal scroll-triggered content.
  const staggered = '[data-component-list*="StaggeredFadeIn"]';
  if (document.querySelector(staggered)) {
    const style = document.createElement('style');
    style.textContent = `
      ${staggered}[data-staggered-item], ${staggered} [data-staggered-item] {
        opacity: 1 !important; visibility: visible !important;
        animation: none !important; transition: none !important;
      }
    `;
    document.head.append(style);
  }
  for (const gallery of document.querySelectorAll('[data-media-card-gallery]')) {
    const wrapper = gallery.querySelector('.media-gallery-wrapper');
    const scroller = wrapper?.querySelector('.scroll-container');
    if (!scroller) continue;
    gallery.querySelector('.all-access-pass__container')?.remove();
    wrapper.classList.remove('disable-scroll');
    scroller.style.setProperty('overflow-x','auto','important');
    scroller.tabIndex = 0;
    gallery.dataset.converterStaticGallery = '';
  }
  if (document.querySelector('[data-converter-static-gallery]')) {
    const style = document.createElement('style');
    style.textContent = `
      [data-converter-static-gallery] .card-container.theme-light > .card { background: #fff; }
      @media (max-width: 734px) {
        [data-converter-static-gallery] .card-container > .card > .media-block {
          translate: 0 100px;
        }
      }
      section:has([data-converter-static-gallery]) { padding-bottom: clamp(28px, 5vw, 72px) !important; }
    `;
    document.head.append(style);
  }
  const index = document.querySelector('.section-index .index');
  if (index) {
    index.dataset.converterStaticIndex = '';
    const style = document.createElement('style');
    style.textContent = `
      [data-converter-static-index] :is(.index-item-base,.index-item-elevated,.index-list-title) {
        opacity: 1 !important; visibility: visible !important;
        transform: none !important; animation: none !important;
      }
    `;
    document.head.append(style);
  }
  let staticMedia = 0;
  for (const viewer of document.querySelectorAll('[data-component-list*="ProductViewerCore"]')) {
    if (!viewer.querySelector('canvas')) continue;
    const image = [...viewer.querySelectorAll('picture img[src]')].find(node =>
      /foldable/i.test(node.closest('picture').className) && hasAsset(node.getAttribute('src')));
    if (!image) continue;
    const still = document.createElement('img');
    still.src = image.getAttribute('src');
    still.alt = viewer.closest('section')?.querySelector('h2')?.textContent.trim() || '';
    still.style.cssText = 'display:block;width:min(calc(100% - 32px),820px);height:auto;margin:24px auto;';
    viewer.replaceWith(still);
    staticMedia++;
  }

  let staticHero = false;
  for (const stack of document.querySelectorAll('.video-element-stack')) {
    const fallback = stack.nextElementSibling;
    const video = stack.querySelector('video');
    if (!video || !fallback?.matches('.fallback-container')) continue;
    const sources = [video.getAttribute('src'),...Array.from(video.querySelectorAll('source[src]'), node => node.getAttribute('src'))];
    if (sources.some(hasAsset) || !hasAsset(fallback.querySelector('img[src]')?.getAttribute('src'))) continue;
    const section = stack.closest('section.media-layout-background');
    const content = section?.querySelector(':scope > .section-content');
    const media = section?.querySelector(':scope > .media');
    if (content && media?.contains(stack)) {
      const picture = fallback.querySelector('picture');
      const image = fallback.querySelector('img[src]');
      const visual = document.createElement('div');
      visual.dataset.converterHeroImage = '';
      for (const node of [picture,image]) node?.removeAttribute('class');
      if (!image.alt) image.alt = fallback.getAttribute('aria-label') || '';
      visual.append(picture || image);
      media.replaceWith(visual);
      section.dataset.converterHero = '';
      staticHero = true;
      staticMedia++;
      continue;
    }
    stack.style.setProperty('display','none','important');
    fallback.style.setProperty('display','flex','important');
    fallback.style.setProperty('visibility','visible','important');
    fallback.style.setProperty('opacity','1','important');
    staticMedia++;
  }
  if (staticHero) {
    const style = document.createElement('style');
    style.textContent = `
      section[data-converter-hero] {
        display: block !important; height: auto !important; min-height: 0 !important;
        padding: clamp(24px, 5vw, 64px) 0 !important;
      }
      section[data-converter-hero] > .section-content {
        position: relative !important; inset: auto !important; height: auto !important;
        transform: none !important; margin: 0 auto !important; max-width: calc(100% - 32px);
      }
      [data-converter-hero-image] {
        width: min(100% - 32px, 1150px); margin: clamp(16px, 3vw, 36px) auto 0;
      }
      [data-converter-hero-image] picture, [data-converter-hero-image] img {
        display: block; width: 100%; height: auto; position: static;
      }
    `;
    document.head.append(style);
  }
  const logos = new Map();
  for (const node of document.querySelectorAll('img, svg')) {
    const link = node.closest('a');
    const context = node.closest('header,footer,nav,[role=banner],[role=contentinfo],[role=navigation]');
    const hints = [node.id,node.getAttribute('class'),node.getAttribute('alt'),node.getAttribute('aria-label'),node.getAttribute('src'),
      node.parentElement?.getAttribute('class'),link?.getAttribute('class')].join(' ');
    const homeMark = context && link?.getAttribute('aria-label') &&
      !link.hasAttribute('data-topnav-flyout-trigger-compact') &&
      /\bhome\b|首頁/i.test(link.getAttribute('data-analytics-title') || '');
    if (!homeMark && !/logo|brand-mark|品牌標誌|商標/i.test(hints)) continue;
    const heading = node.closest('h1,h2,h3,h4,h5,h6');
    const composite = context && heading && /logo|brand-mark/i.test(heading.className) &&
      heading.querySelectorAll('img,svg').length > 1;
    const group = homeMark ? link : composite ? heading : node;
    if (composite && logos.has(group)) node.dataset.converterLogoPart = '';
    if (!logos.has(group)) {
      if (logos.size >= 24) continue;
      const section = context?.matches('footer,[role=contentinfo]') ? '頁尾' : context ? '頁首' : '頁面';
      const name = node.getAttribute('alt') || node.getAttribute('aria-label') || link?.getAttribute('aria-label') || 'Logo';
      const desktopHeader = node.closest('[id$="-page-header"]');
      const mobileHeader = node.closest('[id$="-mobile-header"]');
      const themeVariant = node.classList.contains('qodef--light') ? '淺色' :
        node.classList.contains('qodef--dark') ? '深色' : '預設';
      const variant = mobileHeader ? '手機頁首' :
        desktopHeader && node.classList.contains('qodef-header-logo-image') ? '桌機頁首 · '+themeVariant : '';
      if (link && variant.startsWith('桌機頁首')) link.dataset.converterLogoVariants = '';
      logos.set(group,{id:logos.size,section,name,variant,hasVariants:Boolean(link && variant.startsWith('桌機頁首'))});
    }
    node.dataset.converterLogo = logos.get(group).id;
  }
  if (logos.size) {
    const style = document.createElement('style');
    style.textContent = '[data-converter-logo-hidden],[data-converter-logo-part-replaced] { display: none !important; }';
    document.head.append(style);
  }
  const slideshowEffect = {transition:slideshows[0]?.dataset.converterTransition || 'fade',easing:'ease'};
  return {dom, logos:[...logos.values()],slideshowCount:slideshows.length,slideshowImages,slideshowEffect,carousels,staticMedia,missingLazyImages,missingBackgrounds:[...missingBackgrounds],hasExternalStyles:externalStyles.length > 0};
}

function logoNodes(dom,id) {
  const nodes = [...dom.window.document.querySelectorAll('[data-converter-logo]')].filter(node => node.dataset.converterLogo === String(id));
  if (!nodes.length) throw Error('找不到這個 Logo。');
  return nodes;
}

export function setLogoVisibility(dom,id,visible) {
  for (const node of logoNodes(dom,id)) {
    node.toggleAttribute('data-converter-logo-hidden',!visible);
  }
}

export function restoreLogo(project,id) {
  const originalPage = new JSDOM(project.initialMarkup);
  try {
    const current = logoNodes(project.dom,id);
    const original = logoNodes(originalPage,id);
    const document = project.dom.window.document;
    const slots = new Set();
    current.forEach((node,index) => {
      const originalNode = original[index];
      const parent = node.parentElement;
      if (parent.hasAttribute('data-converter-logo-slot')) slots.add(parent);
      if (node.hasAttribute('data-converter-replaced-logo')) {
        const picture = node.closest('picture');
        if (picture && !picture.querySelector('source')) {
          const sources = originalNode.closest('picture')?.querySelectorAll('source') || [];
          for (const source of sources) node.before(document.importNode(source,true));
        }
        if (originalNode.localName !== 'img' && parent.localName === 'span' && parent.children.length === 1 &&
            node.closest('nav,[role=navigation]')) {
          for (const property of ['width','max-width']) {
            const style = originalNode.parentElement.style;
            parent.style.setProperty(property,style.getPropertyValue(property),style.getPropertyPriority(property));
          }
        }
      }
      node.replaceWith(document.importNode(originalNode,true));
    });
    for (const slot of slots) updateLogoSlot(slot);
    project.logoSizes.delete(id);
  } finally { originalPage.window.close(); }
}

export function restoreParsedPage(project) {
  const restored = new JSDOM(project.initialMarkup);
  project.dom.window.close();
  project.dom = restored;
  project.logoSizes.clear();
}

export const defaultLogoSize = {mobile:28,tablet:32,desktop:32};
export const logoDevices = Object.keys(defaultLogoSize);
export const logoSizeLimits = {min:12,mobile:64,tablet:128,desktop:128,offset:100,width:{mobile:176,tablet:360,desktop:360}};

export function previewMarkup(project, focusedLogo, focusedSlide, highlightLogo) {
  const focus = /^(0|[1-9]\d{0,2})-(0|[1-9]\d{0,2})$/.exec(focusedSlide || '');
  const document = project.dom.window.document;
  const gallery = focus && document.querySelector('[data-converter-slideshow-id="'+focus[1]+'"]');
  const slides = gallery ? [...gallery.querySelectorAll(':scope > details')] : [];
  const targetSlide = focus && slides[Number(focus[2])];
  const open = targetSlide && slides.find(slide => slide.open);
  const logo = /^(?:0|[1-9][0-9]?)$/.test(focusedLogo || '') && project.logos.find(logo => logo.id === Number(focusedLogo));
  if (targetSlide && targetSlide !== open) {
    open?.removeAttribute('open');
    targetSlide.open = true;
  }
  try {
    if (!logo) return project.dom.serialize();
    return focusedLogoMarkup(project.dom,logo,highlightLogo);
  } finally {
    if (targetSlide && targetSlide !== open) {
      targetSlide.open = false;
      if (open) open.open = true;
    }
  }
}

function focusedLogoMarkup(dom,logo,highlightLogo) {
  const document = dom.window.document;
  const focusedLogo = logo.id;
  const target = '[data-converter-logo="'+focusedLogo+'"]:not([data-converter-logo-hidden],[data-converter-logo-part])';
  const slot = '[data-converter-logo-variants]:has(> '+target+')';
  const variantStyle = logo.hasVariants ? slot+' > [data-converter-logo]:not('+target+') {opacity:0!important;}'+
    slot+' > '+target+' {display:block!important;visibility:visible!important;opacity:1!important;}' : '';
  const highlightStyle = highlightLogo ? '[data-converter-logo-outline] {all:initial;display:block;position:fixed;top:0;left:0;'+
    'pointer-events:none;z-index:2147483647;outline:3px solid #ef4444;outline-offset:3px;}' : '';
  const style = '<style>'+variantStyle+highlightStyle+'</style>';
  // The saved page DOM is shared by preview and export. Mark only the returned preview.
  const targets = document.querySelectorAll(target);
  for (const node of targets) node.setAttribute('data-converter-preview-logo',highlightLogo ? 'highlight' : '');
  try {
    const preview = dom.serialize().replace(/<\/head>/i,()=>style+'</head>');
    return document.querySelector('script') ? preview :
      preview.replace(/<\/body>/i,()=>'<script>'+playerSource+'</script></body>');
  } finally {
    for (const node of targets) node.removeAttribute('data-converter-preview-logo');
  }
}

export function replaceLogo(dom, id, url, size = defaultLogoSize) {
  const {document} = dom.window;
  const nodes = logoNodes(dom,id);
  if (url) {
    nodes.filter(node => node.hasAttribute('data-converter-logo-part')).forEach(node =>
      node.setAttribute('data-converter-logo-part-replaced',''));
  }
  const replaceable = nodes.filter(node => !node.hasAttribute('data-converter-logo-part'));
  if (!document.getElementById('converter-logo-sizing')) {
    const style = document.createElement('style');
    style.id = 'converter-logo-sizing';
    const sizingRule = (device,selector) => `
      ${selector} {
        width:var(--converter-logo-${device}-width,auto) !important;
        height:var(--converter-logo-${device}) !important;
        max-height:none !important;
        max-width:var(--converter-logo-limit-${device},100%) !important;
        object-fit:var(--converter-logo-${device}-fit,contain) !important;
        vertical-align:middle !important;
      }`;
    const mediaQueries = {mobile:'(width < 768px)',tablet:'(768px <= width <= 1024px)',desktop:'(width > 1024px)'};
    style.textContent = logoDevices.map(device => {
      const sized = '[data-converter-size-'+device+']';
      const slot = '[data-converter-logo-slot]:has(> '+sized+':not([data-converter-logo-hidden]))';
      const height = 'var(--converter-logo-slot-'+device+')';
      return `
        @media ${mediaQueries[device]} {
          ${sizingRule(device,sized)}
          [data-converter-offset-${device}] {translate:var(--converter-logo-offset-${device}) !important;}
          ${slot} {min-height:${height} !important;}
          ${device === 'mobile' ? '' : slot+':not([data-converter-mobile-logo]) {min-height:calc('+height+' + 12px) !important;}'}
        }
      `;
    }).join('');
    document.head.append(style);
  }
  const slots = new Set();
  for (const node of replaceable) {
    const inNav = Boolean(node.closest('nav,[role=navigation]'));
    let image = node;
    if (url && node.localName !== 'img') {
      image = document.createElement('img');
      const attributes = ['id','class','style','width','height','data-converter-logo','data-converter-logo-hidden',
        ...logoDevices.map(device => 'data-converter-offset-'+device)];
      for (const name of attributes) {
        if (node.hasAttribute(name)) image.setAttribute(name,node.getAttribute(name));
      }
      image.alt = node.getAttribute('aria-label') || node.closest('a')?.getAttribute('aria-label') || 'Logo';
      if (inNav) {
        // SVG slots often use a tall, narrow icon box. Give raster wordmarks
        // their own width while keeping the existing desktop/mobile wrappers.
        if (node.parentElement?.children.length === 1 && node.parentElement.localName === 'span') {
          node.parentElement.style.setProperty('width','auto','important');
          node.parentElement.style.setProperty('max-width','none','important');
        }
      }
      node.replaceWith(image);
    }
    if (url) {
      image.closest('picture')?.querySelectorAll('source').forEach(source => source.remove());
      for (const attribute of ['srcset','sizes','width','height']) image.removeAttribute(attribute);
      for (const property of ['width','height','max-width','max-height','object-fit']) image.style.removeProperty(property);
      image.dataset.converterReplacedLogo = '';
      image.src = url;
    }
    const mobileHeader = image.closest('[id$="-mobile-header"]');
    image.toggleAttribute('data-converter-mobile-logo',Boolean(mobileHeader));
    const inHeader = mobileHeader || image.closest('header,[role=banner],[id$="-page-header"]');
    if (inNav || inHeader) {
      image.style.setProperty('--converter-logo-limit-desktop','min(360px, 30vw)');
      image.style.setProperty('--converter-logo-limit-tablet',mobileHeader ? '45vw' : 'min(360px, 30vw)');
      image.style.setProperty('--converter-logo-limit-mobile','45vw');
    }
    for (const device of logoDevices) {
      const offset = size.offsets?.[device];
      if (offset) {
        image.toggleAttribute('data-converter-offset-'+device,Boolean(offset.x || offset.y));
        if (offset.x || offset.y) image.style.setProperty('--converter-logo-offset-'+device,offset.x+'px '+offset.y+'px');
        else image.style.removeProperty('--converter-logo-offset-'+device);
      }
      if (size[device] == null) continue;
      image.setAttribute('data-converter-size-'+device,'');
      image.style.setProperty('--converter-logo-'+device,size[device]+'px');
      const width = size.widths?.[device];
      image.style.setProperty('--converter-logo-'+device+'-width',width == null ? 'auto' : width+'px');
      image.style.setProperty('--converter-logo-'+device+'-fit',size.locks?.[device] === false ? 'fill' : 'contain');
    }
    if (image.parentElement?.matches('a') &&
        [...image.parentElement.children].every(child => child.hasAttribute('data-converter-logo'))) {
      image.parentElement.toggleAttribute('data-converter-mobile-logo',Boolean(mobileHeader));
      slots.add(image.parentElement);
    }
  }
  for (const slot of slots) updateLogoSlot(slot);
}

function updateLogoSlot(slot) {
  const sized = logoDevices.some(device => slot.querySelector(':scope > [data-converter-size-'+device+']'));
  slot.toggleAttribute('data-converter-logo-slot',sized);
  if (!sized) slot.removeAttribute('data-converter-mobile-logo');
  for (const device of logoDevices) {
    const property = '--converter-logo-slot-'+device;
    if (!sized) slot.style.removeProperty(property);
    else {
      const images = [...slot.querySelectorAll(':scope > [data-converter-size-'+device+']')];
      const height = Math.max(0,...images.map(image => parseInt(image.style.getPropertyValue('--converter-logo-'+device),10)));
      slot.style.setProperty(property,height+'px');
    }
  }
}

function inspectLogoPositions() {
  return [...document.querySelectorAll('[data-converter-logo]:not([data-converter-logo-part])')].map(node => {
    const box = node.getBoundingClientRect();
    const variants = node.closest('[data-converter-logo-variants]');
    const inLayout = element => Boolean(element?.getClientRects().length);
    const visible = box.width > 0 && box.height > 0 && node.checkVisibility({opacityProperty:true,visibilityProperty:true});
    const intrinsicWidth = node.naturalWidth || node.viewBox?.baseVal?.width || box.width;
    const intrinsicHeight = node.naturalHeight || node.viewBox?.baseVal?.height || box.height;
    return {id:Number(node.dataset.converterLogo),available:inLayout(node) || inLayout(variants),visible,
      width:Math.round(box.width),height:Math.round(box.height),ratio:intrinsicHeight ? intrinsicWidth/intrinsicHeight : 0};
  });
}

export async function measurePreviewLogos(browser,url,width) {
  const context = await browser.newContext({viewport:{width,height:950},serviceWorkers:'block'});
  const root = new URL('./',url).href;
  try {
    const page = await context.newPage();
    await page.route('**/*',route => route.request().url().startsWith(root) ? route.continue() : route.abort());
    await page.goto(url,{waitUntil:'load',timeout:10000});
    return await page.evaluate(inspectLogoPositions);
  } finally {
    await context.close();
  }
}

async function scan(page, url, width, checkStyles) {
  await page.setViewportSize({width,height:950});
  await page.goto(url,{waitUntil:'load',timeout:12000});
  await page.evaluate(() => document.fonts.ready.then(() => true));
  if (checkStyles) {
    const result = await page.evaluate(expectedOrigin => {
      const links = [...document.querySelectorAll('link[rel~="stylesheet"][href]:not([disabled])')];
      const local = links.filter(link => new URL(link.href).origin === expectedOrigin);
      return {
        missing: local.filter(link => !link.sheet).map(link => new URL(link.href).pathname.split('/').at(-1)),
        hasReferences: links.length > 0,
        hasStyles: links.some(link => link.sheet) || Boolean(document.querySelector('style'))
      };
    },new URL(url).origin);
    if (result.missing.length) {
      const names = result.missing.slice(0,3).map(name => {
        try { return decodeURIComponent(name); } catch { return name; }
      });
      throw missingStyles(names);
    }
    if (result.hasReferences && !result.hasStyles) {
      throw Error('這份 HTML 的樣式需要外部檔案。請用 Chrome「網頁，完整」另存，再匯入 HTML 與素材資料夾。');
    }
  }
  const result = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const area = document.body;
    const elements = [...area.querySelectorAll('*')];
    const selector = node => {
      const parts = [];
      while (node !== area) {
        const index = [...node.parentElement.children].indexOf(node) + 1;
        parts.unshift(':nth-child('+index+')');
        node = node.parentElement;
      }
      return ['body',...parts].join(' > ');
    };
    const candidates = [];
    for (const node of elements) {
      if (!node.getClientRects().length || node.closest('svg,table,pre,[role=carousel],[data-converter-track],[data-converter-static-carousel]')) continue;
      const box = node.getBoundingClientRect();
      const parent = node.parentElement;
      const bounds = parent.getBoundingClientRect();
      const css = getComputedStyle(node);
      const parentCSS = getComputedStyle(parent);
      if (node.closest('dialog') || ['absolute','fixed'].includes(css.position) ||
          ['auto','scroll','hidden','clip'].includes(parentCSS.overflowX)) continue;
      const available = Math.min(bounds.right - parseFloat(parentCSS.paddingRight),vw) - Math.max(bounds.left,0);
      if (box.width < 40 || available < 80) continue;
      const extendsParent = box.right > Math.min(bounds.right,vw)+2;
      const children = [...node.children].filter(child => child.getBoundingClientRect().width > 40);
      const cards = children.length >= 2 && children.length <= 12 && children.every(child =>
        child.matches('article,li,[role=listitem],.card') || (/^(DIV|SECTION)$/.test(child.tagName) && child.querySelector('h2,h3,h4')));
      const columns = new Set(children.map(child => Math.round(child.getBoundingClientRect().left))).size;
      const overflowingCards = children.some(child => child.getBoundingClientRect().right > vw+2);
      if (cards && columns >= 2 && /grid|flex/.test(css.display) && overflowingCards) {
        candidates.push({key:selector(node),kind:'cards'});
      } else if (extendsParent && node.matches('img,video') && box.width > available+2) {
        candidates.push({key:selector(node),kind:'media'});
      } else if (extendsParent && box.width > available+2 && /^(DIV|MAIN|SECTION|ARTICLE|ASIDE|HEADER|FOOTER|FIGURE)$/.test(node.tagName)) {
        candidates.push({key:selector(node),kind:'container'});
      }
    }
    const overflow = Math.max(0,document.documentElement.scrollWidth-vw);
    const largest = [...new Map(candidates.map(item => [item.key,item])).values()];
    return {width:vw,previewWidth:innerWidth,overflow,findings:largest.length,candidates:largest};
  });
  return {...result,logos:await page.evaluate(inspectLogoPositions)};
}

function rule({key,kind,max}) {
  const limit = max;
  const fit = 'box-sizing:border-box!important;min-width:0!important;max-width:100%!important;';
  if (kind === 'cards') {
    return `@media(max-width:${limit}px){${key}{${fit}display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important}\n${key}>*{${fit}width:auto!important;grid-column:auto!important}}\n@media(max-width:${Math.min(600,limit)}px){${key}{grid-template-columns:minmax(0,1fr)!important}}`;
  }
  return `@media(max-width:${limit}px){${key}{${fit}${kind === 'media' ? 'height:auto!important;' : ''}}}`;
}

export async function repair(browser, project, url, onProgress) {
  const context = await browser.newContext({serviceWorkers:'block',reducedMotion:'reduce'});
  const page = await context.newPage();
  const missing = new Set(project.hasExternalStyles ? ['外部樣式未包含在匯出的本機頁面'] : []);
  for (const name of project.missingBackgrounds || []) missing.add('缺少背景圖：'+name);
  if (project.missingLazyImages) missing.add(project.missingLazyImages+' 張延遲載入圖片未存入封存');
  const root = new URL('./',url).href;
  await page.route('**/*', route => {
    const address = route.request().url();
    if (address.startsWith(root) || address.startsWith('data:')) return route.continue();
    return route.abort();
  });
  page.on('response', response => {
    if (response.status() === 404) missing.add(decodeURI(new URL(response.url()).pathname.split('/').at(-1)));
  });
  page.on('console', msg => {
    if (/Content Security Policy/.test(msg.text()) && /https?:/.test(msg.text())) missing.add('外部資源未包含在本機素材中');
  });
  const measure = async (sizes,onWidth) => {
    const results = [];
    for (const width of sizes) {
      results.push(await scan(page,url,width,width === widths[0]));
      onWidth?.(results.length,sizes.length);
    }
    return results;
  };
  const style = project.dom.window.document.createElement('style');
  style.id = 'converter-responsive-overrides';
  const chosen = new Map();
  const rejected = new Set();
  const before = await measure(widths,(done,total)=>onProgress?.('scan',done,total))
    .catch(async error => {await context.close(); throw error;});
  project.dom.window.document.head.append(style);
  let after = before;
  try {
    // Repair outer containers first, then re-measure descendants at their new widths.
    for (let pass=0;pass<4;pass++) {
      const candidates = new Map();
      for (const result of after.slice(1)) {
        if (result.overflow <= 8) continue;
        for (const candidate of result.candidates) {
          if (chosen.has(candidate.key) || rejected.has(candidate.key)) continue;
          const current = candidates.get(candidate.key);
          if (!current) {
            const previousWidth = widths[widths.indexOf(result.width)-1];
            candidates.set(candidate.key,{...candidate,max:Math.min(1199,previousWidth-1)});
          }
        }
      }
      const order = ['container','cards','media'];
      const batch = order.map(kind => [...candidates.values()].filter(item => item.kind === kind)).find(group => group.length);
      if (!batch) break;
      const previous = style.textContent;
      style.textContent += '\n'+batch.slice(0,80).map(rule).join('\n');
      const check = await measure(widths.slice(1),(done,total)=>
        onProgress?.('validate',pass*total+done,4*total));
      const old = after.slice(1);
      const worsened = check.some((result,i) => result.overflow > old[i].overflow+1);
      const improved = check.some((result,i) => result.overflow < old[i].overflow);
      if (worsened || !improved) {
        style.textContent = previous;
        batch.forEach(item => rejected.add(item.key));
      } else {
        batch.slice(0,80).forEach(item => chosen.set(item.key,item.kind));
        after = [...before.slice(0,1),...check];
      }
      // Rejected candidates must not prevent a later safe category from being tried.
    }
    if (!style.textContent) style.remove();
    return {before,after,changes:[...chosen.values()],missing:[...missing].slice(0,25)};
  } finally {
    await context.close();
  }
}
