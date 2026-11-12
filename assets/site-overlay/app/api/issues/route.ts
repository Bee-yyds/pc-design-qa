import { NextResponse } from "next/server";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { database, rowToState } from "@/lib/issue-db";
import type { IssueState } from "@/lib/report";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const result = await database()
    .prepare("SELECT issue_id, description, handling_note, repaired, confirmed, revision, updated_by, updated_at FROM issue_state")
    .all();
  const states: Record<string, IssueState> = {};
  for (const row of result.results) {
    const state = rowToState(row as Parameters<typeof rowToState>[0]);
    states[state.issueId] = state;
  }
  return NextResponse.json({ states, actor: { name: user.displayName, email: user.email } });
}
