#!/usr/bin/env node
import { realpath, stat } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import manifest from './package.json' with { type:'json' };
import { runConversion } from './local-converter.mjs';

try {
  const {values} = parseArgs({options:{workspace:{type:'string'}}});
  if (!values.workspace) throw Error('Specify a local folder with --workspace.');
  const workspace = await realpath(values.workspace);
  if (!(await stat(workspace)).isDirectory()) throw Error('The workspace must be a folder.');

  const server = new McpServer({name:manifest.name,version:manifest.version});
  const fields = {
    input:z.string().min(1).describe('ZIP, HTML file, or directory inside the configured workspace'),
    assets:z.string().min(1).optional().describe('Optional matching assets directory for an HTML file'),
    archive:z.string().min(1).optional().describe('Optional MHTML archive from the same page'),
    fetchAssets:z.boolean().optional().describe('Opt in to fetching missing assets via public HTTPS')
  };
  let busy = false;
  async function perform(args) {
    const result = (text,isError=false)=>({isError,content:[{type:'text',text}]});
    if (busy) return result('Another conversion is running. Retry when it finishes.',true);
    busy = true;
    try {
      const report = await runConversion(args,{workspace});
      return {...result(JSON.stringify(report)),structuredContent:report};
    } catch (error) {
      return result(error.message,true);
    } finally {
      busy = false;
    }
  }
  server.registerTool('inspect_page',{
    description:'Analyze one local web page and report RWD overflow, missing assets, and detected elements.',
    inputSchema:fields,
    annotations:{readOnlyHint:true,openWorldHint:true}
  },perform);
  server.registerTool('convert_page',{
    description:'Analyze one local web page and write an offline ZIP. Existing files are preserved.',
    inputSchema:{...fields,output:z.string().min(1).describe('Path for a new ZIP within the workspace')},
    annotations:{destructiveHint:false,openWorldHint:true}
  },perform);
  await server.connect(new StdioServerTransport());
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
