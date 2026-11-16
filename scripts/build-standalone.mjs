import {readFileSync,writeFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {dirname,resolve} from "node:path";

const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const read=path=>readFileSync(resolve(root,path),"utf8");
const css=read("src/styles.css");
const modules=["src/domain.mjs","src/pricelist.mjs","src/store.mjs","src/views.mjs"].map(read);
const script=modules.map(code=>code
  .replace(/^import\s+\{[^\n]+\}\s+from\s+["'][^"']+["'];?\s*$/gm,"")
  .replace(/^export\s+/gm,"")).join("\n;\n");
const html='<!doctype html>\n<html lang="lt"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">'+
  '<meta name="theme-color" content="#0e2d3c"><title>DentalPro 2.0 – demonstracija (offline)</title>\n<style>\n'+css+'\n</style></head>'+
  '<body><div id="app"></div><script>\n'+script+'\n</script></body></html>';
writeFileSync(resolve(root,"demo-standalone.html"),html);
console.log("Created demo-standalone.html ("+html.length+" characters)");
