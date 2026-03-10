import type { ReactNode, ComponentType } from 'react';

interface VaultEmptyStateProps {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: ReactNode;
}

/** Centered empty-state placeholder reused across vault views. */
export function VaultEmptyState({ icon: Icon, title, description, action }: VaultEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
      <Icon className="w-14 h-14 mb-4 opacity-30" />
      <p className="text-base font-medium">{title}</p>
      {description && <p className="text-sm mt-1 opacity-70 max-w-md">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
