// This function is serialized into the offline page alongside the slideshow player.
export function enableCarouselTracks() {
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  for (const root of document.querySelectorAll('[data-converter-track]')) {
    const owner = document.querySelector('[data-converter-track-controls="'+root.dataset.converterTrack+'"]');
    const originals = [...root.querySelectorAll('[data-converter-track-frame]')];
    if (!owner || originals.length<2) continue;
    const track = root.querySelector('[data-converter-rail-items]');
    const loop = root.hasAttribute('data-converter-track-loop');
    const centered = root.hasAttribute('data-converter-track-centered');
    const dots = [...owner.querySelectorAll('[data-converter-track-jump]')];
    const count = originals.length;
    let current = Number(root.dataset.converterTrackIndex)||0;
    let selected = originals[current];
    let target;
    let finishTransition;
    let frames = originals;
    const activeClass = root.dataset.converterTrackActiveClass || 'bdt-active';
    const frameIndex = new Map(originals.map((frame,i)=>[frame,i]));
    const mark = () => {
      if (track) {
        const position = frames.indexOf(selected);
        frames.forEach((frame,i)=>{
          frame.classList.toggle('swiper-slide-active',i===position);
          frame.classList.toggle('swiper-slide-prev',i===position-1);
          frame.classList.toggle('swiper-slide-next',i===position+1);
        });
      }
      dots.forEach(dot=>{
        const active = Number(dot.dataset.converterTrackJump)===current;
        dot.classList.toggle(track?'swiper-pagination-bullet-active':'active',active);
        dot.setAttribute('aria-current',String(active));
      });
    };
    if (track && loop) {
      const sides = Math.min(count,Math.max(1,Number(track.style.getPropertyValue('--rail-desktop')) || 1));
      const duplicate = (frame) => {
        const copy = frame.cloneNode(true);
        copy.removeAttribute('id');
        copy.querySelectorAll('[id]').forEach(el=>el.removeAttribute('id'));
        copy.setAttribute('inert','');
        copy.setAttribute('aria-hidden','true');
        frameIndex.set(copy,frameIndex.get(frame));
        return copy;
      };
      const before = originals.slice(-sides).map(duplicate);
      const after = originals.slice(0,sides).map(duplicate);
      track.prepend(...before);
      track.append(...after);
      frames = [...before,...originals,...after];
    }
    const offset = el => {
      const box = el.getBoundingClientRect();
      const left = box.left-track.getBoundingClientRect().left+track.scrollLeft;
      return centered ? left+(box.width-track.clientWidth)/2 : left;
    };
    const align = (frame,behavior='instant') => track.scrollTo({left:offset(frame),behavior});
    const choose = (index,relative=false) => {
      const old = current;
      const next = loop ? (index+count)%count : Math.min(count-1,Math.max(0,index));
      if (track) {
        const neighbor = relative && frames[frames.indexOf(selected)+Math.sign(index-old)];
        current = next;
        selected = neighbor && frameIndex.get(neighbor)===next ? neighbor : originals[next];
        target = selected;
        const previousScroll = track.scrollLeft;
        align(selected,reduced()?'instant':'smooth');
        if (Math.abs(track.scrollLeft-offset(selected))<1 || (reduced() && track.scrollLeft===previousScroll)) target = null;
      } else if (next!==old) {
        finishTransition?.();
        const previous = originals[old];
        const incoming = originals[next];
        current = next;
        incoming.hidden = false;
        incoming.classList.add(activeClass);
        const hidePrevious = () => {
          previous.hidden = true;
          previous.classList.remove(activeClass);
        };
        if (reduced()) hidePrevious();
        else {
          const horizontal = root.hasAttribute('data-converter-track-horizontal');
          const distance = index>=old ? 100 : -100;
          const timing = {duration:420,easing:'ease',fill:'both'};
          const animations = horizontal ? [
            incoming.animate([{transform:'translateX('+distance+'%)'},{transform:'translateX(0)'}],timing),
            previous.animate([
              {position:'absolute',inset:'0',transform:'translateX(0)'},
              {position:'absolute',inset:'0',transform:'translateX('+(-distance)+'%)'}
            ],timing)
          ] : [incoming.animate([{opacity:0},{opacity:1}],timing)];
          finishTransition = () => {
            animations.forEach(animation=>animation.cancel());
            hidePrevious();
            finishTransition = null;
          };
          const finish = finishTransition;
          Promise.all(animations.map(animation=>animation.finished.catch(()=>undefined))).then(()=>{
            if (finishTransition===finish) finish();
          });
        }
      }
      mark();
    };
    const activate = (control,run) => {
      if (!control) return;
      if (!control.matches('button')) {
        control.setAttribute('role','button');
        control.tabIndex = 0;
        control.addEventListener('keydown',event=>{
          if (event.key==='Enter'||event.key===' ') { event.preventDefault(); run(); }
        });
      }
      control.addEventListener('click',event=>{event.preventDefault();run();});
    };
    activate(owner.querySelector('[data-converter-track-prev]'),()=>choose(current-1,true));
    activate(owner.querySelector('[data-converter-track-next]'),()=>choose(current+1,true));
    dots.forEach(dot=>activate(dot,()=>choose(Number(dot.dataset.converterTrackJump))));
    if (track) {
      let drag;
      let suppressClick = false;
      const cue = root.hasAttribute('data-converter-drag-hint') ? document.createElement('span') : null;
      if (cue) {
        cue.dataset.converterDragCue = '';
        cue.className = 'qw_extension_icon-qw-resize';
        cue.setAttribute('aria-hidden','true');
        cue.hidden = true;
        document.body.append(cue);
      }
      track.addEventListener('pointerdown',event=>{
        if (event.pointerType!=='mouse' || event.button!==0) return;
        suppressClick = false;
        drag = {id:event.pointerId,x:event.clientX,left:track.scrollLeft};
      });
      track.addEventListener('pointermove',event=>{
        if (event.pointerType!=='mouse') return;
        if (cue) {
          cue.hidden = !track.contains(document.elementFromPoint(event.clientX,event.clientY));
          cue.style.left = event.clientX+'px';
          cue.style.top = event.clientY+'px';
        }
        if (drag?.id!==event.pointerId || !(event.buttons & 1)) return;
        const delta = event.clientX-drag.x;
        if (!drag.moved && Math.abs(delta)<5) return;
        if (!drag.moved) {
          drag.moved = true;
          target = null;
          track.dataset.converterDragging = '';
          track.setPointerCapture(event.pointerId);
        }
        track.scrollLeft = drag.left-delta;
      });
      const stopDrag = event => {
        if (drag?.id!==event.pointerId) return;
        if (drag.moved) {
          suppressClick = true;
          delete track.dataset.converterDragging;
        }
        drag = null;
      };
      track.addEventListener('pointerup',stopDrag);
      track.addEventListener('pointercancel',stopDrag);
      track.addEventListener('lostpointercapture',stopDrag);
      track.addEventListener('pointerleave',()=>{if (cue) cue.hidden = true;});
      track.addEventListener('dragstart',event=>event.preventDefault());
      track.addEventListener('click',event=>{
        if (!suppressClick || event.detail===0) return;
        suppressClick = false;
        event.preventDefault();
        event.stopImmediatePropagation();
      },true);
      track.addEventListener('keydown',event=>{
        if (event.key==='ArrowLeft'||event.key==='ArrowRight') {
          event.preventDefault();
          choose(current+(event.key==='ArrowLeft'?-1:1),true);
        }
      });
      track.addEventListener('scrollend',()=>{
        if (drag?.moved) return;
        const closest = frames.reduce((a,b)=>Math.abs(offset(a)-track.scrollLeft)<Math.abs(offset(b)-track.scrollLeft)?a:b);
        selected = target || closest;
        target = null;
        current = frameIndex.get(selected);
        if (selected!==originals[current]) {
          selected = originals[current];
          align(selected);
        }
        mark();
      });
      let width = -1;
      new ResizeObserver(()=>{
        if (track.clientWidth===width) return;
        width = track.clientWidth;
        align(selected);
      }).observe(track);
      align(selected);
    }
    mark();
    const delay = Number(root.dataset.converterTrackAuto)||0;
    if (delay) setInterval(()=>{
      const hover = !root.hasAttribute('data-converter-track-allow-hover') && (owner.matches(':hover') || root.matches(':hover'));
      const focused = owner.contains(document.activeElement) || root.contains(document.activeElement);
      if (!reduced() && !document.hidden && !hover && !focused) choose(current+1,true);
    },delay);
  }
}
