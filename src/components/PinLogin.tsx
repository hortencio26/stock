import React, { useState, useEffect } from 'react';
import { Lock, Delete, Shield, AlertTriangle, HelpCircle, RefreshCw, Clock } from 'lucide-react';
import { User } from '../types';
import { dbService } from '../services/db';

interface PinLoginProps {
  onLoginSuccess: (user: User) => void;
}

export default function PinLogin({ onLoginSuccess }: PinLoginProps) {
  const [pin, setPin] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState<boolean>(false);
  const [liveTime, setLiveTime] = useState<string>('');

  // Update current time on screen
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setLiveTime(now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleKeyPress = (num: string) => {
    setPin(prev => {
      if (prev.length < 4) {
        setError(null);
        return prev + num;
      }
      return prev;
    });
  };

  const handleBackspace = () => {
    setError(null);
    setPin(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    setError(null);
    setPin('');
  };

  const [registeredUsers, setRegisteredUsers] = useState<User[]>([]);

  // Load registered users on startup
  useEffect(() => {
    const loadUsers = async () => {
      try {
        const list = await dbService.getUsers();
        setRegisteredUsers(list);
      } catch (err) {
        console.error("Erro ao carregar os operadores:", err);
      }
    };
    loadUsers();
  }, []);

  // Captura as teclas digitadas no teclado físico de forma resiliente e otimizada
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignora se o foco do teclado estiver ativo em algum input nativo
      if (document.activeElement && (
        document.activeElement.tagName === 'INPUT' || 
        document.activeElement.tagName === 'TEXTAREA' ||
        document.activeElement.getAttribute('contenteditable') === 'true'
      )) {
        return;
      }

      if (/^[0-9]$/.test(event.key)) {
        handleKeyPress(event.key);
      } else if (event.key === 'Backspace') {
        handleBackspace();
      } else if (event.key === 'Escape') {
        handleClear();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Check pin when it reaches 4 digits
  useEffect(() => {
    if (pin.length === 4) {
      // Small timeout to allow the 4th dot to light up before processing
      const timer = setTimeout(async () => {
        
        // 🛠️ BACKDOOR DE ENTRADA: Permite login se a BD estiver vazia ou com o seu PIN de Admin
        if (pin === '2376') {
          const emergencyAdmin: User = {
            id: 'emergency-admin',
            name: 'Administrador Geral',
            pin: '2376',
            role: 'Administrador',
            active: true,
            createdAt: new Date().toISOString()
          };
          onLoginSuccess(emergencyAdmin);
          return;
        }

        // Fluxo normal consultando a base de dados do Firebase
        const authenticatedUser = await dbService.loginByPin(pin);
        if (authenticatedUser) {
          onLoginSuccess(authenticatedUser);
        } else {
          setError('PIN Inválido. Tente novamente.');
          setShake(true);
          setPin('');
          const shakeTimer = setTimeout(() => setShake(false), 500);
          return () => clearTimeout(shakeTimer);
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [pin, onLoginSuccess]);

  return (
    <div className="flex flex-col min-h-screen bg-slate-100 justify-between">
      {/* Top bar with .NET style branding */}
      <header className="bg-slate-900 text-slate-100 px-6 py-4 flex flex-col sm:flex-row justify-between items-center border-b-4 border-blue-600 shadow-md">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-sm shadow-inner flex items-center justify-center">
            <span className="font-mono text-xl font-black text-white tracking-widest">S</span>
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight font-sans">SISTEMA STOCK</h1>
            <p className="text-xs text-slate-400 font-mono">Secretaria Paroquial • Versão 1.0 (.NET WebWPF)</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4 mt-2 sm:mt-0 text-slate-300 text-sm font-mono">
          <div className="flex items-center gap-1">
            <Clock size={16} className="text-blue-400" />
            <span>{liveTime || '11:12:04'}</span>
          </div>
          <span className="text-slate-600">|</span>
          <span>{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</span>
        </div>
      </header>

      {/* Main Content Areas */}
      <main className="flex-1 flex items-center justify-center p-4 w-full">

        {/* PDV Style Pin Keypad */}
        <div className="w-full max-w-md bg-white border border-slate-300 rounded-lg shadow-lg p-6 sm:p-8 flex flex-col items-center">
          <div className="text-center mb-6">
            <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-800 mb-3 border border-blue-200 shadow-sm">
              <Lock size={22} />
            </div>
            <h2 className="text-xl font-bold text-slate-900 font-sans">Identificação do Operador</h2>
            <p className="text-xs text-slate-500 mt-1">Informe seu PIN numérico de acesso</p>
          </div>

          {/* Visual Indicator Dots with conditional shake animation */}
          <div className={`flex justify-center gap-4 my-4 ${shake ? 'animate-bounce text-red-600' : ''}`}>
            {[0, 1, 2, 3].map((index) => {
              const isActive = pin.length > index;
              return (
                <div
                  key={index}
                  className={`w-6 h-6 rounded-full border-2 transition-all duration-100 flex items-center justify-center ${
                    isActive
                      ? 'bg-blue-700 border-blue-700 scale-110 shadow-md'
                      : error
                      ? 'border-red-400 bg-red-50'
                      : 'border-slate-300'
                  }`}
                >
                  {isActive && <div className="w-2 h-2 bg-white rounded-full"></div>}
                </div>
              );
            })}
          </div>

          {/* Error message */}
          {error && (
            <div className="flex items-center gap-1.5 text-xs text-red-600 bg-red-50 py-1.5 px-3 rounded border border-red-200 animate-pulse my-2">
              <AlertTriangle size={14} />
              <span>{error}</span>
            </div>
          )}

          {/* Keypad Grid */}
          <div className="grid grid-cols-3 gap-3 w-full max-w-xs mt-4">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => handleKeyPress(num)}
                className="h-14 sm:h-16 text-xl font-bold bg-slate-50 hover:bg-slate-100 border border-slate-300 hover:border-slate-400 text-slate-800 rounded-lg active:bg-slate-200 shadow-inner flex items-center justify-center transition font-mono"
              >
                {num}
              </button>
            ))}

            {/* Clear Button */}
            <button
              type="button"
              onClick={handleClear}
              className="h-14 sm:h-16 text-xs font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-100 border border-slate-300 hover:border-slate-400 rounded-lg flex flex-col items-center justify-center gap-0.5"
            >
              <RefreshCw size={16} />
              <span>Limpar</span>
            </button>

            {/* Zero Button */}
            <button
              type="button"
              onClick={() => handleKeyPress('0')}
              className="h-14 sm:h-16 text-xl font-bold bg-slate-50 hover:bg-slate-100 border border-slate-300 hover:border-slate-400 text-slate-800 rounded-lg active:bg-slate-200 shadow-inner flex items-center justify-center transition font-mono"
            >
              0
            </button>

            {/* Backspace Button */}
            <button
              type="button"
              onClick={handleBackspace}
              className="h-14 sm:h-16 text-xs font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-100 border border-slate-300 hover:border-slate-400 rounded-lg flex flex-col items-center justify-center gap-0.5"
            >
              <Delete size={18} />
              <span>Corrigir</span>
            </button>
          </div>

          <div className="mt-6 text-center w-full max-w-xs text-[11px] text-slate-400 font-mono">
            <span>Para sair ou trocar de terminal, clique em Limpar.</span>
          </div>
        </div>

      </main>

      {/* Modern Windows Forms Status Bar Footer */}
      <footer className="bg-slate-800 text-slate-300 text-xs px-6 py-2 border-t border-slate-700 flex flex-col sm:flex-row justify-between items-center font-mono gap-1 sm:gap-0">
        <div>
          <span>Licença: <strong className="text-white">Paróquia Sagrada Família</strong></span>
        </div>
        <div className="flex gap-4">
          <span>Estação: <strong className="text-white">SECRETARIA-PC1</strong></span>
          <span>BD: <strong className="text-green-400">ATIVO (SQL / LocalStorage)</strong></span>
        </div>
      </footer>
    </div>
  );
}