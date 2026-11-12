"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { IssueHistory, type History } from "./issue-history";
import { getOrderedModules, tabForHash, type SortMode } from "@/lib/report-order";
import { getIssueEvidence, getReportSummary, initialState, report, project, batchKeys, type IssueSeed, type IssueState, type ModuleSeed } from "@/lib/report";
import { figmaLinks, figmaMcpPrompt } from "@/lib/figma-handoff";

type BatchKey = string;
type Draft = { description: string; handlingNote: string; revision: number };
type Zoom = { src: string; title: string; marks: [number, number, number][] };
const errorText = (error: unknown) => error instanceof Error ? error.message : "保存失败";
const dateText = (value: string) => value ? new Intl.DateTimeFormat("zh-CN", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)) : "";

export default function AuditApp({ actorName }: { actorName: string }) {
  const [tab, setTab] = useState<BatchKey>(batchKeys[0]);
  const [sortMode, setSortMode] = useState<SortMode>("default");
  const [states, setStates] = useState<Record<string, IssueState>>({});
  const [loaded, setLoaded] = useState(false);
  const [pageError, setPageError] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [conflicts, setConflicts] = useState<Record<string, IssueState>>({});
  const [openHistory, setOpenHistory] = useState<Record<string, boolean>>({});
  const [history, setHistory] = useState<Record<string, History[]>>({});
  const [zoom, setZoom] = useState<Zoom | null>(null);
  const [activeIssues, setActiveIssues] = useState<Record<string, number>>({});
  const [copiedFigma, setCopiedFigma] = useState("");
  const [handoffError, setHandoffError] = useState("");
  const batch = report[tab];
  const orderedModules = useMemo(() => getOrderedModules(batch.modules, sortMode, states), [batch, sortMode, states]);

  useEffect(() => {
    const update = () => setTab(tabForHash(location.hash, batchKeys));
    update();
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/issues", { cache: "no-store" });
      if (!response.ok) throw new Error("无法读取共享状态");
      const data = await response.json() as { states: Record<string, IssueState> };
      setStates(data.states);
      setPageError("");
    } catch (error) { setPageError(errorText(error)); }
    finally { setLoaded(true); }
  }, []);
  useEffect(() => {
    void refresh();
    const timer = setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, 15000);
    window.addEventListener("focus", refresh);
    return () => { clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, [refresh]);
  useEffect(() => {
    if (!zoom) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setZoom(null); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [zoom]);
  const { moduleCount, issueCount, repairedCount, confirmedCount } = useMemo(() => getReportSummary(states), [states]);
  const current = (issue: IssueSeed) => states[issue.id] ?? initialState(issue);
  const select = (key: BatchKey) => { location.hash = key; setTab(key); };
  async function copyFigmaPrompt(module: ModuleSeed, url: string) {
    try {
      await navigator.clipboard.writeText(figmaMcpPrompt(tab, module, url));
      setCopiedFigma(url);
      setHandoffError("");
    } catch { setHandoffError("无法访问剪贴板，请展开下方提示词后手动复制。"); }
  }
  function edit(issue: IssueSeed) {
    const state = current(issue);
    setEditing(issue.id);
    setDraft({ description: state.description, handlingNote: state.handlingNote, revision: state.revision });
    setErrors((old) => ({ ...old, [issue.id]: "" }));
  }
  async function save(issue: IssueSeed, values: Draft & { repaired: boolean; confirmed: boolean }, finish: boolean) {
    setBusy(issue.id);
    setErrors((old) => ({ ...old, [issue.id]: "" }));
    try {
      const response = await fetch(`/api/issues/${encodeURIComponent(issue.id)}`, {
        method: "PATCH", headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...values, expectedRevision: values.revision }),
      });
      const data = await response.json() as { current?: IssueState; error?: string; state?: IssueState };
      if (response.status === 409) {
        const latest = data.current;
        if (latest) {
          setStates((old) => ({ ...old, [issue.id]: latest }));
          setConflicts((old) => ({ ...old, [issue.id]: latest }));
        }
        throw new Error("其他人已更新此问题。你的输入仍保留，请核对最新内容。");
      }
      if (!response.ok || !data.state) throw new Error(data.error || "保存失败");
      const saved = data.state;
      setStates((old) => ({ ...old, [issue.id]: saved }));
      setConflicts((old) => { const next = { ...old }; delete next[issue.id]; return next; });
      setHistory((old) => { const next = { ...old }; delete next[issue.id]; return next; });
      if (finish) { setEditing(null); setDraft(null); }
    } catch (error) { setErrors((old) => ({ ...old, [issue.id]: errorText(error) })); }
    finally { setBusy(null); }
  }
  function toggle(issue: IssueSeed, field: "repaired" | "confirmed") {
    if (editing === issue.id || busy === issue.id) return;
    const value = current(issue);
    void save(issue, {
      description: value.description, handlingNote: value.handlingNote, revision: value.revision,
      repaired: field === "repaired" ? !value.repaired : value.repaired,
      confirmed: field === "confirmed" ? !value.confirmed : value.confirmed,
    }, false);
  }
  async function toggleHistory(issue: IssueSeed) {
    const opening = !openHistory[issue.id];
    setOpenHistory((old) => ({ ...old, [issue.id]: opening }));
    if (!opening || history[issue.id]) return;
    try {
      const response = await fetch(`/api/issues/${encodeURIComponent(issue.id)}/history`, { cache: "no-store" });
      if (!response.ok) throw new Error("读取历史失败");
      const data = await response.json() as { history: History[] };
      setHistory((old) => ({ ...old, [issue.id]: data.history }));
    } catch (error) { setErrors((old) => ({ ...old, [issue.id]: errorText(error) })); }
  }
  function shot(module: ModuleSeed, kind: "dev" | "design", evidence: Pick<ModuleSeed, "dev" | "design" | "marks" | "devDisplayWidth"> = module) {
    const dev = kind === "dev", title = `${module.title} · ${dev ? "研发页面" : "Figma 设计稿"}`;
    return <section className="shotcol">
      <div className="shotlabel">{dev ? "前端研发页面" : "Figma 设计稿"}<span>{dev ? "红色序号对应下方问题" : "原始节点截图"}</span></div>
      <button className="shot" onClick={() => setZoom({ src: evidence[kind], title, marks: dev ? evidence.marks : [] })} aria-label={`放大${title}`}>
        <span className="imgbox"><img src={evidence[kind]} alt={title} style={dev && evidence.devDisplayWidth ? { width: evidence.devDisplayWidth } : undefined} />{dev && evidence.marks.map(([n,x,y]) => <i className="badge" key={n} style={{ left: `${x}%`, top: `${y}%` }}>{n}</i>)}</span>
      </button>
      <div className="shotfoot">原始像素截图 · 点击放大</div>
    </section>;
  }
  function issueView(issue: IssueSeed, index: number, tabbed: boolean) {
    const value = current(issue), isEditing = editing === issue.id, isBusy = busy === issue.id;
    const conflict = conflicts[issue.id];
    return <section className="issue" key={issue.id} id={issue.id} role={tabbed ? "tabpanel" : undefined} aria-labelledby={tabbed ? `issue-tab-${issue.id}` : undefined}>
      <span className="num">{index + 1}</span>
      <div className="issuebody">
        <div className="issue-top"><span className="issue-id">{issue.id.toUpperCase()}</span><span>{value.updatedAt ? `最近由 ${value.updatedBy} 修改 · ${dateText(value.updatedAt)}` : "原始验收记录"}</span></div>
        {isEditing && draft ? <div className="edit-fields">
          <label>问题描述<textarea value={draft.description} maxLength={4000} rows={5} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></label>
          <label>研发处理备注<textarea value={draft.handlingNote} maxLength={2000} rows={3} placeholder="记录修改内容或需设计复核的地方" onChange={(e) => setDraft({ ...draft, handlingNote: e.target.value })} /></label>
          <div className="edit-actions"><button className="primary-action" disabled={isBusy || !draft.description.trim()} onClick={() => void save(issue, { ...draft, repaired: value.repaired, confirmed: value.confirmed }, true)}>{isBusy ? "保存中…" : "保存修改"}</button><button className="subtle-action" disabled={isBusy} onClick={() => { setEditing(null); setDraft(null); }}>取消</button></div>
        </div> : <><p className="issue-description">{value.description}</p>{value.handlingNote && <p className="handling-note"><b>处理备注：</b>{value.handlingNote}</p>}</>}
        {conflict && <div className="conflict"><b>服务器最新描述：</b>{conflict.description}<button onClick={() => { if (draft && isEditing) setDraft({ ...draft, revision: conflict.revision }); setConflicts((old) => { const next = { ...old }; delete next[issue.id]; return next; }); }}>已核对，继续编辑</button></div>}
        {errors[issue.id] && <p className="field-error" role="alert">{errors[issue.id]}</p>}
        <div className="issue-actions">
          <button className={value.repaired ? "state-button repaired" : "state-button"} aria-pressed={value.repaired} disabled={isBusy || isEditing} onClick={() => toggle(issue, "repaired")}>{value.repaired ? "✓ 研发已修复" : "○ 研发标记已修复"}</button>
          <button className={value.confirmed ? "state-button confirmed" : "state-button"} aria-pressed={value.confirmed} disabled={isBusy || isEditing} onClick={() => toggle(issue, "confirmed")}>{value.confirmed ? "✓ 设计已确认" : "○ 设计标记已确认"}</button>
          <span className="action-spacer" />
          {!isEditing && <button className="text-action" disabled={isBusy} onClick={() => edit(issue)}>编辑描述与备注</button>}
          <button className="text-action" onClick={() => void toggleHistory(issue)}>{openHistory[issue.id] ? "收起历史" : "查看历史"}</button>
        </div>
        {openHistory[issue.id] && <IssueHistory history={history[issue.id]} originalDescription={issue.originalDescription} />}
      </div>
    </section>;
  }
  return <>
    <header className="hero"><div className="eyebrow">{project.version} · UI DESIGN QA</div><h1>{project.requirement} · 视觉还原验收</h1><div className="summary"><span className="chip"><b>{moduleCount}</b> 个差异模块</span><span className="chip"><b>{issueCount}</b> 项视觉问题</span><span className="chip"><b>{repairedCount}</b> 项研发已修复</span><span className="chip"><b>{confirmedCount}</b> 项设计已确认</span></div><div className="hero-handoff"><div className="toolbar"><span>{batch.source} · 当前登录：{actorName}</span><div className="toolbar-actions"><a href={batch.link} target="_blank" rel="noopener noreferrer">打开开发页面 ↗</a></div></div><p className="mcp-note">在线验收页包含本需求全部批次的问题、截图、节点链接和 MCP 提示词。每个 Figma 节点均可复制对应提示词；使用者需已连接 Figma MCP，并拥有设计文件访问权限。</p></div></header>
    <nav className="batchtabs" aria-label="验收批次">{batchKeys.map(key => <button key={key} className={tab === key ? "active" : ""} aria-current={tab === key ? "page" : undefined} onClick={() => select(key)}>{report[key].tab}</button>)}<span className="tab-spacer" /><label className="sort-control"><span>排序</span><select aria-label="问题排序" value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)}><option value="default">默认</option><option value="unrepaired">未修复</option></select></label><span className="sync-label">{pageError ? "同步异常" : loaded ? "在线同步中" : "正在连接…"}</span><button className="refresh-button" onClick={() => void refresh()}>刷新状态</button></nav>
    <main className="wrap">{handoffError && <div className="page-error" role="alert">{handoffError}</div>}{pageError && <div className="page-error" role="alert">{pageError}。请检查网络后刷新。</div>}
      {orderedModules.map(({module, originalIndex}) => {
        const activeIndex = Math.min(activeIssues[module.id] ?? 0, module.issues.length - 1);
        const activeIssue = module.issues[activeIndex];
        const evidence = getIssueEvidence(module, activeIssue);
        return <article className="card" key={module.id}><div className="cardhead"><div className="titleline"><span className="index">{String(originalIndex+1).padStart(2,"0")}</span><h2>{module.title}</h2></div><div className="figma-links">{figmaLinks(module).map(({label,url}) => <div className="figma-link-row" key={url}><a className="meta" href={url} target="_blank" rel="noopener noreferrer">{label} ↗</a><button type="button" onClick={() => void copyFigmaPrompt(module,url)}>{copiedFigma === url ? "已复制 MCP 提示词" : "复制 MCP 提示词"}</button></div>)}</div></div><details className="mcp-details"><summary>给 ChatGPT 的 Figma MCP 提示词 · {figmaLinks(module).length} 个节点</summary>{figmaLinks(module).map(({label,url}) => <div className="mcp-node" key={url}><b>{label}</b><pre>{figmaMcpPrompt(tab,module,url)}</pre></div>)}</details><div className="comparison">{shot(module,"dev",evidence)}{shot(module,"design",evidence)}</div><div className="issues"><div className="issue-heading"><h3>视觉差异 · {module.issues.length} 项</h3>{module.issues.length > 1 && <div className="issue-tabs" role="tablist" aria-label={`${module.title}的问题序号`}>{module.issues.map((issue,issueIndex) => <button key={issue.id} type="button" role="tab" id={`issue-tab-${issue.id}`} aria-controls={issue.id} aria-selected={activeIndex===issueIndex} onClick={() => setActiveIssues(old => ({...old,[module.id]:issueIndex}))}>{issueIndex+1}</button>)}</div>}</div>{activeIssue && issueView(activeIssue,activeIndex,module.issues.length>1)}</div></article>;
      })}
    </main>
    {zoom && <div className="lightbox" role="dialog" aria-modal="true" aria-label={zoom.title} onClick={() => setZoom(null)}><div className="lbbar"><b>{zoom.title}</b><button onClick={() => setZoom(null)}>关闭 ×</button></div><div className="lbimg" onClick={(e) => e.stopPropagation()}><div className="imgbox"><img src={zoom.src} alt={zoom.title} />{zoom.marks.map(([n,x,y]) => <i className="badge" key={n} style={{ left: `${x}%`, top: `${y}%` }}>{n}</i>)}</div></div></div>}
  </>;
}
