'use client';

import { useState } from 'react';
import { Eye, Pencil } from 'lucide-react';
import { SimpleMarkdown } from '@/components/VaultView/components/MarkdownRenderer';

interface MarkdownFileViewerProps {
  content: string;
  onChange: (content: string) => void;
}

export default function MarkdownFileViewer({ content, onChange }: MarkdownFileViewerProps) {
  const [mode, setMode] = useState<'write' | 'preview'>('write');

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center gap-2 border-b border-white/8 bg-black/10 px-4 py-3">
        <button
          type="button"
          onClick={() => setMode('write')}
          className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition ${
            mode === 'write' ? 'bg-emerald-400/14 text-emerald-100' : 'text-white/45 hover:text-white/85'
          }`}
        >
          <Pencil className="h-3.5 w-3.5" />
          Write
        </button>
        <button
          type="button"
          onClick={() => setMode('preview')}
          className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition ${
            mode === 'preview' ? 'bg-emerald-400/14 text-emerald-100' : 'text-white/45 hover:text-white/85'
          }`}
        >
          <Eye className="h-3.5 w-3.5" />
          Preview
        </button>
      </div>

      {mode === 'write' ? (
        <textarea
          value={content}
          onChange={(event) => onChange(event.target.value)}
          className="h-full w-full resize-none border-none bg-[#0b1016] p-5 font-mono text-sm leading-6 text-white outline-none"
          spellCheck={false}
        />
      ) : (
        <div className="h-full overflow-auto bg-[#0b1016] px-6 py-5 text-white">
          <SimpleMarkdown content={content} />
        </div>
      )}
    </div>
  );
}
