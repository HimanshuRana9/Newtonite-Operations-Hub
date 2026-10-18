import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MoreHorizontal, ExternalLink, Copy, HandMetal } from 'lucide-react';
import { apiRequest } from '../api/client.js';
import { WorkItem } from '../types/index.js';
import { useToast } from '../context/ToastContext.js';

/** Per-row actions. Menu is position:fixed so the table's overflow container can't clip it. */
export const RowMenu: React.FC<{ item: WorkItem; canClaim: boolean }> = ({ item, canClaim }) => {
  const navigate = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const btn = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);

  const claim = useMutation({
    mutationFn: () => apiRequest<WorkItem>(`/api/items/${item.id}/claim`, { method: 'POST' }),
    onSuccess: () => {
      toast.success('Work item claimed', `"${item.title}" is now assigned to you.`);
      qc.invalidateQueries({ queryKey: ['items'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (e: any) => toast.error('Claim failed', e.message)
  });

  useEffect(() => {
    if (!pos) return;
    const close = () => setPos(null);
    const onDown = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('[data-rowmenu]')) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [pos]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(item.id);
      toast.info('Copied', 'Work item ID copied to clipboard.');
    } catch {
      toast.error('Copy failed', 'Clipboard access was blocked by the browser.');
    }
  };

  const row = 'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-200 hover:bg-white/5 text-left';
  return (
    <div data-rowmenu onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      <button
        ref={btn}
        aria-label={`Actions for ${item.title}`}
        aria-haspopup="menu"
        aria-expanded={!!pos}
        onClick={() => {
          const r = btn.current!.getBoundingClientRect();
          setPos(pos ? null : { top: r.bottom + 6, right: window.innerWidth - r.right });
        }}
        className="p-1.5 rounded-lg border border-white/10 text-slate-300 hover:bg-white/5"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>
      {pos && (
        <div role="menu" style={{ position: 'fixed', top: pos.top, right: pos.right }} className="z-50 w-48 rounded-xl border border-white/10 bg-[#0b1120] p-1.5 shadow-2xl">
          <button role="menuitem" className={row} onClick={() => navigate(`/items/${item.id}`)}><ExternalLink className="w-4 h-4" />Open</button>
          <button role="menuitem" className={row} onClick={() => { setPos(null); copy(); }}><Copy className="w-4 h-4" />Copy ID</button>
          {canClaim && (
            <button role="menuitem" className={row} disabled={claim.isPending} onClick={() => { setPos(null); claim.mutate(); }}>
              <HandMetal className="w-4 h-4" />Claim
            </button>
          )}
        </div>
      )}
    </div>
  );
};
