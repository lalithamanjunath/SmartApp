import { Link } from 'react-router-dom';

export function Brand({ light = false, compact = false, to = '/' }) {
  return (
    <Link className={`brand ${light ? 'brand-light' : ''} ${compact ? 'brand-compact' : ''}`} to={to} aria-label="Tandem home">
      <span className="brand-icon" aria-hidden="true">
        <svg viewBox="0 0 40 40" fill="none">
          <rect x="3" y="6" width="34" height="31" rx="9" fill="currentColor" />
          <path d="M12 4v7M28 4v7M3 15h34" stroke="white" strokeWidth="2.6" strokeLinecap="round" />
          <path d="m13 25 4.3 4.3L27 19" stroke="#D5F36A" strokeWidth="3.1" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      {!compact && <span className="brand-name">tandem<span>.</span></span>}
    </Link>
  );
}
