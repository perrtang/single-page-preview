import { createHash } from 'node:crypto';
import { enableMobileNavigation } from './mobile-navigation.mjs';
import { enableCarouselTracks } from './carousel-player.mjs';
import { enableMarquees } from './marquee.mjs';

function playSlideshows() {
  const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const layeredHeader = document.querySelector('[data-converter-fixed-header]') && document.querySelector('#masthead > nav.header-img.fixed-top');
  if (layeredHeader) {
    const compact = matchMedia('(max-width:767px)');
    const updateHeader = () => {
      layeredHeader.parentElement.style.minHeight = compact.matches ? layeredHeader.offsetHeight+'px' : '';
    };
    new ResizeObserver(updateHeader).observe(layeredHeader);
    compact.addEventListener('change',updateHeader);
    updateHeader();
  }
  const allowedEasings = new Set(['ease','ease-in','ease-out','ease-in-out']);
  const allowedTransitions = new Set(['fade','slide','slide-left','slide-right','ken-burns','depth','reveal']);
  for (const gallery of document.querySelectorAll('[data-converter-slideshow]')) {
    const slides = [...gallery.querySelectorAll(':scope > details')];
    const controls = gallery.querySelector('[data-converter-player]');
    if (!controls || slides.length < 2) continue;
    let current = Math.max(0,slides.findIndex(slide => slide.open));
    let playing = !reducedMotion();
    let timer;
    let runningAnimations = [];
    let presentation;
    const jumps = [...controls.querySelectorAll('[data-converter-jump]')];
    const duration = Number(gallery.dataset.converterDelay) || 5000;
    const status = controls.querySelector('output');
    const currentNumber = controls.querySelector('[data-converter-current]');
    const totalNumber = controls.querySelector('[data-converter-total]');
    const progress = controls.querySelector('.swiper-scrollbar');
    const pause = controls.querySelector('[data-converter-pause]');
    const select = controls.querySelector('select');
    const transition = allowedTransitions.has(gallery.dataset.converterTransition)
      ? gallery.dataset.converterTransition
      : 'fade';
    const easing = allowedEasings.has(gallery.dataset.converterEasing)
      ? gallery.dataset.converterEasing
      : 'ease';
    const animationDuration = Math.max(180,Math.min(transition==='reveal' ? 1800 : 1000,Number(gallery.dataset.converterTransitionDuration) || 420));

    function setControls() {
      if (status) status.textContent = (current+1)+' / '+slides.length;
      if (currentNumber) currentNumber.textContent = String(current+1).padStart(2,'0');
      if (totalNumber) totalNumber.textContent = String(slides.length).padStart(2,'0');
      if (progress) progress.style.setProperty('--ps-sniper-progress',(current+1)/slides.length*100+'%');
      if (select) select.value = String(current);
      jumps.forEach((button,index) => button.setAttribute('aria-current',String(index === current)));
    }

    function stopAnimations() {
      runningAnimations.forEach(animation => animation.cancel());
      runningAnimations = [];
      if (!presentation) return;
      settle(slides[current]);
    }

    function restorePresentation() {
      if (!presentation) return;
      gallery.style.position = presentation.gallery.position;
      gallery.style.overflow = presentation.gallery.overflow;
      for (const [slide,style] of presentation.slides) {
        slide.style.position = style.position;
        slide.style.top = style.top;
        slide.style.left = style.left;
        slide.style.width = style.width;
        slide.style.height = style.height;
        slide.style.margin = style.margin;
        if (style.name === null) slide.removeAttribute('name');
        else slide.setAttribute('name',style.name);
      }
      if (presentation.caption) {
        const [caption,text] = presentation.caption;
        caption.replaceChildren(text);
      }
      presentation = undefined;
    }

    function preparePresentation(next,previous) {
      const galleryRect = gallery.getBoundingClientRect();
      const previousRect = previous.getBoundingClientRect();
      presentation = {
        gallery:{position:gallery.style.position,overflow:gallery.style.overflow},
        slides:new Map([[next,{
          position:next.style.position,top:next.style.top,left:next.style.left,width:next.style.width,height:next.style.height,margin:next.style.margin,name:next.getAttribute('name')
        }],[previous,{
          position:previous.style.position,top:previous.style.top,left:previous.style.left,width:previous.style.width,height:previous.style.height,margin:previous.style.margin,name:previous.getAttribute('name')
        }]])
      };
      if (!gallery.style.position) gallery.style.position = 'relative';
      // Split layouts deliberately bleed past the gallery to the viewport edge.
      // Their image frame already clips its own reveal animation.
      if (!gallery.hasAttribute('data-converter-split')) gallery.style.overflow = 'hidden';
      next.removeAttribute('name');
      previous.removeAttribute('name');
      next.style.position = 'absolute';
      next.style.top = Math.max(0,previousRect.top-galleryRect.top)+'px';
      next.style.left = Math.max(0,previousRect.left-galleryRect.left)+'px';
      next.style.width = previousRect.width+'px';
      next.style.height = previousRect.height+'px';
      next.style.margin = '0';
    }

    function settle(next,previous) {
      restorePresentation();
      slides.forEach(slide => {
        const isCurrent = slide === next;
        slide.hidden = !isCurrent;
        slide.open = isCurrent;
        slide.style.removeProperty('z-index');
      });
      if (previous && previous !== next) previous.style.removeProperty('z-index');
    }

    function startKenBurns(slide) {
      if (transition !== 'ken-burns' || reducedMotion() || !Element.prototype.animate) return undefined;
      const image = slide.querySelector('article > img, article picture > img, article img');
      if (!image || typeof image.animate !== 'function') return undefined;
      const dwell = Math.max(animationDuration,Math.min(30000,Number(slide.dataset.converterZoomDuration) || duration));
      const frames = slide.hasAttribute('data-converter-zoom-start') ? [
        {transform:'scale('+slide.dataset.converterZoomStart+')'},
        {transform:'scale('+slide.dataset.converterZoomEnd+')'}
      ] : [
        {transform:'translate3d(-0.6%, -0.35%, 0) scale(1.001)'},
        {transform:'translate3d(0.6%, 0.35%, 0) scale(1.075)'}
      ];
      return image.animate(frames,{duration:dwell,easing,fill:'both'});
    }

    function animateSplitCaption(copy,timing) {
      const caption = copy.querySelector('[data-converter-split-caption]');
      const text = caption?.firstChild;
      if (!text) return [copy.animate([{opacity:0},{opacity:1}],timing)];
      const range = document.createRange();
      const starts = [0];
      let previousTop;
      for (const word of text.data.matchAll(/\S+/g)) {
        range.setStart(text,word.index);
        range.setEnd(text,word.index+1);
        const top = range.getBoundingClientRect().top;
        if (previousTop!==undefined && Math.abs(top-previousTop)>1) starts.push(word.index);
        previousTop = top;
      }
      const lines = starts.map((start,index)=>{
        const line = document.createElement('span');
        line.style.display = 'block';
        line.textContent = text.data.slice(start,starts[index+1]).trim();
        return line;
      });
      presentation.caption = [caption,text];
      caption.replaceChildren(...lines);
      const stagger = Math.min(125,timing.duration/(lines.length+1));
      const frames = [{opacity:0,transform:'translateY(.6em)'},{opacity:1,transform:'translateY(0)'}];
      const animations = lines.map((line,index)=>line.animate(frames,{
        ...timing,delay:stagger*(index+1),duration:timing.duration-stagger*lines.length
      }));
      if (copy.lastElementChild!==caption) animations.push(copy.lastElementChild.animate(frames,{
        ...timing,delay:stagger*lines.length,duration:timing.duration-stagger*lines.length
      }));
      return animations;
    }

    function animateTransition(next,previous,direction) {
      if (!previous || previous === next || reducedMotion() || !Element.prototype.animate) {
        settle(next,previous);
        return;
      }
      preparePresentation(next,previous);
      next.hidden = false;
      next.open = true;
      previous.hidden = false;
      previous.open = true;
      const timing = {duration:animationDuration,easing,fill:'both'};
      const nextArt = next.querySelector('[data-converter-split-art]');
      const oldArt = previous.querySelector('[data-converter-split-art]');
      if (transition==='reveal' && nextArt && oldArt) {
        next.style.zIndex = '1';
        previous.style.zIndex = '0';
        const shift = 'translateX('+(direction>=0?9:-9)+'%)';
        const rest = 'translateX(0)';
        const full = 'inset(0 0 0 0)';
        const closed = direction>=0 ? 'inset(0 100% 0 0)' : 'inset(0 0 0 100%)';
        const animations = [
          nextArt.animate([{opacity:0,clipPath:closed},{opacity:1,clipPath:full}],timing),
          oldArt.animate([{opacity:1,clipPath:full},{opacity:0,clipPath:closed}],timing),
          nextArt.querySelector('img').animate([{transform:shift},{transform:rest}],timing),
          oldArt.querySelector('img').animate([{transform:rest},{transform:shift}],timing)
        ];
        const copy = next.querySelector('[data-converter-split-copy]');
        const captionAnimations = copy ? animateSplitCaption(copy,timing) : [];
        animations.push(...captionAnimations);
        const oldCopy = previous.querySelector('[data-converter-split-copy]');
        if (oldCopy) {
          const firstLineDelay = captionAnimations[0]?.effect.getTiming().delay || 100;
          animations.push(oldCopy.animate([{opacity:1},{opacity:0}],{...timing,duration:Math.min(100,firstLineDelay)}));
        }
        runningAnimations = animations;
        Promise.all(animations.map(animation=>animation.finished.catch(()=>undefined))).then(()=>{
          if (runningAnimations !== animations) return;
          settle(next,previous);
          animations.forEach(animation=>animation.cancel());
          runningAnimations = [];
        });
        return;
      }
      const nextMedia = next.querySelector('[data-converter-sniper-media]');
      const previousMedia = previous.querySelector('[data-converter-sniper-media]');
      if (transition === 'depth' && nextMedia && previousMedia) {
        const forward = direction >= 0;
        next.style.zIndex = forward ? '4' : '3';
        previous.style.zIndex = forward ? '3' : '4';
        const flat = {transform:'translateX(0) scale(1)',filter:'brightness(1)'};
        const behind = {transform:'perspective(1100px) translateZ(-400px)',filter:'brightness(.48)'};
        const offscreen = {transform:'translateX(100%)',filter:'brightness(1)'};
        const animations = [nextMedia.animate([forward ? offscreen : behind,flat],timing),
          previousMedia.animate([flat,forward ? behind : offscreen],timing)];
        for (const [slide,incoming] of [[next,true],[previous,false]]) {
          for (const text of slide.querySelectorAll('.bdt-content,[data-converter-sniper-neighbor]')) {
            const shift = incoming ? (forward ? 48 : -48) : (forward ? -48 : 48);
            const rest = {transform:'translate(0,-50%)',opacity:1};
            const displaced = {transform:'translate('+shift+'px,-50%)',opacity:0};
            const frames = incoming ? [displaced,{...displaced,offset:.35},{...rest,offset:.75},rest] :
              [rest,{...displaced,offset:.35},displaced];
            animations.push(text.animate(frames,timing));
          }
        }
        runningAnimations = animations;
        Promise.all(animations.map(animation => animation.finished.catch(() => undefined))).then(() => {
          if (runningAnimations !== animations) return;
          settle(next,previous);
          animations.forEach(animation => animation.cancel());
          runningAnimations = [];
        });
        return;
      }
      next.style.zIndex = '1';
      previous.style.zIndex = '0';
      const motionDirection = transition === 'slide-right' ? -1 : transition === 'slide-left' ? 1 : direction || 1;
      const incoming = transition === 'slide' || transition === 'slide-left' || transition === 'slide-right'
        ? [{opacity:0,transform:'translateX('+(motionDirection*100)+'%)'},{opacity:1,transform:'translateX(0)'}]
        : [{opacity:0},{opacity:1}];
      const outgoing = transition === 'slide' || transition === 'slide-left' || transition === 'slide-right'
        ? [{opacity:1,transform:'translateX(0)'},{opacity:0,transform:'translateX('+(-motionDirection*35)+'%)'}]
        : [{opacity:1},{opacity:0}];
      const animations = [next.animate(incoming,timing),previous.animate(outgoing,timing)];
      const kenBurns = startKenBurns(next);
      if (kenBurns) animations.push(kenBurns);
      runningAnimations = animations;
      Promise.all(animations.slice(0,2).map(animation => animation.finished.catch(() => undefined))).then(() => {
        if (runningAnimations !== animations) return;
        settle(next,previous);
        animations.slice(0,2).forEach(animation => animation.cancel());
        runningAnimations = animations.slice(2);
      });
    }

    function update(index,{initial=false,direction=1} = {}) {
      stopAnimations();
      const previous = slides[current];
      current = (index+slides.length)%slides.length;
      const next = slides[current];
      setControls();
      if (initial) {
        settle(next,previous);
        const kenBurns = startKenBurns(next);
        if (kenBurns) runningAnimations = [kenBurns];
      }
      else animateTransition(next,previous,direction);
    }
    function schedule() {
      clearInterval(timer);
      if (pause) {
        const label = playing ? '暫停播放' : '自動播放';
        pause.setAttribute('aria-label',label);
        pause.title = label;
        pause.toggleAttribute('data-converter-paused',!playing);
      }
      if (playing) timer = setInterval(() => {
        const keepPlayingOnHover = gallery.hasAttribute('data-converter-allow-hover');
        const hoverPaused = !keepPlayingOnHover && gallery.matches(':hover');
        const active = document.activeElement;
        const focusPaused = gallery.contains(active) && (!keepPlayingOnHover || active.matches(':focus-visible'));
        if (!document.hidden && !hoverPaused && !focusPaused) update(current+1,{direction:1});
      },duration);
    }
    controls.querySelector('[data-converter-prev]')?.addEventListener('click',() => update(current-1,{direction:-1}));
    controls.querySelector('[data-converter-next]')?.addEventListener('click',() => update(current+1,{direction:1}));
    select?.addEventListener('change',() => update(Number(select.value),{direction:Number(select.value) >= current ? 1 : -1}));
    pause?.addEventListener('click',() => { playing = !playing; schedule(); });
    jumps.forEach((button,index) => button.addEventListener('click',() => {
      update(index,{direction:index >= current ? 1 : -1});
      schedule();
    }));
    if (gallery.hasAttribute('data-converter-swipe')) {
      let start;
      gallery.addEventListener('touchstart',event => {
        start = event.touches.length === 1 ? event.touches[0] : null;
      },{passive:true});
      gallery.addEventListener('touchend',event => {
        if (!start) return;
        const end = event.changedTouches[0];
        const x = end.clientX-start.clientX, y = end.clientY-start.clientY;
        start = null;
        if (Math.abs(x) >= 40 && Math.abs(x) > Math.abs(y)*1.5) {
          update(current+(x<0 ? 1 : -1),{direction:x<0 ? 1 : -1});
          schedule();
        }
      },{passive:true});
      gallery.addEventListener('touchcancel',() => { start = null; });
    }
    slides.forEach((slide,index) => {
      slide.querySelector('summary')?.addEventListener('click',event => { event.preventDefault(); update(index,{direction:index >= current ? 1 : -1}); });
    });
    update(current,{initial:true});
    gallery.dataset.converterPlaying = '';
    controls.hidden = false;
    schedule();
  }
}

