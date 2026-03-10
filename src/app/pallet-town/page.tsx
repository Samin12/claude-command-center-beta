'use client';
import { useEffect } from 'react';
import PokemonGame from '@/components/PokemonGame';
import { useStore } from '@/store';

export default function PalletTownPage() {
  useEffect(() => {
    useStore.setState({ sidebarCollapsed: true });
  }, []);

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-black">
      <div className="relative flex-1 min-h-0">
        <PokemonGame />
      </div>
      <div className="border-t border-emerald-900/70 bg-stone-950 px-4 py-3">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-emerald-300/70">
            Community Link
          </div>
          <a
            href="https://www.skool.com/claude"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded border border-emerald-400/40 bg-emerald-400/10 px-4 py-2 font-mono text-xs uppercase tracking-[0.22em] text-emerald-100 transition hover:border-emerald-300 hover:bg-emerald-300/20"
          >
            Join Claude
          </a>
        </div>
      </div>
    </div>
  );
}
