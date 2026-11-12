import { requireChatGPTUser } from "./chatgpt-auth";
import AuditApp from "./audit-app";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await requireChatGPTUser("/");
  return <AuditApp actorName={user.displayName} />;
}
