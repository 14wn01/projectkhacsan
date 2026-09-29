import { ReactNode } from "react";

export function PageHeader({ icon: Icon, title, description, actions }: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        {Icon && (
          <div className="grid place-items-center size-10 rounded-xl bg-foreground text-background shadow-md shrink-0">
            <Icon className="size-5" />
          </div>
        )}
        <div>
          <h3 className="leading-tight">{title}</h3>
          {description && <p className="text-sm text-muted-foreground mt-0.5">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description }: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center">
      <div className="grid place-items-center size-14 rounded-2xl bg-muted text-muted-foreground mb-3">
        <Icon className="size-7" />
      </div>
      <div className="font-medium">{title}</div>
      {description && <p className="text-sm text-muted-foreground mt-1 max-w-sm">{description}</p>}
    </div>
  );
}
