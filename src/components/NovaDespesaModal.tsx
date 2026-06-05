import React, { useState } from 'react';
import { X, Save } from 'lucide-react';
import { dbService } from '../services/db';
import { safeStorage } from '../services/safeStorage';
import { User } from '../types';

interface NovaDespesaProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveSuccess: () => void;
  currentUser: User;
}

const DEFAULT_EXPENSE_CATEGORIES = [
  'Fraternidade',
  'Suporte Paroquial',
  'Comunicação & Internet',
  'Transporte & Mobilidade',
  'Água & Energia',
  'Manutenção & Limpeza',
  'Outros'
];

export default function NovaDespesaModal({ isOpen, onClose, onSaveSuccess, currentUser }: NovaDespesaProps) {
  const [categoria, setCategoria] = useState('Fraternidade');
  const [categoriesList, setCategoriesList] = useState<string[]>(() => {
    const saved = safeStorage.getItem('stock_parocos_expense_categories');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return DEFAULT_EXPENSE_CATEGORIES;
      }
    }
    return DEFAULT_EXPENSE_CATEGORIES;
  });
  const [isAddingNewCat, setIsAddingNewCat] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [valor, setValor] = useState('');
  const [descricao, setDescricao] = useState('');
  const [data, setData] = useState(() => {
    // Default to today in YYYY-MM-DD
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  const handleAddNewCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;

    const trimmed = newCategoryName.trim();
    if (categoriesList.some(c => c.toLowerCase() === trimmed.toLowerCase())) {
      const matched = categoriesList.find(c => c.toLowerCase() === trimmed.toLowerCase())!;
      setCategoria(matched);
    } else {
      const updated = [...categoriesList];
      const outrosIndex = updated.indexOf('Outros');
      if (outrosIndex >= 0) {
        updated.splice(outrosIndex, 0, trimmed);
      } else {
        updated.push(trimmed);
      }
      setCategoriesList(updated);
      setCategoria(trimmed);
      try {
        safeStorage.setItem('stock_parocos_expense_categories', JSON.stringify(updated));
      } catch (err) {
        console.warn('Erro ao salvar categorias de despesa:', err);
      }
    }
    setNewCategoryName('');
    setIsAddingNewCat(false);
  };

  const handleSalvarDespesa = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    
    const parsedAmount = parseFloat(valor);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setErrorMessage('Por favor, insira um valor válido maior que zero.');
      return;
    }

    if (!descricao.trim()) {
      setErrorMessage('Por favor, insira uma descrição para a despesa.');
      return;
    }

    setIsSaving(true);

    try {
      // Save expense via dbService
      await dbService.saveExpense(categoria, parsedAmount, descricao.trim(), data);
      
      // Register audit log
      await dbService.log(
        currentUser.id,
        currentUser.name,
        'CADASTRO_DESPESA',
        `Registrada despesa de MTn ${parsedAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} na categoria "${categoria}". Obs: ${descricao.trim()}`
      );
      
      onSaveSuccess();
      onClose();
    } catch (err: any) {
      console.error('Erro ao salvar despesa:', err);
      setErrorMessage('Falha ao registrar despesa no banco de dados.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 transition-all animate-fade-in">
      <div className="bg-white border-2 border-slate-700 shadow-2xl rounded-lg w-full max-w-md overflow-hidden transform transition-all duration-200 scale-100 flex flex-col">
        {/* Header - Windows Access/Classic Styling */}
        <header className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between border-b-2 border-blue-600">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono font-extrabold text-yellow-400 bg-yellow-400/10 border border-yellow-400/30 rounded px-1.5 py-0.5 leading-none">MTn</span>
            <h3 className="text-xs font-mono font-bold tracking-tight uppercase">REGISTRAR NOVA DESPESA / SAÍDA</h3>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            className="text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X size={16} />
          </button>
        </header>

        {/* Form Body */}
        <form onSubmit={handleSalvarDespesa} className="p-5 flex-col flex gap-4 text-xs">
          {errorMessage && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 p-2.5 rounded font-mono text-[11px] leading-tight flex gap-2">
              <span>⚠️</span>
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Form Input fields */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="font-mono font-bold text-slate-700 uppercase tracking-wide">Categoria da Despesa</label>
              {!isAddingNewCat ? (
                <button
                  type="button"
                  onClick={() => setIsAddingNewCat(true)}
                  className="text-blue-600 hover:text-blue-800 font-mono font-bold text-[10px] uppercase tracking-wider flex items-center gap-0.5 cursor-pointer"
                >
                  + Nova Categoria
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsAddingNewCat(false)}
                  className="text-slate-500 hover:text-slate-700 font-mono font-bold text-[10px] uppercase tracking-wider cursor-pointer"
                >
                  Cancelar
                </button>
              )}
            </div>

            {isAddingNewCat ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Nome da nova categoria..."
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  className="flex-1 bg-slate-50 border border-slate-300 rounded px-2.5 py-2 focus:ring-1 focus:ring-blue-600 focus:border-blue-600 outline-hidden font-sans font-medium text-slate-800 text-xs"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleAddNewCategory}
                  className="px-3 bg-slate-900 border border-slate-850 text-white font-mono font-bold rounded hover:bg-slate-800 transition text-[10px] uppercase cursor-pointer"
                >
                  Adicionar
                </button>
              </div>
            ) : (
              <select
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-2 focus:ring-1 focus:ring-blue-600 focus:border-blue-600 outline-hidden font-sans font-medium text-slate-800"
              >
                {categoriesList.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3.5">
            <div className="flex flex-col gap-1.5">
              <label className="font-mono font-bold text-slate-700 uppercase tracking-wide">Valor da Despesa (MTn)</label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-mono font-bold">MTn</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded pl-10 pr-2.5 py-2 focus:ring-1 focus:ring-blue-600 focus:border-blue-600 outline-hidden font-mono text-slate-800"
                  required
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-mono font-bold text-slate-700 uppercase tracking-wide">Data da Despesa</label>
              <input
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-2 focus:ring-1 focus:ring-blue-600 focus:border-blue-600 outline-hidden font-mono text-slate-800"
                required
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="font-mono font-bold text-slate-700 uppercase tracking-wide">Descrição / Justificativa</label>
            <textarea
              rows={3}
              placeholder="Descreva detalhes ou nota da despesa..."
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-2 focus:ring-1 focus:ring-blue-600 focus:border-blue-600 outline-hidden font-sans font-medium text-slate-800 resize-none"
              required
            />
          </div>

          {/* Prompt/Guide */}
          <div className="bg-slate-50 border border-slate-200 p-2.5 rounded text-slate-500 text-[10px] leading-relaxed">
            <p><strong>Nota:</strong> Esta ação reduzirá o saldo operacional diário da secretaria paroquial em tempo real, aparecendo no extrato de auditoria.</p>
          </div>

          {/* Footer controls */}
          <footer className="flex items-center justify-end gap-2.5 pt-3.5 border-t border-slate-150 mt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 font-mono font-bold rounded transition cursor-pointer"
              disabled={isSaving}
            >
              CANCELAR
            </button>
            <button
              type="submit"
              className="px-3.5 py-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-white font-mono font-bold rounded shadow-sm hover:shadow-md transition cursor-pointer flex items-center gap-1.5"
              disabled={isSaving}
            >
              <Save size={13} className="text-emerald-400" />
              {isSaving ? 'SALVANDO...' : 'REGISTRAR'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
