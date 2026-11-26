import Icon from './Icon';

/** Shared page title row: tinted icon, title, one-line summary, and actions on the right. */
export default function PageHeader({ icon, tone = 'mint', title, subtitle, children }) {
  return (
    <div className="page-head">
      <div className="page-head-main">
        {icon && <span className={`page-head-icon kpi-tone-${tone}`}><Icon name={icon} size={22} /></span>}
        <div className="min-w-0">
          <h1>{title}</h1>
          {subtitle && <p className="page-head-sub">{subtitle}</p>}
        </div>
      </div>
      {children && <div className="page-head-actions">{children}</div>}
    </div>
  );
}
