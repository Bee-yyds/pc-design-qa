import { NextRequest, NextResponse } from "next/server";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { database, getIssueState } from "@/lib/issue-db";
import { issueSeeds, type IssueState } from "@/lib/report";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: Context) {
  const user = await getChatGPTUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const { id } = await context.params;
  const seed = issueSeeds.get(id);
  if (!seed) return NextResponse.json({ error: "问题不存在" }, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求内容不是有效 JSON" }, { status: 400 });
  }
  if (!body || typeof body !== "object") return NextResponse.json({ error: "请求内容无效" }, { status: 400 });
  const data = body as Record<string, unknown>;
  const { description, handlingNote, repaired, confirmed, expectedRevision } = data;
  if (
    typeof description !== "string" ||
    !description.trim() ||
    description.length > 4000 ||
    typeof handlingNote !== "string" ||
    handlingNote.length > 2000 ||
    typeof repaired !== "boolean" ||
    typeof confirmed !== "boolean" ||
    !Number.isInteger(expectedRevision) ||
    (expectedRevision as number) < 0
  ) {
    return NextResponse.json({ error: "请检查问题描述、备注和状态" }, { status: 400 });
  }

  const db = database();
  await db
    .prepare("INSERT OR IGNORE INTO issue_state (issue_id, description, handling_note, repaired, confirmed, revision, updated_by, updated_at, edit_nonce) VALUES (?, ?, '', 0, 0, 0, '', '', '')")
    .bind(id, seed.originalDescription)
    .run();
  const before = await getIssueState(id);
  if (!before) return NextResponse.json({ error: "问题不存在" }, { status: 404 });
  if (before.revision !== expectedRevision) {
    return NextResponse.json({ error: "此问题已被其他人更新，请核对最新内容", current: before }, { status: 409 });
  }
  const next: IssueState = {
    ...before,
    description: description.trim(),
    handlingNote: handlingNote.trim(),
    repaired,
    confirmed,
    revision: before.revision + 1,
    updatedBy: user.displayName,
    updatedAt: new Date().toISOString(),
  };
  if (
    next.description === before.description &&
    next.handlingNote === before.handlingNote &&
    next.repaired === before.repaired &&
    next.confirmed === before.confirmed
  ) return NextResponse.json({ state: before });

  const nonce = crypto.randomUUID();
  const results = await db.batch([
    db.prepare("UPDATE issue_state SET description = ?, handling_note = ?, repaired = ?, confirmed = ?, revision = revision + 1, updated_by = ?, updated_at = ?, edit_nonce = ? WHERE issue_id = ? AND revision = ?")
      .bind(next.description, next.handlingNote, Number(next.repaired), Number(next.confirmed), next.updatedBy, next.updatedAt, nonce, id, expectedRevision),
    db.prepare("INSERT INTO issue_history (issue_id, revision, before_json, after_json, actor_id, actor_email, changed_at) SELECT issue_id, revision, ?, ?, ?, ?, ? FROM issue_state WHERE issue_id = ? AND revision = ? AND edit_nonce = ?")
      .bind(JSON.stringify(before), JSON.stringify(next), user.userId, user.email, next.updatedAt, id, next.revision, nonce),
  ]);
  if (results[0].meta.changes !== 1) {
    return NextResponse.json({ error: "此问题已被其他人更新，请核对最新内容", current: await getIssueState(id) }, { status: 409 });
  }
  return NextResponse.json({ state: next });
}
