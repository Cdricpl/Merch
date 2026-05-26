import './styles.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';
import { getRouter } from './router';

function showError(label: string, err: unknown) {
  const msg = err instanceof Error ? `${err.name}: ${err.message}\n${err.stack ?? ''}` : String(err);
  const box = document.getElementById('app-error');
  if (!box) {
    const div = document.createElement('div');
    div.id = 'app-error';
    div.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:#b00020;color:#fff;padding:12px;font:12px/1.4 system-ui;white-space:pre-wrap;max-height:50vh;overflow:auto;';
    document.body.appendChild(div);
    div.textContent = `[${label}] ${msg}`;
  } else {
    box.textContent += `\n\n[${label}] ${msg}`;
  }
}

window.addEventListener('error', (e) => showError('window.error', e.error ?? e.message));
window.addEventListener('unhandledrejection', (e) => showError('unhandledrejection', e.reason));

// Touch counter — shows independently of React's event system.
// If touches register here but React buttons don't fire → event delegation broken.
// If touches DON'T register → invisible overlay blocking the screen.
let _touches = 0;
document.addEventListener('touchstart', () => {
  _touches++;
  const el = document.getElementById('app-tc');
  if (el) el.textContent = `T:${_touches}`;
}, { passive: true });

const tcDiv = document.createElement('div');
tcDiv.id = 'app-tc';
tcDiv.style.cssText = 'position:fixed;bottom:calc(env(safe-area-inset-bottom,0px) + 60px);right:4px;z-index:99998;background:rgba(0,0,0,.65);color:#4f4;padding:1px 5px;font:10px monospace;border-radius:3px;pointer-events:none;';
tcDiv.textContent = 'T:0';
document.body.appendChild(tcDiv);

try {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <RouterProvider router={getRouter()} />
    </React.StrictMode>
  );
} catch (err) {
  showError('mount', err);
}
