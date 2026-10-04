import { z } from 'zod';
export const nodeTypes = ['claim', 'evidence', 'counter', 'note'] as const;
export const categories = ['学习', '工作', '生活', '休息'] as const;
export const categoryColors: Record<string, string> = { '学习': '#4269db', '工作': '#d48624', '生活': '#14927f', '休息': '#8a60bc' };
const id = z.string().min(1).max(80);
const nodeSchema = z.object({ id, type: z.enum(nodeTypes), title: z.string().max(160), body: z.string().max(6000), x: z.number().finite().min(-5000).max(5000), y: z.number().finite().min(-5000).max(5000) });
export const boardSchema = z.object({ title: z.string().max(160), nodes: z.array(nodeSchema).max(150), edges: z.array(z.object({ id, from: id, to: id })).max(500) }).superRefine((b, ctx) => {
  const ids = new Set(b.nodes.map(n => n.id)); if (ids.size !== b.nodes.length) ctx.addIssue({ code: 'custom', message: '卡片编号重复' });
  if (new Set(b.edges.map(e => e.id)).size !== b.edges.length) ctx.addIssue({ code: 'custom', message: '连线编号重复' });
  const pairs = new Set<string>(); for (const e of b.edges) { const pair = `${e.from}:${e.to}`; if (!ids.has(e.from) || !ids.has(e.to) || e.from === e.to || pairs.has(pair)) ctx.addIssue({ code: 'custom', message: '连线无效或重复' }); pairs.add(pair); }
});
const timestamp = z.number().finite().min(0).max(4102444800000);
const entrySchema = z.object({ id, title: z.string().min(1).max(160), category: z.enum(categories), start: timestamp, end: timestamp }).refine(e => e.end > e.start && e.end - e.start <= 7 * 86400000, '结束时间须晚于开始时间，单条记录不超过七天');
export const timeSchema = z.object({ entries: z.array(entrySchema).max(5000), active: z.object({ id, title: z.string().min(1).max(160), category: z.enum(categories), start: timestamp }).nullable(), goal: z.number().int().min(0).max(1440) }).superRefine((t, ctx) => {
  if (new Set(t.entries.map(e => e.id)).size !== t.entries.length) ctx.addIssue({ code: 'custom', message: '记录编号重复' });
  if (t.active && t.entries.some(e => e.id === t.active!.id)) ctx.addIssue({ code: 'custom', message: '计时编号重复' });
  const sorted = [...t.entries].sort((a,b) => a.start-b.start);
  if (sorted.some((e,i) => i>0 && e.start < sorted[i-1].end)) ctx.addIssue({ code: 'custom', message: '时间记录不能重叠' });
  if (t.active && sorted.some(e => e.end > t.active!.start)) ctx.addIssue({ code: 'custom', message: '进行中的计时与记录重叠' });
});
export type BoardData = z.infer<typeof boardSchema>; export type NodeData = BoardData['nodes'][number];
export type TimeData = z.infer<typeof timeSchema>; export type TimeEntry = TimeData['entries'][number]; export type Category = typeof categories[number];
export const emptyBoard: BoardData = { title: '我的观点板', nodes: [], edges: [] };
export const emptyTime: TimeData = { entries: [], active: null, goal: 120 };
export const makeId = () => crypto.randomUUID();
export function sampleBoard(): BoardData { return { title: '大学生是否应该开始记账？', nodes: [
  { id: 'claim', type: 'claim', title: '记账帮助理解自己的消费习惯', body: '先记录，再判断。关注消费结构，而非一味压缩开支。', x: 330, y: 70 },
  { id: 'evidence', type: 'evidence', title: '证据：区分固定与可变支出', body: '整理一个月的餐饮、交通与娱乐开支，比较各类占比。\n待补：个人账本数据与资料来源。', x: 70, y: 330 },
  { id: 'counter', type: 'counter', title: '反例：逐笔记录可能难以坚持', body: '如果记录成本过高，可以每周汇总一次，而不是追求每笔都记。', x: 600, y: 330 },
  { id: 'note', type: 'note', title: '结论：先做四周实验', body: '每周复盘一次，观察是否真的改善了消费决策。', x: 330, y: 590 },
], edges: [{ id: 'e1', from: 'claim', to: 'evidence' }, { id: 'e2', from: 'claim', to: 'counter' }, { id: 'e3', from: 'claim', to: 'note' }] }; }
export const typeLabels = { claim: '论点', evidence: '证据', counter: '反例', note: '笔记' };
export function outline(b: BoardData): string { const visited = new Set<string>(); const lines = [`# ${b.title || '观点提纲'}`, ''];
  const walk = (n: NodeData, depth: number) => { if (visited.has(n.id)) return; visited.add(n.id); lines.push(`${'  '.repeat(depth)}- 【${typeLabels[n.type]}】${n.title || '未命名卡片'}`); if (n.body) lines.push(...n.body.split('\n').map(l => `${'  '.repeat(depth + 1)}${l}`)); for (const e of b.edges.filter(e => e.from === n.id)) { const child = b.nodes.find(x => x.id === e.to); if (child) walk(child, depth + 1); } };
  b.nodes.filter(n => !b.edges.some(e => e.to === n.id)).forEach(n => walk(n, 0)); b.nodes.forEach(n => walk(n, 0)); return lines.join('\n');
}
export type ParsedTable = { headers: string[]; rows: string[][]; numericColumns: number[] };
export function numberValue(value: string): number | null { const s = value.trim().replace(/,/g, ''); if (!s || !/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(s)) return null; const n = Number(s); return Number.isFinite(n) && Math.abs(n) < 1e15 ? n : null; }
// Quoted CSV, escaped quotes and CRLF are accepted; Excel paste uses tabs.
export function parseTable(text: string): ParsedTable {
  if (text.length > 1000000) throw Error('数据过大，请缩减到 1 MB 以内。');
  const delimiter = (text.split(/\r?\n/)[0] || '').includes('\t') ? '\t' : ',';
  const rows: string[][] = []; let row: string[] = [], cell = '', quoted = false;
  const pushRow = () => { row.push(cell.trim()); cell = ''; if (row.some(v => v !== '')) rows.push(row); row = []; };
  for (let i = 0; i < text.length; i++) { const c = text[i]; if (c === '"') { if (quoted && text[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted; } else if (!quoted && c === delimiter) { row.push(cell.trim()); cell = ''; } else if (!quoted && (c === '\n' || c === '\r')) { if (c === '\r' && text[i + 1] === '\n') i++; pushRow(); } else cell += c; }
  if (quoted) throw Error('有未闭合的双引号，请检查 CSV。'); pushRow();
  if (rows.length < 2) throw Error('请粘贴表头和至少一行数据。');
  const headers = rows.shift()!; if (headers.length < 2 || headers.length > 20) throw Error('需要 2–20 列：至少一列名称、一列数值。');
  if (rows.length > 200) throw Error('一次最多绘制 200 行，请先筛选数据。');
  if (headers.some(x => !x) || new Set(headers).size !== headers.length) throw Error('表头不能为空或重复。');
  if (rows.some(r => r.length !== headers.length)) throw Error('每行列数须与表头一致；逗号分隔的名称请用双引号包住。');
  const numericColumns = headers.map((_, i) => i).filter(i => rows.every(r => numberValue(r[i]) !== null));
  if (!numericColumns.length) throw Error('没有完整的数值列；请去掉单位、百分号或补全空值。');
  return { headers, rows, numericColumns };
}
export function localDate(d = new Date()): string { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
export function dayBounds(day: string): [number, number] { const start = new Date(`${day}T00:00:00`); const end = new Date(start); end.setDate(end.getDate() + 1); return [+start, +end]; }
export function dayEntries(entries: TimeEntry[], day: string): TimeEntry[] { const [a, b] = dayBounds(day); return entries.filter(e => e.start < b && e.end > a).map(e => ({ ...e, start: Math.max(a, e.start), end: Math.min(b, e.end) })); }
export function minutes(entries: TimeEntry[]): number { return entries.reduce((s, e) => s + (e.end - e.start) / 60000, 0); }
export function overlaps(entries: TimeEntry[], start: number, end: number, except?: string): boolean { return entries.some(e => e.id !== except && start < e.end && end > e.start); }
export function duration(ms: number): string { const s = Math.max(0, Math.floor(ms / 1000)); return `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; }