function locatePreviewLogo() {
  const targets = document.querySelectorAll('[data-converter-preview-logo]');
  if (!targets.length) return;
  function locate() {
    const logo = [...targets].find(node => node.getClientRects().length &&
      node.checkVisibility({opacityProperty:true,visibilityProperty:true}));
    if (!logo) return;
    logo.setAttribute('data-converter-located-logo','');
    logo.scrollIntoView({block:'center',inline:'nearest',behavior:'instant',container:'nearest'});
    const rect = logo.getBoundingClientRect();
    if (rect.top < 0 || rect.bottom > innerHeight) {
      scrollBy({top:(rect.top + rect.bottom - innerHeight) / 2,behavior:'instant'});
    }
    setTimeout(() => {
      const clear = () => logo.removeAttribute('data-converter-located-logo');
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) clear();
      else {
        logo.setAttribute('data-converter-located-logo','fading');
        setTimeout(clear,220);
      }
    },2000);
  }
  if (document.readyState === 'complete') locate();
  else addEventListener('load',locate,{once:true});
}

export const playerSource = [playSlideshows,enableMobileNavigation,enableCarouselTracks,enableMarquees,locatePreviewLogo]
  .map(run=>'('+run.toString()+')();').join('');
export const playerPolicy = "script-src 'sha256-"+createHash('sha256').update(playerSource).digest('base64')+"'";
