import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function NotFoundPage() {
  return <main className="not-found"><span className="eyebrow">404 · THAT TIME HAS PASSED</span><h1>This page isn’t on the calendar.</h1><p>The link may have moved, or the page may no longer be available.</p><Link to="/" className="button button-primary"><ArrowLeft size={16}/>Back to Tandem</Link></main>;
}
