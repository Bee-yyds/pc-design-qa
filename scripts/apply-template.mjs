import fs from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

function args(){const a=process.argv.slice(2),o={};for(let i=0;i<a.length;i+=2){if(!a[i]?.startsWith("--")||!a[i+1])throw Error("需要 --target 和 --report");o[a[i].slice(2)]=a[i+1]}return o}
const options=args();
if(!options.target||!options.report)throw Error("用法: node apply-template.mjs --target <新Sites源码> --report <report.json>");
const target=path.resolve(options.target), root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../assets/site-overlay");
await fs.access(path.join(target,"package.json"));
await fs.access(path.join(target,"app/chatgpt-auth.ts"));
try{await fs.access(path.join(target,"data/report.json"));throw Error("已有报告，拒绝覆盖。请更新其数据并保留Site与ID。")}catch(e){if(e.code!=="ENOENT")throw e}
const report=JSON.parse(await fs.readFile(options.report,"utf8"));
if(report.schemaVersion!==1||!report.version||!report.requirement||!Object.keys(report.batches??{}).length)throw Error("报告基本字段不完整");
await fs.cp(root,target,{recursive:true});
await fs.mkdir(path.join(target,"data"),{recursive:true});
await fs.writeFile(path.join(target,"data/report.json"),JSON.stringify(report,null,2)+"\n");
const manifestPath=path.join(target,".openai/hosting.json");
let manifest={};try{manifest=JSON.parse(await fs.readFile(manifestPath,"utf8"))}catch(e){if(e.code!=="ENOENT")throw e}
manifest.d1="DB";
await fs.mkdir(path.dirname(manifestPath),{recursive:true});
await fs.writeFile(manifestPath,JSON.stringify(manifest,null,2)+"\n");
console.log(JSON.stringify({target,version:report.version,requirement:report.requirement,next:"复制真实证据，校验，按Sites技能构建/迁移/发布"}));
