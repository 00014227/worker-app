import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import reportWebVitals from './reportWebVitals';

const RETRY_KEY = 'vite-preload-retry';
const RETRY_WINDOW_MS = 10_000;

window.addEventListener('vite:preloadError', (event) => {
  const last = Number(sessionStorage.getItem(RETRY_KEY));
  if (last && Date.now() - last < RETRY_WINDOW_MS) return;

  event.preventDefault();
  sessionStorage.setItem(RETRY_KEY, String(Date.now()));
  window.location.reload();
});
const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement,
);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
