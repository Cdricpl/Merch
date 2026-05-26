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

try {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <RouterProvider router={getRouter()} />
    </React.StrictMode>
  );
} catch (err) {
  showError('mount', err);
}
