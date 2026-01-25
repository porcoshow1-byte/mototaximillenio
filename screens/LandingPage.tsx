import React from 'react';
import {
  Shield, Zap, TrendingUp, Users, Map,
  CheckCircle, ArrowRight, LayoutDashboard, Globe
} from 'lucide-react';
import { Button } from '../components/UI';

export const LandingPage = ({ onStartDemo }: { onStartDemo: () => void }) => {
  return (
    <div className="min-h-screen bg-white font-sans text-gray-900">

      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center gap-2">
              <img src="/logo-new.jpg" alt="MotoJá" className="h-10 w-10 rounded-lg object-cover" />
              <span className="text-2xl font-bold tracking-tight text-gray-900">
                Moto<span className="text-orange-500">Já</span>
              </span>
            </div>
            <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-600">
              <a href="#benefits" className="hover:text-orange-500 transition">Benefícios</a>
              <a href="#features" className="hover:text-orange-500 transition">Recursos</a>
              <a href="#admin" className="hover:text-orange-500 transition">Gestão</a>
            </div>
            <Button onClick={onStartDemo} className="hidden md:flex shadow-orange-500/20">
              Ver Demonstração
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-16 pb-20 lg:pt-32 lg:pb-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-50 text-orange-600 font-semibold text-sm mb-8 animate-fade-in border border-orange-100">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
              </span>
              Tecnologia de Ponta para sua Frota
            </div>

            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-gray-900 mb-8 animate-slide-up leading-tight">
              Seu Próprio App de <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-red-600">
                Mobilidade Urbana
              </span>
            </h1>

            <p className="text-xl text-gray-500 mb-10 max-w-2xl mx-auto leading-relaxed animate-slide-up" style={{ animationDelay: '0.1s' }}>
              Chega de perder corridas no WhatsApp. Tenha uma plataforma completa tipo Uber/99 com a
              <strong> sua marca</strong>. Automatize despachos, controle pagamentos e escale seu negócio.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center animate-slide-up" style={{ animationDelay: '0.2s' }}>
              <button
                onClick={onStartDemo}
                className="px-8 py-4 bg-orange-600 text-white rounded-2xl font-bold text-lg hover:bg-orange-700 hover:scale-105 transition-all shadow-xl shadow-orange-500/30 flex items-center gap-3"
              >
                Acessar Demonstração <ArrowRight size={20} />
              </button>
              <button className="px-8 py-4 bg-white text-gray-700 border border-gray-200 rounded-2xl font-bold text-lg hover:bg-gray-50 transition-all flex items-center gap-2">
                Falar com Consultor
              </button>
            </div>
          </div>
        </div>

        {/* Background Decorative Elements */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full z-[-1] overflow-hidden pointer-events-none opacity-40">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-orange-200 rounded-full mix-blend-multiply filter blur-3xl animate-pulse-slow"></div>
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-yellow-200 rounded-full mix-blend-multiply filter blur-3xl animate-pulse-slow" style={{ animationDelay: '1s' }}></div>
        </div>
      </section>

      {/* Pain Points / Solution */}
      <section id="benefits" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900">Por que modernizar sua frota?</h2>
            <p className="text-gray-500 mt-4 max-w-2xl mx-auto">
              O modelo antigo via rádio e WhatsApp limita seu crescimento. Veja como a tecnologia transforma sua operação.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard
              icon={<Shield size={32} className="text-orange-500" />}
              title="Marca Própria (White Label)"
              description="O aplicativo é entregue com seu logo, suas cores e seu nome. Seus clientes vão amar a sua nova identidade profissional."
            />
            <FeatureCard
              icon={<TrendingUp size={32} className="text-blue-500" />}
              title="Faturamento Automático"
              description="Chega de caderninho. O sistema calcula rotas, preços e gera relatórios financeiros precisos em tempo real."
            />
            <FeatureCard
              icon={<Map size={32} className="text-green-500" />}
              title="Rastreamento em Tempo Real"
              description="Segurança para o passageiro e controle para você. Saiba exatamente onde cada moto está a cada segundo."
            />
          </div>
        </div>
      </section>

      {/* App Showcase */}
      <section id="features" className="py-20 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row items-center gap-16">
            <div className="lg:w-1/2 space-y-8">
              <h2 className="text-4xl font-bold text-gray-900 leading-tight">
                A experiência perfeita para <span className="text-orange-500">Passageiros</span> e <span className="text-orange-500">Pilotos</span>
              </h2>
              <p className="text-lg text-gray-500">
                Entregamos 3 aplicativos conectados: App do Passageiro (Android/iOS), App do Piloto e Painel Administrativo Web.
              </p>

              <div className="space-y-4">
                <CheckItem text="Geolocalização precisa com Google Maps" />
                <CheckItem text="Opção de Mototáxi e Entregas (Moto/Bike)" />
                <CheckItem text="Chat integrado entre motorista e cliente" />
                <CheckItem text="Histórico de corridas e avaliação 5 estrelas" />
              </div>

              <div className="pt-4">
                <Button onClick={onStartDemo} className="px-8" variant="secondary">
                  Testar Aplicativo Agora
                </Button>
              </div>
            </div>

            <div className="lg:w-1/2 relative">
              {/* Abstract Phone Representation */}
              <div className="relative mx-auto border-gray-800 bg-gray-800 border-[14px] rounded-[2.5rem] h-[600px] w-[300px] shadow-2xl flex flex-col overflow-hidden">
                <div className="h-[32px] w-[3px] bg-gray-800 absolute -left-[17px] top-[72px] rounded-l-lg"></div>
                <div className="h-[46px] w-[3px] bg-gray-800 absolute -left-[17px] top-[124px] rounded-l-lg"></div>
                <div className="h-[64px] w-[3px] bg-gray-800 absolute -right-[17px] top-[142px] rounded-r-lg"></div>
                <div className="rounded-[2rem] overflow-hidden w-full h-full bg-white relative">
                  {/* Mock Screen Content (Mini version of UserApp) */}
                  <div className="bg-orange-500 h-1/2 w-full absolute top-0 rounded-b-[3rem]"></div>
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                    <div className="bg-white p-4 rounded-2xl shadow-xl w-full mb-4 flex items-center gap-3">
                      <div className="bg-orange-100 p-2 rounded-full"><Map size={20} className="text-orange-500" /></div>
                      <div className="text-left">
                        <div className="h-2 w-24 bg-gray-200 rounded mb-1"></div>
                        <div className="h-2 w-16 bg-gray-100 rounded"></div>
                      </div>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-xl w-full">
                      <h3 className="font-bold text-gray-800 mb-2">Para onde vamos?</h3>
                      <div className="w-full h-10 bg-gray-100 rounded-lg mb-4"></div>
                      <div className="w-full h-10 bg-orange-500 rounded-lg"></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating Badges */}
              <div className="absolute top-20 -right-10 bg-white p-4 rounded-xl shadow-xl border border-gray-100 animate-pulse-slow">
                <div className="flex items-center gap-3">
                  <div className="bg-green-100 p-2 rounded-full text-green-600"><Users size={20} /></div>
                  <div>
                    <p className="text-xs text-gray-400">Motoristas</p>
                    <p className="font-bold text-gray-800">Online</p>
                  </div>
                </div>
              </div>
              <div className="absolute bottom-20 -left-10 bg-white p-4 rounded-xl shadow-xl border border-gray-100 animate-pulse-slow" style={{ animationDelay: '1.5s' }}>
                <div className="flex items-center gap-3">
                  <div className="bg-blue-100 p-2 rounded-full text-blue-600"><TrendingUp size={20} /></div>
                  <div>
                    <p className="text-xs text-gray-400">Receita</p>
                    <p className="font-bold text-gray-800">+ 145%</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Admin Section */}
      <section id="admin" className="py-20 bg-gray-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Controle Total na Palma da Mão</h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              O Painel Administrativo Web oferece visão de águia sobre toda sua operação.
            </p>
          </div>

          <div className="relative bg-gray-800 rounded-2xl p-4 md:p-8 border border-gray-700 shadow-2xl">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-gray-700 p-6 rounded-xl border border-gray-600">
                <LayoutDashboard className="text-orange-500 mb-4" size={32} />
                <h3 className="font-bold text-lg mb-2">Dashboard em Tempo Real</h3>
                <p className="text-sm text-gray-400">Acompanhe corridas, motoristas ativos e faturamento ao vivo.</p>
              </div>
              <div className="bg-gray-700 p-6 rounded-xl border border-gray-600">
                <Users className="text-blue-500 mb-4" size={32} />
                <h3 className="font-bold text-lg mb-2">Gestão de Motoristas</h3>
                <p className="text-sm text-gray-400">Aprovação de documentos, bloqueio, e controle de comissões.</p>
              </div>
              <div className="bg-gray-700 p-6 rounded-xl border border-gray-600">
                <Globe className="text-green-500 mb-4" size={32} />
                <h3 className="font-bold text-lg mb-2">Mapa de Calor</h3>
                <p className="text-sm text-gray-400">Entenda onde estão as chamadas e posicione sua frota estrategicamente.</p>
              </div>
            </div>


          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 bg-gradient-to-br from-orange-600 to-red-600 text-white text-center">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-4xl font-bold mb-6">Pronto para digitalizar sua frota?</h2>
          <p className="text-xl text-orange-100 mb-10">
            Não cobramos por corrida. Modelo de assinatura fixa ou porcentagem, você decide.
            Tenha seu app rodando em menos de 7 dias.
          </p>
          <button
            onClick={onStartDemo}
            className="px-10 py-5 bg-white text-orange-600 rounded-full font-bold text-xl shadow-2xl hover:bg-gray-50 hover:scale-105 transition-all"
          >
            Quero Ver a Demonstração
          </button>
          <p className="mt-6 text-sm opacity-70">
            Sem compromisso • Não requer cartão de crédito para testar
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-50 py-12 border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-4 text-center text-gray-500 text-sm">
          <p className="mb-4 font-bold text-gray-900 text-lg">MotoJá Tecnologia</p>
          <p>&copy; {new Date().getFullYear()} MotoJá. Todos os direitos reservados.</p>
          <p className="mt-2">Av. Major Rangel, Centro - Avaré, SP</p>
        </div>
      </footer>
    </div>
  );
};

// Componentes Auxiliares
const FeatureCard = ({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) => (
  <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100 hover:shadow-xl transition-shadow group">
    <div className="mb-6 bg-gray-50 w-16 h-16 rounded-xl flex items-center justify-center group-hover:bg-orange-50 transition-colors">
      {icon}
    </div>
    <h3 className="text-xl font-bold text-gray-900 mb-3">{title}</h3>
    <p className="text-gray-500 leading-relaxed">{description}</p>
  </div>
);

const CheckItem = ({ text }: { text: string }) => (
  <div className="flex items-center gap-3">
    <CheckCircle size={20} className="text-green-500 flex-shrink-0" />
    <span className="text-gray-700 font-medium">{text}</span>
  </div>
);