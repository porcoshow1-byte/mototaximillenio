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

const Main = () => {
  // Determine initial role from URL or localStorage
  const getInitialRole = (): Role => {
    const path = window.location.pathname;
    if (path === '/' || path === '') return 'landing';
    if (path === '/apresentacao' || path === '/apresentacao/') return 'selection';
    if (path === '/passageiro' || path === '/passageiro/') return 'user';
    if (path === '/piloto' || path === '/piloto/') return 'driver';
    if (path === '/cadastro-motorista' || path === '/cadastro-motorista/') return 'driver-register';
    if (path === '/admin' || path === '/admin/') return 'admin';
    if (path === '/empresas' || path === '/empresas/') return 'company';

    // Fallback to localStorage if at root or unknown
    const saved = localStorage.getItem('motoja_role');
    return (saved as Role) || 'landing';
  };

  const [currentRole, setCurrentRole] = useState<Role>(getInitialRole);
  const { user } = useAuth();

  // Sync URL with currentRole
  useEffect(() => {
    let path = '/';
    switch (currentRole) {
      case 'selection': path = '/apresentacao'; break;
      case 'user': path = '/passageiro'; break;
      case 'driver': path = '/piloto'; break;
      case 'driver-register': path = '/cadastro-motorista'; break;
      case 'admin': path = '/admin'; break;
      case 'company': path = '/empresas'; break;
      case 'landing': default: path = '/'; break;
    }

    // Update URL without reload if it changed
    if (window.location.pathname !== path) {
      window.history.pushState({}, '', path);
    }

    localStorage.setItem('motoja_role', currentRole);
  }, [currentRole]);

  // Handle browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      setCurrentRole(getInitialRole());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // --- Global Session Monitor ---
  useEffect(() => {
    if (!user) return;

    const checkSession = async () => {
      try {
        const { validateSession } = await import('./services/user');
        const isValid = await validateSession(user.uid);

        if (!isValid) {
          console.warn("Session invalidated. Logging out.");
          await logout();
          alert("Você foi desconectado pois sua conta foi acessada em outro dispositivo.");
          setCurrentRole('landing');
          window.location.href = '/';
        }
      } catch (e) {
        console.error("Session check failed", e);
      }
    };

    // Check immediately and then every 10 seconds
    // Delay initial check to allow registerSession to complete and propagate
    const initialTimer = setTimeout(() => {
      checkSession();
    }, 2000);

    const interval = setInterval(checkSession, 10000);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [user]);

  // 1. Landing Page (Estado Inicial)
  if (currentRole === 'landing') {
    return <LandingPage onStartDemo={() => setCurrentRole('selection')} />;
  }

  // 2. Driver Registration Direct Link (/cadastro-motorista)
  // This route is ALWAYS for new driver registration - no login state allowed
  if (currentRole === 'driver-register') {
    // If user just registered successfully, redirect to driver app
    if (user) {
      // User registered successfully, change role to driver to access driver app
      setCurrentRole('driver');
      return (
        <div className="h-screen flex items-center justify-center bg-gray-900 text-white">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
        </div>
      );
    }
    // Show clean registration screen
    return (
      <AuthScreen
        role="driver-register"
        onLoginSuccess={() => { setCurrentRole('driver'); }}
        onBack={() => setCurrentRole('selection')}
      />
    );
  }

  // Se o usuário selecionou um papel (ex: passageiro) mas NÃO está logado, mostra Login
  if (currentRole !== 'selection' && !user) {
    return (
      <AuthScreen
        role={currentRole}
        onLoginSuccess={() => { }} // O AuthContext vai atualizar automaticamente o user
        onBack={() => setCurrentRole('selection')}
      />
    );
  }

  // Se está logado e selecionou passageiro
  if (currentRole === 'user' && user) {
    return <UserApp />;
  }

  // Se está logado e selecionou motorista
  if (currentRole === 'driver' && user) {
    return <DriverApp />;
  }

  // Admin - requires user to be logged in
  if (currentRole === 'admin' && user) {
    return <AdminDashboard onLogout={async () => { await logout(); setCurrentRole('admin'); }} />;
  }

  // Painel Corporativo
  if (currentRole === 'company') {
    return <CompanyDashboard onBack={() => setCurrentRole('landing')} />;
  }

  // Tela Inicial (Seleção) - FIX: Use relative container and absolute footer
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-500 to-red-600 flex flex-col items-center justify-center p-4 animate-fade-in relative overflow-hidden">
      <div className="absolute top-6 left-6 z-10">
        <button
          onClick={() => setCurrentRole('landing')}
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
            onClick={() => setCurrentRole('user')}
          />
          <RoleCard
            title="Piloto"
            description="Receber corridas e lucrar."
            icon={<Bike size={32} />}
            onClick={() => setCurrentRole('driver')}
          />
          <RoleCard
            title="Empresas"
            description="Gestão de corridas corporativas."
            icon={<Building2 size={32} />}
            onClick={() => setCurrentRole('company')}
          />
          <RoleCard
            title="Painel Admin"
            description="Gestão da plataforma."
            icon={<LayoutDashboard size={32} />}
            onClick={() => { logout(); setCurrentRole('admin'); }}
          />
        </div>
      </div>

      <div className="absolute bottom-6 text-center text-white/40 text-xs w-full">
        {APP_CONFIG.name} &copy; {new Date().getFullYear()}
      </div>
    </div>
  );
};

// Envolvemos o App inteiro no AuthProvider
const App = () => {
  return (
    <AuthProvider>
      <Main />
    </AuthProvider>
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

export default App;