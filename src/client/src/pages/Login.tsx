import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { RoleBadge } from '../components/Badge.js';
import {
  ShieldAlert,
  ArrowRight,
  Lock,
  Mail,
  Eye,
  EyeOff,
  Zap,
  RotateCcw,
  Layers,
  CheckCircle,
  Users,
  AlertCircle,
  Sparkles
} from 'lucide-react';
import { Robot } from '../components/Robot.js';

const DEMO_PERSONAS = [
  {
    role: 'ADMIN',
    name: 'Alice Admin',
    email: 'admin@newtonite.io',
    tagline: 'System Governance & Approvals',
    description: 'Full team governance, closed-item reopening & final workflow approvals.'
  },
  {
    role: 'LEAD',
    name: 'Leo Lead',
    email: 'lead@newtonite.io',
    tagline: 'Incident Review & Resolution',
    description: 'Approves or rejects pending transitions and marks resolved items closed.'
  },
  {
    role: 'MEMBER',
    name: 'Zoro Member',
    email: 'member@newtonite.io',
    tagline: 'Core Operator & Responder',
    description: 'Creates items, claims unassigned incidents, performs edits and posts comments.'
  },
  {
    role: 'VIEWER',
    name: 'Victor Viewer',
    email: 'viewer@newtonite.io',
    tagline: 'Audit & Read-Only Inspection',
    description: 'Inspects queues and audit timeline without mutation permissions.'
  },
  {
    role: 'EXTERNAL',
    name: 'Eve External',
    email: 'extern@newtonite.io',
    tagline: 'Customer Response Unit',
    description: 'Member of Customer Escalations; strictly blocked from Platform Core Ops.'
  }
];

