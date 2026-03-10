import type { ReactNode } from 'react';

/** Styled panel container — border, rounded-lg, bg-card, overflow-hidden. */
export function VaultPanel({
  className = '',
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`border border-border rounded-lg bg-card overflow-hidden ${className}`}>
      {children}
    </div>
  );
}

/** Uppercase section header inside a VaultPanel (e.g. "Folders", "Vaults"). */
export function VaultPanelHeader({ children }: { children: ReactNode }) {
  return (
    <div className="px-3 py-2.5 border-b border-border">
      <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        {children}
      </h2>
    </div>
  );
}

/** Sidebar tree/list item with consistent selected/unselected styling. */
export function VaultSidebarItem({
  selected,
  className = '',
  style,
  onClick,
  children,
}: {
  selected: boolean;
  className?: string;
  style?: React.CSSProperties;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-1.5 px-2 py-1.5 text-left text-sm transition-colors ${
        selected
          ? 'bg-primary/10 text-foreground font-medium rounded'
          : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50 rounded'
      } ${className}`}
      style={style}
    >
      {children}
    </button>
  );
}
