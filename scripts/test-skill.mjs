import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";
const here=path.dirname(fileURLToPath(import.meta.url));
const targetArg=process.argv.indexOf("--target");
const outArg=process.argv.indexOf("--out");
const root=outArg<0?await fs.mkdtemp(path.join(os.tmpdir(),"pcqa-test-")):path.resolve(process.argv[outArg+1]);
await fs.mkdir(root,{recursive:true});
const target=targetArg<0?path.join(root,"site-a"):path.resolve(process.argv[targetArg+1]);
const run=(name,args,ok=true)=>{const r=spawnSync(process.execPath,[path.join(here,name),...args],{encoding:"utf8"});assert.equal(r.status===0,ok,r.stdout+r.stderr);return r};
const figma="https://www.figma.com/design/DEMO_FILE/Synthetic?node-id=1-1";
const capture={width:400,height:240,capturedAt:"2026-01-01T00:00:00Z",state:"默认",dpr:1};
function module(id,n){return {id,title:"模拟模块 "+id,figma,dev:"/evidence/dev.svg",design:"/evidence/design.svg",facts:"仅用于模板功能测试，不代表真实设计验收",marks:Array.from({length:n},(_,i)=>[i+1,20+i*20,40]),issues:Array.from({length:n},(_,i)=>({id:id+"-issue-"+(i+1),originalDescription:"位置：模拟区域。开发现状：测试现状。设计要求：测试要求。建议：测试修改。"})),capture:{dev:capture,design:capture}}}
const report={schemaVersion:1,version:"测试版本",requirement:"测试需求A",onlineUrl:"https://example.test/report-a",batches:{
  foundation:{tab:"基础",title:"基础",source:"隔离模拟数据",link:"https://example.test/dev",modules:[module("module-a",2),module("module-b",1)],pending:[["加载","尚无同状态画面"]]},
  extra:{tab:"补充",title:"补充",source:"隔离模拟数据",link:"https://example.test/dev",modules:[module("module-c",1)],pending:[]}
}};
const coverage={version:report.version,requirement:report.requirement,states:[
  ...["module-a","module-b","module-c"].map((id,i)=>({id:"state-"+i,batchId:i===2?"extra":"foundation",name:id,figma,status:"confirmed-difference",moduleId:id,developmentNotes:["模拟Development"]})),
  {id:"state-pass",batchId:"foundation",name:"一致状态",figma,status:"no-difference",developmentNotes:[]},
  {id:"state-pending",batchId:"foundation",name:"加载",figma,status:"pending",reason:"尚无同状态画面",developmentNotes:[]}
]};
const file=path.join(root,"report.json"),scope=path.join(root,"coverage.json"),pub=path.join(root,"public");
await fs.mkdir(path.join(pub,"evidence"),{recursive:true});
for(const name of ["dev","design"])await fs.writeFile(path.join(pub,"evidence",name+".svg"),'<svg xmlns="http://www.w3.org/2000/svg" width="400" height="240"><rect width="400" height="240" fill="#242424"/><text x="30" y="120" fill="white" font-size="24">Synthetic '+name+'</text></svg>');
await fs.writeFile(file,JSON.stringify(report));await fs.writeFile(scope,JSON.stringify(coverage));
const base=["--report",file,"--public-dir",pub,"--coverage",scope,"--published"];
run("validate-report.mjs",base);
const withEvidence=structuredClone(report);
const em=withEvidence.batches.foundation.modules[0];
em.marks=[[1,20,40]];
em.issues[1].evidence={dev:"/evidence/design.svg",design:"/evidence/dev.svg",marks:[[2,45,55],[2,60,70]],capture:{dev:capture,design:capture}};
await fs.writeFile(path.join(root,"evidence.json"),JSON.stringify(withEvidence));
run("validate-report.mjs",["--report",path.join(root,"evidence.json"),"--public-dir",pub]);
em.issues[1].evidence.marks=[[1,45,55]];
await fs.writeFile(path.join(root,"evidence-bad.json"),JSON.stringify(withEvidence));
run("validate-report.mjs",["--report",path.join(root,"evidence-bad.json")],false);
const badOrder=structuredClone(report);badOrder.batches.foundation.modules[0].reviewOrder=-1;
await fs.writeFile(path.join(root,"bad-order.json"),JSON.stringify(badOrder));
run("validate-report.mjs",["--report",path.join(root,"bad-order.json")],false);
const bad=structuredClone(report);bad.batches.foundation.modules[0].marks[0][0]=9;
await fs.writeFile(path.join(root,"bad.json"),JSON.stringify(bad));
run("validate-report.mjs",["--report",path.join(root,"bad.json")],false);
bad.batches.foundation.modules[0].marks[0][0]=1;bad.batches.foundation.modules[0].capture.dev={...capture,width:401};
await fs.writeFile(path.join(root,"bad.json"),JSON.stringify(bad));
run("validate-report.mjs",["--report",path.join(root,"bad.json"),"--public-dir",pub],false);
async function stub(dir){await fs.mkdir(path.join(dir,"app"),{recursive:true});await fs.writeFile(path.join(dir,"package.json"),'{"type":"module"}');await fs.writeFile(path.join(dir,"app/chatgpt-auth.ts"),"// local test starter stub");}
try{await fs.access(path.join(target,"package.json"))}catch{await stub(target)}
run("apply-template.mjs",["--target",target,"--report",file]);
await fs.cp(pub,path.join(target,"public"),{recursive:true});
run("apply-template.mjs",["--target",target,"--report",file],false);
const other=structuredClone(report);other.requirement="测试需求B";other.onlineUrl="https://example.test/report-b";
const fileB=path.join(root,"report-b.json"),siteB=path.join(root,"site-b");await fs.writeFile(fileB,JSON.stringify(other));await stub(siteB);
run("apply-template.mjs",["--target",siteB,"--report",fileB]);
assert.notEqual(JSON.parse(await fs.readFile(path.join(siteB,"data/report.json"))).requirement,JSON.parse(await fs.readFile(path.join(target,"data/report.json"))).requirement);
console.log(JSON.stringify({ok:true,checks:["valid report","bad marker rejected","wrong image dimensions rejected","new requirement isolated","existing report overwrite rejected","pass excluded from issue modules","pending separate"],root,target}));
