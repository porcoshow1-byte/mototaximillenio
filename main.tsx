import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { Loader2, AlertTriangle } from 'lucide-react';

// Error Boundary para capturar falhas críticas e evitar tela branca
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: any }> {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gray-50 text-center">
          <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full border border-red-100">
            <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <AlertTriangle className="text-red-500" size={32} />
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">Ops! Algo deu errado.</h1>
            <p className="text-gray-500 mb-4 text-sm">
              O aplicativo encontrou um erro inesperado. Tente recarregar a página.
            </p>
            <div className="bg-gray-100 p-3 rounded-lg text-left text-xs font-mono text-red-600 overflow-auto max-h-32 mb-6">
              {this.state.error?.message || 'Erro desconhecido'}
            </div>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold transition-colors"
            >
              Recarregar Página
            </button>
          </div>
        </div>
      );
    }

    // @ts-ignore
    return (this as any).props.children;
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);

// Register Service Worker for PWA & Notifications
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('SW registered: ', registration);
      })
      .catch(registrationError => {
        console.log('SW registration failed: ', registrationError);
      });
  });
}