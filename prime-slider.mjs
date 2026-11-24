// The Sniper widget saves separate image and caption tracks with the same slide IDs.
export function prepareSniperSlideshows(document, startIndex) {
  let count = 0;
  for (const slider of document.querySelectorAll('.bdt-sniper-slider')) {
    const main = slider.querySelector(':scope > .bdt-main-slider');
    const captions = slider.querySelector(':scope > .bdt-thumbs-slider');
    const slides = [...(main?.querySelectorAll(':scope > .swiper-wrapper > .swiper-slide[data-swiper-slide-index]:not(.swiper-slide-duplicate)') || [])];
    const titles = new Map(Array.from(captions?.querySelectorAll('.swiper-slide[data-swiper-slide-index]:not(.swiper-slide-duplicate)') || [],
      caption => [caption.dataset.swiperSlideIndex,caption.querySelector('.bdt-content')]));
    if (slides.length < 2 || !slides.every(slide => slide.querySelector('img[src]') && titles.get(slide.dataset.swiperSlideIndex)?.querySelector('.bdt-title'))) continue;

    const controls = document.createElement('div');
    controls.dataset.converterPlayer = '';
    controls.hidden = true;
    const navigation = slider.querySelector('.bdt-navigation-wrap');
    if (navigation) {
      for (const [direction,label] of [['next','下一頁'],['prev','上一頁']]) {
        const original = navigation.querySelector('.bdt-button-'+direction);
        if (!original) continue;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = original.className;
        button.setAttribute('data-converter-'+direction,'');
        button.setAttribute('aria-label',label);
        const icon = original.querySelector('svg');
        if (icon) button.append(icon);
        else button.textContent = label;
        original.replaceWith(button);
      }
      controls.append(navigation);
    }
    const pagination = main.querySelector('.bdt-pagination-wrap');
    if (pagination) {
      const fraction = pagination.querySelector('.bdt-pagination');
      const current = fraction?.querySelector('.swiper-pagination-current');
      const total = fraction?.querySelector('.swiper-pagination-total');
      if (current && total) {
        current.dataset.converterCurrent = '';
        total.dataset.converterTotal = '';
      }
      pagination.querySelector('.swiper-scrollbar-drag')?.remove();
      controls.append(pagination);
    }

    slider.dataset.converterSlideshow = '';
    slider.dataset.converterSniper = '';
    slider.dataset.converterSwipe = '';
    slider.setAttribute('aria-label','首頁輪播');
    try {
      const settings = JSON.parse(slider.dataset.settings || '{}');
      if (settings.effect === 'creative' && settings.creativeEffect === 'creative-1') {
        slider.dataset.converterTransition = 'depth';
        if (Number.isFinite(settings.speed)) slider.dataset.converterTransitionDuration = String(settings.speed);
      }
    } catch { /* Keep the standard transition if the saved settings are invalid. */ }
    const overlay = main.querySelector('.bdt-ps-iamge-overlay');
    const grid = main.querySelector('.bdt-grid-line');
    const active = Math.max(0,slides.findIndex(slide => slide.classList.contains('swiper-slide-active')));
    slides.forEach((slide,index) => {
      const entry = document.createElement('details');
      entry.name = 'converter-slides-'+(startIndex+count);
      entry.open = index === active;
      const summary = document.createElement('summary');
      const caption = titles.get(slide.dataset.swiperSlideIndex);
      summary.textContent = caption.querySelector('.bdt-title').textContent.trim().replace(/\s+/g,' ');
      const panel = document.createElement('article');
      const image = slide.querySelector('img[src]');
      image.removeAttribute('loading');
      const media = document.createElement('div');
      media.dataset.converterSniperMedia = '';
      media.append(image);
      if (overlay) media.append(overlay.cloneNode(true));
      panel.append(media);
      panel.append(caption);
      for (const [offset,side] of [[-1,'previous'],[1,'next']]) {
        const neighbor = slides[(index+offset+slides.length)%slides.length];
        const heading = titles.get(neighbor.dataset.swiperSlideIndex).querySelector('.bdt-title');
        const text = document.createElement('span');
        text.className = 'bdt-title';
        text.dataset.converterSniperNeighbor = side;
        text.setAttribute('aria-hidden','true');
        text.textContent = heading.textContent.trim().replace(/\s+/g,' ');
        panel.append(text);
      }
      entry.append(summary,panel);
      slider.append(entry);
    });
    if (grid) slider.append(grid);
    slider.append(controls);
    main.remove();
    captions.remove();
    count++;
  }
  if (!count) return 0;
  const style = document.createElement('style');
  style.textContent = `
    .bdt-sniper-slider[data-converter-sniper] { padding:0; background:#000; touch-action:pan-y pinch-zoom; }
    .bdt-sniper-slider[data-converter-sniper] > details { position:relative; height:100%; max-width:none; border:0; }
    [data-converter-sniper][data-converter-playing] > details > summary { display:none; }
    [data-converter-sniper] article { position:absolute; inset:0; }
    [data-converter-sniper-media] { position:absolute; inset:0 0 0 30%; z-index:0; }
    .bdt-sniper-slider [data-converter-sniper-media] img { position:absolute; inset:0; display:block; width:100%; height:100% !important; aspect-ratio:auto; object-fit:cover; }
    [data-converter-sniper-media] .bdt-ps-iamge-overlay { inset:0; z-index:1; pointer-events:none; }
    .bdt-sniper-slider[data-converter-sniper] > .bdt-grid-line { inset:0 0 0 30%; width:70%; z-index:2; pointer-events:none; }
    [data-converter-sniper] article .bdt-content, [data-converter-sniper-neighbor] {
      position:absolute; top:50%; z-index:2; transform:translateY(-50%); width:28%; text-align:right;
    }
    [data-converter-sniper] article .bdt-content { left:36%; }
    [data-converter-sniper] article .bdt-sub-title { opacity:1; transform:none; }
    [data-converter-sniper] article .bdt-content .bdt-title { color:#fff !important; }
    [data-converter-sniper-neighbor=previous] { left:-12%; }
    [data-converter-sniper-neighbor=next] { right:-12%; }
    [data-converter-sniper] > [data-converter-player]:not([hidden]) { position:absolute; inset:0; z-index:12; margin:0; max-width:none; pointer-events:none; }
    [data-converter-sniper] .bdt-navigation-wrap button.bdt-nav-btn { background:none; border:0; padding:0; pointer-events:auto; }
    [data-converter-sniper] .bdt-navigation-wrap button:focus-visible { outline:2px solid #fff; outline-offset:-4px; }
    @media (max-width:767px) {
      [data-converter-sniper] article .bdt-content { left:29%; width:46%; }
      [data-converter-sniper] .bdt-navigation-wrap button.bdt-nav-btn { width:72px; }
      [data-converter-sniper] .bdt-navigation-wrap .bdt-nav-btn.bdt-button-next::before { right:34px; }
      [data-converter-sniper] .bdt-navigation-wrap .bdt-nav-btn.bdt-button-prev::before { left:34px; }
    }
  `;
  document.head.append(style);
  return count;
}
