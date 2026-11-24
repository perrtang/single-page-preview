// Revolution 7 row layouts can publish their custom arrow artwork as static layers.
export function prepareSplitSlideshow(document,module,config,layers,index) {
  const previous = module.querySelector('.sr7-staticslide .sldr-nav-prev svg');
  const next = module.querySelector('.sr7-staticslide .sldr-nav-next svg');
  if (!config || !previous || !next || layers.length<2 ||
      !layers.every(item=>item.text && item.pictures.length===1 && item.pictures[0].url &&
        item.text.closest('sr7-row') && item.pictures[0].node.closest('sr7-row'))) return false;
  const imageDefinition = layers.flatMap(item=>Object.values(config.slides?.[item.slide.dataset.key]?.layers || {}))
    .find(layer=>layer.tl?.in?.mask?.all?.[0]?.x?.some(value=>/^-?\d+%$/.test(value)) &&
      layer.tl?.in?.content?.all?.[0]?.x?.some(value=>/^-?\d+%$/.test(value)));
  if (!imageDefinition) return false;
  const section = document.createElement('section');
  section.dataset.converterSlideshow = '';
  section.dataset.converterSplit = '';
  section.dataset.converterTransition = 'reveal';
  const duration = Number(imageDefinition.tl.in.content.all.at(-1).d) || 900;
  section.dataset.converterTransitionDuration = String(Math.max(180,Math.min(1800,duration)));
  if (config.settings?.nav?.s?.use) section.dataset.converterSwipe = '';
  section.setAttribute('aria-label','輪播內容');

  const place = document.createElement('span');
  place.id = 'converter-carousel-after-'+index;
  while (document.getElementById(place.id)) place.id += '-';
  place.dataset.converterSplitTarget = '';
  const scrollBelow = Object.values(config.slides || {}).some(item=>item.slide?.actions?.some(action=>action.a==='scrollbelow'));
  const animatedCaptions = new Set(Object.values(config.slides || {})
    .flatMap(slide=>Object.values(slide.layers || {}))
    .filter(layer=>layer.tl?.in?.chars?.ex && typeof layer.content?.text==='string')
    .map(layer=>layer.content.text.trim().replace(/\s+/g,' ')));
  for (const {slide,text,pictures} of layers) {
    const entry = document.createElement('details');
    entry.name = 'converter-slides-'+index;
    entry.open = !section.childElementCount;
    const summary = document.createElement('summary');
    summary.textContent = text.textContent.trim().replace(/\s+/g,' ');
    const article = document.createElement('article');
    const copy = document.createElement('div');
    copy.dataset.converterSplitCopy = '';
    const caption = document.createElement('p');
    caption.textContent = summary.textContent;
    if (animatedCaptions.has(caption.textContent)) caption.dataset.converterSplitCaption = '';
    if (text.style.color) caption.style.color = text.style.color;
    if (text.style.fontFamily) caption.style.fontFamily = text.style.fontFamily+',system-ui,sans-serif';
    copy.append(caption);
    const sourceButton = slide.querySelector('sr7-btn');
    if (scrollBelow && sourceButton?.textContent.trim()) {
      const anchor = document.createElement('a');
      anchor.href = '#'+place.id;
      anchor.textContent = sourceButton.textContent.trim();
      copy.append(anchor);
    }
    const art = document.createElement('div');
    art.dataset.converterSplitArt = '';
    const image = document.createElement('img');
    image.src = pictures[0].url;
    image.alt = '';
    art.append(image);
    article.append(copy,art);
    entry.append(summary,article);
    section.append(entry);
  }
  const controls = document.createElement('div');
  controls.dataset.converterPlayer = '';
  controls.dataset.converterSplitControls = '';
  controls.setAttribute('role','group');
  controls.setAttribute('aria-label','輪播控制');
  controls.hidden = true;
  for (const [source,direction,label] of [[previous,'prev','上一張'],[next,'next','下一張']]) {
    const control = document.createElement('button');
    control.type = 'button';
    control.setAttribute('data-converter-'+direction,'');
    control.setAttribute('aria-label',label);
    const svg = source.cloneNode(true);
    svg.setAttribute('aria-hidden','true');
    control.append(svg);
    controls.append(control);
  }
  section.append(controls);
  module.replaceWith(section,place);

  if (!document.querySelector('style[data-converter-split-style]')) {
    const style = document.createElement('style');
    style.dataset.converterSplitStyle = '';
    style.textContent = `
      [data-converter-split][data-converter-split] {position:relative;isolation:isolate;padding:0;background:transparent;color:inherit;container-type:inline-size;touch-action:pan-y pinch-zoom}
      [data-converter-split][data-converter-split] > details {max-width:none;margin:0;border:0}
      [data-converter-split] > details > summary {position:absolute;width:1px;height:1px;clip-path:inset(50%);overflow:hidden}
      [data-converter-split] article {display:grid;grid-template-columns:minmax(0,40%) minmax(0,60%);align-items:center;min-height:clamp(345px,33vw,545px)}
      [data-converter-split-copy] {padding-right:7%;color:inherit}
      [data-converter-split-copy] p {margin:0 0 14px;font-size:clamp(18px,1.4vw,24px);line-height:1.35;font-weight:650}
      [data-converter-split-copy] a {display:inline-flex;padding-bottom:3px;color:inherit;font:500 17px/1.5 system-ui,sans-serif;text-decoration:none;border-bottom:1px solid currentColor}
      [data-converter-split-art] {width:calc(100% + max(0px,(100vw - 100cqw)/2));aspect-ratio:1.94;overflow:hidden}
      [data-converter-split] [data-converter-split-art] img {display:block;width:100%;height:100%;aspect-ratio:auto;object-fit:cover}
      [data-converter-split] > [data-converter-split-controls]:not([hidden]) {position:absolute;z-index:3;left:0;bottom:0;display:flex;gap:8px;margin:0}
      [data-converter-split] [data-converter-split-controls] button {isolation:isolate;position:relative;display:grid;place-items:center;width:64px;min-height:44px;padding:0;border:0;background:transparent;color:inherit;box-shadow:none}
      [data-converter-split-controls] button::before {content:'';position:absolute;inset-inline-start:0;width:40px;height:40px;border-radius:50%;z-index:-1;background:#c79c93;opacity:0}
      [data-converter-split-controls] button:is(:hover,:focus-visible)::before,
      [data-converter-split-controls] button:first-child::before {opacity:1}
      [data-converter-split-controls] svg {width:48px;height:26px}
      [data-converter-split-target] {display:block;scroll-margin-top:72px}
      @media (max-width:767px) {
        [data-converter-split] article {grid-template-columns:minmax(0,1fr);min-height:0;gap:25px}
        [data-converter-split-copy] {padding:0}
        [data-converter-split-art] {width:100%}
        [data-converter-split] > [data-converter-split-controls]:not([hidden]) {position:relative;inset:auto;margin-top:14px}
      }
    `;
    document.head.append(style);
  }
  return true;
}
