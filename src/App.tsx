import React, { Component, useState, useEffect } from 'react';
import { User } from './types';
import { dbService } from './services/db';
import PinLogin from './components/PinLogin';
import MainDashboard from './components/MainDashboard';

// CLASS ERROR BOUNDARY - Blindagem Suprema contra qualquer travamento na visualização
class ErrorBoundary extends Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  public state: { hasError: boolean; error: Error | null };
  public props: { children: React.ReactNode };

  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.props = props;
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary detectou uma exceção em tempo de execução:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-slate-100 p-6 font-sans">
          <div className="bg-slate-800 border-2 border-red-650 rounded-lg shadow-2xl p-6 max-w-xl w-full space-y-4">
            <h2 className="text-lg font-bold text-red-400 uppercase font-mono tracking-tight flex items-center gap-2">
              ⚠️ Falha Crítica de Execução (Modo Resiliente)
            </h2>
            <p className="text-xs text-slate-350 leading-relaxed font-semibold">
              Ocorreu um erro que impediu o carregamento correto da página. Você pode recarregar ou limpar a memória local para restaurar os padrões seguros de fábrica.
            </p>
            <div className="bg-slate-950 p-4 rounded border border-slate-700 max-h-40 overflow-auto">
              <code className="text-xs text-red-300 font-mono block whitespace-pre-wrap leading-normal">
                {this.state.error?.stack || this.state.error?.message || String(this.state.error)}
              </code>
            </div>
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-755">
              <button
                onClick={() => {
                  localStorage.clear();
                  window.location.reload();
                }}
                className="px-4 py-2 bg-red-700 hover:bg-red-800 text-white font-mono text-xs font-bold rounded transition shadow cursor-pointer"
              >
                Limpar Memória Geral & Recarregar
              </button>
              <button
                onClick={() => {
                  window.location.reload();
                }}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-mono text-xs font-semibold rounded border border-slate-605 transition cursor-pointer"
              >
                Tentar Recarregar
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Auto-authenticate if active session exists
  useEffect(() => {
    const initApp = async () => {
      try {
        // Timeout de Segurança de 3 segundos contra travamento de Promise pendente na rede do Firestore
        const initPromise = dbService.initialize();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error("Timeout de inicialização do banco")), 3000)
        );
        
        await Promise.race([initPromise, timeoutPromise]).catch(err => {
          console.warn("Inicialização do Firebase tomou timeout de segurança. Carregando em modo local offline resiliente:", err);
        });

        const session = dbService.getCurrentSession();
        if (session) {
          // Validate that user still exists and is active (com timeout de 1.5s)
          const usersPromise = dbService.getUsers();
          const usersTimeout = new Promise<User[]>((resolve) => 
            setTimeout(() => resolve([]), 1500)
          );
          
          const users = await Promise.race([usersPromise, usersTimeout]);
          const verifiedUser = users.find(u => u.id === session.user.id && u.active);
          
          if (verifiedUser) {
            setCurrentUser(verifiedUser);
          } else if (users.length > 0) {
            await dbService.logout();
          }
        }
      } catch (e) {
        console.error("Initialization error:", e);
      } finally {
        setLoading(false);
      }
    };
    initApp();
  }, []);

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
  };

  const handleLogout = async () => {
    await dbService.logout();
    setCurrentUser(null);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-100 font-mono text-sm text-slate-500">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <span>Carregando Sistema Stock...</span>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div id="app-root" className="min-h-screen font-sans bg-slate-100 selection:bg-blue-600 selection:text-white">
        {currentUser ? (
          <MainDashboard currentUser={currentUser} onLogout={handleLogout} />
        ) : (
          <PinLogin onLoginSuccess={handleLoginSuccess} />
        )}
      </div>
    </ErrorBoundary>
  );
}
