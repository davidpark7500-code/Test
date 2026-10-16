import { Link, useParams } from 'react-router-dom';
import { useStore } from '../store';
import { useEffect, useState } from 'react';
import { rt } from '../realtime';

export function Rail() {
  const { communities } = useStore();
  const { slug } = useParams();
  const [, tick] = useState(0);
  useEffect(() => rt.on((m) => { if (m.t === 'live:update' || m.t === 'hello') tick((x) => x + 1); }), []);
  const liveCommunities = new Set<number>();
  for (const l of rt.live.values()) if (l.live && l.communityId) liveCommunities.add(l.communityId);
  return (
    <nav className="rail">
      <Link to="/" className={`rail-item home ${!slug ? 'active' : ''}`} title="Today">K</Link>
      <div className="rail-sep" />
      {communities.map((c) => (
        <Link key={c.id} to={`/c/${c.slug}`} className={`rail-item ${slug === c.slug ? 'active' : ''}`} title={c.name} style={{ background: slug === c.slug ? c.color : undefined }}>
          {c.icon}
        </Link>
      ))}
      <Link to="/new" className="rail-item" title="Create a community" style={{ color: 'var(--green)' }}>+</Link>
      <Link to="/discover" className="rail-item" title="Discover" style={{ fontSize: 18 }}>🧭</Link>
    </nav>
  );
}
