'use client';

import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef } from 'react';
import {
  Bold,
  Code,
  FileCode,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link,
  List,
  ListOrdered,
  Minus,
  Quote,
} from 'lucide-react';
import { SimpleMarkdown } from '@/components/VaultView/components/MarkdownRenderer';

interface ToolbarAction {
  icon: React.FC<{ className?: string }>;
  label: string;
  prefix: string;
  suffix: string;
  block?: boolean;
}

const INLINE_ACTIONS: ToolbarAction[] = [
  { icon: Bold, label: 'Bold', prefix: '**', suffix: '**' },
  { icon: Italic, label: 'Italic', prefix: '*', suffix: '*' },
  { icon: Code, label: 'Inline code', prefix: '`', suffix: '`' },
  { icon: Link, label: 'Link', prefix: '[', suffix: '](url)' },
];

const BLOCK_ACTIONS: ToolbarAction[] = [
  { icon: Heading1, label: 'Heading 1', prefix: '# ', suffix: '', block: true },
  { icon: Heading2, label: 'Heading 2', prefix: '## ', suffix: '', block: true },
  { icon: Heading3, label: 'Heading 3', prefix: '### ', suffix: '', block: true },
  { icon: List, label: 'Bullet list', prefix: '- ', suffix: '', block: true },
  { icon: ListOrdered, label: 'Numbered list', prefix: '1. ', suffix: '', block: true },
  { icon: Quote, label: 'Blockquote', prefix: '> ', suffix: '', block: true },
  { icon: Minus, label: 'Horizontal rule', prefix: '\n---\n', suffix: '', block: true },
  { icon: FileCode, label: 'Code block', prefix: '```\n', suffix: '\n```', block: true },
];

interface MarkdownFileViewerProps {
  content: string;
  mode: 'edit' | 'preview';
  onChange: (content: string) => void;
  onModeChange?: (mode: 'edit' | 'preview') => void;
}

export default function MarkdownFileViewer({ content, mode, onChange, onModeChange }: MarkdownFileViewerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewContent = useDeferredValue(content);

  useEffect(() => {
    if (mode !== 'edit') return;
    textareaRef.current?.focus();
  }, [mode]);

  const applyFormatting = useCallback((action: ToolbarAction) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.slice(start, end);

    let nextContent: string;
    let nextCursorPos: number;

    if (action.block && !selectedText) {
      const beforeCursor = content.slice(0, start);
      const afterCursor = content.slice(end);
      const needsNewline = beforeCursor.length > 0 && !beforeCursor.endsWith('\n');
      const prefix = `${needsNewline ? '\n' : ''}${action.prefix}`;
      nextContent = beforeCursor + prefix + action.suffix + afterCursor;
      nextCursorPos = start + prefix.length;
    } else if (selectedText) {
      nextContent = content.slice(0, start) + action.prefix + selectedText + action.suffix + content.slice(end);
      nextCursorPos = start + action.prefix.length + selectedText.length + action.suffix.length;
    } else {
      nextContent = content.slice(0, start) + action.prefix + action.suffix + content.slice(end);
      nextCursorPos = start + action.prefix.length;
    }

    onChange(nextContent);

    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(nextCursorPos, nextCursorPos);
    });
  }, [content, onChange]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'b') {
      event.preventDefault();
      applyFormatting(INLINE_ACTIONS[0]);
    }
    if ((event.metaKey || event.ctrlKey) && event.key === 'i') {
      event.preventDefault();
      applyFormatting(INLINE_ACTIONS[1]);
    }
    if (event.key === 'Tab') {
      event.preventDefault();
      const textarea = event.currentTarget;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const nextContent = content.slice(0, start) + '  ' + content.slice(end);
      onChange(nextContent);
      requestAnimationFrame(() => {
        textarea.setSelectionRange(start + 2, start + 2);
      });
    }
  };

  const previewPane = useMemo(() => {
    if (!previewContent.trim()) {
      return <p className="text-sm italic text-text-muted">Nothing to preview</p>;
    }

    return (
      <div className="max-w-none text-foreground">
        <SimpleMarkdown content={previewContent} />
      </div>
    );
  }, [previewContent]);

  if (mode === 'preview') {
    return (
      <div
        className="h-full overflow-auto bg-bg-primary px-6 py-5"
        onDoubleClick={() => onModeChange?.('edit')}
      >
        <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-border-primary bg-card/75 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-foreground">Preview mode</p>
            <p className="text-xs text-text-secondary">Double-click anywhere in the preview to jump back into editing.</p>
          </div>
          <button
            type="button"
            onClick={() => onModeChange?.('edit')}
            className="rounded-xl border border-border-primary bg-bg-secondary px-3 py-2 text-xs font-medium text-foreground transition hover:border-primary/20 hover:bg-secondary active:scale-[0.98] active:bg-primary/10"
          >
            Edit markdown
          </button>
        </div>
        {previewPane}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-bg-primary">
      <div className="flex flex-wrap items-center justify-end gap-1 border-b border-border-primary bg-card px-4 py-3">
        <div className="flex flex-wrap items-center gap-1">
          {INLINE_ACTIONS.map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={() => applyFormatting(action)}
              className="rounded-lg p-2 text-text-secondary transition hover:bg-secondary hover:text-foreground active:scale-[0.98] active:bg-primary/10"
              title={action.label}
            >
              <action.icon className="h-3.5 w-3.5" />
            </button>
          ))}
          <div className="mx-1 h-4 w-px bg-border-primary" />
          {BLOCK_ACTIONS.map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={() => applyFormatting(action)}
              className="rounded-lg p-2 text-text-secondary transition hover:bg-secondary hover:text-foreground active:scale-[0.98] active:bg-primary/10"
              title={action.label}
            >
              <action.icon className="h-3.5 w-3.5" />
            </button>
          ))}
        </div>
      </div>

      <textarea
        ref={textareaRef}
        value={content}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        spellCheck={false}
        className="h-full w-full resize-none border-none bg-transparent p-5 font-mono text-sm leading-7 text-foreground outline-none"
      />
    </div>
  );
}
