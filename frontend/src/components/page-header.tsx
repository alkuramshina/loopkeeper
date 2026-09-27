import { ReactNode } from 'react';

type PageHeaderProps = {
  title: ReactNode;
  titleId?: string;
  /** One line under the title. */
  lead?: ReactNode;
  /** Quiet status beside the title in the compact header, e.g. "Updated…". */
  meta?: ReactNode;
  /** Page actions on the right: create, search, save. */
  actions?: ReactNode;
  /** A smaller title with the meta on its line, for full-height pages. */
  compact?: boolean;
};

/** The page title in one place on every screen, with actions on the right. */
export function PageHeader({
  title,
  titleId,
  lead,
  meta,
  actions,
  compact,
}: PageHeaderProps) {
  return (
    <header className={`page-header${compact ? ' page-header-compact' : ''}`}>
      <div className="page-header-text">
        <h1 id={titleId}>{title}</h1>
        {meta && <p className="page-header-meta">{meta}</p>}
        {lead && <p className="page-header-lead">{lead}</p>}
      </div>
      {actions && <div className="page-header-actions">{actions}</div>}
    </header>
  );
}
