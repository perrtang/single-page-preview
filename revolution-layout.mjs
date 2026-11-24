// Read supported declarative values from the saved page. The source script is never executed.
function numbers(value) {
  return (value || '').split(',').map(part => /^-?\d+(?:\.\d+)?(?:px)?$/.test(part.trim())
    ? parseFloat(part) : null);
}

export function revolutionOptions(document) {
  const scripts = [...document.scripts].map(script => script.textContent)
    .filter(script => script.includes('.revolutionInit('));
  const options = new Map();
  for (const module of document.querySelectorAll('rs-module[id]')) {
    const script = scripts.find(source => source.includes('getElementById("'+module.id+'")'));
    if (!script) continue;
    const levels = numbers(/responsiveLevels\s*:\s*"([^"]+)"/.exec(script)?.[1]);
    const bullets = /\bbullets\s*:\s*\{([^}]+)\}/.exec(script)?.[1] || '';
    const number = (name,fallback) => {
      const match = new RegExp('\\b'+name+'\\s*:\\s*"?([0-9]+)').exec(bullets);
      return match ? Math.min(name === 'hide_under' ? 4000 : 400,Number(match[1])) : fallback;
    };
    options.set(module.id,{
      fullscreen:/sliderLayout\s*:\s*"fullscreen"/.test(script),
      duration:Math.min(60000,Math.max(1000,Number(/\bduration\s*:\s*"(\d+)ms"/.exec(script)?.[1]) || 5000)),
      levels:levels.every((level,i) => level > 0 && level <= 4000 && (!i || level < levels[i-1])) ? levels : [],
      bullets: {
        left:number('h_offset',75), bottom:number('v_offset',65),
        space:number('space',20), hideUnder:number('hide_under',0),
      },
      swipe:/touchenabled\s*:\s*true/.test(script),
      hoverStop:!/onHoverStop\s*:\s*false/.test(script),
    });
  }
  return options;
}

const layerFields = [
  ['data-xy','xo','x'], ['data-xy','yo','y'],
  ['data-text','s','font'], ['data-text','l','line'],
];

export function preserveRevolutionLayout(section, sourceLayers, layers, options, index) {
  if (!options?.fullscreen || !options.levels.length ||
      !sourceLayers.every(layer => /(?:^|;)y:m(?:;|$)/.test(layer.getAttribute('data-xy') || ''))) return;
  const rules = options.levels.map((_,device) => {
    const selector = '[data-converter-rev-layout="'+index+'"] [data-converter-rev-layer]';
    const rule = selector+' { '+layerFields.map(([, ,name]) =>
      '--converter-rs-'+name+':var(--converter-rs-'+name+'-'+device+');').join(' ')+' }';
    return device ? '@media (max-width:'+options.levels[device]+'px) { '+rule+' }' : rule;
  });
  const layerStyles = sourceLayers.map(source => layerFields.map(([attr,key,name]) => {
    const setting = new RegExp('(?:^|;)'+key+':([^;]+)').exec(source.getAttribute(attr) || '')?.[1];
    const values = numbers(setting);
    const inline = {x:'left',y:'top',font:'fontSize',line:'lineHeight'}[name];
    const fallback = parseFloat(source.style[inline]);
    return [name,options.levels.map((_,i) => values[i] ?? values[0] ?? fallback)];
  }));
  if (layerStyles.some(fields => fields.some(([,values]) => values.some(value => !Number.isFinite(value))))) return;

  section.dataset.converterRevLayout = index;
  for (const [i,layer] of layers.entries()) {
    layer.dataset.converterRevLayer = '';
    const source = sourceLayers[i];
    for (const property of ['font-family','font-weight','color','letter-spacing','text-transform','text-align','white-space']) {
      const value = source.style.getPropertyValue(property);
      if (value) layer.style.setProperty(property,value);
    }
    const width = parseFloat(source.style.width);
    if (width > 0) layer.style.setProperty('--converter-rs-layer-width',width+'px');
    for (const [name,values] of layerStyles[i]) {
      values.forEach((value,device) => layer.style.setProperty('--converter-rs-'+name+'-'+device,value+'px'));
    }
  }
  const style = section.ownerDocument.createElement('style');
  style.textContent = rules.join('\n');
  section.ownerDocument.head.append(style);
}

export function revolutionBullets(section, module, options, slides) {
  const source = [...module.querySelectorAll('rs-bullets > rs-bullet[data-key]')];
  if (!slides.every(slide => source.some(dot => dot.getAttribute('data-key') === slide.dataset.key))) return;
  const controls = section.ownerDocument.createElement('div');
  controls.dataset.converterPlayer = '';
  controls.dataset.converterRevBullets = '';
  controls.setAttribute('role','group');
  controls.setAttribute('aria-label','輪播選頁');
  controls.hidden = true;
  const placement = options?.bullets || {left:75,bottom:65,space:20,hideUnder:0};
  controls.style.setProperty('--converter-bullets-left',placement.left+'px');
  controls.style.setProperty('--converter-bullets-bottom',placement.bottom+'px');
  controls.style.setProperty('--converter-bullets-step',placement.space+8+'px');
  if (placement.hideUnder) {
    controls.dataset.converterBulletsBreakpoint = placement.hideUnder;
    const style = section.ownerDocument.createElement('style');
    style.textContent = '@media (max-width:'+(placement.hideUnder-1)+'px) { [data-converter-bullets-breakpoint="'+placement.hideUnder+'"] { display:none!important; } }';
    section.ownerDocument.head.append(style);
  }
  slides.forEach((slide,index) => {
    const button = section.ownerDocument.createElement('button');
    button.type = 'button';
    button.dataset.converterJump = index;
    const title = slide.querySelector('summary').textContent;
    button.setAttribute('aria-label','第 '+(index+1)+' 張 · '+title);
    controls.append(button);
  });
  section.append(controls);
}
