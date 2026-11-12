import { NextResponse } from "next/server";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { database } from "@/lib/issue-db";
import { issueSeeds } from "@/lib/report";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  const user = await getChatGPTUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const { id } = await context.params;
  if (!issueSeeds.has(id)) return NextResponse.json({ error: "问题不存在" }, { status: 404 });
  const result = await database()
    .prepare("SELECT revision, before_json, after_json, actor_email, changed_at FROM issue_history WHERE issue_id = ? ORDER BY revision DESC")
    .bind(id)
    .all();
  return NextResponse.json({
    history: result.results.map((row) => ({
      revision: row.revision,
      before: JSON.parse(String(row.before_json)),
      after: JSON.parse(String(row.after_json)),
      actorEmail: row.actor_email,
      changedAt: row.changed_at,
    })),
  });
}
