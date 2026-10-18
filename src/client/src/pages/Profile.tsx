import React from 'react';
import { useAuth } from '../context/AuthContext.js';
import { RoleBadge } from '../components/Badge.js';
import { initials } from '../utils/format.js';
import { PageHeader } from '../components/PageHeader.js';

export const Profile: React.FC = () => {
  const { user, logout } = useAuth();
  if (!user) return null;
  return (
    <div className="app-container space-y-6 max-w-3xl">
      <PageHeader eyebrow="Account" title="Profile" />
      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 flex items-center gap-4">
        <div className="w-14 h-14 rounded-full grid place-items-center text-lg font-bold text-white bg-gradient-to-tr from-indigo-600 to-violet-500">{initials(user.name)}</div>
        <div><div className="text-lg font-semibold text-slate-50">{user.name}</div><div className="text-sm text-slate-400">{user.email}</div></div>
      </section>
      <section className="rounded-2xl border border-white/10 bg-white/[0.03] divide-y divide-white/5">
        <h2 className="px-5 py-3 text-sm font-semibold text-slate-200">Team memberships</h2>
        {user.memberships.map((m) => (
          <div key={m.id} className="px-5 py-3 flex items-center justify-between"><span className="text-sm text-slate-200">{m.teamName}</span><RoleBadge role={m.role} /></div>
        ))}
      </section>
      <button onClick={logout} className="btn-secondary">Sign out</button>
    </div>
  );
};
