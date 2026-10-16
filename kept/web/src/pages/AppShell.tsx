import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { Avatar } from '../components/Avatar';
import { Rail } from '../components/Rail';
import { useState } from 'react';

export function AppShell() {
  const { user, logout } = useStore();
  const nav = useNavigate();
  const [showNav, setShowNav] = useState(false);
  return (
    <div className={`shell ${showNav ? 'show-nav' : ''}`}>
      <Rail />
      <aside className="sidebar">
        <div className="sidebar-head"><span className="logo"><span className="k">K</span>Kept</span></div>
        <div className="sidebar-body">
          <NavLink to="/" end className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={() => setShowNav(false)}>☀️ Today</NavLink>
          <NavLink to="/discover" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={() => setShowNav(false)}>🧭 Discover</NavLink>
          <NavLink to="/me" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={() => setShowNav(false)}>👤 Profile & billing</NavLink>
          <NavLink to="/new" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={() => setShowNav(false)}>➕ Create a community</NavLink>
        </div>
        <div className="sidebar-foot">
          <Avatar user={user} size={32} online />
          <div className="grow"><div className="bold small">{user?.display_name}</div><div className="tiny muted">@{user?.username}</div></div>
          <button className="btn btn-ghost btn-sm" onClick={async () => { await logout(); nav('/discover'); }}>Sign out</button>
        </div>
      </aside>
      <main className="main">
        <div className="main-body"><Outlet /></div>
        <div className="mobile-bar">
          <button className="btn" onClick={() => setShowNav((s) => !s)}>☰ Menu</button>
          <Link className="btn" to="/">☀️ Today</Link>
          <Link className="btn" to="/discover">🧭 Discover</Link>
        </div>
      </main>
    </div>
  );
}
