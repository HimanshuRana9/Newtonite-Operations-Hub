import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { ShieldAlert, ArrowRight, Lock, Mail, Users, CheckCircle } from 'lucide-react';

const DEMO_ACCOUNTS = [
  { role: 'ADMIN', name: 'Alice Admin', email: 'admin@newtonite.io', desc: 'Manage teams, users & full approvals' },
  { role: 'LEAD', name: 'Leo Lead', email: 'lead@newtonite.io', desc: 'Approve or reject workflow transitions' },
  { role: 'MEMBER', name: 'Maya Member', email: 'member@newtonite.io', desc: 'Create, claim, edit and progress work' },
  { role: 'VIEWER', name: 'Victor Viewer', email: 'viewer@newtonite.io', desc: 'Read-only access to team work items' },
  { role: 'EXTERNAL', name: 'Eve External', email: 'extern@newtonite.io', desc: 'Member of Customer Escalations only' }
];

export const Login: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('member@newtonite.io');
  const [password, setPassword] = useState('Password123!');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login(email, password);
      navigate('/');
    } catch (err: any) {
      setError(err?.message || 'Failed to authenticate');
    } finally {
      setLoading(false);
    }
  };

  const selectDemoUser = (userEmail: string) => {
    setEmail(userEmail);
    setPassword('Password123!');
    setError(null);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-950">
      <div className="w-full max-w-4xl grid md:grid-cols-2 gap-8 items-center">
        {/* Left column: Brand & Context */}
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-600/20 border border-indigo-500/40 text-indigo-400">
              <ShieldAlert className="w-8 h-8 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">Newtonite Operations Hub</h1>
              <p className="text-xs font-mono text-indigo-400 tracking-wider uppercase font-semibold">
                High-Stakes Work Management
              </p>
            </div>
          </div>

          <div className="space-y-3 text-slate-300 text-sm">
            <p>
              An internal work-item operations platform engineered for zero data divergence, atomic concurrency,
              optimistic locking, and reliable asynchronous outbox processing.
            </p>
            <div className="space-y-2 pt-2">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                Atomic conditional claims with conflict detection
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                Versioned optimistic locking preventing lost updates
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                Durable outbox worker with abandoned lease recovery
              </div>
            </div>
          </div>

          {/* Quick Demo Selector */}
          <div className="glass-panel p-4 space-y-3 border-slate-800">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-300 uppercase tracking-wider">
              <Users className="w-4 h-4 text-indigo-400" />
              Quick Demo Accounts
            </div>
            <div className="grid grid-cols-1 gap-2">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => selectDemoUser(acc.email)}
                  className={`text-left p-2.5 rounded-lg border transition-all flex items-center justify-between text-xs ${
                    email === acc.email
                      ? 'bg-indigo-950/60 border-indigo-500 text-indigo-200'
                      : 'bg-slate-900/50 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-800/50'
                  }`}
                >
                  <div>
                    <div className="font-semibold text-slate-200 flex items-center gap-2">
                      {acc.name}
                      <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-indigo-300 border border-slate-700">
                        {acc.role}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{acc.desc}</div>
                  </div>
                  <span className="text-[11px] text-indigo-400 font-mono">Select</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right column: Login form */}
        <div className="glass-panel p-8 border-slate-800 shadow-2xl relative">
          <h2 className="text-xl font-bold text-slate-100 mb-1">Sign In to Hub</h2>
          <p className="text-xs text-slate-400 mb-6">Enter your credentials or select a demo profile on the left</p>

          {error && (
            <div className="mb-5 p-3 rounded-lg bg-rose-950/50 border border-rose-800/60 text-rose-300 text-xs">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="input-label" htmlFor="email-input">Work Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  id="email-input"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field pl-9"
                  placeholder="name@newtonite.io"
                />
              </div>
            </div>

            <div>
              <label className="input-label" htmlFor="password-input">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  id="password-input"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field pl-9"
                  placeholder="••••••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center py-2.5 mt-2"
            >
              {loading ? 'Authenticating...' : 'Sign In'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-800/80 text-center">
            <span className="text-[11px] text-slate-500 font-mono">
              Newtonite Operations Platform · Role-Based Security
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
