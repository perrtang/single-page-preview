import { fork } from 'node:child_process';
import { once } from 'node:events';
import { open, readFile, readdir, realpath, rm, stat } from 'node:fs/promises';
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';

const maxImportBytes = 80 * 1024 * 1024;
const maxFiles = 2500;
const htmlExtension = /^\.html?$/i;

function requireInside(workspace, path) {
  if (!workspace) return path;
  const fromRoot = relative(workspace,path);
  if (isAbsolute(fromRoot) || fromRoot === '..' || fromRoot.startsWith('..'+sep)) {
    throw Error('The path is outside the configured workspace.');
  }
  return path;
}

async function inputPayload({input,assets,archive,fetchAssets},workspace) {
  const resolveInput = async path => requireInside(workspace,await realpath(resolve(workspace || '.',path)));
  const source = await resolveInput(input);
  const info = await stat(source);
  const items = [];
  let bytes = 0;
  async function encode(path) {
    const info = await stat(path);
    if (!info.isFile()) throw Error('Expected a file: '+path);
    if (info.size > maxImportBytes-bytes) throw Error('Input exceeds the 80 MB limit.');
    const data = await readFile(path);
    bytes += data.length;
    if (bytes > maxImportBytes) throw Error('Input exceeds the 80 MB limit.');
    return data.toString('base64');
  }
  async function add(path,name) {
    if (items.length >= maxFiles) throw Error('Input exceeds the 2,500-file limit.');
    items.push({path:name,data:await encode(path)});
  }
  async function walk(directory,prefix='') {
    const entries = await readdir(directory,{withFileTypes:true});
    entries.sort((a,b)=>a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (entry.name.startsWith('.') || ['__MACOSX','node_modules'].includes(entry.name)) continue;
      const path = join(directory,entry.name);
      const name = prefix+entry.name;
      if (entry.isDirectory()) await walk(path,name+'/');
      else if (entry.isFile()) await add(path,name);
    }
  }

  if (info.isDirectory()) {
    if (assets) throw Error('A separate assets folder is only supported with an HTML input file.');
    await walk(source);
  } else if (htmlExtension.test(extname(source))) {
    await add(source,basename(source));
    if (assets) {
      const directory = await resolveInput(assets);
      if (!(await stat(directory)).isDirectory()) throw Error('The assets path must be a folder.');
      await walk(directory,basename(directory)+'/');
    }
  } else {
    if (extname(source).toLowerCase() !== '.zip' || assets) {
      throw Error('Choose a ZIP, an HTML file with optional assets, or a folder.');
    }
    await add(source,basename(source));
  }
  if (!items.length) throw Error('The input folder is empty.');
  const browserArchive = archive ? await encode(await resolveInput(archive)) : undefined;
  return {items,browserArchive,fetchImages:fetchAssets===true,fetchFonts:fetchAssets===true};
}

async function withConverter(run) {
  const child = fork(new URL('./server.mjs',import.meta.url),[],{
    env:{...process.env,PORT:'0'},stdio:['ignore','ignore','pipe','ipc'],execArgv:[]
  });
  let diagnostics = '';
  child.stderr.setEncoding('utf8').on('data',chunk=>{diagnostics = (diagnostics+chunk).slice(-16000);});
  const exited = once(child,'exit');
  try {
    const [message] = await Promise.race([
      once(child,'message',{signal:AbortSignal.timeout(20000)}),
      exited.then(()=>{throw Error(diagnostics.trim() || 'The local converter stopped during startup.');})
    ]);
    return await run(message.origin);
  } finally {
    if (child.connected) child.disconnect();
    const shutdownTimer = setTimeout(()=>child.kill('SIGKILL'),5000);
    try { await exited.catch(()=>{}); }
    finally { clearTimeout(shutdownTimer); }
  }
}

async function importPage(origin,payload,onProgress) {
  const response = await fetch(origin+'/import',{
    method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Accept:'application/x-ndjson'},
    body:JSON.stringify(payload)
  });
  if (!response.ok) {
    const result = await response.json();
    throw Error(result.error || 'The converter could not import the page.');
  }
  let buffered = '';
  for await (const chunk of response.body.pipeThrough(new TextDecoderStream())) {
    const lines = (buffered+chunk).split('\n');
    buffered = lines.pop();
    for (const line of lines) {
      const message = JSON.parse(line);
      if (message.error) throw Error(message.error);
      if (message.result) return message.result;
      onProgress?.(message);
    }
  }
  throw Error('The converter stopped before producing a report.');
}

async function writeZip(path,data) {
  const file = await open(path,'wx').catch(error=>{
    if (error.code==='EEXIST') throw Error('Output already exists: '+path);
    throw error;
  });
  try {
    try { await file.writeFile(data); }
    finally { await file.close(); }
  } catch (error) {
    await rm(path,{force:true});
    throw error;
  }
}

export async function runConversion(options,{workspace,onProgress}={}) {
  const payload = await inputPayload(options,workspace);
  let outputPath;
  if (options.output) {
    const requested = resolve(workspace || '.',options.output);
    if (extname(requested).toLowerCase() !== '.zip') throw Error('The output filename must end in .zip.');
    const parent = requireInside(workspace,await realpath(dirname(requested)));
    outputPath = join(parent,basename(requested));
  }

  return withConverter(async origin=>{
    const report = await importPage(origin,payload,onProgress);
    if (outputPath) {
      const response = await fetch(origin+'/export/'+encodeURIComponent(report.id));
      if (!response.ok) throw Error('The converter could not export the ZIP.');
      await writeZip(outputPath,Buffer.from(await response.arrayBuffer()));
    }
    return {
      entry:report.entry,
      ...(outputPath ? {output:outputPath} : {}),
      widths:report.after.map((row,index)=>({
        width:row.width,beforeOverflow:report.before[index].overflow,afterOverflow:row.overflow
      })),
      changes:report.changes,
      missing:report.missing,
      unresolvedFonts:report.unresolvedFonts,
      logos:report.logos.length,
      carousels:report.carousels,
      slideshowCount:report.slideshowCount
    };
  });
}
