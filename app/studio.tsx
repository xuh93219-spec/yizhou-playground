'use client';
import { useEffect, useState } from 'react';
import { BarChart3, Network, Clock3, PanelTop, Check, HardDrive, AlertCircle } from 'lucide-react';
import DataStudio from './tools/data-studio';
import IdeaBoard from './tools/idea-board';
import TimeLedger from './tools/time-ledger';
import { Toaster } from '@/components/ui/sonner';
import { useDocument } from './tools/shared';
import { emptyBoard, emptyTime } from '@/lib/studio-model';
const tools = [{ id: 'data', label: '数据小画室', icon: BarChart3, number: '01' }, { id: 'ideas', label: '观点整理板', icon: Network, number: '02' }, { id: 'time', label: '时间账本', icon: Clock3, number: '03' }];
export default function Studio() {
  const [tab, setTab] = useState('data'); const board = useDocument('board', emptyBoard); const time = useDocument('time', emptyTime);
  useEffect(() => { const read = () => setTab(tools.some(t => t.id === location.hash.slice(1)) ? location.hash.slice(1) : 'data'); read(); window.addEventListener('hashchange', read); return () => window.removeEventListener('hashchange', read); }, []);
  const current = tab === 'ideas' ? board : tab === 'time' ? time : null;
  return <div className={`studio theme-${tab}`}><aside className="rail"><a className="brand" href="#data" aria-label="一舟工具室首页"><span className="brand-icon"><PanelTop size={21}/></span><span>一舟<span className="brand-sub">工具室</span></span></a><div className="rail-label">日常的小帮手</div><nav aria-label="工具导航">{tools.map(t => <a key={t.id} href={`#${t.id}`} className={`nav-item ${tab === t.id ? 'active' : ''}`} aria-current={tab === t.id ? 'page' : undefined}><t.icon size={20}/><span>{t.label}</span><small>{t.number}</small></a>)}</nav><div className="rail-bottom"><span className="tiny-grid">✦</span><p>把事情<br/>慢慢理清楚。</p><small>数据 · 想法 · 时间</small></div></aside>
    <div className="workspace"><header className="topbar"><span className="breadcrumb">工具室 <span>/</span> {tools.find(t => t.id === tab)?.label}</span><span className={`save-state ${current?.status === 'error' || current?.status === 'conflict' ? 'bad' : ''}`}>{!current ? <><Check size={15}/> 数据在页面内处理</> : current.status === 'saved' ? <><HardDrive size={15}/> 本机已保存</> : current.status === 'error' || current.status === 'conflict' ? <><AlertCircle size={15}/> 尚未保存</> : <><HardDrive size={15}/> {current.status === 'loading' ? '读取中' : '保存中'}</>}</span></header>
      <main><div hidden={tab !== 'data'}><DataStudio/></div><div hidden={tab !== 'ideas'}><IdeaBoard doc={board}/></div><div hidden={tab !== 'time'}><TimeLedger doc={time}/></div></main><footer className="workspace-footer">一舟工具室 <span>记录仅保存在此浏览器 · 换设备请导出备份</span></footer></div><Toaster position="bottom-right" richColors/></div>;
}
