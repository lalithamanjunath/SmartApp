import { ArrowRight, CalendarCheck2, CalendarDays, Check, Clock3, ShieldCheck, Sparkles, Users } from 'lucide-react';
import { Link } from 'react-router-dom';

const highlights = [
  { icon: CalendarCheck2, title: 'Real availability', text: 'Choose from times that are actually open, not just a list that looks available.' },
  { icon: Clock3, title: 'A clear next step', text: 'Keep your next appointment and every booking detail in one calm view.' },
  { icon: ShieldCheck, title: 'Built for teams', text: 'Give administrators the tools to manage capacity without losing the human touch.' },
];

export default function LandingPage() {
  return <main id="top" className="landing-main">
    <section className="hero-section">
      <div className="hero-copy">
        <div className="eyebrow"><span className="eyebrow-dot" />SCHEDULING, IN GOOD COMPANY</div>
        <h1>Make room<br />for <span>what matters.</span></h1>
        <p className="hero-description">Appointments should feel like the beginning of something, not another thing to manage. Tandem keeps your time, details and next steps together.</p>
        <div className="hero-actions"><Link className="button button-primary" to="/register">Find your time <ArrowRight size={17} /></Link><a className="button button-quiet" href="#how-it-works">See how it works</a></div>
        <div className="hero-assurance"><div className="avatar-stack"><span>T</span><span>M</span><span>J</span></div><span>Thoughtful scheduling for people and teams</span></div>
      </div>
      <div className="hero-art" aria-label="Preview of the Tandem appointment calendar">
        <div className="hero-art-orbit" />
        <div className="hero-preview-card">
          <div className="preview-top"><span className="preview-brand"><span className="preview-brand-dot" />YOUR WEEK, IN VIEW</span><span className="preview-date">Today · 9:41</span></div>
          <div className="preview-greeting"><div><small>MONDAY, MAY 12</small><strong>A little more breathing room.</strong></div><span className="preview-sun">✳</span></div>
          <div className="preview-timeline">
            <span className="timeline-hour">09:00</span><div className="timeline-line" /><span className="timeline-hour">10:00</span><div className="timeline-line" />
            <div className="preview-appointment"><span className="appointment-marker" /><div><strong>Discovery session</strong><small>10:30 AM · Studio room 02</small></div><span className="preview-check"><Check size={13} /></span></div>
            <span className="timeline-hour">11:00</span><div className="timeline-line" /><span className="timeline-hour">12:00</span>
          </div>
          <div className="preview-next"><div className="preview-next-icon"><CalendarDays size={17} /></div><div><small>UP NEXT</small><strong>Project check-in</strong><span>Thursday, May 15 · 2:00 PM</span></div><span className="preview-chevron">↗</span></div>
        </div>
        <div className="hero-note note-top"><span className="note-icon note-green"><Check size={15} /></span><span><strong>Time saved</strong><small>All in one place</small></span></div>
        <div className="hero-note note-bottom"><div className="note-avatar">A</div><span><strong>Appointment confirmed</strong><small>Your time is yours.</small></span></div>
        <div className="hero-art-caption">A little less back-and-forth.<br /><span>A lot more room to be present.</span></div>
      </div>
      <div className="hero-baseline"><span>MADE FOR PEOPLE, NOT JUST CALENDARS</span><span>01 / 03</span></div>
    </section>

    <section id="how-it-works" className="editorial-section">
      <div className="editorial-heading"><div><div className="eyebrow">A BETTER KIND OF BOOKING</div><h2>Clear from the<br />first click.</h2></div><p>Find a time that works, see exactly what you booked, and get back to the day you already have planned.</p></div>
      <div className="feature-list">{highlights.map(({ icon: Icon, title, text }, index) => <article className="feature-row" key={title}><span className="feature-index">0{index + 1}</span><div className="feature-icon"><Icon size={21} strokeWidth={1.7} /></div><div className="feature-copy"><h3>{title}</h3><p>{text}</p></div><span className="feature-line" /></article>)}</div>
    </section>

    <section id="for-teams" className="teams-section"><div className="teams-copy"><div className="eyebrow eyebrow-light"><span className="eyebrow-dot" />FOR THE PEOPLE WHO MAKE IT HAPPEN</div><h2>More present.<br /><span>Less admin.</span></h2><p>One considered space for your clients, your team and the little details that make a meeting feel easy.</p><Link className="button button-light" to="/register">Get started <ArrowRight size={16} /></Link></div><div className="team-visual"><div className="team-card team-card-back"><span className="team-card-tag">CAPACITY THIS WEEK</span><div className="capacity-meter"><i /><i /><i /><i /><i /><i /><i /></div><div className="team-card-foot"><strong>18</strong><span>open times</span><span className="green-pill">+4.8% <Sparkles size={12} /></span></div></div><div className="team-card team-card-front"><div className="team-profile"><div className="team-avatar">M</div><div><strong>Monday, May 19</strong><small>Planning session · 10:30 AM</small></div><span className="team-confirmed"><Check size={14} /></span></div><div className="team-divider" /><div className="team-profile"><div className="team-avatar team-avatar-blue">J</div><div><strong>Tuesday, May 20</strong><small>Follow-up · 2:00 PM</small></div><span className="team-confirmed"><Check size={14} /></span></div><div className="team-microcopy"><Users size={14} />A little more in sync.</div></div><span className="teams-spark">✳</span></div></section>

    <section className="closing-section"><div><span className="closing-mark">✳</span><div className="eyebrow">YOUR TIME, BACK IN YOUR HANDS</div><h2>Ready to find<br />your next time?</h2></div><Link className="button button-primary" to="/register">Make your first booking <ArrowRight size={17} /></Link></section>
  </main>;
}
