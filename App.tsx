import React, { useState, useEffect } from 'react';
import { logout } from './services/auth';
import { UserApp } from './screens/UserApp';
import { DriverApp } from './screens/DriverApp';
import { AdminDashboard } from './screens/AdminDashboard';
import { CompanyDashboard } from './screens/CompanyDashboard';
import { AuthScreen } from './screens/AuthScreen';
import { LandingPage } from './screens/LandingPage';
import { Role } from './types';
import { Smartphone, LayoutDashboard, Bike, ArrowLeft, ArrowRight, Building2 } from 'lucide-react';
import { APP_CONFIG } from './constants';
import { AuthProvider, useAuth } from './context/AuthContext';
import { isAppContext, getAppUrl } from './utils/url';

// --- APP ROUTER (Functional Application) ---
// This component runs ONLY when on 'app.motoja.top' or 'localhost/app/*'
const AppRouter = () => {
  const { user } = useAuth();

  // Parse role from URL (e.g. /app/passageiro -> 'user')
  const getRoleFromUrl = (): Role | 'login' => {
    const path = window.location.pathname;

    // Normalize path for local dev (remove /app prefix)
    const effectivePath = path.replace('/app', '') || '/';

    if (effectivePath.includes('/passageiro')) return 'user';
    if (effectivePath.includes('/piloto')) return 'driver';
    if (effectivePath.includes('/cadastro-motorista')) return 'driver-register';
    if (effectivePath.includes('/admin')) return 'admin';
    if (effectivePath.includes('/empresas')) return 'company';

    // Default to login if root of app or unknown
    return 'login';
  };

  const [role, setRole] = useState<Role | 'login'>(getRoleFromUrl);

  // Sync session check
  useEffect(() => {
    if (!user) return;
    const checkSession = async () => {
      try {
        const { validateSession } = await import('./services/user');
        const isValid = await validateSession(user.uid);
        if (!isValid) {
          console.warn("Session invalidated.");
          await logout();
          window.location.reload();
        }
      } catch (e) {
        console.error("Session check failed", e);
      }
    };
    const interval = setInterval(checkSession, 10000);
    return () => clearInterval(interval);
  }, [user]);

  // Handle Login State
  if (!user && role !== 'driver-register') {
    // If we are at a specific route like /app/admin but not logged in, 
    // we show the AuthScreen for that role (or generic).
    // Mapping URL role to AuthScreen expected role:
    const authRoleMap: Record<string, string> = {
      'user': 'user',
      'driver': 'driver',
      'admin': 'admin',
      'company': 'company',
      'login': 'user' // Default login screen
    };

    return (
      <AuthScreen
        role={authRoleMap[role as string] || 'user'}
        onLoginSuccess={() => {
          // After login, we stay on the same component but 'user' will be truthy,
          // so it will fall through to the App logic below.
          // We might want to force a re-evaluation or just let React handle it.
        }}
        onBack={() => {
          // Back from App Login -> Go to Site (Main Domain)
          window.location.href = window.location.origin.replace('/app', ''); // Simple mock logic, for prod needs real domain
          // Better:
          if (window.location.hostname.includes('localhost')) {
            window.location.href = '/';
          } else {
            window.location.href = 'https://motoja.top';
          }
        }}
      />
    );
  }

  // Driver Registration (No Login Required)
  if (role === 'driver-register') {
    if (user) {
      setRole('driver'); // Auto-switch if registered
      return <div className="h-screen bg-gray-900 flex items-center justify-center text-white">Carregando App...</div>;
    }
    return (
      <AuthScreen
        role="driver-register"
        onLoginSuccess={() => setRole('driver')}
        onBack={() => { window.location.href = getAppUrl('piloto'); }} // Back simply reloads or goes to login
      />
    );
  }

  // Logged In Views
  if (role === 'user') return <UserApp />;
  if (role === 'driver') return <DriverApp />;
  if (role === 'admin') return <AdminDashboard onLogout={logout} />;
  if (role === 'company') return <CompanyDashboard onBack={logout} />;

  // User logged in but unknown role or root /app
  return (
    <div className="h-screen flex flex-col items-center justify-center bg-gray-50">
      <h1 className="text-xl font-bold mb-4">Selecione o Acesso</h1>
      <div className="space-x-4">
        <button className="px-4 py-2 bg-orange-500 text-white rounded" onClick={() => setRole('user')}>Passageiro</button>
        <button className="px-4 py-2 bg-gray-800 text-white rounded" onClick={() => setRole('driver')}>Piloto</button>
      </div>
    </div>
  );
}

