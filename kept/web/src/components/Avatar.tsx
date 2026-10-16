import type { User } from '../types';
export function Avatar({ user, size = 36, online }: { user: Pick<User, 'display_name' | 'avatar_color'> | null; size?: number; online?: boolean }) {
  const name = user?.display_name || '?';
  const initials = name.split(' ').map((p) => p[0]).slice(0, 2).join('');
  return (
    <span className="avatar" style={{ width: size, height: size, background: user?.avatar_color || 'var(--bg-4)', fontSize: size * 0.38 }} title={name}>
      {initials}
      {online !== undefined && <span className={`status ${online ? 'on' : ''}`} />}
    </span>
  );
}
