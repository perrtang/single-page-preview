export function prepareMarquees(document) {
  let count = 0;
  for (const wrap of document.querySelectorAll('[data-bg-text] > .trx_addons_marquee_wrap')) {
    let settings;
    try { settings = JSON.parse(wrap.parentElement.dataset.bgText); }
    catch { continue; }
    const speed = Number(settings?.bg_text_marquee?.size ?? settings?.bg_text_marquee);
    const copies = [...wrap.querySelectorAll(':scope > .trx_addons_marquee_element')];
    const first = copies[0];
    if (!(speed > 0) || settings.bg_text_effect !== 'none' || !first?.textContent.trim() ||
        first.querySelector('a,button,input') || copies.some(copy=>copy.textContent!==first.textContent)) continue;
    wrap.dataset.converterMarquee = Math.min(15,speed);
    if (Number(settings.bg_text_reverse)>0) wrap.dataset.converterMarqueeReverse = '';
    if (settings.bg_text_marquee_hover) wrap.dataset.converterMarqueePause = '';
    first.classList.add('trx_addons_showed_on_scroll');
    first.style.removeProperty('transform');
    for (const delimiter of first.querySelectorAll('.trx_addons_bg_text_delimiter_rotation')) delimiter.style.removeProperty('transform');
    copies.slice(1).forEach(copy=>copy.remove());
    count++;
  }
  if (count) {
    const style = document.createElement('style');
    style.textContent = `
      .trx_addons_bg_text[data-converter-marquee] {justify-content:flex-start}
      @media(prefers-reduced-motion:no-preference) {
        [data-converter-marquee] > .trx_addons_marquee_element {
          animation:converter-marquee var(--marquee-duration) linear infinite;
        }
        [data-converter-marquee] .trx_addons_bg_text_delimiter_rotation {
          animation:converter-marquee-rotate var(--marquee-duration) linear infinite;
        }
        [data-converter-marquee-reverse] > .trx_addons_marquee_element,
        [data-converter-marquee-reverse] .trx_addons_bg_text_delimiter_rotation {animation-direction:reverse}
        [data-converter-marquee-pause]:hover > .trx_addons_marquee_element,
        [data-converter-marquee-pause]:hover .trx_addons_bg_text_delimiter_rotation {animation-play-state:paused}
      }
      @keyframes converter-marquee {to {transform:translateX(-100%)}}
      @keyframes converter-marquee-rotate {to {transform:rotate(-1turn)}}
    `;
    document.head.append(style);
  }
  return count;
}

export function enableMarquees() {
  for (const wrap of document.querySelectorAll('[data-converter-marquee]')) {
    const first = wrap.querySelector(':scope > .trx_addons_marquee_element');
    const copies = [];
    const speed = Number(wrap.dataset.converterMarquee);
    const fit = () => {
      const width = wrap.clientWidth;
      const itemWidth = first.offsetWidth;
      if (!width || !itemWidth) return;
      const needed = Math.min(100,Math.ceil(width/itemWidth)+1);
      while (copies.length>needed) copies.pop().remove();
      while (copies.length<needed) {
        const copy = first.cloneNode(true);
        copy.removeAttribute('id');
        copy.querySelectorAll('[id]').forEach(node=>node.removeAttribute('id'));
        copy.setAttribute('aria-hidden','true');
        copies.push(copy);
        wrap.append(copy);
      }
      const interpolation = Math.max(0,Math.min(1,(width-320)/1600));
      const min = 1680-speed*speed*2;
      const pixelsPerSecond = (min+interpolation*(1920-min))/(50-speed*3);
      wrap.style.setProperty('--marquee-duration',itemWidth/pixelsPerSecond+'s');
      // CSS animations start when each copy enters the DOM. Keep their phases in sync after resizing.
      for (const copy of copies) {
        const originalAnimations = first.getAnimations({subtree:true});
        copy.getAnimations({subtree:true}).forEach((animation,index)=>{
          if (originalAnimations[index]) animation.startTime = originalAnimations[index].startTime;
        });
      }
    };
    const observer = new ResizeObserver(fit);
    observer.observe(wrap);
    observer.observe(first);
    fit();
  }
}
