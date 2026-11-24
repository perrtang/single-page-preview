import { prepareSplitSlideshow } from './revolution7-split.mjs';

// Read declarative JSON and saved layer boxes. Never run the source slider scripts.
export function revolution7Options(document) {
  const settings = new Map();
  for (const script of document.scripts) {
    const match = /^\s*SR7\.JSON\[['"]([^'"]+)['"]\]\s*=\s*(\{[^\r\n]*\});/m.exec(script.textContent);
    if (!match) continue;
    try { settings.set(match[1],JSON.parse(match[2])); }
    catch { /* Keep the snapshot when the source has no readable settings. */ }
  }
  return settings;
}

function position(layer,slide) {
  let x = 0, y = 0, z = 0;
  for (let node=layer; node!==slide; node=node.parentElement) {
    x += parseFloat(node.style.left) || 0;
    y += parseFloat(node.style.top) || 0;
    z = Math.max(z,parseFloat(node.style.zIndex) || 0);
  }
  return {x,y,z};
}

export function prepareLayeredSlideshows(document, options, firstIndex, imageAsset, missingBackgrounds) {
  let count = 0;
  let incomplete = 0;
  for (const module of document.querySelectorAll('sr7-module')) {
    const canvas = module.querySelector('sr7-content');
    const width = parseFloat(canvas?.style.width);
    const height = parseFloat(canvas?.style.height);
    const sources = [...module.querySelectorAll('sr7-slide:not(.sr7-staticslide)')];
    const config = options.get(module.id);
    const active = String(module.dataset.current || '');
    const sourceBullets = [...module.querySelectorAll('sr7-bullets > sr7-bullet[data-key]')];
    const definitions = item => Object.values(config?.slides?.[item.slide.dataset.key]?.layers || {});
    const layers = sources.map(slide => {
      const title = slide.querySelector('sr7-txt.main-text');
      const text = [...slide.querySelectorAll('sr7-txt')].find(node => node!==title && !/^\d+$/.test(node.textContent.trim()));
      const pictures = [...slide.querySelectorAll('sr7-img[style]')].map(node => {
        const match = /url\(\s*(?:"([^"]+)"|'([^']+)'|([^)]*))\)/i.exec(node.getAttribute('style'));
        const reference = match && (match[1] ?? match[2] ?? match[3]).trim();
        const url = reference && imageAsset(reference);
        if (reference && !url) {
          try { missingBackgrounds.add(decodeURIComponent(new URL(reference,'https://import.invalid').pathname.split('/').at(-1))); }
          catch { /* Invalid URLs are not used as layer images. */ }
        }
        return {node,reference,url};
      });
      return {slide,title,text,pictures,shape:slide.querySelector('sr7-shp'),link:slide.querySelector('a[href^="#"]')};
    });
    if (prepareSplitSlideshow(document,module,config,layers,firstIndex+count)) {
      count++;
      continue;
    }
    const fade = layers.flatMap(definitions).map(layer => layer.tl?.in?.bg).find(effect => effect?.temp?.p === 'fade');
    if (!(width>0 && height>0) || !fade || layers.length<2 ||
        !layers.every(item => item.title && item.pictures.length>=2 && item.pictures.every(picture=>picture.reference))) {
      for (const {pictures} of layers) for (const {node,url} of pictures) {
        if (url) node.style.setProperty('background-image','url("'+url+'")');
      }
      continue;
    }

    const playable = layers.filter(item => item.pictures.some(picture=>picture.url));
    const snapshots = playable.length<2;
    const available = snapshots ? [layers.find(item=>item.slide.dataset.key===active) || layers[0]] : playable;
    if (playable.length!==layers.length || layers.some(item=>item.pictures.some(picture=>!picture.url))) incomplete++;
    const section = document.createElement('section');
    section.dataset.converterLayered = '';
    if (document.querySelector('#masthead > nav.header-img.fixed-top')) section.dataset.converterFixedHeader = '';
    section.setAttribute('aria-label','多圖層輪播');
    if (snapshots) section.dataset.converterStaticCarousel = '';
    else {
      section.dataset.converterSlideshow = '';
      section.dataset.converterTransition = 'fade';
      section.dataset.converterTransitionDuration = String(Number(fade.ms)||900);
      if (config.settings?.nav?.s?.use) section.dataset.converterSwipe = '';
    }
    if (parseFloat(canvas.style.left)<0) section.dataset.converterHeroFullWidth = '';
    section.style.setProperty('--layer-canvas',width+'px');
    section.style.setProperty('--layer-height',height+'px');
    const locate = (node,original,item) => {
      const {slide} = item;
      const {x,y,z} = position(original,slide);
      const id = original.id.split('-').at(-1);
      const motion = definitions(item).find(layer=>String(layer.id)===id)?.tl?.in?.content?.all?.at(-1);
      const offset = value => /^-?\d+(?:\.\d+)?px$/.test(value) ? parseFloat(value) : 0;
      node.style.setProperty('--layer-x',(x+offset(motion?.x?.[0]))/width*100+'%');
      node.style.setProperty('--layer-y',(y+offset(motion?.y?.[0]))/height*100+'%');
      node.style.setProperty('--layer-w',(parseFloat(original.style.width) || width*.38)/width*100+'%');
      node.style.setProperty('--layer-h',(parseFloat(original.style.height) || 0)/height*100+'%');
      node.style.setProperty('--layer-z',String(z));
    };
    for (const item of available) {
      const {slide,title,text,pictures,shape,link} = item;
      const entry = document.createElement('details');
      entry.name = 'converter-slides-'+(firstIndex+count);
      entry.dataset.key = slide.dataset.key;
      const summary = document.createElement('summary');
      const heading = document.createElement('h2');
      for (const child of title.childNodes) {
        if (child.nodeName==='BR') heading.append(document.createElement('br'));
        else heading.append(child.textContent);
      }
      summary.textContent = [...heading.childNodes].map(node=>node.nodeName==='BR'?' ':node.textContent).join('').trim();
      const panel = document.createElement('article');
      const place = (node,original,role) => {
        node.dataset.converterLayer = role;
        locate(node,original,item);
        panel.append(node);
      };
      if (shape?.style.backgroundColor) {
        const decoration = document.createElement('span');
        decoration.style.backgroundColor = shape.style.backgroundColor;
        decoration.setAttribute('aria-hidden','true');
        place(decoration,shape,'shape');
      }
      pictures.forEach(({node,url},i) => {
        if (!url) return;
        const image = document.createElement('img');
        image.src = url;
        image.alt = '';
        image.style.objectFit = /contain/i.test(node.style.background || '') ? 'contain' : 'cover';
        place(image,node,'image-'+i);
      });
      if (text?.textContent.trim()) {
        const lead = document.createElement('p');
        lead.textContent = text.textContent.trim();
        if (text.style.color) lead.style.color = text.style.color;
        place(lead,text,'intro');
      }
      place(heading,title,'title');
      if (link?.textContent.trim()) {
        const action = document.createElement('a');
        action.href = link.getAttribute('href');
        action.textContent = link.textContent.trim();
        place(action,link,'link');
      }
      entry.append(summary,panel);
      section.append(entry);
      entry.open = entry === section.firstElementChild;
    }
    if (!section.querySelector('details[open]')) section.firstElementChild.open = true;
    if (!snapshots && available.every(item=>sourceBullets.some(bullet=>bullet.dataset.key===item.slide.dataset.key))) {
      const controls = document.createElement('div');
      controls.dataset.converterPlayer = '';
      controls.dataset.converterLayerDots = '';
      controls.setAttribute('role','group');
      controls.setAttribute('aria-label','輪播選頁');
      controls.hidden = true;
      for (const [index,entry] of [...section.children].entries()) {
        const dot = document.createElement('button');
        dot.type = 'button';
        dot.dataset.converterJump = index;
        dot.setAttribute('aria-label','第 '+(index+1)+' 張 · '+entry.querySelector('summary').textContent);
        controls.append(dot);
      }
      section.append(controls);
    }
    module.replaceWith(section);
    if (!snapshots) count++;
  }
  const style = document.createElement('style');
  style.textContent = `
    [data-converter-layered][data-converter-layered] {position:relative;isolation:isolate;overflow:hidden;padding:0;background:#f9f6f3;color:#232323;touch-action:pan-y pinch-zoom;font-family:Poppins,system-ui,sans-serif}
    [data-converter-layered][data-converter-hero-full-width] {box-sizing:border-box;width:100vw;max-width:none;margin-inline:calc(50% - 50vw)}
    [data-converter-layered][data-converter-layered] > details {position:relative;max-width:none;margin:0;border:0}
    [data-converter-layered] > details > summary {position:absolute;width:1px;height:1px;clip-path:inset(50%);overflow:hidden}
    [data-converter-layered] article {position:relative;width:min(var(--layer-canvas),120vw);left:50%;transform:translateX(-50%);height:clamp(530px,63vw,var(--layer-height));box-sizing:border-box}
    [data-converter-layered] [data-converter-layer] {position:absolute;left:var(--layer-x);top:var(--layer-y);z-index:var(--layer-z);margin:0}
    [data-converter-layered] img[data-converter-layer] {width:var(--layer-w);height:var(--layer-h);aspect-ratio:auto;display:block}
    [data-converter-layer=shape] {width:var(--layer-w);aspect-ratio:1;border-radius:50%}
    [data-converter-layer=title] {width:min(var(--layer-w),48%);font:700 clamp(32px,5.65vw,81px)/1.055 Poppins,system-ui,sans-serif;color:inherit;overflow-wrap:anywhere;letter-spacing:-.015em}
    [data-converter-layer=intro] {font-size:clamp(12px,1.1vw,16px);font-weight:500}
    [data-converter-layer=link] {display:inline-flex;align-items:center;min-height:50px;padding:0 25px;color:inherit;text-transform:uppercase;font-size:13px;font-weight:650;text-decoration:none}
    [data-converter-layer=link]::before {content:'';position:absolute;left:0;inset-block:0;width:50px;border-radius:50%;background:#bf8c4c55;z-index:-1}
    [data-converter-layer=link]::after {content:'⟶';margin-left:18px;font-size:22px}
    [data-converter-layered] > [data-converter-layer-dots]:not([hidden]) {position:absolute;z-index:20;left:max(0px,calc((100% - 1180px)/2));bottom:24px;display:flex;gap:0;margin:0}
    [data-converter-layered] [data-converter-layer-dots] button {display:grid;place-items:center;width:23px;min-height:44px;padding:0;border:0;background:transparent;box-shadow:none}
    [data-converter-layer-dots] button::after {content:'';width:12px;height:12px;border-radius:50%;background:#d9d7d4}
    [data-converter-layer-dots] button:is([aria-current=true],:hover)::after {background:#bf8c4c}
    @media(max-width:767px) {
      [data-converter-layered] article {width:100%;height:auto;min-height:clamp(610px,165vw,690px);display:flex;flex-direction:column;align-items:center;text-align:center;padding:clamp(290px,90vw,397px) 14px 62px}
      [data-converter-layered] :is([data-converter-layer=intro],[data-converter-layer=title],[data-converter-layer=link]) {position:relative;inset:auto;width:auto;max-width:100%;z-index:4}
      [data-converter-layered] [data-converter-layer=title] {font-size:clamp(32px,10vw,44px);line-height:1.14;margin-top:12px}
      [data-converter-layered] [data-converter-layer=link] {margin-top:12px}
      [data-converter-layered] [data-converter-layer=shape] {width:min(110%,480px);left:7%;top:-57px;z-index:0}
      [data-converter-layered] img[data-converter-layer=image-0] {left:10%;top:clamp(90px,29vw,135px);width:min(57%,250px);height:clamp(170px,57vw,244px);z-index:1}
      [data-converter-layered] img[data-converter-layer=image-1] {left:64%;top:clamp(100px,31vw,140px);width:min(21%,100px);height:clamp(120px,47vw,195px);z-index:2}
      [data-converter-layered] img[data-converter-layer=image-2] {left:51%;top:27px;width:min(23%,108px);height:clamp(64px,22vw,96px);z-index:2}
    }
  `;
  if (document.querySelector('[data-converter-layered]')) document.head.append(style);
  return {count,incomplete};
}
