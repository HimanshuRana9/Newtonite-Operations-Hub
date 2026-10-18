import React from 'react';

interface PageHeaderProps {
  eyebrow: string;
  eyebrowNote?: string;
  title: React.ReactNode;
  description?: string;
  actions?: React.ReactNode;
}

/** Shared page heading: small section label, title, optional description and right-aligned actions. */
export const PageHeader: React.FC<PageHeaderProps> = ({ eyebrow, eyebrowNote, title, description, actions }) => (
  <header className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
    <div className="min-w-0">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-sky-400">
        {eyebrow}
        {renderNote(eyebrowNote)}
      </div>
      <h1 className="mt-1 text-3xl sm:text-4xl font-extrabold tracking-tight text-white flex items-center gap-2.5">{title}</h1>
      {description && <p className="mt-1.5 text-slate-400">{description}</p>}
    </div>
    {actions && <div className="flex items-center gap-3 shrink-0">{actions}</div>}
  </header>
);

function renderNote(note?: string) {
  if (!note) return null;
  return (
    <>
      <span className="text-slate-600">·</span>
      <span className="normal-case tracking-normal font-normal text-slate-300">{note}</span>
    </>
  );
}
