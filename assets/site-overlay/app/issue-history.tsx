import type { IssueState } from "@/lib/report";

export type History = {
  revision: number;
  before: IssueState;
  after: IssueState;
  actorEmail: string;
  changedAt: string;
};

type HistoryChange = { field: string; label: string; before: string; after: string };

export function historyChanges(before: IssueState, after: IssueState): HistoryChange[] {
  const changes: HistoryChange[] = [];
  if (before.description !== after.description) {
    changes.push({ field: "description", label: "问题描述", before: before.description, after: after.description });
  }
  if (before.handlingNote !== after.handlingNote) {
    changes.push({ field: "handlingNote", label: "处理备注", before: before.handlingNote || "无", after: after.handlingNote || "无" });
  }
  if (before.repaired !== after.repaired) {
    changes.push({ field: "repaired", label: "研发状态", before: before.repaired ? "已修复" : "未标记", after: after.repaired ? "已修复" : "未标记" });
  }
  if (before.confirmed !== after.confirmed) {
    changes.push({ field: "confirmed", label: "设计状态", before: before.confirmed ? "已确认" : "未标记", after: after.confirmed ? "已确认" : "未标记" });
  }
  return changes;
}

const dateText = (value: string) => value ? new Intl.DateTimeFormat("zh-CN", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)) : "";

export function IssueHistory({ history, originalDescription }: { history?: History[]; originalDescription: string }) {
  const entries = history?.map((item) => ({ item, changes: historyChanges(item.before, item.after) })).filter(({ changes }) => changes.length > 0);
  return <div className="history">
    {!entries ? <p>正在读取修改历史…</p> : entries.length === 0 ? <p>尚无修改记录。</p> : entries.map(({ item, changes }) => <details key={item.revision}>
      <summary>版本 {item.revision} · {item.actorEmail} · {dateText(item.changedAt)}</summary>
      {changes.map((change) => change.field === "description" ? <div key={change.field}>
        <p><b>问题描述 · 修改前：</b>{change.before}</p>
        <p><b>问题描述 · 修改后：</b>{change.after}</p>
      </div> : <p key={change.field}><b>{change.label}：</b>{change.before} → {change.after}</p>)}
    </details>)}
    <p className="original"><b>原始验收描述：</b>{originalDescription}</p>
  </div>;
}
