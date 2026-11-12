import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { webcrypto } from "node:crypto";

// Executes the real component and PATCH handler with isolated in-memory inputs.
const project = path.resolve(process.argv[2] ?? process.cwd());
const require = createRequire(path.join(project, "package.json"));
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
function load(relative, mocks = {}) {
  const filename = path.join(project, relative);
  const code = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    fileName: filename,
  }).outputText;
  const module = { exports: {} };
  Function("require", "module", "exports", "crypto", code)(
    (id) => Object.hasOwn(mocks, id) ? mocks[id] : require(id), module, module.exports, webcrypto,
  );
  return module.exports;
}

const { IssueHistory, historyChanges } = load("app/issue-history.tsx");
const initial = {
  issueId: "isolated-issue", description: "原描述", handlingNote: "", repaired: false, confirmed: false,
  revision: 0, updatedBy: "", updatedAt: "",
};
const record = (changes, revision = 8) => ({
  revision, before: { ...initial }, after: { ...initial, ...changes, revision },
  actorEmail: "tester@example.invalid", changedAt: "2026-10-29T04:00:00Z",
});
function render(history) {
  return renderToStaticMarkup(React.createElement(IssueHistory, { history, originalDescription: "固定原始描述" }));
}
function entry(history) {
  return render(history).match(/<details>[\s\S]*?<\/details>/g)?.join("") ?? "";
}
function check(changes, labels) {
  const item = record(changes);
  const original = JSON.stringify(item);
  const html = entry([item]);
  for (const label of ["问题描述", "处理备注", "研发状态", "设计状态"]) {
    assert.equal(html.includes(label), labels.includes(label), `${label}: ${JSON.stringify(changes)}`);
  }
  assert.ok(html.includes("版本 8") && html.includes("tester@example.invalid") && html.includes("2026"));
  assert.equal(JSON.stringify(item), original, "Rendering must preserve original history");
  return html;
}
assert.ok(check({ description: "新描述" }, ["问题描述"]).includes("新描述"));
assert.ok(check({ handlingNote: "修复说明" }, ["处理备注"]).includes("无 → 修复说明"));
assert.ok(check({ repaired: true }, ["研发状态"]).includes("未标记 → 已修复"));
assert.ok(check({ confirmed: true }, ["设计状态"]).includes("未标记 → 已确认"));
check({ description: "新描述", handlingNote: "说明", repaired: true, confirmed: true }, ["问题描述", "处理备注", "研发状态", "设计状态"]);
for (const [field, label, text] of [["repaired", "研发状态", "已修复 → 未标记"], ["confirmed", "设计状态", "已确认 → 未标记"]]) {
  const item = record({}); item.before[field] = true;
  const html = entry([item]); assert.ok(html.includes(label) && html.includes(text));
  assert.equal(historyChanges(item.before, item.after).length, 1);
}
const clearNote = record({}); clearNote.before.handlingNote = "旧备注";
assert.ok(entry([clearNote]).includes("旧备注 → 无"));
const unchanged = record({ updatedBy: "metadata only", updatedAt: "2026-10-29" }, 4);
assert.equal(historyChanges(unchanged.before, unchanged.after).length, 0);
assert.ok(render([unchanged]).includes("尚无修改记录。"));
assert.equal(entry([unchanged]), "");
const mixed = entry([record({ repaired: true }), unchanged]);
assert.ok(mixed.includes("版本 8") && !mixed.includes("版本 4"));
assert.ok(render([]).includes("尚无修改记录。"));
assert.ok(render(undefined).includes("正在读取修改历史…"));

let state = { ...initial }, writes = 0;
const db = {
  prepare(sql) { return { sql, bind(...values) { return { sql, values, async run() { return {}; } }; } }; },
  async batch(statements) { writes++; assert.equal(statements.length, 2); return [{ meta: { changes: 1 } }, { meta: { changes: 1 } }]; },
};
const { PATCH } = load("app/api/issues/[id]/route.ts", {
  "next/server": { NextResponse: { json: (data, init = {}) => ({ status: init.status ?? 200, data }) } },
  "@/app/chatgpt-auth": { getChatGPTUser: async () => ({ displayName: "Isolated tester", userId: "test-user", email: "tester@example.invalid" }) },
  "@/lib/issue-db": { database: () => db, getIssueState: async () => structuredClone(state) },
  "@/lib/report": { issueSeeds: new Map([[initial.issueId, { originalDescription: initial.description }]]) },
});
const patch = (changes = {}) => PATCH({ json: async () => ({ ...state, expectedRevision: state.revision, ...changes }) }, { params: Promise.resolve({ id: initial.issueId }) });
let result = await patch();
assert.equal(result.status, 200); assert.equal(writes, 0); assert.deepEqual(result.data.state, state);
result = await patch({ description: " 原描述 ", handlingNote: "  " });
assert.equal(result.status, 200); assert.equal(writes, 0); assert.deepEqual(result.data.state, state);
result = await patch({ expectedRevision: state.revision + 1 });
assert.equal(result.status, 409); assert.equal(writes, 0);
result = await patch({ repaired: true });
assert.equal(result.status, 200); assert.equal(writes, 1); assert.equal(result.data.state.revision, 1);
assert.equal(result.data.state.confirmed, false);
console.log(JSON.stringify({ ok: true, cases: ["description", "note and clear", "independent states and undo", "multiple changes", "legacy unchanged records hidden", "original revision actor time preserved", "loading and empty", "real PATCH no-op and conflict", "real PATCH changed status"], storage: "memory only; no hosted data written" }));
