'use client';
import { useEffect, useRef } from 'react';
type Tool = { name: string; description: string; inputSchema: object; readOnly?: boolean; execute: (input: unknown) => unknown | Promise<unknown> };
type Registry = { registerTool: (tool: object, options: { signal: AbortSignal }) => void | Promise<void> };
export function useWebTool(tool: Tool) {
  const current = useRef(tool); current.current = tool;
  useEffect(() => { const context = (document as Document & { modelContext?: Registry }).modelContext; if (!context?.registerTool) return; const lifecycle = new AbortController();
    try { void Promise.resolve(context.registerTool({ name: tool.name, description: tool.description, inputSchema: tool.inputSchema, annotations: { readOnlyHint: !!tool.readOnly, untrustedContentHint: true }, execute: (input: unknown) => current.current.execute(input) }, { signal: lifecycle.signal })).catch(e => console.warn('WebMCP registration unavailable', e)); } catch (e) { console.warn('WebMCP registration unavailable', e); }
    return () => lifecycle.abort();
  }, [tool.name]);
}
