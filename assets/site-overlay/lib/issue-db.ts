import { env } from "cloudflare:workers";
import { initialState, issueSeeds, type IssueState } from "./report";

type IssueRow = {
  issue_id: string;
  description: string;
  handling_note: string;
  repaired: number;
  confirmed: number;
  revision: number;
  updated_by: string;
  updated_at: string;
};

export function database() {
  if (!env.DB) throw new Error("共享数据库暂不可用");
  return env.DB;
}

export function rowToState(row: IssueRow): IssueState {
  return {
    issueId: row.issue_id,
    description: row.description,
    handlingNote: row.handling_note,
    repaired: Boolean(row.repaired),
    confirmed: Boolean(row.confirmed),
    revision: row.revision,
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
  };
}

export async function getIssueState(id: string): Promise<IssueState | null> {
  const seed = issueSeeds.get(id);
  if (!seed) return null;
  const row = await database()
    .prepare("SELECT issue_id, description, handling_note, repaired, confirmed, revision, updated_by, updated_at FROM issue_state WHERE issue_id = ?")
    .bind(id)
    .first<IssueRow>();
  return row ? rowToState(row) : initialState(seed);
}
