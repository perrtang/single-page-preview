#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { runConversion } from './local-converter.mjs';

const help = `Single Page Preview CLI

Usage
  node cli.mjs inspect INPUT [options]
  node cli.mjs convert INPUT --output FILE.zip [options]

INPUT is a ZIP, HTML file, or folder.
  --assets FOLDER       Chrome assets folder paired with an HTML input
  --archive FILE        Optional Chrome MHTML archive for recovering images
  --fetch-assets        Try to retrieve missing images and fonts via public HTTPS
  --output, -o FILE    New output ZIP for convert
  --help, -h           Show usage

Results are JSON on stdout. Progress and errors are written to stderr.`;

try {
  const {positionals,values} = parseArgs({allowPositionals:true,options:{
    assets:{type:'string'},archive:{type:'string'},'fetch-assets':{type:'boolean'},
    output:{type:'string',short:'o'},help:{type:'boolean',short:'h'}
  }});
  let lastPhase;
  if (values.help || !process.argv.slice(2).length) console.log(help);
  else {
    const [command,input] = positionals;
    if (positionals.length!==2 || !['inspect','convert'].includes(command) ||
        (command==='convert')!==Boolean(values.output)) {
      throw Error('Use inspect INPUT or convert INPUT --output FILE.zip. Run with --help for options.');
    }
    const result = await runConversion({
      input,assets:values.assets,archive:values.archive,fetchAssets:values['fetch-assets'],output:values.output
    },{onProgress:({percent,label})=>{
      if (label!==lastPhase) {
        console.error(percent+'% '+label);
        lastPhase = label;
      }
    }});
    console.log(JSON.stringify(result,null,2));
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
