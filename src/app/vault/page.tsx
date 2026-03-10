'use client';

import { useState } from 'react';
import VaultView from '@/components/VaultView';
import ObsidianVaultView from '@/components/ObsidianVaultView';
import { ObsidianIcon } from '@/components/Settings/ObsidianIcon';

export default function VaultPage() {
  const [activeTab, setActiveTab] = useState<'claude-command-center' | 'obsidian'>('claude-command-center');

  return (
    <div className="h-[calc(100vh-7rem)] lg:h-[calc(100vh-3rem)] flex flex-col pt-4 lg:pt-6">
      {/* Header — same layout as AgentListHeader */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 lg:mb-6">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold tracking-tight text-foreground">Vault</h1>
          <p className="text-muted-foreground text-xs lg:text-sm mt-1 hidden sm:block">
            Agent reports, knowledge base & notes
          </p>
        </div>
      </div>

      {/* Filter buttons — same style as ProjectFilterTabs */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2">
        <button
          onClick={() => setActiveTab('claude-command-center')}
          className={`
            flex items-center gap-2 px-3 py-2 text-sm font-medium transition-all whitespace-nowrap
            ${activeTab === 'claude-command-center'
              ? 'bg-foreground text-background'
              : 'bg-secondary text-muted-foreground hover:text-foreground border border-border'
            }
          `}
        >
          <img src="/command-center-mark.png" alt="Samins Command Center" className="w-4 h-4 object-contain" />
          Samins Command Center Vault
        </button>
        <button
          onClick={() => setActiveTab('obsidian')}
          className={`
            flex items-center gap-2 px-3 py-2 text-sm font-medium transition-all whitespace-nowrap
            ${activeTab === 'obsidian'
              ? 'bg-foreground text-background'
              : 'bg-secondary text-muted-foreground hover:text-foreground border border-border'
            }
          `}
        >
          <ObsidianIcon className={`w-4 h-4 ${activeTab === 'obsidian' ? 'text-background' : 'text-[#A88BFA]'}`} />
          Obsidian Vault
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === 'claude-command-center' ? <VaultView embedded /> : <ObsidianVaultView />}
      </div>
    </div>
  );
}
