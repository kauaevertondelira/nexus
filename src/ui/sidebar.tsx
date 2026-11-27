import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { Button } from './components/button';

// Uma ilha pequena de shadcn/ui: os módulos operacionais continuam em HTML estático.
export function mountSidebarToggle(host: HTMLElement, collapsed: boolean) {
  const root = createRoot(host);
  const update = (compact: boolean) => {
    const label = compact ? 'Expandir barra lateral' : 'Recolher barra lateral';
    root.render(
      <Button type="button" variant="ghost" size="icon" className="sidebar-toggle"
        data-action="sidebar-toggle" aria-label={label} title={label}
        aria-controls="sidebar-nav" aria-expanded={!compact}>
        <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
          <path d="m14 6-6 6 6 6" />
        </svg>
      </Button>
    );
  };
  update(collapsed);
  return { update, dispose: () => root.unmount() };
}
