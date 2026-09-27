import { ReactNode } from 'react';

/**
 * An empty, unavailable or failed screen: what happened and one next step.
 * `visual` is a slot for an icon, sketch or a future theme emblem.
 */
export function EmptyState({
  title,
  children,
  action,
  visual,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  visual?: ReactNode;
}) {
  return (
    <section className="ui-empty-state">
      {visual && <div className="ui-empty-state-visual">{visual}</div>}
      <h2>{title}</h2>
      {children && <div className="ui-empty-state-text">{children}</div>}
      {action}
    </section>
  );
}
