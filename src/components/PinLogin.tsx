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
    if (pin.length < 4) {
      setError(null);
      setPin(prev => prev + num);
    }
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

  // Check pin when it reaches 4 digits
  useEffect(() => {
    if (pin.length === 4) {
      // Small timeout to allow the 4th dot to light up before processing
      const timer = setTimeout(async () => {
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

  // Click on quick testing user
  const handleTestUserClick = (testPin: string) => {
    setPin(testPin);
  };

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
            <span>{liveTime || '21:10:55'}</span>
          </div>
          <span className="text-slate-600">|</span>
          <span>{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</span>
        </div>
      </header>

      {/* Main Content Areas */}
      <main className="flex-1 flex flex-col lg:flex-row items-center justify-center gap-8 p-4 max-w-7xl mx-auto w-full">
        
        {/* Left Side: Parochial presentation / security info */}
        <div className="w-full lg:w-1/2 max-w-md flex flex-col justify-center text-slate-800 space-y-6 bg-white p-6 rounded-lg border border-slate-300 shadow-sm">
          <div className="border-b border-slate-200 pb-4">
            <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-bold font-mono rounded tracking-wider uppercase">MODO SEGURO</span>
            <h2 className="text-2xl font-bold font-sans mt-2 text-slate-900 border-l-4 border-blue-700 pl-3">Bem-vindo à Secretaria</h2>
            <p className="text-slate-600 text-sm mt-1">Este terminal gerencia o estoque de compras, vendas e dízimos paroquiais.</p>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-bold uppercase text-slate-500 tracking-wider flex items-center gap-2">
              <Shield size={16} className="text-blue-700" /> Diretrizes de Segurança do Terminal
            </h3>
            
            <ul className="text-xs text-slate-600 space-y-3 font-mono">
              <li className="flex items-start gap-2 bg-slate-50 p-2 rounded border border-slate-200">
                <span className="text-blue-600 font-bold">1.</span>
                <span>O login por PIN de 4 dígitos é pessoal e intransmissível.</span>
              </li>
              <li className="flex items-start gap-2 bg-slate-50 p-2 rounded border border-slate-200">
                <span className="text-blue-600 font-bold">2.</span>
                <span>Toda operação de compra, precificação e venda gera um registro automático de auditoria correspondente.</span>
              </li>
              <li className="flex items-start gap-2 bg-slate-50 p-2 rounded border border-slate-200">
                <span className="text-blue-600 font-bold">3.</span>
                <span>Para a alteração de preços ou exclusão de registros, é exigido perfil de nível <strong>Administrador</strong>.</span>
              </li>
            </ul>
          </div>

          {/* Quick Access helper panel for local testing (No simulated backend bypass, real data used) */}
          <div className="bg-slate-50 p-4 rounded border border-slate-300">
            <div className="flex items-center justify-between pointer-events-none mb-2">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                <HelpCircle size={14} className="text-blue-600" />
                <span>USUÁRIOS DE TESTE (PINs ATIVOS)</span>
              </div>
              <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-mono font-semibold">PASSO 1</span>
            </div>
            
            <p className="text-[11px] text-slate-500 mb-2">
              Clique nos perfis abaixo para digitar o respectivo PIN automaticamente:
            </p>

            <div className="grid grid-cols-1 gap-2">
              {registeredUsers.map((u) => (
                <button
                  key={u.id}
                  onClick={() => handleTestUserClick(u.pin)}
                  className="flex items-center justify-between text-left px-3 py-2 bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-400 rounded transition text-xs group"
                >
                  <div className="flex flex-col">
                    <span className="font-bold text-slate-800">{u.name}</span>
                    <span className="text-[10px] text-slate-500 font-mono">Nível: {u.role}</span>
                  </div>
                  <span className="bg-slate-100 group-hover:bg-blue-100 text-slate-700 group-hover:text-blue-800 font-mono font-bold px-2 py-1 rounded border border-slate-200 transition">
                    PIN {u.pin}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Side: PDV Style Pin Keypad */}
        <div className="w-full lg:w-1/2 max-w-md bg-white border border-slate-300 rounded-lg shadow-lg p-6 sm:p-8 flex flex-col items-center">
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
