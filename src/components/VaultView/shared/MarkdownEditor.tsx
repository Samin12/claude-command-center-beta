'use client';

import React, { useState, useRef, useCallback } from 'react';
import {
  Bold,
  Italic,
  Code,
  Link,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Heading3,
  Quote,
  Minus,
  FileCode,
  Eye,
  Pencil,
} from 'lucide-react';

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

interface MarkdownEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
}

export function MarkdownEditor({
  content,
  onChange,
  placeholder = 'Write your content here...',
}: MarkdownEditorProps) {
  const [activeTab, setActiveTab] = useState<'write' | 'preview'>('write');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const applyFormatting = useCallback((action: ToolbarAction) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.slice(start, end);

    let newContent: string;
    let newCursorPos: number;

    if (action.block && !selectedText) {
      const beforeCursor = content.slice(0, start);
      const afterCursor = content.slice(end);
      const needsNewline = beforeCursor.length > 0 && !beforeCursor.endsWith('\n');
      const prefix = (needsNewline ? '\n' : '') + action.prefix;
      newContent = beforeCursor + prefix + action.suffix + afterCursor;
      newCursorPos = start + prefix.length;
    } else if (selectedText) {
      newContent = content.slice(0, start) + action.prefix + selectedText + action.suffix + content.slice(end);
      newCursorPos = start + action.prefix.length + selectedText.length + action.suffix.length;
    } else {
      newContent = content.slice(0, start) + action.prefix + action.suffix + content.slice(end);
      newCursorPos = start + action.prefix.length;
    }

    onChange(newContent);

    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    });
  }, [content, onChange]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
      e.preventDefault();
      applyFormatting(INLINE_ACTIONS[0]);
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'i') {
      e.preventDefault();
      applyFormatting(INLINE_ACTIONS[1]);
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = e.currentTarget;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newContent = content.slice(0, start) + '  ' + content.slice(end);
      onChange(newContent);
      requestAnimationFrame(() => {
        textarea.setSelectionRange(start + 2, start + 2);
      });
    }
  };

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Tab bar + Toolbar */}
      <div className="border-b border-border bg-secondary/30">
        {/* Tabs */}
        <div className="flex items-center justify-between px-3 py-2">
          <div className="flex items-center bg-secondary rounded-md p-0.5">
            <button
              onClick={() => setActiveTab('write')}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded transition-colors ${
                activeTab === 'write'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Pencil className="w-3 h-3" />
              Write
            </button>
            <button
              onClick={() => setActiveTab('preview')}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded transition-colors ${
                activeTab === 'preview'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Eye className="w-3 h-3" />
              Preview
            </button>
          </div>
          <span className="text-[10px] text-muted-foreground hidden sm:block">
            Markdown supported
          </span>
        </div>

        {/* Toolbar - only shown in write mode */}
        {activeTab === 'write' && (
          <div className="flex items-center gap-0.5 px-3 py-1.5 flex-wrap">
            {INLINE_ACTIONS.map(action => (
              <button
                key={action.label}
                onClick={() => applyFormatting(action)}
                className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded transition-colors"
                title={action.label}
              >
                <action.icon className="w-3.5 h-3.5" />
              </button>
            ))}
            <div className="w-px h-4 bg-border mx-1" />
            {BLOCK_ACTIONS.map(action => (
              <button
                key={action.label}
                onClick={() => applyFormatting(action)}
                className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded transition-colors"
                title={action.label}
              >
                <action.icon className="w-3.5 h-3.5" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content area */}
      {activeTab === 'write' ? (
        <textarea
          ref={textareaRef}
          value={content}
          onChange={e => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full min-h-[400px] text-sm bg-transparent outline-none border-none text-foreground placeholder:text-muted-foreground/40 focus:outline-none resize-none leading-relaxed font-mono p-4"
          style={{ height: 'calc(100vh - 380px)' }}
        />
      ) : (
        <div className="p-4 min-h-[400px]" style={{ minHeight: 'calc(100vh - 380px)' }}>
          {content.trim() ? (
            <pre className="text-sm whitespace-pre-wrap font-mono leading-relaxed text-foreground/90 break-words">
              {content}
            </pre>
          ) : (
            <p className="text-muted-foreground/50 text-sm italic">Nothing to preview</p>
          )}
        </div>
      )}
    </div>
  );
}
