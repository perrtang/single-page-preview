const inactiveControls = '.swiper-button-prev,.swiper-button-next,.swiper-pagination,.carousel-control-prev,.carousel-control-next,.carousel-indicators,.slick-arrow,.slick-dots,.owl-nav,.owl-dots,.splide__arrows,.splide__pagination,.bdt-navigation-arrows,.bdt-thumbnav,[data-carousel-next],[data-carousel-prev],rs-bullets,sr7-bullets,rs-arrow,sr7-arrow';
const carouselCandidates = [
  'sr7-module','rs-module','.bdt-sniper-slider','.bdt-slideshow','.swiper','.swiper-container','.qodef-qi-swiper-container',
  '.carousel','.owl-carousel','.slick-slider','.splide','.glide','swiper-container','.swiper-slider-container','[aria-roledescription="carousel"]',
  '[data-carousel]:has([data-slide])',
].join(',');

function settingsOf(node) {
  if (node.matches('.swiper-slider-container[data-slides-per-view-breakpoints][data-effect]')) {
    try {
      const widths = Object.entries(JSON.parse(node.dataset.slidesPerViewBreakpoints))
        .map(([max,items])=>[Number(max),Number(items)]).filter(([max,items])=>max>0 && items>0).sort((a,b)=>a[0]-b[0]);
      const columnsAt = width => widths.find(([max])=>width<=max)?.[1];
      const columns = Number(node.dataset.slidesPerView) || columnsAt(1440);
      const space = Number(node.dataset.slidesSpace);
      const minimum = Number(node.dataset.slidesMinWidth) || 1;
      return {slidesPerView:columns,slides_to_show_tablet:Math.min(columnsAt(834),Math.floor(834/(minimum+space))),
        slides_to_show_mobile:Math.max(1,Math.min(columnsAt(390),Math.floor(390/(minimum+space)))),spaceBetween:space,
        spaceBetweenTablet:space,spaceBetweenMobile:space,direction:node.dataset.direction,effect:node.dataset.effect,
        autoplay:node.dataset.autoplay==='1',loop:node.dataset.loop==='1',centeredSlides:node.dataset.slidesCentered==='1'};
    } catch { return {}; }
  }
  try { return JSON.parse(node.getAttribute('data-options') || node.getAttribute('data-settings') || '{}'); }
  catch { return {}; }
}

function controls(previous,next,dots) {
  if (previous) previous.dataset.converterTrackPrev = '';
  if (next) next.dataset.converterTrackNext = '';
  dots.forEach((dot,i) => {
    if (!dot.hasAttribute('data-converter-track-jump')) dot.dataset.converterTrackJump = i;
    if (!dot.matches('button')) {
      dot.setAttribute('role','button');
      dot.tabIndex = 0;
    }
    if (!dot.hasAttribute('aria-label')) dot.setAttribute('aria-label','第 '+(i+1)+' 張');
  });
}

