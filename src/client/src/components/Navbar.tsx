import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { ShieldAlert, LayoutDashboard, ListTodo, LogOut, UserCircle } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const location = useLocation();

  if (!user) return null;

  const primaryRole = user.memberships[0]?.role || 'VIEWER';

  return (
    <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-50">
      <div className="app-container flex items-center justify-between py-3">
        {/* Brand */}
        <div className="flex items-center gap-6">
          <Link to="/" className="flex items-center gap-2.5 text-decoration-none group">
            <div className="p-2 rounded-lg bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 group-hover:bg-indigo-600/30 transition-all">
              <ShieldAlert className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <div className="font-bold text-slate-100 text-base leading-tight tracking-tight">
                Newtonite <span className="text-indigo-400 font-medium">Ops Hub</span>
              </div>
              <div className="text-[10px] text-slate-400 font-mono tracking-wider uppercase">
                Operations Under Pressure
              </div>
            </div>
          </Link>

          {/* Nav links */}
          <nav className="hidden md:flex items-center gap-1 ml-4">
            <Link
              to="/"
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                location.pathname === '/'
                  ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              Dashboard
            </Link>
            <Link
              to="/items"
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                location.pathname.startsWith('/items')
                  ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <ListTodo className="w-4 h-4" />
              Work Items
            </Link>
          </nav>
        </div>

        {/* User profile & session actions */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5 bg-slate-900 border border-slate-800 py-1 px-3 rounded-full">
            <UserCircle className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-medium text-slate-200">{user.name}</span>
            <span
              className={`text-[10px] font-mono px-2 py-0.5 rounded-full uppercase tracking-wider font-semibold ${
                primaryRole === 'ADMIN'
                  ? 'bg-purple-900/60 text-purple-300 border border-purple-700/50'
                  : primaryRole === 'LEAD'
                  ? 'bg-amber-900/60 text-amber-300 border border-amber-700/50'
                  : primaryRole === 'MEMBER'
                  ? 'bg-blue-900/60 text-blue-300 border border-blue-700/50'
                  : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}
            >
              {primaryRole}
            </span>
          </div>

          <button
            onClick={logout}
            className="p-1.5 rounded-md text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 border border-transparent hover:border-rose-900/50 transition-colors"
            title="Log out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
