'use client';

import { ReactNode, useState, useCallback, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { TopBar } from './TopBar';
import { EditorWindows } from './EditorWindows';
import { ConsoleFlyout } from './ConsoleFlyout';
import { HelpPanel } from './HelpPanel';
import { ResearchModal } from './ResearchModal';
import { usePyodideWorker } from '@/hooks/usePyodideWorker';

type Flyout = 'none' | 'console' | 'help';

export function GameLayout({ children }: { children: ReactNode }) {
  const { isReady, logs, executeCode, stopExecution, clearLogs } = usePyodideWorker();
  const [flyout, setFlyout] = useState<Flyout>('none');
  const [researchOpen, setResearchOpen] = useState(false);
  const newScriptRef = useRef<() => void>(() => {});

  const registerNewScript = useCallback((fn: () => void) => {
    newScriptRef.current = fn;
  }, []);

  const errorCount = logs.filter((l) => l.type === 'error').length;

  return (
    <div className="relative h-full w-full overflow-hidden bg-farm-bg">
      <div className="absolute inset-0">{children}</div>

      {!isReady && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/90 border border-farm-panel-border shadow-panel text-xs text-farm-text-muted">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-farm-accent" />
          Loading Python runtime...
        </div>
      )}

      <TopBar
        errorCount={errorCount}
        onOpenConsole={() => setFlyout((f) => (f === 'console' ? 'none' : 'console'))}
        onNewScript={() => newScriptRef.current()}
        onOpenHelp={() => setFlyout((f) => (f === 'help' ? 'none' : 'help'))}
        onOpenResearch={() => setResearchOpen(true)}
      />

      <EditorWindows
        registerNewScript={registerNewScript}
        executeCode={executeCode}
        stopExecution={stopExecution}
        isReady={isReady}
      />

      {flyout === 'console' && (
        <ConsoleFlyout logs={logs} onClear={clearLogs} onClose={() => setFlyout('none')} />
      )}
      {flyout === 'help' && <HelpPanel onClose={() => setFlyout('none')} />}

      <ResearchModal isOpen={researchOpen} onClose={() => setResearchOpen(false)} />
    </div>
  );
}