export const Login: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('member@newtonite.io');
  const [password, setPassword] = useState('Password123!');
  const [showPassword, setShowPassword] = useState(false);
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
      setError(err?.message || 'Authentication failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const selectPersona = (userEmail: string) => {
    setEmail(userEmail);
    setPassword('Password123!');
    setError(null);
  };

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col justify-center relative overflow-hidden p-4 sm:p-6 lg:p-8">
      {/* Ambient background glows */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 -right-32 w-96 h-96 bg-violet-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 left-1/3 w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-6xl w-full mx-auto grid lg:grid-cols-12 gap-8 items-center relative z-10">
        {/* Left Section: Brand & Strategic Visual Overview */}
        <div className="lg:col-span-7 space-y-8 pr-0 lg:pr-6">
          {/* Brand header */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl grid place-items-center border border-indigo-400/50 bg-gradient-to-br from-blue-600/30 to-indigo-600/30 text-indigo-300 shadow-[0_0_20px_rgba(99,102,241,0.35)]">
                <ShieldAlert className="w-6 h-6 text-indigo-400" />
              </div>
              <div className="leading-tight">
                <div className="font-extrabold text-white text-xl tracking-tight">
                  Newtonite <span className="text-sky-400">Ops Hub</span>
                </div>
                <div className="text-[10px] tracking-widest uppercase font-semibold text-slate-500">
                  OPERATIONS CONSOLE
                </div>
              </div>
            </div>

            <div className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-indigo-950/60 border border-indigo-500/30 text-indigo-300 text-xs font-mono">
              <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
              <span>Enterprise Operations Hub · High Stakes Edition</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight">
              Operations, <br />
              <span className="gradient-text-indigo">under control.</span>
            </h1>

            <p className="text-sm sm:text-base text-slate-300 max-w-xl leading-relaxed">
              Engineered for mission-critical teams operating under peak pressure. Guarantees zero lost updates,
              atomic concurrent claims, and durable transactional outbox delivery.
            </p>
          </div>

          {/* 3 Core Architectural Highlights */}
          <div className="grid sm:grid-cols-3 gap-3.5 pt-1">
            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-1.5">
              <div className="p-2 rounded-lg bg-indigo-600/20 text-indigo-400 w-fit">
                <Zap className="w-4 h-4" />
              </div>
              <div className="text-xs font-bold text-slate-200">Atomic Claims</div>
              <div className="text-[11px] text-slate-400 leading-normal">
                Conditional PostgreSQL locking prevents dual-assignment race conditions.
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-1.5">
              <div className="p-2 rounded-lg bg-cyan-600/20 text-cyan-400 w-fit">
                <RotateCcw className="w-4 h-4" />
              </div>
              <div className="text-xs font-bold text-slate-200">Optimistic OCC</div>
              <div className="text-[11px] text-slate-400 leading-normal">
                Version-checked mutations return HTTP 409 Conflict instead of silent data loss.
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-1.5">
              <div className="p-2 rounded-lg bg-emerald-600/20 text-emerald-400 w-fit">
                <Layers className="w-4 h-4" />
              </div>
              <div className="text-xs font-bold text-slate-200">Durable Outbox</div>
              <div className="text-[11px] text-slate-400 leading-normal">
                Asynchronous worker with automatic abandoned lease recovery and retries.
              </div>
            </div>
          </div>

          {/* 3D Robot Mascot Stage */}
          <div className="flex items-center gap-4 p-4 rounded-2xl border border-blue-500/20 bg-gradient-to-r from-blue-950/30 to-indigo-950/20 backdrop-blur-xl shadow-[0_0_20px_rgba(59,130,246,0.15)]">
            <div className="shrink-0">
              <Robot size={75} showHalo={true} />
            </div>
            <div className="text-xs space-y-1">
              <div className="font-bold text-slate-100 flex items-center gap-1.5 text-sm">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                Meet Your Newtonite Ops Co-Pilot
              </div>
              <p className="text-slate-300 text-xs leading-relaxed">
                Autonomous outbox event delivery, real-time race detection, and conflict alerts active across all queues.
              </p>
            </div>
          </div>

          {/* Interactive Persona Selector Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-indigo-400" />
                Select Demo Persona to Sign In
              </span>
              <span className="text-[10px] text-indigo-400 font-mono">Password: Password123!</span>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-2.5">
              {DEMO_PERSONAS.map((p) => {
                const isSelected = email === p.email;
                return (
                  <button
                    key={p.email}
                    type="button"
                    onClick={() => selectPersona(p.email)}
                    className={`text-left p-3 rounded-xl border transition-all relative ${
                      isSelected
                        ? 'bg-indigo-950/60 border-indigo-500/70 shadow-[0_0_15px_rgba(99,102,241,0.25)]'
                        : 'bg-slate-900/40 border-slate-800/80 hover:bg-slate-900/80 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-xs font-bold text-slate-100">{p.name}</span>
                      <RoleBadge role={p.role} />
                    </div>
                    <div className="text-[11px] text-indigo-300 font-medium">{p.tagline}</div>
                    <div className="text-[10px] text-slate-400 mt-1 line-clamp-1">{p.description}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Section: High-Polish Glass Login Form */}
        <div className="lg:col-span-5">
          <div className="rounded-3xl border border-white/10 bg-[#0c142b]/85 backdrop-blur-2xl p-6 sm:p-8 shadow-[0_0_40px_rgba(30,58,138,0.25)] relative">
            <div className="mb-6 space-y-1">
              <h2 className="text-2xl font-black text-white flex items-center gap-2">
                <span>Sign In to Hub</span>
              </h2>
              <p className="text-xs text-slate-400">
                Access your team queue or select a pre-seeded profile on the left.
              </p>
            </div>

            {error && (
              <div className="mb-5 p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5" htmlFor="email-input">
                  Work Email Address
                </label>
                <div className="relative flex items-center">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
                  <input
                    id="email-input"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full !pl-11 !pr-4 py-2.5 rounded-xl border border-white/10 bg-[#080d1b]/90 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/40 shadow-inner transition"
                    placeholder="name@newtonite.io"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400" htmlFor="password-input">
                    Password
                  </label>
                </div>
                <div className="relative flex items-center">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
                  <input
                    id="password-input"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full !pl-11 !pr-11 py-2.5 rounded-xl border border-white/10 bg-[#080d1b]/90 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/40 shadow-inner transition"
                    placeholder="••••••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 p-1 text-slate-400 hover:text-slate-200 transition"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-4 py-3 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-semibold flex items-center justify-center gap-2 shadow-[0_4px_20px_rgba(37,99,235,0.4)] transition"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Authenticating Session...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    Sign In to Operations Hub
                    <ArrowRight className="w-4 h-4" />
                  </span>
                )}
              </button>
            </form>

            <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-500">
              <span className="font-mono">Newtonite v1.0.0</span>
              <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                <CheckCircle className="w-3.5 h-3.5" /> Security Enforced
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