export function prepareCarouselTracks(document) {
  let rails = 0, fades = 0;
  for (const module of document.querySelectorAll('.swiper,.swiper-container,.qodef-qi-swiper-container,.swiper-slider-container')) {
    if (module.closest('.bdt-sniper-slider,[data-converter-slideshow]')) continue;
    const track = module.querySelector(':scope > .swiper-wrapper');
    if (!track) continue;
    const settings = settingsOf(module);
    const columns = Number(settings.slides_to_show ?? settings.slidesPerView);
    const slides = [...track.children].filter(e=>e.matches('.swiper-slide:not(.swiper-slide-duplicate)'));
    if (!Number.isInteger(columns) || columns<1 || columns>12 || slides.length<2 || slides.length>80 ||
        settings.direction==='vertical' || !['','slide'].includes(settings.effect ?? '') || settings.parallax===true) continue;
    const external = module.parentElement;
    const trxControls = module.id.endsWith('_sc_swiper') && [...document.querySelectorAll('.sc_slider_controls[data-slider-id]')]
      .find(el=>el.dataset.sliderId+'_sc_swiper'===module.id);
    const byControl = attr => {
      const candidate = module.querySelector(':scope > .swiper-button-'+attr);
      const custom = trxControls && trxControls.querySelector('.slider_'+attr);
      if (candidate || custom || !track.id) return candidate || custom;
      return [...external.querySelectorAll('.swiper-button-'+attr+'[aria-controls]')]
        .find(el=>el.getAttribute('aria-controls')===track.id);
    };
    const prev = byControl('prev');
    const next = byControl('next');
    const suffix = String(settings.unique ?? '');
    const pagination = module.querySelector(':scope > .swiper-pagination') ||
      (/^\d+$/.test(suffix) ? external.querySelector('.swiper-pagination-'+suffix) : null);
    const dots = [...(pagination?.querySelectorAll('.swiper-pagination-bullet') || [])].slice(0,slides.length);
    const owner = trxControls || ([prev,next,pagination].some(node=>node && !module.contains(node)) ? external : module);
    const active = slides.findIndex(e=>e.classList.contains('swiper-slide-active'));
    owner.dataset.converterTrackControls = String(rails+fades);
    module.dataset.converterTrack = String(rails+fades);
    module.dataset.converterRail = '';
    const dragHint = module.closest('[data-mouse-helper-icon="qw_extension_icon-qw-resize"]');
    if (dragHint) module.dataset.converterDragHint = '';
    module.dataset.converterTrackIndex = Math.max(0,active);
    const isTrue = value => value===true || value==='yes';
    if (isTrue(settings.loop)) module.dataset.converterTrackLoop = '';
    if (isTrue(settings.centeredSlides)) module.dataset.converterTrackCentered = '';
    if (isTrue(settings.autoplay)) module.dataset.converterTrackAuto = String(Math.max(1000,Math.min(60000,Number(settings.autoplay_speed) || 5000)));
    if (settings.pause_on_hover==='no') module.dataset.converterTrackAllowHover = '';
    track.dataset.converterRailItems = '';
    track.style.removeProperty('transform');
    track.style.removeProperty('transition-duration');
    track.tabIndex = 0;
    const deviceColumns = (value,fallback) => Math.max(1,Math.min(columns,Number(value) || fallback));
    for (const [device,visible,gap] of [
      ['desktop',columns,settings.image_spacing?.size ?? settings.spaceBetween],
      ['tablet',deviceColumns(settings.slides_to_show_tablet,3),settings.image_spacing?.size ?? settings.spaceBetweenTablet],
      ['mobile',deviceColumns(settings.slides_to_show_mobile,1),settings.image_spacing?.size ?? settings.spaceBetweenMobile],
    ]) {
      const spacing = Math.max(0,Math.min(100,Number(gap) || 0));
      track.style.setProperty('--rail-'+device,visible);
      track.style.setProperty('--gap-'+device,spacing+'px');
    }
    for (const node of track.querySelectorAll(':scope > .swiper-slide-duplicate')) node.remove();
    slides.forEach(slide=>{
      slide.dataset.converterTrackFrame = '';
      for (const key of ['width','height','margin-right','margin-left','transform','transition-duration']) slide.style.removeProperty(key);
    });
    controls(prev,next,dots);
    rails++;
  }
  for (const module of document.querySelectorAll('.bdt-slideshow[bdt-slideshow]')) {
    let settings;
    try { settings = JSON.parse(module.getAttribute('bdt-slideshow')); }
    catch { continue; }
    const track = module.querySelector(':scope > .bdt-slideshow-items');
    const frames = [...(track?.children || [])].filter(slide=>slide.matches('.bdt-slideshow-item'));
    const buttons = [...module.querySelectorAll('[bdt-slideshow-item]')].filter(el=>!track?.contains(el));
    const prev = buttons.find(el=>el.getAttribute('bdt-slideshow-item')==='previous');
    const next = buttons.find(el=>el.getAttribute('bdt-slideshow-item')==='next');
    if (settings.animation!=='fade' || frames.length<2 || !prev || !next) continue;
    const active = frames.findIndex(e=>e.classList.contains('bdt-active'));
    module.dataset.converterTrack = module.dataset.converterTrackControls = String(rails+fades);
    module.dataset.converterTrackFade = '';
    module.dataset.converterTrackActiveClass = 'bdt-active';
    module.dataset.converterTrackIndex = Math.max(0,active);
    if (!settings.finite) module.dataset.converterTrackLoop = '';
    if (settings.autoplay) module.dataset.converterTrackAuto = String(Math.max(1000,Math.min(60000,Number(settings['autoplay-interval'])||5000)));
    if (settings['pause-on-hover']===false) module.dataset.converterTrackAllowHover = '';
    frames.forEach((frame,index)=>{
      frame.dataset.converterTrackFrame = '';
      frame.classList.toggle('bdt-active',index===Math.max(0,active));
      frame.hidden = index!==Math.max(0,active);
      frame.style.removeProperty('transform');
      frame.style.removeProperty('opacity');
      frame.querySelectorAll('[data-bdt-slideshow-parallax]').forEach(el=>{
        el.style.removeProperty('opacity');
        el.style.removeProperty('transform');
      });
    });
    controls(prev,next,[]);
    fades++;
  }

  for (const module of document.querySelectorAll('.carousel')) {
    const frames = [...module.querySelectorAll(':scope > .carousel-inner > .carousel-item')];
    const active = frames.findIndex(frame=>frame.classList.contains('active'));
    const prev = module.querySelector(':scope > .carousel-control-prev');
    const next = module.querySelector(':scope > .carousel-control-next');
    const dots = [...module.querySelectorAll(':scope > .carousel-indicators > :is([data-slide-to],[data-bs-slide-to])')];
    if (frames.length<2 || active<0 || (!prev && !next && !dots.length)) continue;
    module.dataset.converterTrack = module.dataset.converterTrackControls = String(rails+fades);
    module.dataset.converterTrackFade = '';
    module.dataset.converterTrackActiveClass = 'active';
    module.dataset.converterTrackIndex = active;
    if ((module.dataset.bsWrap ?? module.dataset.wrap)!=='false') module.dataset.converterTrackLoop = '';
    if ((module.dataset.bsRide ?? module.dataset.ride)==='carousel') {
      module.dataset.converterTrackAuto = String(Math.max(1000,Math.min(60000,Number(module.dataset.bsInterval ?? module.dataset.interval)||5000)));
    }
    if (!module.classList.contains('carousel-fade')) module.dataset.converterTrackHorizontal = '';
    frames.forEach((frame,index)=>{
      frame.dataset.converterTrackFrame = '';
      frame.hidden = index!==active;
    });
    const linkedDots = dots.filter(dot=>/^\d+$/.test(dot.dataset.bsSlideTo ?? dot.dataset.slideTo) &&
      Number(dot.dataset.bsSlideTo ?? dot.dataset.slideTo)<frames.length);
    linkedDots.forEach(dot=>{dot.dataset.converterTrackJump = dot.dataset.bsSlideTo ?? dot.dataset.slideTo;});
    controls(prev,next,linkedDots);
    fades++;
  }

  let snapshots = document.querySelectorAll('[data-converter-static-carousel]').length;
  for (const module of document.querySelectorAll(carouselCandidates)) {
    if (module.closest('[data-converter-track],[data-converter-slideshow],[data-converter-static-carousel]')) continue;
    module.dataset.converterStaticCarousel = '';
    for (const control of module.querySelectorAll(inactiveControls)) control.setAttribute('inert','');
    snapshots++;
  }

  if (rails || fades || snapshots) {
    const style = document.createElement('style');
    style.textContent = `
      [data-converter-static-carousel] {max-inline-size:100%;overflow-x:clip}
      [data-converter-static-carousel] [inert] {pointer-events:none}
      [data-converter-static-carousel], [data-converter-static-carousel] * {animation-play-state:paused!important}
      [data-converter-rail] {max-inline-size:100%;min-inline-size:0}
      [data-converter-rail-items] {
        --rail-visible:var(--rail-desktop);--rail-gap:var(--gap-desktop);
        display:flex!important;width:100%!important;height:auto!important;gap:var(--rail-gap);overflow-x:auto!important;
        scroll-snap-type:x mandatory;scrollbar-width:none;transform:none!important;cursor:grab;
      }
      [data-converter-rail-items]::-webkit-scrollbar {display:none}
      [data-converter-rail-items][data-converter-dragging] {scroll-snap-type:none;cursor:grabbing;user-select:none}
      [data-converter-drag-cue] {
        position:fixed;z-index:20;pointer-events:none;display:grid;place-items:center;inline-size:64px;block-size:64px;
        border-radius:50%;background:#f6f6f6;color:#000;font-size:14px;transform:translate(-50%,-50%)
      }
      [data-converter-drag-cue][hidden] {display:none}
      [data-converter-rail-items] > [data-converter-track-frame] {
        flex:0 0 calc((100% - (var(--rail-visible) - 1)*var(--rail-gap))/var(--rail-visible))!important;
        width:auto!important;min-width:0;margin-inline:0!important;height:auto;scroll-snap-align:start;
      }
      [data-converter-track-centered] [data-converter-rail-items] > [data-converter-track-frame] {scroll-snap-align:center}
      [data-converter-track-fade] [data-converter-track-frame][hidden] {display:none!important}
      [data-converter-track-fade] [data-converter-track-frame]:not([hidden]) {visibility:visible}
      [data-converter-track-fade] [data-bdt-slideshow-parallax] {opacity:1!important;transform:none!important}
      [data-converter-track-controls] :is([data-converter-track-prev],[data-converter-track-next],[data-converter-track-jump]) {cursor:pointer}
      @media(max-width:1024px) {
        [data-converter-rail-items] {--rail-visible:var(--rail-tablet);--rail-gap:var(--gap-tablet)}
      }
      @media(max-width:767px) {
        [data-converter-rail-items] {--rail-visible:var(--rail-mobile);--rail-gap:var(--gap-mobile)}
      }
    `;
    document.head.append(style);
  }
  return {rails,fades,snapshots};
}
