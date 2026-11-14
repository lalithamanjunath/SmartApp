import { Link, NavLink, Outlet } from 'react-router-dom';
import { ArrowRight, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { Brand } from '../components/Brand.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export function PublicLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user } = useAuth();
  const home = user?.role === 'admin' ? '/admin/dashboard' : '/app/dashboard';
  return <div className="public-shell">
    <header className="public-nav"><Brand /><button className="mobile-menu-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}>{menuOpen ? <X size={21} /> : <Menu size={21} />}</button>
      <nav className={menuOpen ? 'public-links public-links-open' : 'public-links'} aria-label="Main navigation">
        <a href="#how-it-works" onClick={() => setMenuOpen(false)}>How it works</a><a href="#for-teams" onClick={() => setMenuOpen(false)}>For teams</a>
        {user ? <Link className="nav-primary" to={home}>Open workspace <ArrowRight size={15} /></Link> : <><NavLink to="/login">Sign in</NavLink><Link className="nav-primary" to="/register">Book your time <ArrowRight size={15} /></Link></>}
      </nav>
    </header>
    <Outlet />
    <footer className="public-footer"><div><Brand light /><p>Make time for what matters.</p></div><span>© {new Date().getFullYear()} Tandem. Thoughtful scheduling, made simple.</span><a href="#top">Back to top ↑</a></footer>
  </div>;
}
