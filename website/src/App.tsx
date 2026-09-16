import { BrowserRouter } from 'react-router-dom';
import { SessionProvider } from '@/state/SessionContext';
import { ToastProvider } from '@/state/ToastContext';
import { AppRoutes } from '@/app/routes';

export default function App() {
  return (
    <SessionProvider>
      <ToastProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </ToastProvider>
    </SessionProvider>
  );
}
