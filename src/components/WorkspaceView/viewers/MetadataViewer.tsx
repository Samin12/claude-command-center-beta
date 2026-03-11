'use client';

import { FileQuestion, Clock3 } from 'lucide-react';
import type { WorkspaceFile } from '@/types/electron';
import { formatBytes } from '../utils';

interface MetadataViewerProps {
  file: WorkspaceFile;
  message?: string;
}

export default function MetadataViewer({ file, message }: MetadataViewerProps) {
  return (
    <div className="flex h-full items-center justify-center bg-[#0b1016] p-8 text-white">
      <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-white/[0.03] p-8 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-2xl bg-white/[0.04] p-3">
            <FileQuestion className="h-6 w-6 text-white/45" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">{file.name}</h3>
            <p className="text-sm text-white/50">{message || 'This file type opens as metadata in Dorothy for now.'}</p>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-white/42">Type</dt>
            <dd className="mt-1 font-medium text-white">{file.kind}</dd>
          </div>
          <div>
            <dt className="text-white/42">Size</dt>
            <dd className="mt-1 font-medium text-white">{formatBytes(file.size)}</dd>
          </div>
          <div>
            <dt className="text-white/42">Extension</dt>
            <dd className="mt-1 font-medium text-white">{file.extension || 'none'}</dd>
          </div>
          <div>
            <dt className="text-white/42">Modified</dt>
            <dd className="mt-1 flex items-center gap-1 font-medium text-white">
              <Clock3 className="h-3.5 w-3.5 text-white/42" />
              {new Date(file.lastModified).toLocaleString()}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
