'use client';

import type { WorkspaceFile } from '@/types/electron';
import { toLocalFileUrl } from '../utils';

interface MediaViewerProps {
  file: WorkspaceFile;
}

export default function MediaViewer({ file }: MediaViewerProps) {
  const src = toLocalFileUrl(file.path);

  if (file.kind === 'image') {
    return (
      <div className="flex h-full items-center justify-center overflow-auto bg-[#0b1016] p-6">
        {/* local-file:// previews do not flow through Next image optimization */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={file.name} className="max-h-full max-w-full rounded-2xl border border-white/8 object-contain shadow-2xl" />
      </div>
    );
  }

  if (file.kind === 'video') {
    return (
      <div className="flex h-full items-center justify-center bg-[#0b1016] p-6">
        <video src={src} controls className="max-h-full max-w-full rounded-2xl border border-white/8 shadow-2xl" />
      </div>
    );
  }

  if (file.kind === 'audio') {
    return (
      <div className="flex h-full items-center justify-center bg-[#0b1016] p-6">
        <audio src={src} controls className="w-full max-w-2xl" />
      </div>
    );
  }

  if (file.kind === 'pdf') {
    return (
      <div className="h-full bg-[#0b1016] p-4">
        <iframe src={src} className="h-full w-full rounded-2xl border border-white/8 bg-white" title={file.name} />
      </div>
    );
  }

  return null;
}
