const itemSelector = '[data-converter-nav-item]';
const menuSelector = '[data-converter-editable-nav]';
const labelSelector = '.qodef-menu-item-text';
const textExclusions = 'svg,[aria-hidden=true],.screen-reader-text,.sr-only,[data-converter-logo]';

function itemLink(item) {
  return item.matches('a') ? item : item.querySelector(':scope > a');
}

function labelNodes(link) {
  if (!link) return [];
  const label = link.querySelector(labelSelector) || link;
  const walker = link.ownerDocument.createTreeWalker(label,4);
  const nodes = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.nodeValue.trim() && !node.parentElement.closest(textExclusions)) nodes.push(node);
  }
  return nodes;
}

function itemLabel(item) {
  return labelNodes(itemLink(item)).map(node => node.nodeValue.trim()).join(' ').replace(/\s+/g,' ');
}

function menuCandidates(document) {
  return [...document.querySelectorAll('nav,[role=navigation]')].flatMap(nav => {
    if (!nav.closest('header,[role=banner]') && nav.parentElement !== document.body && !nav.hasAttribute('data-converter-navigation')) return [];
    if (nav.closest('footer,[role=contentinfo]')) return [];
    const lists = [...nav.querySelectorAll('ul,ol')].filter(list => {
      const parentList = list.parentElement.closest('ul,ol');
      return !nav.contains(parentList);
    });
    const candidates = [...lists,nav].flatMap(menu => {
      const itemTag = /^(ul|ol)$/.test(menu.localName) ? 'li' : 'a';
      const items = [...menu.children].filter(item => item.localName === itemTag);
      if (!items.length || items.some(item => !itemLabel(item) || item.hasAttribute('data-converter-logo') ||
          item.querySelector('[data-converter-logo]'))) return [];
      return [{menu,items,itemTag,mobile:nav.hasAttribute('data-converter-navigation')}];
    });
    return candidates.sort((a,b) => b.items.length-a.items.length).slice(0,1);
  });
}

export function identifyNavigation(document) {
  const candidates = menuCandidates(document);
  const main = candidates.filter(candidate => !candidate.mobile).sort((a,b) => b.items.length-a.items.length)[0] ||
    candidates.sort((a,b) => b.items.length-a.items.length)[0];
  if (!main) return null;
  const items = main.items.map((item,id) => ({id,label:itemLabel(item)}));
  const signature = ({items}) => JSON.stringify(items.map(item => itemLabel(item).toLowerCase()));
  const matched = candidates.filter(candidate => candidate !== main && signature(candidate) === signature(main));
  const groups = [main,...matched].map(({menu,items,itemTag},index) => {
    menu.dataset.converterEditableNav = index;
    items.forEach((item,id) => { item.dataset.converterNavItem = id; });
    const sample = itemLink(items[0]);
    const label = sample.querySelector(labelSelector) || sample.querySelector(':scope > span');
    return {initialHTML:menu.innerHTML,itemTag,labelClass:label?.className || '',
      itemClass:commonClasses(items),linkClass:commonClasses(items.map(itemLink)),
      container:index};
  });
  return {initial:items,items,groups,nextId:items.length};
}

function commonClasses(nodes) {
  return [...nodes[0].classList].filter(name =>
    !/(?:^|[-_])(?:current|active|selected|ancestor|parent|children|hide|drop|opened)(?:[-_]|$)|\d+$/.test(name) &&
    nodes.every(node => node.classList.contains(name))).join(' ');
}

function targetMenus(document,navigation) {
  return navigation.groups.map(group => {
    const menu = document.querySelector(menuSelector+'[data-converter-editable-nav="'+group.container+'"]');
    if (!menu) throw Error('找不到原本的導覽區域。');
    return menu;
  });
}

export function resetNavigation(document,navigation) {
  targetMenus(document,navigation).forEach((menu,index) => { menu.innerHTML = navigation.groups[index].initialHTML; });
  navigation.items = navigation.initial;
}

export function updateNavigation(document,navigation,rows) {
  if (!Array.isArray(rows) || rows.length > Math.max(50,navigation.initial.length+20)) {
    throw Error('導覽項目數量超出可用範圍。');
  }
  const original = new Map(navigation.items.map(item => [item.id,item]));
  const ids = new Set();
  let nextId = navigation.nextId;
  function itemHref(row) {
    const href = typeof row.href === 'string' ? row.href.trim() : '';
    if (href && !/^#[^\s\x00-\x1f]{0,399}$/.test(href)) throw Error('新增項目的連結請使用頁內錨點，例如 #contact。');
    return href;
  }
  const items = rows.map(row => {
    const label = typeof row?.label === 'string' ? row.label.trim() : '';
    if (!label || label.length > 200) throw Error('每個導覽項目都需要 1–200 個字的文字。');
    if (row.id === null) {
      return {id:nextId++,label,href:itemHref(row)};
    }
    const previous = original.get(row.id);
    if (!previous || ids.has(row.id)) throw Error('找不到導覽項目，請重新開啟調整面板。');
    ids.add(row.id);
    return Object.hasOwn(previous,'href') ? {...previous,label,href:itemHref(row)} : {...previous,label};
  });
  const menus = targetMenus(document,navigation);
  const updates = menus.map((menu,index) => {
    const existing = [...menu.children].filter(item => item.matches(itemSelector));
    const byId = new Map(existing.map(item => [Number(item.dataset.converterNavItem),item]));
    const replacements = items.map(item => {
      const existingItem = byId.get(item.id);
      if (existingItem) {
        const link = itemLink(existingItem);
        if (original.get(item.id).label !== item.label) {
          const [first,...rest] = labelNodes(link);
          if (first) first.nodeValue = item.label;
          for (const node of rest) node.nodeValue = '';
        }
        if (Object.hasOwn(item,'href')) {
          if (item.href) link.setAttribute('href',item.href);
          else link.removeAttribute('href');
        }
        return existingItem;
      }
      const group = navigation.groups[index];
      const link = document.createElement('a');
      link.className = group.linkClass;
      if (item.href) link.setAttribute('href',item.href);
      const span = group.labelClass ? document.createElement('span') : link;
      if (span !== link) {
        span.className = group.labelClass;
        link.append(span);
      }
      span.textContent = item.label;
      const node = group.itemTag === 'a' ? link : document.createElement('li');
      if (node !== link) {
        node.className = group.itemClass;
        node.append(link);
      }
      node.dataset.converterNavItem = item.id;
      return node;
    });
    return {menu,existing,replacements};
  });
  for (const {menu,existing,replacements} of updates) {
    for (const node of existing) node.remove();
    menu.append(...replacements);
  }
  navigation.items = items;
  navigation.nextId = nextId;
}
