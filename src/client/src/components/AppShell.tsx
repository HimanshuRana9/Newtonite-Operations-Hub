import React, { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ShieldAlert, LayoutGrid, ListChecks, Users, BarChart3, UserCircle, LogOut,
  Search, ChevronDown, ChevronRight, Layers, Menu, X, Bell, Settings as SettingsIcon
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { apiRequest } from '../api/client.js';
import { Team } from '../types/index.js';
import { RoleBadge } from './Badge.js';
import { Robot } from './Robot.js';
import { highestRole, initials } from '../utils/format.js';

const navCls = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 group ${
    isActive
      ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 text-white shadow-[0_4px_20px_rgba(59,130,246,0.45)]'
      : 'text-slate-300 hover:bg-white/[0.06] hover:text-white'
  }`;

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="px-3.5 pt-5 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">{children}</div>
);

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [drawer, setDrawer] = useState(false);
  const [teamMenu, setTeamMenu] = useState(false);
  const [q, setQ] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const teamRef = useRef<HTMLDivElement>(null);

  const { data: teams } = useQuery<Team[]>({ queryKey: ['teams'], queryFn: () => apiRequest<Team[]>('/api/teams') });

  useEffect(() => setDrawer(false), [location.pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === 'Escape') setTeamMenu(false);
    };
    const onDown = (e: MouseEvent) => {
      if (teamRef.current && !teamRef.current.contains(e.target as Node)) setTeamMenu(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, []);

  if (!user) return null;
  const role = highestRole(user.memberships);
  const n = user.memberships.length;
  const activeTeamName = n === 1 ? user.memberships[0].teamName : (teams?.[0]?.name ?? 'Platform Core Operations');

  return (
    <div className="min-h-screen flex bg-[#070b14] text-slate-100">
      {drawer && <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden" onClick={() => setDrawer(false)} />}

      <aside
        className={`fixed lg:sticky top-0 z-50 h-screen w-[256px] shrink-0 flex flex-col gap-1 p-4 border-r border-white/[0.08] bg-[#070b16]/95 backdrop-blur-2xl transition-transform lg:translate-x-0 ${
          drawer ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label="Primary"
      >
        <div className="flex items-center justify-between pb-2">
          <Link to="/" className="flex items-center gap-3 px-1 py-1">
            <div className="w-10 h-10 rounded-xl grid place-items-center border border-indigo-400/50 bg-gradient-to-br from-blue-600/30 to-indigo-600/30 text-indigo-300 shadow-[0_0_15px_rgba(99,102,241,0.3)]">
              <ShieldAlert className="w-5 h-5 text-indigo-400" />
            </div>
            <div className="leading-tight">
              <div className="font-bold text-slate-50 text-[15px]">Newtonite <span className="text-sky-400 font-extrabold">Ops Hub</span></div>
              <div className="text-[9px] tracking-widest uppercase font-semibold text-slate-500">OPERATIONS CONSOLE</div>
            </div>
          </Link>
          <button className="lg:hidden p-1.5 text-slate-400" onClick={() => setDrawer(false)} aria-label="Close menu">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="mt-4 flex flex-col gap-1 overflow-y-auto pr-1">
          <NavLink to="/" end className={navCls}>
            {({ isActive }) => (
              <>
                <LayoutGrid className="w-4 h-4 shrink-0" />
                <span>Dashboard</span>
                {isActive && <ChevronRight className="ml-auto w-4 h-4 text-white/80" />}
              </>
            )}
          </NavLink>
          <NavLink to="/items" className={navCls}>
            {({ isActive }) => (
              <>
                <ListChecks className="w-4 h-4 shrink-0" />
                <span>Work Items</span>
                {isActive && <ChevronRight className="ml-auto w-4 h-4 text-white/80" />}
              </>
            )}
          </NavLink>

          <SectionLabel>Platform</SectionLabel>
          <NavLink to="/teams" className={navCls}>
            {({ isActive }) => (
              <>
                <Users className="w-4 h-4 shrink-0" />
                <span>Teams</span>
                {isActive && <ChevronRight className="ml-auto w-4 h-4 text-white/80" />}
              </>
            )}
          </NavLink>
          <NavLink to="/notifications" className={navCls}>
            {({ isActive }) => (
              <>
                <Bell className="w-4 h-4 shrink-0" />
                <span>Notifications</span>
                <span className="ml-auto px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#6366f1] text-white shadow-[0_0_10px_rgba(99,102,241,0.5)]">
                  3
                </span>
                {isActive && <ChevronRight className="ml-1 w-4 h-4 text-white/80" />}
              </>
            )}
          </NavLink>

          <SectionLabel>Account</SectionLabel>
          <NavLink to="/profile" className={navCls}>
            {({ isActive }) => (
              <>
                <UserCircle className="w-4 h-4 shrink-0" />
                <span>Profile</span>
                {isActive && <ChevronRight className="ml-auto w-4 h-4 text-white/80" />}
              </>
            )}
          </NavLink>
          <NavLink to="/settings" className={navCls}>
            {({ isActive }) => (
              <>
                <SettingsIcon className="w-4 h-4 shrink-0" />
                <span>Settings</span>
                {isActive && <ChevronRight className="ml-auto w-4 h-4 text-white/80" />}
              </>
            )}
          </NavLink>
          <button onClick={logout} className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-slate-300 hover:bg-rose-500/10 hover:text-rose-300 text-left transition-colors">
            <LogOut className="w-4 h-4" />Sign out
          </button>
        </nav>

        {/* Mascot Co-Pilot Card */}
        <Link
          to="/"
          className="mt-auto mb-2 flex items-center gap-3 rounded-2xl border border-blue-500/20 bg-gradient-to-r from-blue-950/30 to-indigo-950/20 p-2.5 hover:border-blue-400/40 transition group"
        >
          <div className="w-9 h-9 rounded-xl grid place-items-center bg-blue-500/10 border border-blue-400/30 shrink-0">
            <Robot size={28} showHalo={false} />
          </div>
          <div className="min-w-0 flex-1 leading-tight">
            <div className="text-xs font-semibold text-slate-100 flex items-center gap-1">
              Need a hand?
            </div>
            <div className="text-[10px] text-slate-400 truncate mt-0.5">Your ops co-pilot is active.</div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-slate-300 group-hover:translate-x-0.5 transition" />
        </Link>

        {/* Current Team Pill */}
        <div
          onClick={() => setTeamMenu((v) => !v)}
          className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 hover:bg-white/[0.06] cursor-pointer transition"
        >
          <div className="w-8 h-8 rounded-full grid place-items-center bg-emerald-500/15 border border-emerald-400/30 shrink-0">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
          </div>
          <div className="min-w-0 flex-1 text-xs leading-snug">
            <div className="font-semibold text-slate-100 truncate">{activeTeamName}</div>
            <div className="text-[10px] text-slate-400">{n} {n === 1 ? 'team' : 'teams'} · {role}</div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 px-4 sm:px-8 py-3.5 border-b border-white/[0.07] bg-[#070b16]/85 backdrop-blur-2xl">
          <button className="lg:hidden p-2 rounded-xl border border-white/10 text-slate-300 hover:bg-white/5" onClick={() => setDrawer(true)} aria-label="Open menu">
            <Menu className="w-5 h-5" />
          </button>

          {/* Search Bar matching design */}
          <form
            role="search"
            className="relative flex-1 max-w-xl"
            onSubmit={(e) => {
              e.preventDefault();
              navigate(q.trim() ? `/items?search=${encodeURIComponent(q.trim())}` : '/items');
            }}
          >
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              ref={searchRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search work items, teams, or keywords..."
              aria-label="Search work items"
              className="w-full pl-10 pr-16 py-2 rounded-xl border border-white/10 bg-[#0c142b]/80 text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/40 shadow-inner"
            />
            <kbd className="hidden sm:block absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono text-slate-400 border border-white/10 bg-white/5 rounded px-1.5 py-0.5">Ctrl K</kbd>
          </form>

          <div className="ml-auto flex items-center gap-3">
            {/* Team Dropdown */}
            <div className="relative hidden md:block" ref={teamRef}>
              <button
                onClick={() => setTeamMenu((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={teamMenu}
                className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2 text-sm text-slate-200 hover:bg-white/[0.08] transition"
              >
                <Layers className="w-4 h-4 text-indigo-400" />
                <span className="max-w-[170px] truncate">{activeTeamName}</span>
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </button>
              {teamMenu && (
                <div role="menu" className="absolute right-0 mt-2 w-72 rounded-xl border border-white/10 bg-[#0b1120] shadow-2xl p-1.5 z-50">
                  <Link role="menuitem" to="/items" onClick={() => setTeamMenu(false)} className="block px-3 py-2 rounded-lg text-sm text-slate-200 hover:bg-white/5">All teams</Link>
                  {(teams ?? []).map((t) => (
                    <Link key={t.id} role="menuitem" to={`/items?teamId=${t.id}`} onClick={() => setTeamMenu(false)}
                      className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-sm text-slate-200 hover:bg-white/5">
                      <span className="truncate">{t.name}</span><RoleBadge role={t.role} />
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Notification Bell with Red Badge */}
            <Link
              to="/notifications"
              className="relative p-2.5 rounded-xl border border-white/10 bg-white/[0.04] text-slate-300 hover:text-white hover:bg-white/[0.08] transition"
              aria-label="View notifications"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-[10px] font-bold text-white grid place-items-center shadow-[0_0_8px_rgba(244,63,94,0.6)]">
                3
              </span>
            </Link>

            {/* User Profile Pill */}
            <Link
              to="/profile"
              className="flex items-center gap-2.5 rounded-full border border-white/10 bg-white/[0.04] py-1 pl-1.5 pr-3 hover:bg-white/[0.08] transition"
            >
              <div className="w-7 h-7 rounded-full grid place-items-center text-[11px] font-bold text-white bg-gradient-to-tr from-indigo-500 via-purple-600 to-pink-500 shadow-[0_0_10px_rgba(168,85,247,0.4)]">
                {initials(user.name)}
              </div>
              <span className="hidden sm:inline text-sm font-medium text-slate-100">{user.name}</span>
              <RoleBadge role={role} />
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </Link>
          </div>
        </header>
        <main className="flex-1 py-6 pb-16">{children}</main>
      </div>
    </div>
  );
};
