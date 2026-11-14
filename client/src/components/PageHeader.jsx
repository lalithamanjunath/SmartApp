export function PageHeader({ eyebrow, title, description, action }) {
  return <div className="page-header"><div>{eyebrow && <div className="eyebrow">{eyebrow}</div>}<h1>{title}</h1>{description && <p>{description}</p>}</div>{action && <div className="page-header-action">{action}</div>}</div>;
}

export function MetricCard({ label, value, note, icon: Icon, tone = 'indigo' }) {
  return <article className="metric-card"><div className={`metric-icon metric-${tone}`}><Icon size={19} strokeWidth={1.8} /></div><div className="metric-copy"><span>{label}</span><strong>{value ?? '—'}</strong>{note && <small>{note}</small>}</div></article>;
}
