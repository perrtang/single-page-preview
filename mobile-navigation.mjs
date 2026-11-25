export function prepareMobileNavigation(document) {
  const menus = new Set();
  const dialogs = new Set();
  const triggerRole = (element,label) => {
    if (element.localName !== 'button') {
      element.setAttribute('role','button');
      element.tabIndex = 0;
    }
    if (!element.getAttribute('aria-label') && label) element.setAttribute('aria-label',label);
  };
  const submenus = menu => {
    for (const item of menu.querySelectorAll('li.menu-item-has-children')) {
      const link = item.querySelector(':scope > a');
      const nested = item.querySelector(':scope > ul,:scope > .qodef-drop-down-second ul');
      if (!link || !nested) continue;
      nested.dataset.converterNavSubmenu = '';
      nested.hidden = true;
      link.dataset.converterNavSubtoggle = '';
      link.setAttribute('aria-expanded','false');
      triggerRole(link);
    }
  };
  const connectDialog = (trigger,menu,kind,label,closeSelector) => {
    const close = menu.querySelector(closeSelector);
    if (!close) return;
    menu.id ||= 'converter-nav-dialog-'+(dialogs.size+1);
    menu.dataset.converterNavDialog = kind;
    menu.setAttribute('role','dialog');
    menu.setAttribute('aria-modal','true');
    menu.setAttribute('aria-label',label);
    menu.setAttribute('aria-hidden','true');
    menu.setAttribute('inert','');
    close.dataset.converterNavClose = '';
    triggerRole(close,'關閉選單');
    trigger.dataset.converterNavDialogTrigger = '';
    trigger.setAttribute('aria-controls',menu.id);
    trigger.setAttribute('aria-expanded','false');
    triggerRole(trigger,label);
    if (!dialogs.has(menu)) submenus(menu);
    dialogs.add(menu);
  };
  for (const trigger of document.querySelectorAll('header .trx_addons_panel_link[href]')) {
    try {
      const href = new URL(trigger.getAttribute('href'),'https://import.invalid');
      const menu = document.getElementById(decodeURIComponent(href.hash.slice(1)));
      if (menu?.matches('.sc_layouts_panel')) connectDialog(trigger,menu,'side','側邊選單','.sc_layouts_panel_close');
    } catch { /* Leave malformed targets to the regular import handling. */ }
  }
  const qodeSideArea = document.querySelector('#qodef-side-area:has(#qodef-side-area-close)');
  if (qodeSideArea) for (const trigger of document.querySelectorAll('header .qodef-side-area-opener')) {
    document.body.classList.remove('qodef-side-area--opened');
    connectDialog(trigger,qodeSideArea,'qode-side','側邊選單','#qodef-side-area-close');
  }
  const mobileDialog = document.querySelector('.menu_mobile:has(.menu_mobile_nav_area)');
  if (mobileDialog) for (const trigger of document.querySelectorAll('header .sc_layouts_menu_mobile_button > a,header .menu_mobile_button')) {
    connectDialog(trigger,mobileDialog,'mobile','選單','.menu_mobile_close');
  }
  for (const trigger of document.querySelectorAll('header [aria-controls], [role=banner] [aria-controls], .qodef-mobile-header-opener')) {
    if (trigger.hasAttribute('data-converter-nav-dialog-trigger')) continue;
    const header = trigger.closest('header,[role=banner]');
    const target = document.getElementById(trigger.getAttribute('aria-controls')) ||
      (trigger.matches('.qodef-mobile-header-opener') && header?.querySelector('.qodef-mobile-header-navigation'));
    if (!header || !target?.matches('nav,[role=navigation]') || menus.has(target)) continue;
    menus.add(target);
    target.id ||= 'converter-navigation-'+menus.size;
    trigger.dataset.converterNavToggle = '';
    trigger.setAttribute('aria-controls',target.id);
    trigger.setAttribute('aria-expanded','false');
    if (!trigger.getAttribute('aria-label') && !trigger.textContent.trim()) trigger.setAttribute('aria-label','選單');
    if (trigger.localName !== 'button') {
      trigger.setAttribute('role','button');
      trigger.tabIndex = 0;
    }
    target.dataset.converterNavigation = '';
    target.hidden = true;
    submenus(target);
  }
  for (const trigger of document.querySelectorAll('.site-header .site-navigation .menu-toggle')) {
    const menu = trigger.parentElement.querySelector(':scope > .nav-menu');
    if (!menu || menus.has(menu)) continue;
    menus.add(menu);
    menu.id ||= 'converter-navigation-'+menus.size;
    trigger.dataset.converterNavToggle = '';
    trigger.dataset.converterThemeNav = '';
    trigger.setAttribute('aria-controls',menu.id);
    trigger.setAttribute('aria-expanded','false');
    trigger.setAttribute('aria-label','選單');
    if (trigger.localName !== 'button') {
      trigger.setAttribute('role','button');
      trigger.tabIndex = 0;
    }
  }
  if (!menus.size && !dialogs.size) return false;
  const style = document.createElement('style');
  style.textContent = `
    [data-converter-navigation][hidden], [data-converter-nav-submenu][hidden] { display:none !important; }
    [data-converter-navigation]:not([hidden]), [data-converter-nav-submenu]:not([hidden]) { display:block !important; }
    [data-converter-nav-dialog-trigger], [data-converter-nav-close],
    [data-converter-nav-toggle], [data-converter-nav-subtoggle] { cursor:pointer; }
    #qodef-side-area[data-converter-nav-dialog="qode-side"] { max-width:100%; overflow-y:auto; }
    body:has([data-converter-nav-dialog="qode-side"][inert]) .qodef-side-area-cover { pointer-events:none; }
    [data-converter-nav-dialog-trigger]:focus-visible, [data-converter-nav-close]:focus-visible,
    [data-converter-nav-toggle]:focus-visible, [data-converter-nav-subtoggle]:focus-visible { outline:2px solid currentColor; outline-offset:3px; }
  `;
  document.head.append(style);
  return true;
}

