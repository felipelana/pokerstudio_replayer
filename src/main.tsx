import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './i18n';
import './index.css';
import { App } from './App';
import { installErrorReporter } from '@/lib/infrastructure/observability/errorReporter';

// A crash in the browser is only ever seen in the browser, unless it is sent.
installErrorReporter();

// No <StrictMode>: its dev-only double effects unmount/remount the R3F canvas
// root and leave the 3D scene blank until the next state update.
ReactDOM.createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>,
);