// --- SITE ROUTER (Marketing & Presentation) ---
// This runs on 'motoja.top' or 'localhost:3000/' (root)
const SiteRouter = () => {
  const [view, setView] = useState<'landing' | 'presentation'>('landing');

  useEffect(() => {
    // Simple path check for local nav
    if (window.location.pathname.includes('/apresentacao')) {
      setView('presentation');
    }
  }, []);

  const navigateToPres = () => {
    window.history.pushState({}, '', '/apresentacao');
    setView('presentation');
  };

  const navigateToHome = () => {
    window.history.pushState({}, '', '/');
    setView('landing');
  };

  if (view === 'presentation') {
    return <DemoPresentation onBack={navigateToHome} />;
  }

  return <LandingPage onStartDemo={navigateToPres} />;
};


// --- DEMO PRESENTATION SCREEN (Replaces old 'Selection') ---
// No Login Logic Here. Just Links.
const DemoPresentation = ({ onBack }: { onBack: () => void }) => {
  const openApp = (path: string) => {
    // Navigate to the APP domain
    window.location.href = getAppUrl(path);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-500 to-red-600 flex flex-col items-center justify-center p-4 animate-fade-in relative overflow-hidden">
      <div className="absolute top-6 left-6 z-10">
        <button
          onClick={onBack}
          className="text-white/80 hover:text-white flex items-center gap-2 font-medium bg-black/20 px-4 py-2 rounded-full hover:bg-black/30 transition"
        >
          <ArrowLeft size={20} /> Voltar ao Site
        </button>
      </div>

      <div className="max-w-4xl w-full z-10">
        <div className="text-center text-white mb-12 animate-slide-up">
          <h1 className="text-5xl font-bold mb-4">{APP_CONFIG.name}</h1>
          <p className="text-xl opacity-90">Demonstração Interativa da Plataforma</p>
          <div className="mt-4 inline-block bg-white/20 backdrop-blur-md px-4 py-1 rounded-full text-sm font-medium border border-white/30">
            Ambiente de Teste • v1.0.0
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-slide-up" style={{ animationDelay: '0.2s' }}>
          <RoleCard
            title="Passageiro"
            description="Solicitar mototáxi e entregas."
            icon={<Smartphone size={32} />}
            onClick={() => openApp('passageiro')}
          />
          <RoleCard
            title="Piloto"
            description="Receber corridas e lucrar."
            icon={<Bike size={32} />}
            onClick={() => openApp('piloto')}
          />
          <RoleCard
            title="Empresas"
            description="Gestão de corridas corporativas."
            icon={<Building2 size={32} />}
            onClick={() => openApp('empresas')}
          />
          <RoleCard
            title="Painel Admin"
            description="Gestão da plataforma."
            icon={<LayoutDashboard size={32} />}
            onClick={() => openApp('admin')}
          />
        </div>
      </div>

      <div className="absolute bottom-6 text-center text-white/40 text-xs w-full">
        {APP_CONFIG.name} &copy; {new Date().getFullYear()}
      </div>
    </div>
  );
};

const RoleCard = ({ title, description, icon, onClick }: { title: string, description: string, icon: React.ReactNode, onClick: () => void }) => (
  <div
    onClick={onClick}
    className="bg-white rounded-3xl p-8 cursor-pointer hover:-translate-y-2 transition-all duration-300 shadow-xl group relative overflow-hidden h-full flex flex-col"
  >
    <div className="absolute top-0 right-0 w-24 h-24 bg-orange-50 rounded-bl-[100px] -mr-4 -mt-4 z-0 transition-transform group-hover:scale-110"></div>
    <div className="relative z-10 flex-1 flex flex-col">
      <div className="bg-orange-100 w-16 h-16 rounded-2xl flex items-center justify-center text-orange-600 mb-6 group-hover:bg-orange-500 group-hover:text-white transition-colors shadow-sm">
        {icon}
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">{title}</h2>
      <p className="text-gray-500 leading-relaxed mb-4 flex-1">{description}</p>
      <div className="mt-auto flex items-center text-orange-600 font-bold group-hover:translate-x-2 transition-transform">
        Acessar <ArrowRight size={18} className="ml-2" />
      </div>
    </div>
  </div>
);

// --- MAIN ENTRY POINT ---
const Main = () => {
  const [inAppMode, setInAppMode] = useState(isAppContext());

  useEffect(() => {
    // Initial check
    setInAppMode(isAppContext());

    // Listener for popstate to handle browser navigation if needed
    const handleChange = () => setInAppMode(isAppContext());
    window.addEventListener('popstate', handleChange);
    return () => window.removeEventListener('popstate', handleChange);
  }, []);

  return inAppMode ? <AppRouter /> : <SiteRouter />;
};

const App = () => {
  return (
    <AuthProvider>
      <Main />
    </AuthProvider>
  );
};

export default App;