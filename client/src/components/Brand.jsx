import { Link } from 'react-router-dom';

export function Brand({ light = false, compact = false, to = '/' }) {
  return (
    <Link className={`brand ${light ? 'brand-light' : ''} ${compact ? 'brand-compact' : ''}`} to={to} aria-label="Tandem home">
      <span className="brand-icon" aria-hidden="true">
        <img className="brand-mark" src="/tandem-mark.png" alt="" />
      </span>
      {!compact && <span className="brand-name">tandem<span>.</span></span>}
    </Link>
  );
}
