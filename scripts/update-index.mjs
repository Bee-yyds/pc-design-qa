import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {createRequire} from "node:module";
import {pathToFileURL} from "node:url";
import {spawnSync} from "node:child_process";
const a={};for(let i=2;i<process.argv.length;i+=2)a[process.argv[i].slice(2)]=process.argv[i+1];
for(const k of ["file","version","requirement","url","runtime-modules"])if(!a[k])throw Error("缺少 --"+k);
if(!["https:","http:"].includes(new URL(a.url).protocol))throw Error("地址须在线HTTP(S)URL");
const loader=createRequire(path.join(path.resolve(a["runtime-modules"]),"..","pcqa-loader.cjs"));
const {Workbook,SpreadsheetFile,FileBlob}=await import(pathToFileURL(loader.resolve("@oai/artifact-tool")).href);
const target=path.resolve(a.file), tmp=await fs.mkdtemp(path.join(os.tmpdir(),"pcqa-index-"));
try{
  let wb,exists=true;try{await fs.access(target)}catch(e){if(e.code!=="ENOENT")throw e;exists=false}
  if(exists)wb=await SpreadsheetFile.importXlsx(await FileBlob.load(target));else wb=Workbook.create();
  let sheet,table,headerIndex=3;
  const headers=["版本号","需求名","HTML 验收文档地址"];
  if(exists){
    sheet=wb.worksheets.getItemAt(0);table=sheet.tables.items[0];
    const grid=sheet.getRange("A1:C10000").values;
    headerIndex=grid.findIndex(row=>JSON.stringify(row)===JSON.stringify(headers));
    if(!table||headerIndex<0)throw Error("已有索引不是预期三列表格，停止并保留原文件");
  }else{
    sheet=wb.worksheets.add("验收文档索引");sheet.showGridLines=false;
    sheet.getRange("A2").values=[["设计验收文档索引"]];
    sheet.getRange("A2").format.font={name:"Arial",size:14,bold:true,color:"#20243A"};
    sheet.getRange("A4:C5").values=[headers,[a.version,a.requirement,null]];
    table=sheet.tables.add("A4:C5",true,"DesignQaIndex");table.style="TableStyleMedium2";table.showFilterButton=true;
    sheet.getRange("A4:C4").format={fill:"#35325A",font:{name:"Arial",size:11,bold:true,color:"#FFFFFF"},horizontalAlignment:"center",verticalAlignment:"center"};
    sheet.getRange("A1:A8").format.columnWidthPx=160;sheet.getRange("B1:B8").format.columnWidthPx=210;sheet.getRange("C1:C8").format.columnWidthPx=790;
    sheet.getRange("A4:C4").format.rowHeightPx=34;
  }
  let rows=sheet.getRange("A"+(headerIndex+2)+":C10000").values;
  while(rows.length&&rows.at(-1).every(v=>v===null||v===""))rows.pop();
  if(rows.some(row=>!row[0]||!row[1]))throw Error("索引记录缺少版本或需求，保留原文件");
  const keys=new Set();for(const row of rows){const key=JSON.stringify(row.slice(0,2));if(keys.has(key))throw Error("索引存在重复版本＋需求，保留原文件并先解决冲突");keys.add(key)}
  let index=rows.findIndex(row=>row[0]===a.version&&row[1]===a.requirement);
  if(index<0){table.rows.add(null,[[a.version,a.requirement,null]]);rows.push([a.version,a.requirement,null]);index=rows.length-1}
  const body=sheet.getRange("A"+(headerIndex+2)+":C"+(headerIndex+1+rows.length)),esc=s=>s.replaceAll('"','""');
  body.getCell(index,2).formulas=[['=HYPERLINK("'+esc(a.url)+'","'+esc(a.url)+'")']];
  body.format.font={name:"Arial",size:11,color:"#262B39"};body.format.verticalAlignment="center";body.format.rowHeightPx=38;
  body.getColumn(2).format.font={name:"Arial",size:11,color:"#3758B8",underline:"single"};
  wb.recalculate();
  const unsupported=body.getColumn(2).values.some(row=>String(row[0]).includes("HYPERLINK is not implemented"));
  if(unsupported&&!a.soffice)throw Error("当前Artifact Tool不能计算HYPERLINK缓存，请提供官方运行环境的--soffice；原索引未覆盖");
  const name=path.basename(target),raw=path.join(tmp,name);await (await SpreadsheetFile.exportXlsx(wb)).save(raw);
  let result=raw;
  if(unsupported){
    const out=path.join(tmp,"recalculated");await fs.mkdir(out);
    const run=spawnSync(a.soffice,["-env:UserInstallation="+pathToFileURL(path.join(tmp,"profile")).href,"--headless","--convert-to","xlsx","--outdir",out,raw],{encoding:"utf8",timeout:60000});
    if(run.error||run.status!==0)throw Error("超链接重算失败，原文件未覆盖："+(run.error?.message??run.stderr));
    result=path.join(out,name);await fs.access(result);
  }
  await fs.mkdir(path.dirname(target),{recursive:true});
  const staged=target+".pcqa-tmp";await fs.copyFile(result,staged);await fs.rename(staged,target);
  console.log(JSON.stringify({ok:true,file:target,records:rows.length,action:exists?"upsert":"create",key:[a.version,a.requirement]}));
}finally{await fs.rm(tmp,{recursive:true,force:true})}
