import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { RoleBadge } from './Badge.js';
import {
  ShieldAlert,
  LayoutDashboard,
  ListTodo,
  LogOut,
  Menu,
  X,
  Activity,
  Layers
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (!user) return null;

  const primaryRole = user.memberships[0]?.role || 'VIEWER';
  const primaryTeam = user.memberships[0]?.teamName || 'Platform Ops';

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl sticky top-0 z-50">
      <div className="app-container py-3 flex items-center justify-between">
        {/* Left: Brand & Navigation */}
        <div className="flex items-center gap-7">
          <Link to="/" className="flex items-center gap-3 text-decoration-none group">
            <div className="p-2 rounded-xl bg-indigo-600/20 border border-indigo-500/40 text-indigo-400 group-hover:bg-indigo-600/30 group-hover:shadow-[0_0_15px_rgba(99,102,241,0.5)] transition-all">
              <ShieldAlert className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <div className="font-bold text-slate-100 text-sm sm:text-base leading-tight tracking-tight flex items-center gap-1.5">
                <span>Newtonite</span>
                <span className="text-indigo-400 font-semibold">Ops Hub</span>
              </div>
              <div className="text-[10px] text-slate-400 font-mono tracking-wider uppercase flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Cluster Online</span>
              </div>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            <Link
              to="/"
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all relative ${
                location.pathname === '/'
                  ? 'bg-indigo-600/15 text-indigo-300 border border-indigo-500/35 shadow-[0_0_12px_rgba(99,102,241,0.2)]'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Dashboard</span>
            </Link>

            <Link
              to="/items"
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all relative ${
                location.pathname.startsWith('/items')
                  ? 'bg-indigo-600/15 text-indigo-300 border border-indigo-500/35 shadow-[0_0_12px_rgba(99,102,241,0.2)]'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
              }`}
            >
              <ListTodo className="w-4 h-4" />
              <span>Work Items</span>
            </Link>
          </nav>
        </div>

        {/* Right: User Profile & Actions */}
        <div className="hidden md:flex items-center gap-3">
          {/* Team Context Pill */}
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900/90 border border-slate-800 text-slate-400 text-xs font-mono">
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-slate-300 max-w-[150px] truncate">{primaryTeam}</span>
          </div>

          {/* User Profile Badge */}
          <div className="flex items-center gap-2.5 bg-slate-900/90 border border-slate-800 py-1 pl-1.5 pr-3 rounded-full shadow-sm">
            <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-[10px] font-bold text-white shadow-inner">
              {getInitials(user.name)}
            </div>
            <span className="text-xs font-medium text-slate-200">{user.name}</span>
            <RoleBadge role={primaryRole} />
          </div>

          {/* Logout Action */}
          <button
            onClick={logout}
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 border border-slate-800 hover:border-rose-900/50 transition-all"
            title="Sign out of Operations Hub"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>

        {/* Mobile Menu Button */}
        <div className="md:hidden flex items-center gap-2">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white"
            aria-label="Toggle Navigation Menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-800/80 bg-slate-950/95 backdrop-blur-2xl p-4 space-y-4 animate-fade-in">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold text-white">
                {getInitials(user.name)}
              </div>
              <div>
                <div className="text-xs font-bold text-slate-100">{user.name}</div>
                <div className="text-[10px] text-slate-400 font-mono">{primaryTeam}</div>
              </div>
            </div>
            <RoleBadge role={primaryRole} />
          </div>

          <nav className="flex flex-col gap-1.5">
            <Link
              to="/"
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold ${
                location.pathname === '/'
                  ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/40'
                  : 'text-slate-300 hover:bg-slate-900'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Dashboard</span>
            </Link>

            <Link
              to="/items"
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold ${
                location.pathname.startsWith('/items')
                  ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/40'
                  : 'text-slate-300 hover:bg-slate-900'
              }`}
            >
              <ListTodo className="w-4 h-4" />
              <span>Work Items Registry</span>
            </Link>
          </nav>

          <div className="pt-2 border-t border-slate-800/80">
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                logout();
              }}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-rose-950/30 text-rose-300 border border-rose-900/50 text-xs font-semibold"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
