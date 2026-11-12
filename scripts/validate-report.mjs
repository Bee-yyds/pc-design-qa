import fs from "node:fs/promises";
import path from "node:path";
const args={};for(let i=2;i<process.argv.length;i++){const key=process.argv[i].slice(2);args[key]=key==="published"?true:process.argv[++i]}
if(!args.report)throw Error("需要 --report，可加 --public-dir、--coverage、--published");
const r=JSON.parse(await fs.readFile(args.report,"utf8")),errors=[],ids=new Set(),modules=new Map();
const check=(ok,message)=>{if(!ok)errors.push(message)};
const text=v=>typeof v==="string"&&v.trim().length>0;
const http=v=>{try{return ["https:","http:"].includes(new URL(v).protocol)}catch{return false}};
const figma=v=>{try{const u=new URL(v);return /(^|\.)figma\.com$/.test(u.hostname)&&/^\/design\/[^/]+\//.test(u.pathname)&&/^(?:I)?\d+[-:]\d+(?:;\d+[-:]\d+)*$/.test(u.searchParams.get("node-id")??"")}catch{return false}};
const unique=(id,where)=>{check(typeof id==="string"&&/^[a-z][a-z0-9-]{0,63}$/.test(id),where+": ID格式");check(!ids.has(id),where+": 重复ID "+id);ids.add(id)};
check(r.schemaVersion===1&&text(r.version)&&text(r.requirement),"需求身份缺失");
check(r.batches&&Object.keys(r.batches).length>0,"至少需要一批");
if(args.published)check(http(r.onlineUrl),"发布后必须有onlineUrl");
function dimensions(buf,file){
  if(buf.readUInt32BE(0)===0x89504e47)return [buf.readUInt32BE(16),buf.readUInt32BE(20)];
  if(buf[0]===255&&buf[1]===216){let p=2;while(p<buf.length){if(buf[p++]!==255)continue;let marker=buf[p++];if(marker===216||marker===217)continue;let size=buf.readUInt16BE(p);if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker))return [buf.readUInt16BE(p+5),buf.readUInt16BE(p+3)];p+=size}}
  if(file.endsWith(".svg")){const s=buf.toString(),w=s.match(/\bwidth="(\d+)"/),h=s.match(/\bheight="(\d+)"/);if(w&&h)return [+w[1],+h[1]]}
  return null;
}
for(const [bid,b] of Object.entries(r.batches??{})){
  unique(bid,"批次");check(text(b.tab)&&text(b.title)&&text(b.source)&&http(b.link),bid+": 基本字段或开发地址");
  check(Array.isArray(b.modules)&&Array.isArray(b.pending),bid+": modules/pending数组");
  for(const p of b.pending??[])check(Array.isArray(p)&&p.length===2&&p.every(text),bid+": 未完成原因缺失");
  for(const m of b.modules??[]){
    unique(m.id,"模块");modules.set(m.id,{...m,bid});check(text(m.title)&&text(m.facts)&&figma(m.figma),m.id+": 标题/参数/节点链接");
    if(m.reviewOrder!==undefined)check(Number.isSafeInteger(m.reviewOrder)&&m.reviewOrder>0,m.id+": reviewOrder须为正安全整数");
    for(const link of m.figmaMore??[])check(text(link.label)&&figma(link.url),m.id+": 附加节点");
    check(Array.isArray(m.issues)&&m.issues.length>0,m.id+": 不能交付无差异空卡片");
    for(const i of m.issues??[]){unique(i.id,"问题");check(text(i.originalDescription),i.id+": 原始描述为空")}
    async function validateEvidence(e,where){
      check(Array.isArray(e.marks),where+": 标记数组");
      for(const mark of e.marks??[])check(Array.isArray(mark)&&mark.length===3&&Number.isInteger(mark[0])&&mark[0]>=1&&mark[0]<=m.issues.length&&mark.slice(1).every(n=>Number.isFinite(n)&&n>=0&&n<=100),where+": 标记序号/坐标");
      for(const kind of ["dev","design"]){
        const c=e.capture?.[kind];check(c&&c.width>0&&c.height>0&&text(c.state)&&!isNaN(Date.parse(c.capturedAt)),where+": "+kind+"采集信息");
        check(typeof e[kind]==="string"&&e[kind].startsWith("/")&&!e[kind].includes(".."),where+": 图片须本地public路径");
        if(args["public-dir"]&&typeof e[kind]==="string"){
          try{const file=path.resolve(args["public-dir"],"."+e[kind]);const buf=await fs.readFile(file),dim=dimensions(buf,file);check(dim&&c&&dim[0]===c.width&&dim[1]===c.height,where+": "+kind+"原始尺寸与文件不符")}catch{errors.push(where+": 图片读取失败 "+e[kind])}
        }
      }
      check(e.capture?.dev?.state===e.capture?.design?.state,where+": 两图状态不一致");
      check((e.capture?.dev?.dpr??0)>0,where+": 缺少开发截图DPR");
      if(e.devDisplayWidth)check(e.devDisplayWidth<=e.capture?.dev?.width/e.capture?.dev?.dpr,where+": 展示宽度超过原始CSS尺寸");
    }
    await validateEvidence(m,m.id);
    for(const [index,i] of (m.issues??[]).entries()){
      if(i.evidence)await validateEvidence(i.evidence,i.id);
      check((i.evidence??m).marks?.some(mark=>mark[0]===index+1),i.id+": 生效截图缺少对应序号");
    }
  }
}
if(args.coverage){
  const c=JSON.parse(await fs.readFile(args.coverage,"utf8")),covered=new Set(),scopeIds=new Set();
  check(c.version===r.version&&c.requirement===r.requirement,"覆盖清单需求身份不符");
  for(const s of c.states??[]){
    check(!scopeIds.has(s.id),"覆盖状态ID重复");scopeIds.add(s.id);
    check(r.batches[s.batchId]&&text(s.name)&&figma(s.figma)&&Array.isArray(s.developmentNotes),"覆盖状态字段不完整");
    check(["confirmed-difference","no-difference","pending","needs-confirmation","excluded"].includes(s.status),"未知覆盖状态");
    if(s.status==="confirmed-difference"){check(modules.get(s.moduleId)?.bid===s.batchId,"差异状态未对应模块");covered.add(s.moduleId)}
    else if(s.status==="no-difference")check(!s.moduleId,"无差异不应进入问题模块");
    else {check(text(s.reason),"未完成/排除缺原因");if(s.status!=="excluded")check(r.batches[s.batchId]?.pending.some(p=>p[0]===s.name&&p[1]===s.reason),"未完成状态未进入报告pending")}
  }
  for(const mid of modules.keys())check(covered.has(mid),"模块未关联内部覆盖项 "+mid);
}
if(errors.length){console.error(JSON.stringify({ok:false,errors},null,2));process.exit(1)}
console.log(JSON.stringify({ok:true,version:r.version,requirement:r.requirement,batches:Object.keys(r.batches).length,modules:modules.size,issues:[...modules.values()].reduce((n,m)=>n+m.issues.length,0)}));
