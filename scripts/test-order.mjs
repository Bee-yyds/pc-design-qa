import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const project = path.resolve(process.argv[2] ?? process.cwd());
const require = createRequire(path.join(project, "package.json"));
const ts = require("typescript");
function load(relative, mocks = {}) {
  const filename = path.join(project, relative);
  const code = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }, fileName: filename,
  }).outputText;
  const module = { exports: {} };
  Function("require", "module", "exports", code)((id) => Object.hasOwn(mocks, id) ? mocks[id] : require(id), module, module.exports);
  return module.exports;
}
const ordering = load("lib/report-order.ts");
const { getOrderedModules, tabForHash } = ordering;
const module = (id, reviewOrder) => ({ id, reviewOrder, issues: [{ id: `${id}-issue` }] });
const ids = (items, mode = "default", states = {}) => getOrderedModules(items, mode, states).map(({ module }) => module.id);
const legacy = [module("a"), module("b"), module("c")];
assert.deepEqual(ids(legacy), ["c", "b", "a"]);
assert.deepEqual(getOrderedModules(legacy, "default", {}).map((x) => x.originalIndex), [2, 1, 0]);
const modules = [module("a", 1), module("b", 2), module("c", 3)];
assert.deepEqual(ids(modules), ["c", "b", "a"]);
modules.push(module("d", 4));
assert.deepEqual(ids(modules), ["d", "c", "b", "a"]);
modules[0].reviewOrder = 5; // A completed reinspection is written to report metadata.
assert.deepEqual(ids(modules), ["a", "d", "c", "b"]);
const original = JSON.stringify(modules);
const states = Object.fromEntries(modules.map((m) => [m.issues[0].id, { repaired: true, description: "edited", handlingNote: "note", updatedAt: "2099-01-01" }]));
states["b-issue"].repaired = false; states["c-issue"].repaired = false;
assert.deepEqual(ids(modules, "default", states), ["a", "d", "c", "b"]);
assert.deepEqual(ids(modules, "unrepaired", states), ["c", "b", "a", "d"]);
states["b-issue"].repaired = true;
assert.deepEqual(ids(modules, "unrepaired", states), ["c", "a", "d", "b"]);
assert.deepEqual(ids(modules, "default", JSON.parse(JSON.stringify(states))), ["a", "d", "c", "b"]);
assert.equal(JSON.stringify(modules), original, "Sorting must preserve source array, metadata and original numbering");
assert.deepEqual(ids([module("a", 1), module("b", 1)]), ["b", "a"]);
assert.deepEqual(ids([module("a", -1), module("b", NaN)]), ["b", "a"]);
assert.deepEqual(ids([]), []);

const raw = JSON.parse(fs.readFileSync(path.join(project, "data/report.json"), "utf8"));
const data = load("lib/report.ts", { "@/data/report.json": { default: raw } });
const evidenceModule = {dev:"/old-dev.png",design:"/old-design.png",marks:[[1,20,30]],issues:[]};
const evidenceIssue = {id:"retest",originalDescription:"isolated",evidence:{dev:"/new-dev.png",design:"/new-design.png",marks:[[2,30,40]],devDisplayWidth:260}};
assert.equal(data.getIssueEvidence(evidenceModule),evidenceModule);
assert.equal(data.getIssueEvidence(evidenceModule,{id:"legacy",originalDescription:"isolated"}),evidenceModule);
assert.equal(data.getIssueEvidence(evidenceModule,evidenceIssue),evidenceIssue.evidence);
assert.equal(evidenceModule.dev,"/old-dev.png");
const batchKeys = Object.keys(data.report);
assert.deepEqual(data.batchKeys, batchKeys);
assert.equal(tabForHash("", batchKeys), batchKeys[0]);
assert.equal(tabForHash("#missing", batchKeys), batchKeys[0]);
assert.equal(tabForHash("#%E0%A4", batchKeys), batchKeys[0]);
for (const key of batchKeys) assert.equal(tabForHash(`#${encodeURIComponent(key)}`, batchKeys), key);
const augmented = { ...data.report, "new-batch": { modules: [module("fresh", 100)] } };
assert.deepEqual(Object.keys(augmented), [...batchKeys, "new-batch"]);
assert.equal(tabForHash("#new%2Dbatch", Object.keys(augmented)), "new-batch");

const allIssues = Object.values(data.report).flatMap((b) => b.modules.flatMap((m) => m.issues));
const reportStates = Object.fromEntries(allIssues.map((i, n) => [i.id, { repaired: n % 2 === 0, confirmed: n % 3 === 0 }]));
const summary = data.getReportSummary(reportStates);
for (const batch of Object.values(data.report)) for (const mode of ["default", "unrepaired"]) getOrderedModules(batch.modules, mode, reportStates);
assert.deepEqual(data.getReportSummary(reportStates), summary);
assert.equal(summary.issueCount, allIssues.length);
assert.equal(summary.repairedCount, allIssues.filter((i) => reportStates[i.id].repaired).length);

const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { AuditApp, default: App } = load("app/audit-app.tsx", {
  "@/lib/report": data, "@/lib/report-order": ordering,
  "./issue-history": load("app/issue-history.tsx"),
  "@/lib/figma-handoff": { figmaLinks: () => [], figmaMcpPrompt: () => "isolated" },
});
const html = renderToStaticMarkup(React.createElement(App ?? AuditApp, { actorName: "Isolated tester" }));
const nav = html.match(/<nav[\s\S]*?<\/nav>/)[0];
let previous = -1;
for (const key of batchKeys) {
  const position = nav.indexOf(`>${data.report[key].tab}</button>`);
  assert.ok(position > previous); previous = position;
}
const shownNumbers = [...html.matchAll(/<span class="index">(\d+)<\/span>/g)].map((m) => Number(m[1]));
assert.deepEqual(shownNumbers, getOrderedModules(data.report[batchKeys[0]].modules, "default", {}).map((m) => m.originalIndex + 1));
console.log(JSON.stringify({ ok: true, cases: ["legacy reverse", "new module first", "reinspection first", "same-round order", "edits and flags do not change default order", "unrepaired groups newest first", "immutable source and numbering", "batch append and hash selection", "refresh roundtrip", "global totals unchanged", "actual initial page rendering"], current: { tabs: batchKeys, firstNumbers: shownNumbers.slice(0, 4), summary }, storage: "isolated inputs only" }));
