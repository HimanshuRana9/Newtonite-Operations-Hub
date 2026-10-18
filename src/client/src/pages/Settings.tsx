import React, { useState, useEffect } from 'react';
import { Bell, Table, ShieldAlert, Sparkles, Check } from 'lucide-react';
import { PageHeader } from '../components/PageHeader.js';

interface WorkspacePreferences {
  notificationsEnabled: boolean;
  compactRows: boolean;
  concurrencyAlerts: boolean;
  theme: 'dark-glass';
}

const DEFAULT_PREFS: WorkspacePreferences = {
  notificationsEnabled: true,
  compactRows: false,
  concurrencyAlerts: true,
  theme: 'dark-glass'
};

export const Settings: React.FC = () => {
  const [prefs, setPrefs] = useState<WorkspacePreferences>(() => {
    try {
      const saved = localStorage.getItem('newtonite_preferences');
      return saved ? JSON.parse(saved) : DEFAULT_PREFS;
    } catch {
      return DEFAULT_PREFS;
    }
  });

  const [savedNotification, setSavedNotification] = useState(false);

  useEffect(() => {
    localStorage.setItem('newtonite_preferences', JSON.stringify(prefs));
  }, [prefs]);

  const toggle = (key: keyof WorkspacePreferences) => {
    setPrefs((prev) => ({
      ...prev,
      [key]: !prev[key]
    }));
    setSavedNotification(true);
    setTimeout(() => setSavedNotification(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-8 space-y-6 animate-fade-in">
      <PageHeader
        eyebrow="WORKSPACE CONFIGURATION"
        title="Settings"
        description="Manage your local workspace presentation, notification, and concurrency behavior."
      />

      {savedNotification && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs">
          <Check className="w-4 h-4 text-emerald-400" />
          Preferences saved to local workspace.
        </div>
      )}

      <div className="rounded-2xl border border-white/5 bg-[#0b101f]/70 backdrop-blur-xl divide-y divide-white/5 overflow-hidden">
        {/* Appearance */}
        <div className="p-5 flex items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-xl grid place-items-center bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-100">Workspace Appearance</h4>
              <p className="text-xs text-slate-400 mt-0.5">
                Modern high-stakes dark interface with glassmorphic cards and indigo accents.
              </p>
            </div>
          </div>
          <span className="font-mono text-[10px] px-2.5 py-1 rounded-full uppercase tracking-wider font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
            ACTIVE (DARK GLASS)
          </span>
        </div>

        {/* Notifications */}
        <div className="p-5 flex items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-xl grid place-items-center bg-purple-500/15 text-purple-400 border border-purple-500/30 shrink-0">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-100">Operational Notifications</h4>
              <p className="text-xs text-slate-400 mt-0.5">
                Display live toast notifications when approval is requested or an urgent incident is created.
              </p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={prefs.notificationsEnabled}
              onChange={() => toggle('notificationsEnabled')}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
          </label>
        </div>

        {/* Compact Table */}
        <div className="p-5 flex items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-xl grid place-items-center bg-blue-500/15 text-blue-400 border border-blue-500/30 shrink-0">
              <Table className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-100">Compact Work-Item Rows</h4>
              <p className="text-xs text-slate-400 mt-0.5">
                Enable denser tabular rows for high-density triage when scanning large queues.
              </p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={prefs.compactRows}
              onChange={() => toggle('compactRows')}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
          </label>
        </div>

        {/* Concurrency Alerts */}
        <div className="p-5 flex items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-xl grid place-items-center bg-rose-500/15 text-rose-400 border border-rose-500/30 shrink-0">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-100">Concurrency Conflict Alerts (OCC)</h4>
              <p className="text-xs text-slate-400 mt-0.5">
                Show prominent visual conflict banners when the server rejects a stale edit (HTTP 409).
              </p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={prefs.concurrencyAlerts}
              onChange={() => toggle('concurrencyAlerts')}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
          </label>
        </div>
      </div>

      <div className="p-4 rounded-xl border border-white/5 bg-white/[0.01] text-xs text-slate-500 leading-relaxed">
        <b className="text-slate-400">Engineering Note:</b> Preferences are managed client-side in local storage. Concurrency validation, version increments, and role permissions remain strictly enforced by the backend API.
      </div>
    </div>
  );
};

export default Settings;
