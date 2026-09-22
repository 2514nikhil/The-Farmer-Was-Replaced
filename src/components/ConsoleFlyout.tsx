'use client';

import { useEffect, useRef } from 'react';
import { Trash2, X } from 'lucide-react';
import type { LogEntry } from '@/hooks/usePyodideWorker';

export function ConsoleFlyout({
  logs,
  onClear,
  onClose,
}: {
  logs: LogEntry[];
  onClear: () => void;
  onClose: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [logs]);

  const colorFor = (type: LogEntry['type']) =>
    type === 'error' ? 'text-red-600' : type === 'system' ? 'text-farm-gold' : 'text-farm-text';

  return (
    <div className="absolute top-16 right-4 z-30 w-96 max-w-[85vw] rounded-xl bg-white/95 border border-farm-panel-border shadow-panel overflow-hidden flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b border-farm-panel-border bg-farm-bg/70">
        <span className="font-mono text-xs text-farm-accent">CONSOLE</span>
        <div className="flex items-center gap-1">
          <button onClick={onClear} className="w-6 h-6 flex items-center justify-center rounded hover:bg-farm-panel-border text-farm-text-muted transition-colors" title="Clear">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={onClose} className="w-6 h-6 flex items-center justify-center rounded hover:bg-farm-panel-border text-farm-text-muted transition-colors" title="Close">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div ref={scrollRef} className="max-h-72 overflow-y-auto p-3 font-mono text-xs space-y-1 bg-farm-bg/40">
        {logs.length === 0 && <div className="text-farm-text-muted text-center py-6">No output yet.</div>}
        {logs.map((log) => (
          <div key={log.id} className={colorFor(log.type)}>
            {log.message}
          </div>
        ))}
      </div>
    </div>
  );
}
