import { Link, NavLink } from "react-router-dom";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { useState } from "react";
import { BrandMark } from "./BrandMark";

const nav = [
  ["Services", "/services"],
  ["About", "/about"],
  ["Journal", "/journal"],
  ["Contact", "/contact"],
] as const;

export function SiteShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="app-shell">
      <header className="site-header">
        <Link to="/" onClick={() => setOpen(false)}><BrandMark /></Link>
        <nav className="desktop-nav" aria-label="Primary navigation">
          {nav.map(([label, href]) => <NavLink key={href} to={href} className={({ isActive }) => isActive ? "active" : ""}>{label}</NavLink>)}
        </nav>
        <div className="header-actions">
          <Link className="header-login" to="/login">Patient login</Link>
          <Link className="button button--small" to="/book-appointment">Book appointment <ArrowUpRight size={15} /></Link>
          <button className="menu-toggle" type="button" aria-label={open ? "Close menu" : "Open menu"} onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</button>
        </div>
      </header>
      {open && <nav className="mobile-nav" aria-label="Mobile navigation">{nav.map(([label, href]) => <NavLink key={href} to={href} onClick={() => setOpen(false)}>{label}</NavLink>)}<Link to="/login" onClick={() => setOpen(false)}>Patient login</Link><Link className="button" to="/book-appointment" onClick={() => setOpen(false)}>Book appointment <ArrowUpRight size={15} /></Link></nav>}
      <main className="route-stage">{children}</main>
      <footer className="site-footer">
        <div className="footer-top"><div><BrandMark dark /><p className="footer-intro">A considered approach to modern dental care in Almonte.</p></div><div className="footer-cta"><span className="eyebrow eyebrow--light">Next step</span><Link to="/book-appointment">Choose a time <ArrowUpRight size={16} /></Link></div></div>
        <div className="footer-grid"><div><span className="footer-label">Explore</span><Link to="/services">Services</Link><Link to="/about">About OralCare+</Link><Link to="/journal">Journal</Link></div><div><span className="footer-label">Patient</span><Link to="/login">Patient login</Link><Link to="/register">Create an account</Link><Link to="/book-appointment">Book an appointment</Link></div><div><span className="footer-label">Clinic</span><span>95 Mill Street</span><span>Almonte, Ontario K0A 1A0</span><span>Public phone and email pending confirmation</span><span>Mon–Fri · 8:00 AM–5:00 PM</span><span>Sat · 8:00 AM–2:00 PM</span></div><div><span className="footer-label">Policies</span><Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link><Link to="/cancellation-policy">Cancellation policy</Link></div></div>
        <div className="footer-bottom"><span>© {new Date().getFullYear()} OralCare+. All rights reserved.</span><span>Clinic details are editable launch inputs until confirmed.</span></div>
      </footer>
    </div>
  );
}
