import React, { useState, useEffect } from 'react';
import { User } from './types';
import { dbService } from './services/db';
import PinLogin from './components/PinLogin';
import MainDashboard from './components/MainDashboard';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Auto-authenticate if active session exists
  useEffect(() => {
    const initApp = async () => {
      try {
        await dbService.initialize();
        const session = dbService.getCurrentSession();
        if (session) {
          // Validate that user still exists and is active
          const users = await dbService.getUsers();
          const verifiedUser = users.find(u => u.id === session.user.id && u.active);
          if (verifiedUser) {
            setCurrentUser(verifiedUser);
          } else {
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
    <div id="app-root" className="min-h-screen font-sans bg-slate-100 selection:bg-blue-600 selection:text-white">
      {currentUser ? (
        <MainDashboard currentUser={currentUser} onLogout={handleLogout} />
      ) : (
        <PinLogin onLoginSuccess={handleLoginSuccess} />
      )}
    </div>
  );
}
