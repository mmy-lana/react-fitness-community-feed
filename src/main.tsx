import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { ErrorBoundary } from './components/ui/ErrorBoundary';

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      {/* Anything that throws during render is caught here instead of leaving
          a blank page. */}
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>
  );
}
