import { useState } from 'react';
import { FolderOpen, X, Plus } from 'lucide-react';
import { ObsidianIcon } from './ObsidianIcon';
import type { AppSettings } from './types';

interface ObsidianSectionProps {
  appSettings: AppSettings;
  onSaveAppSettings: (updates: Partial<AppSettings>) => void;
}

export const ObsidianSection = ({ appSettings, onSaveAppSettings }: ObsidianSectionProps) => {
  const [adding, setAdding] = useState(false);
  const vaultPaths = appSettings.obsidianVaultPaths || [];

  const handleAddVault = async () => {
    const folderPath = await window.electronAPI?.dialog?.openFolder();
    if (folderPath && !vaultPaths.includes(folderPath)) {
      const result = await window.electronAPI?.obsidian?.addVault(folderPath);
      if (result?.success) {
        onSaveAppSettings({ obsidianVaultPaths: [...vaultPaths, folderPath] });
      }
    }
    setAdding(false);
  };

  const handleRemoveVault = async (vaultPath: string) => {
    const result = await window.electronAPI?.obsidian?.removeVault(vaultPath);
    if (result?.success) {
      onSaveAppSettings({ obsidianVaultPaths: vaultPaths.filter(p => p !== vaultPath) });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1">Obsidian Vaults</h2>
        <p className="text-sm text-muted-foreground">
          Register Obsidian vaults for browsing and agent read-only access
        </p>
      </div>

      <div className="border border-border bg-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <ObsidianIcon className="w-5 h-5 text-[#A88BFA]" />
          <div className="flex-1">
            <h3 className="font-medium">Registered Vaults</h3>
            <p className="text-xs text-muted-foreground">
              <a href="https://obsidian.md" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">Obsidian</a> is an advanced knowledge base app that stores notes as local Markdown files. Connect your vaults so agents can reference them.
            </p>
          </div>
          <button
            onClick={handleAddVault}
            disabled={adding}
            className="px-3 py-1.5 text-sm border border-border hover:border-foreground hover:text-foreground text-muted-foreground transition-colors flex items-center gap-2"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Vault
          </button>
        </div>

        {vaultPaths.length === 0 ? (
          <div className="py-8 text-center border rounded-lg border-dashed border-border">
            <ObsidianIcon className="w-8 h-8 text-muted-foreground mx-auto mb-3 opacity-40" />
            <p className="text-sm text-muted-foreground">No vaults registered</p>
            <p className="text-xs text-muted-foreground mt-1">
              Add one above, or create an agent in an Obsidian project to auto-detect.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {vaultPaths.map((vp) => (
              <div
                key={vp}
                className="flex items-center gap-3 p-3 border rounded-lg border-border bg-background"
              >
                <ObsidianIcon className="w-4 h-4 text-[#A88BFA] shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{vp.split('/').pop()}</p>
                  <p className="text-xs text-muted-foreground font-mono truncate">{vp}</p>
                </div>
                <button
                  onClick={() => handleRemoveVault(vp)}
                  className="p-1.5 text-muted-foreground hover:text-red-500 transition-colors shrink-0"
                  title="Remove vault"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
