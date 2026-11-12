import raw from "@/data/report.json";

export type IssueEvidence = { dev: string; design: string; marks: [number, number, number][]; devDisplayWidth?: number };
export type IssueSeed = { id: string; originalDescription: string; evidence?: IssueEvidence };
export type Capture = { width: number; height: number; capturedAt: string; state: string; dpr?: number };
export type ModuleSeed = {
  id: string; reviewOrder?: number; title: string; figma: string; figmaMore?: {label:string;url:string}[];
  dev: string; design: string; devDisplayWidth?: number; marks: [number,number,number][];
  facts: string; issues: IssueSeed[]; capture: {dev:Capture;design:Capture};
};
export type BatchSeed = { tab:string;title:string;source:string;link:string;modules:ModuleSeed[];pending:[string,string][] };
export type ReportProject = { schemaVersion:1;version:string;requirement:string;onlineUrl:string;batches:Record<string,BatchSeed> };
// Report JSON is checked by scripts/validate-report.mjs before building.
export const project = raw as unknown as ReportProject;
export const report = project.batches;
export const batchKeys = Object.keys(report);
export const issueSeeds = new Map(Object.values(report).flatMap(b => b.modules.flatMap(m => m.issues.map(i => [i.id,i] as const))));
export type IssueState = { issueId:string;description:string;handlingNote:string;repaired:boolean;confirmed:boolean;revision:number;updatedBy:string;updatedAt:string };
export function initialState(issue:IssueSeed):IssueState {
  return {issueId:issue.id,description:issue.originalDescription,handlingNote:"",repaired:false,confirmed:false,revision:0,updatedBy:"",updatedAt:""};
}

export function getReportSummary(states: Record<string, IssueState>) {
  const modules = Object.values(report).flatMap((batch) => batch.modules);
  const issues = modules.flatMap((module) => module.issues);
  return {
    moduleCount: modules.length,
    issueCount: issues.length,
    repairedCount: issues.filter((issue) => states[issue.id]?.repaired).length,
    confirmedCount: issues.filter((issue) => states[issue.id]?.confirmed).length,
  };
}

export function getIssueEvidence(module: ModuleSeed, issue?: IssueSeed) {
  return issue?.evidence ?? module;
}
