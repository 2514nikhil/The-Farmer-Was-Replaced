'use client';

import { useCallback, useState } from 'react';
import Editor, { OnMount, Monaco } from '@monaco-editor/react';

const FUNCTION_DOCS: Array<{ label: string; detail: string; doc: string; insertText: string }> = [
  { label: 'move', detail: '(direction)', doc: 'Move one tile: North, South, East, West. Returns True if it moved, False if blocked by the edge.', insertText: 'move(${1:East})' },
  { label: 'plant', detail: '(crop)', doc: 'Plant a crop at the current tile: Grass, Bush, Carrot, Pumpkin.', insertText: 'plant(${1:Grass})' },
  { label: 'harvest', detail: '()', doc: 'Harvest the crop at the current tile, if ready.', insertText: 'harvest()' },
  { label: 'water', detail: '()', doc: 'Water the current tile.', insertText: 'water()' },
  { label: 'till', detail: '()', doc: 'Permanently boosts this tile\'s growth speed. Diminishing effect, caps out after a few tills.', insertText: 'till()' },
  { label: 'get_pos', detail: '()', doc: "Returns the drone's (x, y) position.", insertText: 'get_pos()' },
  { label: 'can_harvest', detail: '()', doc: 'Returns True if the current tile is ready to harvest.', insertText: 'can_harvest()' },
  { label: 'get_crop', detail: '()', doc: 'Returns the crop type at the current tile (e.g. "grass"), or None.', insertText: 'get_crop()' },
  { label: 'get_moisture', detail: '()', doc: 'Returns the current tile\'s moisture, 0 to 1.', insertText: 'get_moisture()' },
  { label: 'get_growth', detail: '()', doc: 'Returns the current tile\'s growth progress, 0 to 1.', insertText: 'get_growth()' },
  { label: 'grid_size', detail: '()', doc: 'Returns the current grid size (e.g. 3 for a 3x3 field).', insertText: 'grid_size()' },
  { label: 'spawn_drone', detail: '()', doc: 'Spawns another drone and returns a handle to control it. Handle methods need explicit "await".', insertText: 'spawn_drone()' },
];

const CONSTANTS = ['North', 'South', 'East', 'West', 'Grass', 'Bush', 'Carrot', 'Pumpkin'];

let providersRegistered = false;

// Registers completion/hover providers using the Monaco instance @monaco-editor/react
// actually loaded (from CDN by default) - never a separately-imported 'monaco-editor'
// package instance, which would silently be a different realm and never affect the
// rendered editor.
function registerLanguageFeatures(monaco: Monaco) {
  if (providersRegistered) return;
  providersRegistered = true;

  monaco.languages.registerCompletionItemProvider('python', {
    provideCompletionItems: (model, position) => {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };
      const suggestions = [
        ...FUNCTION_DOCS.map((f) => ({
          label: f.label,
          kind: monaco.languages.CompletionItemKind.Function,
          detail: f.detail,
          documentation: f.doc,
          insertText: f.insertText,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range,
        })),
        ...CONSTANTS.map((c) => ({
          label: c,
          kind: monaco.languages.CompletionItemKind.EnumMember,
          detail: 'constant',
          insertText: c,
          range,
        })),
      ];
      return { suggestions };
    },
  });

  monaco.languages.registerHoverProvider('python', {
    provideHover: (model, position) => {
      const word = model.getWordAtPosition(position);
      if (!word) return null;
      const fn = FUNCTION_DOCS.find((f) => f.label === word.word);
      if (!fn) return null;
      return {
        range: new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn),
        contents: [{ value: `**${fn.label}${fn.detail}**` }, { value: fn.doc }],
      };
    },
  });
}

const FARM_THEME = {
  base: 'vs' as const,
  inherit: true,
  rules: [
    { token: 'comment', foreground: '7a6f5e', fontStyle: 'italic' },
    { token: 'keyword', foreground: 'c45a2a', fontStyle: 'bold' },
    { token: 'string', foreground: '4a7c2e' },
    { token: 'number', foreground: 'a84820' },
    { token: 'type', foreground: 'a67c52' },
  ],
  colors: {
    'editor.background': '#fefefc',
    'editor.foreground': '#3d3528',
    'editor.lineHighlightBackground': '#f5f0e8',
    'editor.selectionBackground': 'rgba(196, 90, 42, 0.25)',
    'editorLineNumber.foreground': '#c4b696',
    'editorLineNumber.activeForeground': '#3d3528',
    'editorCursor.foreground': '#c45a2a',
    'editorIndentGuide.background': '#e8e0d0',
    'editorIndentGuide.activeBackground': '#c45a2a',
    'scrollbarSlider.background': '#c45a2a55',
    'scrollbarSlider.hoverBackground': '#a8482088',
  },
};

export interface MonacoEditorProps {
  content: string;
  onChange: (content: string) => void;
  readOnly?: boolean;
}

export function MonacoEditor({ content, onChange, readOnly = false }: MonacoEditorProps) {
  const [themeReady, setThemeReady] = useState(false);

  const handleMount: OnMount = useCallback((_editor, monaco) => {
    registerLanguageFeatures(monaco);
    monaco.editor.defineTheme('farm-light', FARM_THEME);
    monaco.editor.setTheme('farm-light');
    setThemeReady(true);
  }, []);

  const handleChange = useCallback(
    (value: string | undefined) => {
      if (value !== undefined) onChange(value);
    },
    [onChange]
  );

  return (
    <Editor
      height="100%"
      language="python"
      theme={themeReady ? 'farm-light' : 'vs'}
      value={content}
      onChange={handleChange}
      onMount={handleMount}
      loading={<div className="w-full h-full flex items-center justify-center text-xs text-farm-text-muted">Loading editor...</div>}
      options={{
        minimap: { enabled: false },
        lineNumbers: 'on',
        wordWrap: 'on',
        tabSize: 4,
        readOnly,
        fontSize: 13,
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        lineHeight: 20,
        scrollBeyondLastLine: false,
        smoothScrolling: true,
        cursorBlinking: 'smooth',
        renderWhitespace: 'selection',
        folding: true,
        matchBrackets: 'always',
        autoClosingBrackets: 'always',
        autoClosingQuotes: 'always',
        formatOnPaste: false,
        suggestOnTriggerCharacters: true,
        quickSuggestions: { other: true, comments: false, strings: false },
        parameterHints: { enabled: true },
        glyphMargin: false,
        lineDecorationsWidth: 8,
        lineNumbersMinChars: 3,
        renderLineHighlight: 'line',
        padding: { top: 8, bottom: 8 },
      }}
    />
  );
}
