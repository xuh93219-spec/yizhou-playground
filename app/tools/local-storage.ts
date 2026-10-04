import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { boardSchema, timeSchema } from '@/lib/studio-model';
import type { Doc } from './shared';
const DB_NAME = 'yizhou-playground-tools-v1';
let opening: Promise<IDBDatabase> | null = null;
function database(): Promise<IDBDatabase> {
  if (opening) return opening;
  opening = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('documents', { keyPath: 'kind' });
    request.onsuccess = () => { const db = request.result; db.onversionchange = () => { db.close(); opening = null; }; resolve(db); };
    request.onerror = () => { opening = null; reject(request.error); };
    request.onblocked = () => { opening = null; reject(Error('请关闭另一处工具室页面，再重试。')); };
  });
  return opening;
}
export async function readDocument<T>(kind: string): Promise<{ data: T | null; revision: number }> {
  const db = await database();
  return new Promise((resolve, reject) => { const request = db.transaction('documents', 'readonly').objectStore('documents').get(kind);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => { const row = request.result; if (!row) { resolve({ data: null, revision: 0 }); return; } const result = (kind === 'board' ? boardSchema : timeSchema).safeParse(row.data); if (!result.success || !Number.isInteger(row.revision) || row.revision < 1) { reject(Error('本机记录格式无效，请从备份恢复。')); return; } resolve({ data: result.data as T, revision: row.revision }); };
  });
}
export async function writeDocument<T>(kind: string, data: T, revision: number): Promise<number> {
  const parsed = (kind === 'board' ? boardSchema : timeSchema).safeParse(data); if (!parsed.success) throw Error(parsed.error.issues[0]?.message || '记录无效');
  const db = await database();
  return new Promise((resolve, reject) => { const tx = db.transaction('documents', 'readwrite'), store = tx.objectStore('documents'); let failure: Error | null = null; const request = store.get(kind);
    request.onsuccess = () => { if ((request.result?.revision ?? 0) !== revision) { failure = Error('VERSION_CONFLICT'); tx.abort(); return; } store.put({ kind, data: parsed.data, revision: revision + 1 }); };
    tx.oncomplete = () => resolve(revision + 1);
    tx.onabort = () => reject(failure || tx.error || Error('浏览器保存失败'));
    tx.onerror = () => reject(tx.error || Error('浏览器保存失败'));
  });
}
export function useLocalDocument<T>(kind: string, initial: T): Doc<T> {
  const [data, setData] = useState(initial), [status, setStatus] = useState<Doc<T>['status']>('loading'), [ready, setReady] = useState(false), [tick, setTick] = useState(0);
  const ref = useRef(data), revision = useRef(0), generation = useRef(0), savedGen = useRef(0), saving = useRef(false), stopped = useRef(false), mounted = useRef(true), channel = useRef<BroadcastChannel | null>(null);
  const reload = useCallback(async () => { setStatus('loading'); try { const row = await readDocument<T>(kind); if (!mounted.current) return; ref.current = row.data ?? initial; revision.current = row.revision; generation.current = savedGen.current = 0; stopped.current = false; setData(ref.current); setReady(true); setStatus('saved'); } catch { if (mounted.current) { setReady(false); setStatus('error'); } } }, [kind, initial]);
  useEffect(() => { mounted.current = true; void reload(); if (typeof BroadcastChannel !== 'undefined') { const c = new BroadcastChannel('yizhou-playground-tools'); channel.current = c; c.onmessage = e => { if (e.data?.kind !== kind) return; if (generation.current !== savedGen.current) { stopped.current = true; setStatus('conflict'); toast.error('另一页面更新了记录。请先导出本页备份，再读取最新版本。'); } else void reload(); }; } return () => { mounted.current = false; channel.current?.close(); channel.current = null; }; }, [reload, kind]);
  const update = useCallback((value: T | ((old: T) => T)) => { if (!ready) return; const next = typeof value === 'function' ? (value as (old: T) => T)(ref.current) : value; ref.current = next; generation.current++; setData(next); if (!stopped.current) setStatus('saving'); setTick(t => t + 1); }, [ready]);
  useEffect(() => { if (!ready || stopped.current || generation.current === savedGen.current) return; const timer = setTimeout(async () => { if (saving.current || stopped.current) return; saving.current = true; const gen = generation.current, snapshot = ref.current; try { revision.current = await writeDocument(kind, snapshot, revision.current); savedGen.current = gen; channel.current?.postMessage({ kind }); if (generation.current === gen) setStatus('saved'); } catch (e) { stopped.current = true; if ((e as Error).message === 'VERSION_CONFLICT') { setStatus('conflict'); toast.error('另一页面更新了记录。本页修改仍保留，请先导出备份。'); } else { setStatus('error'); toast.error('本机保存失败。内容仍在当前页面，请重试或导出备份。'); } } finally { saving.current = false; if (mounted.current && !stopped.current && generation.current !== savedGen.current) setTick(t => t + 1); } }, 300); return () => clearTimeout(timer); }, [tick, ready, kind]);
  useEffect(() => { const leave = (e: BeforeUnloadEvent) => { if (generation.current !== savedGen.current) { e.preventDefault(); e.returnValue = ''; } }; window.addEventListener('beforeunload', leave); return () => window.removeEventListener('beforeunload', leave); }, []);
  return { data, update, status, ready, reload, retry: () => { if (!ready) { void reload(); return; } if (status === 'conflict') return; stopped.current = false; setStatus('saving'); setTick(t => t + 1); } };
}
