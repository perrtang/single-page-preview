import { lookup } from 'node:dns';
import { get } from 'node:https';
import { BlockList, isIP } from 'node:net';

const blocked = new BlockList();
for (const [address,bits] of [
  ['0.0.0.0',8],['10.0.0.0',8],['100.64.0.0',10],['127.0.0.0',8],['169.254.0.0',16],
  ['172.16.0.0',12],['192.0.0.0',24],['192.0.2.0',24],['192.88.99.0',24],['192.168.0.0',16],
  ['198.18.0.0',15],['198.51.100.0',24],['203.0.113.0',24],['224.0.0.0',3]
]) blocked.addSubnet(address,bits,'ipv4');

const extensions = {
  'image/jpeg':'.jpg','image/png':'.png','image/gif':'.gif','image/webp':'.webp',
  'image/avif':'.avif','image/x-icon':'.ico','image/vnd.microsoft.icon':'.ico'
};
const maxAsset = 8*1024*1024;
export function fontExtension(data) {
  const magic = Buffer.from(data.subarray(0,4));
  return ({wOF2:'.woff2',wOFF:'.woff',OTTO:'.otf',true:'.ttf'})[magic.toString('latin1')] ||
    (magic.toString('hex')==='00010000' ? '.ttf' : null);
}
const media = {
  image:{accept:'image/avif,image/webp,image/png,image/jpeg,image/gif,image/x-icon',limit:maxAsset,
    match:mime=>extensions[mime],finish:(data,extension)=>({data,extension})},
  font:{accept:'font/woff2,font/woff,font/ttf,font/otf,application/octet-stream',limit:maxAsset,
    match:mime=>/^(?:font\/|application\/(?:octet-stream$|(?:font|x-font|x-woff)(?:-|$)|vnd\.ms-opentype$))/.test(mime || ''),
    finish:data=>{
      const extension = fontExtension(data);
      if (!extension) throw Error('回傳內容不是支援的字型檔');
      return {data,extension};
    }},
  page:{accept:'text/html,application/xhtml+xml',limit:4*1024*1024,
    match:mime=>['text/html','application/xhtml+xml'].includes(mime),
    finish:(data,_,url)=>({html:data.toString('utf8'),url})}
};

function publicLookup(host,{all},callback) {
  lookup(host,{family:4,all:true},(error,addresses) => {
    if (error) return callback(error);
    const address = addresses.find(item => !blocked.check(item.address,'ipv4'));
    if (!address) return callback(Error('無法連到公開圖片網址'));
    if (all) callback(null,[address]);
    else callback(null,address.address,4);
  });
}

function download(source,signal,type,redirects=3) {
  const {accept,limit,match,finish} = media[type];
  return new Promise((resolve,reject) => {
    const url = new URL(source);
    if (url.protocol !== 'https:' || url.username || url.password ||
        (url.port && url.port !== '443') || isIP(url.hostname) || url.hostname.startsWith('[')) {
      reject(Error('只接受公開 HTTPS 網址'));
      return;
    }
    const request = get(url,{
      signal,lookup:publicLookup,family:4,agent:false,
      headers:{Accept:accept}
    },response => {
      const code = response.statusCode;
      if ([301,302,303,307,308].includes(code) && redirects && response.headers.location) {
        response.destroy();
        try { resolve(download(new URL(response.headers.location,url).href,signal,type,redirects-1)); }
        catch (error) { reject(error); }
        return;
      }
      const mime = response.headers['content-type']?.split(';')[0]?.trim().toLowerCase();
      const format = match(mime);
      if (code !== 200 || !format || Number(response.headers['content-length']) > limit) {
        response.destroy();
        reject(Error(code !== 200 ? 'HTTP '+code : '資源格式不支援或檔案過大'));
        return;
      }
      const chunks = [];
      let length = 0;
      response.on('data',chunk => {
        length += chunk.length;
        if (length > limit) {
          response.destroy();
          reject(Error('資源超過大小上限'));
        } else chunks.push(chunk);
      });
      response.on('error',reject);
      response.on('end',() => {
        if (!length) return reject(Error('資源內容為空'));
        try { resolve(finish(Buffer.concat(chunks,length),format,url.href)); }
        catch (error) { reject(error); }
      });
    });
    request.on('error',reject);
  });
}

async function downloadAssets(sources,budget,save,type,onProgress) {
  const urls = [...sources];
  const limit = 120;
  const queue = urls.slice(0,limit);
  const failed = [];
  const deadline = AbortSignal.timeout(18000);
  let next = 0;
  let saved = 0;
  await Promise.all(Array.from({length:Math.min(8,queue.length)},async () => {
    while (next < queue.length) {
      const source = queue[next++];
      try {
        if (budget <= 0) throw Error('已達本次素材容量上限');
        const result = await download(source,AbortSignal.any([deadline,AbortSignal.timeout(5500)]),type);
        if (result.data.length > budget) throw Error('已達本次素材容量上限');
        budget -= result.data.length;
        await save(source,result);
        saved++;
      } catch (error) {
        failed.push({source,reason:error.name === 'AbortError' ? '連線逾時' : error.message});
      }
      onProgress?.(saved+failed.length,queue.length);
    }
  }));
  return {saved,failed,skipped:urls.length-queue.length,remaining:budget};
}

export const downloadImages = (sources,budget,save,onProgress) => downloadAssets(sources,budget,save,'image',onProgress);
export const downloadFonts = (sources,budget,save,onProgress) => downloadAssets(sources,budget,save,'font',onProgress);
export const readOriginPage = source => download(source,AbortSignal.timeout(5500),'page');