export function enableMobileNavigation() {
  function activate(trigger, callback) {
    trigger.addEventListener('click',event => { event.preventDefault(); callback(); });
    if (trigger.localName !== 'button') {
      trigger.addEventListener('keydown',event => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); callback(); }
      });
    }
  }
  function enableSubmenus(menu) {
    for (const sub of menu.querySelectorAll('[data-converter-nav-subtoggle]')) {
      const list = sub.parentElement.querySelector('[data-converter-nav-submenu]');
      if (!list) continue;
      activate(sub,() => {
        const opening = list.hidden;
        sub.setAttribute('aria-expanded',String(opening));
        list.hidden = !opening;
        if (menu.hasAttribute('data-converter-nav-dialog')) sub.parentElement.classList.toggle('opened',opening);
      });
    }
  }
  for (const menu of document.querySelectorAll('[data-converter-nav-dialog]')) {
    const triggers = [...document.querySelectorAll('[data-converter-nav-dialog-trigger]')].filter(node=>node.getAttribute('aria-controls')===menu.id);
    const close = menu.querySelector('[data-converter-nav-close]');
    const kind = menu.dataset.converterNavDialog;
    const side = kind === 'side';
    const qodeSide = kind === 'qode-side';
    const overlaySelector = side ? '.sc_layouts_panel_hide_content' : '.menu_mobile_overlay';
    const overlay = qodeSide ? menu.parentElement.querySelector(':scope > .qodef-side-area-cover') :
      menu.previousElementSibling?.matches(overlaySelector) ? menu.previousElementSibling : null;
    const modeClass = side ? 'sc_layouts_panel_opened' : 'opened';
    let opener;
    function setOpen(open) {
      if (qodeSide) document.body.classList.toggle('qodef-side-area--opened',open);
      else menu.classList.toggle(modeClass,open);
      menu.toggleAttribute('inert',!open);
      menu.setAttribute('aria-hidden',String(!open));
      if (!qodeSide) document.body.classList.toggle(side ? 'sc_layouts_panel_opened' : 'menu_mobile_opened',open);
      if (side) {
        const position = menu.dataset.panelPosition;
        if (['left','right','top','bottom'].includes(position)) document.body.classList.toggle(modeClass+'_'+position,open);
        overlay?.classList.toggle(modeClass,open);
      } else if (!qodeSide && overlay) overlay.style.display = open ? 'block' : 'none';
      for (const trigger of triggers) trigger.setAttribute('aria-expanded',String(open));
      if (qodeSide && open) {
        requestAnimationFrame(() => {
          if (!menu.hasAttribute('inert')) close.focus({preventScroll:true});
        });
      } else (open ? close : opener)?.focus({preventScroll:true});
    }
    for (const trigger of triggers) activate(trigger,()=>{
      opener = trigger;
      setOpen(menu.hasAttribute('inert'));
    });
    activate(close,()=>setOpen(false));
    if (overlay) overlay.addEventListener('click',()=>setOpen(false));
    enableSubmenus(menu);
    document.addEventListener('keydown',event=>{
      if (menu.hasAttribute('inert')) return;
      if (event.key==='Escape') setOpen(false);
      else if (event.key==='Tab') {
        const stops = [close,...[...menu.querySelectorAll('a[href],button,[tabindex="0"]')].filter(node=>node!==close && node.getClientRects().length && !node.disabled)];
        if (event.shiftKey && document.activeElement===stops[0]) { event.preventDefault(); stops.at(-1).focus(); }
        else if (!event.shiftKey && document.activeElement===stops.at(-1)) { event.preventDefault(); stops[0].focus(); }
      }
    });
  }

  for (const trigger of document.querySelectorAll('[data-converter-nav-toggle]')) {
    const menu = document.getElementById(trigger.getAttribute('aria-controls'));
    if (!menu) continue;
    const themeNavigation = trigger.hasAttribute('data-converter-theme-nav') && trigger.closest('.site-navigation');
    const isOpen = () => trigger.getAttribute('aria-expanded') === 'true';
    function setOpen(open) {
      if (themeNavigation) {
        document.documentElement.classList.toggle('is-menu-toggled-on',open);
        themeNavigation.classList.toggle('is-active',open);
        themeNavigation.closest('.site-header').classList.toggle('is-active',open);
      } else menu.hidden = !open;
      trigger.setAttribute('aria-expanded',String(open));
      if (trigger.matches('.qodef-mobile-header-opener')) trigger.classList.toggle('qodef--opened',open);
    }
    activate(trigger,() => setOpen(!isOpen()));
    if (themeNavigation) matchMedia('(min-width:992px)').addEventListener('change',() => {
      if (isOpen()) setOpen(false);
    });
    enableSubmenus(menu);
    menu.addEventListener('click',event => {
      if (event.target.closest('a[href^="#"]:not([data-converter-nav-subtoggle])')) setOpen(false);
    });
    document.addEventListener('keydown',event => {
      if (event.key === 'Escape' && isOpen() && trigger.getClientRects().length) {
        setOpen(false);
        trigger.focus();
      }
    });
  }
  const root = document.documentElement;
  const original = document.querySelector('.site-header.original:has([data-converter-theme-nav])');
  const clone = document.querySelector('.site-header.clone:has([data-converter-theme-nav])');
  if (original && clone && root.classList.contains('is-menu-sticky')) {
    const heroPage = original.parentElement.querySelector(':scope > .elementor:has([data-converter-sniper])');
    if (root.matches('.is-header-float.is-header-small') && /^-\d+(?:\.\d+)?px$/.test(heroPage?.style.marginTop || '')) {
      const fitHeader = () => {
        if (!root.classList.contains('is-menu-toggled-on')) {
          // The source uses the floating header height plus its divider as the overlap.
          heroPage.style.marginTop = -(original.offsetHeight+1)+'px';
        }
      };
      new ResizeObserver(fitHeader).observe(original);
      fitHeader();
    }
    const sync = () => {
      if (root.classList.contains('is-menu-toggled-on')) return;
      const sticky = scrollY >= original.offsetHeight && scrollY > 0;
      clone.classList.toggle('is-visible',sticky);
      root.classList.toggle('is-sticky-menu-visible',sticky);
    };
    root.classList.remove('menu-detached','menu-invisible');
    addEventListener('scroll',sync,{passive:true});
    sync();
  }
}
