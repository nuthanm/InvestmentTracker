import Link from 'next/link';
import Icon from './Icon';

/** One KPI tile: tinted icon and label on top, then the value and a supporting note. */
export default function KpiTile({ href, onClick, icon, tone = 'mint', label, value, note, alert = false, title }) {
  const body = (
    <>
      <span className="kpi-head">
        <span className={`kpi-icon kpi-tone-${tone}`}><Icon name={icon} /></span>
        <span className="kpi-label">{label}</span>
      </span>
      <span className="kpi-value">{value}</span>
      {note != null && <span className="kpi-note">{note}</span>}
    </>
  );
  const className = `kpi-tile${alert ? ' is-alert' : ''}`;
  if (href) return <Link href={href} title={title} className={className}>{body}</Link>;
  if (onClick) return <button type="button" onClick={onClick} title={title} className={`${className} text-left`}>{body}</button>;
  return <div title={title} className={className}>{body}</div>;
}
