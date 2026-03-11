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
    <div className="flex h-full items-center justify-center bg-bg-primary p-8 text-foreground">
      <div className="w-full max-w-xl rounded-3xl border border-border-primary bg-card p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-2xl bg-bg-secondary p-3">
            <FileQuestion className="h-6 w-6 text-text-muted" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">{file.name}</h3>
            <p className="text-sm text-text-secondary">{message || 'This file type opens as metadata in Dorothy for now.'}</p>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-text-muted">Type</dt>
            <dd className="mt-1 font-medium text-foreground">{file.kind}</dd>
          </div>
          <div>
            <dt className="text-text-muted">Size</dt>
            <dd className="mt-1 font-medium text-foreground">{formatBytes(file.size)}</dd>
          </div>
          <div>
            <dt className="text-text-muted">Extension</dt>
            <dd className="mt-1 font-medium text-foreground">{file.extension || 'none'}</dd>
          </div>
          <div>
            <dt className="text-text-muted">Modified</dt>
            <dd className="mt-1 flex items-center gap-1 font-medium text-foreground">
              <Clock3 className="h-3.5 w-3.5 text-text-muted" />
              {new Date(file.lastModified).toLocaleString()}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
