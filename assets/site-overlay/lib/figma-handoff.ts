import { report, type ModuleSeed } from "./report";

type BatchKey = string;

export function figmaNode(url: string) {
  const parsed = new URL(url);
  const parts = parsed.pathname.split("/").filter(Boolean);
  return {fileKey: parts[2] === "branch" ? parts[3] : parts[1], nodeId: (parsed.searchParams.get("node-id") ?? "").replace(/(\d+)-(\d+)/g, "$1:$2")};
}

export function figmaLinks(module: ModuleSeed) {
  return [
    { label: "查看对应 Figma 节点", url: module.figma },
    ...(module.figmaMore ?? []),
  ];
}

export function figmaMcpPrompt(batch: BatchKey, module: ModuleSeed, url: string) {
  const issueIds = module.issues.map((issue) => issue.id.toUpperCase()).join("、");
  return `请使用已连接的 Figma MCP 读取这个设计节点的画面、参数和可读取的 Development 批注（不读取关联评论），再对照我提供的视觉验收 HTML 中「${report[batch].tab} / ${module.title}」的 ${issueIds} 修改前端。请以节点实际数据为准。\n\nImplement this design from Figma.\n@${url}`;
}
