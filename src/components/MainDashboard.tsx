import React, { useState, useEffect } from 'react';
import { 
  User as UserType, 
  Product, 
  Sale, 
  AuditLog,
  Customer,
  PurchaseLog
} from '../types';
import { dbService } from '../services/db';
import { seedDatabaseIfEmpty, ensureAnonymousLogin, db } from '../services/firebase';
// @ts-ignore
import logoParoquia from '../logo.png';
import { 
  Database, 
  Activity, 
  Users, 
  AlertCircle,
  FileSpreadsheet, 
  Check, 
  Plus, 
  RefreshCw,
  ShoppingBag as SaleIcon,
  ShoppingBag,
  PlusCircle,
  TrendingDown,
  TrendingUp,
  Coins,
  Trash2,
  Calendar,
  Layers,
  ArrowRight,
  Search,
  CheckCircle,
  Info,
  Printer,
  Sliders,
  AlertTriangle,
  Upload
} from 'lucide-react';

interface CartItem {
  productId: string;
  name: string;
  code: string;
  category: string;
  quantity: number;
  salePrice: number;
  maxStock: number;
}

interface MainDashboardProps {
  currentUser: UserType;
  onLogout: () => void;
}

const DEFAULT_CATEGORIES = [
  'Velas',
  'Livros & Folhetos',
  'Artigos Religiosos',
  'Hóstias',
  'Liturgia',
  'Lembranças',
  'Outros'
];

export default function MainDashboard({ currentUser, onLogout }: MainDashboardProps) {
  const [activeTab, setActiveTab] = useState<'products' | 'pricing' | 'sales' | 'categories' | 'reports' | 'audit'>('products');
  const [products, setProducts] = useState<Product[]>([]);
  const [users, setUsers] = useState<UserType[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [purchases, setPurchases] = useState<PurchaseLog[]>([]);
  const [isFirebaseConnected, setIsFirebaseConnected] = useState(false);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState<string>('');

  // POINT OF SALE / SALES MODULE STATE:
  const [salesSearchQuery, setSalesSearchQuery] = useState<string>('');
  const [salesCategoryFilter, setSalesCategoryFilter] = useState<string>('Todos');
  const [checkoutCart, setCheckoutCart] = useState<CartItem[]>([]);

  // Add item to cart
  const handleAddToCart = (prod: Product) => {
    if (!prod.salePrice || prod.salePrice <= 0) {
      triggerStatus('error', 'Este produto não possui preço de venda definido.');
      return;
    }
    if (prod.quantity <= 0) {
      triggerStatus('error', `Aviso: "${prod.name}" não possui saldo de estoque.`);
      return;
    }

    setCheckoutCart((prev) => {
      const existing = prev.find((item) => item.productId === prod.id);
      if (existing) {
        if (existing.quantity >= prod.quantity) {
          triggerStatus('error', `Estoque máximo atingido para "${prod.name}" (${prod.quantity} unidades).`);
          return prev;
        }
        triggerStatus('success', `Quantidade de "${prod.name}" aumentada para ${existing.quantity + 1}.`);
        return prev.map((item) =>
          item.productId === prod.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      } else {
        triggerStatus('success', `"${prod.name}" adicionado ao cupom paroquial.`);
        const newItem: CartItem = {
          productId: prod.id,
          name: prod.name,
          code: prod.code,
          category: prod.category,
          quantity: 1,
          salePrice: prod.salePrice,
          maxStock: prod.quantity,
        };
        return [...prev, newItem];
      }
    });
  };

  // Modify item quantity in cart
  const handleUpdateCartQuantity = (productId: string, newQty: number) => {
    setCheckoutCart((prev) => {
      const target = prev.find((item) => item.productId === productId);
      if (!target) return prev;
      
      if (newQty <= 0) {
        return prev;
      }

      if (newQty > target.maxStock) {
        triggerStatus('error', `Estoque máximo atingido para este item (${target.maxStock} un disponíveis).`);
        return prev;
      }

      return prev.map((item) =>
        item.productId === productId ? { ...item, quantity: newQty } : item
      );
    });
  };

  // Remove item from cart
  const handleRemoveFromCart = (productId: string) => {
    setCheckoutCart((prev) => {
      const item = prev.find((i) => i.productId === productId);
      if (item) {
        triggerStatus('success', `"${item.name}" removido do cupom paroquial.`);
      }
      return prev.filter((i) => i.productId !== productId);
    });
  };

  // CUSTOMER AND RECEIPT FLOW STATE:
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isConfirmClearOpen, setIsConfirmClearOpen] = useState(false);
  const [isConfirmClearHistoryOpen, setIsConfirmClearHistoryOpen] = useState(false);
  const [checkoutCustomerName, setCheckoutCustomerName] = useState('');
  const [checkoutCustomerPhone, setCheckoutCustomerPhone] = useState('');
  const [customersList, setCustomersList] = useState<Customer[]>([]);
  const [activeReceipt, setActiveReceipt] = useState<{
    id: string;
    items: { productName: string; quantity: number; salePrice: number; totalPrice: number }[];
    customerName?: string;
    customerPhone?: string;
    sellerName: string;
    timestamp: string;
    totalAmount: number;
  } | null>(null);

  // USER LOGO CONFIGURATION STATE:
  const [parishLogo, setParishLogo] = useState<string | null>(() => {
    return localStorage.getItem('stock_parocos_logo');
  });

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        triggerStatus('error', 'O arquivo de imagem é muito grande. Escolha uma imagem de até 2MB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        localStorage.setItem('stock_parocos_logo', base64String);
        setParishLogo(base64String);
        triggerStatus('success', 'Logótipo da paróquia atualizado com sucesso!');
      };
      reader.onerror = () => {
        triggerStatus('error', 'Falha ao processar o arquivo de imagem.');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleLogoReset = () => {
    localStorage.removeItem('stock_parocos_logo');
    setParishLogo(null);
    triggerStatus('success', 'Logótipo da paróquia redefinido para o padrão.');
  };

  // HISTORICAL RECEIPTS SEARCH STATE:
  const [receiptSearchQuery, setReceiptSearchQuery] = useState('');
  const [receiptSearchDate, setReceiptSearchDate] = useState('');

  // REPORTS STATE:
  const [reportStartDate, setReportStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(1); // Default to 1st of current month
    return d.toISOString().substring(0, 10);
  });
  const [reportEndDate, setReportEndDate] = useState<string>(() => {
    return new Date().toISOString().substring(0, 10);
  });
  const [tipoRelatorio, setTipoRelatorio] = useState<'vendas' | 'compras' | 'stock'>('vendas');

  // Status message
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [mensagemVerde, setMensagemVerde] = useState<string | null>(null);

  useEffect(() => {
    if (mensagemVerde) {
      triggerStatus('success', mensagemVerde);
      // Reset after status is triggered so the next click can trigger it again
      setTimeout(() => {
        setMensagemVerde(null);
      }, 5000);
    }
  }, [mensagemVerde]);

  // User Management popups & actions
  const [selectedUser, setSelectedUser] = useState<UserType | null>(null);
  const [isUserActionModalOpen, setIsUserActionModalOpen] = useState(false);

  // Product actions popups state
  const [selectedActionProduct, setSelectedActionProduct] = useState<Product | null>(null);
  const [isProductActionModalOpen, setIsProductActionModalOpen] = useState(false);

  const handleOpenProductActions = (prod: Product) => {
    setSelectedActionProduct(prod);
    setIsProductActionModalOpen(true);
  };
  
  // Edit mode state
  const [isUserEditMode, setIsUserEditMode] = useState(false);
  const [editUserName, setEditUserName] = useState('');
  const [editUserPin, setEditUserPin] = useState('');
  const [editUserRole, setEditUserRole] = useState<'Administrador' | 'Operador'>('Operador');
  const [editUserActive, setEditUserActive] = useState(true);

  // CATEGORIES MANAGEMENT STATE:
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [categories, setCategories] = useState<string[]>(() => {
    const saved = localStorage.getItem('stock_parocos_categories');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return DEFAULT_CATEGORIES;
      }
    }
    return DEFAULT_CATEGORIES;
  });
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategoryIndex, setEditingCategoryIndex] = useState<number | null>(null);
  const [editingCategoryValue, setEditingCategoryValue] = useState('');

  const saveCategories = (newCats: string[]) => {
    setCategories(newCats);
    localStorage.setItem('stock_parocos_categories', JSON.stringify(newCats));
  };

  const handleRenameCategory = async (oldName: string, newName: string) => {
    if (!newName.trim() || oldName === newName) return;
    const trimmed = newName.trim();
    if (categories.some(c => c.toLowerCase() === trimmed.toLowerCase())) {
      triggerStatus('error', 'Uma categoria com este nome já existe.');
      return;
    }
    const updatedCats = categories.map(c => c === oldName ? trimmed : c);
    saveCategories(updatedCats);
    
    // Update products in db
    const dbProducts = await dbService.getProducts();
    const updatedProducts = dbProducts.map(p => p.category === oldName ? { ...p, category: trimmed } : p);
    for (const p of updatedProducts) {
      if (p.category === trimmed) {
        await dbService.saveProduct(p, currentUser.id, currentUser.name);
      }
    }
    
    await dbService.log(
      currentUser.id,
      currentUser.name,
      'CATEGORIA_EDITADA',
      `Renomeou categoria de "${oldName}" para "${trimmed}"`
    );
    
    await loadData();
    triggerStatus('success', `Categoria "${oldName}" editada para "${trimmed}" com sucesso.`);
  };

  const handleDeleteCategory = async (catToDelete: string) => {
    if (catToDelete === 'Outros') {
      triggerStatus('error', 'A categoria "Outros" não pode ser eliminada.');
      return;
    }
    const hasDefault = categories.includes('Outros');
    let updatedCats = categories.filter(c => c !== catToDelete);
    if (!hasDefault) {
      updatedCats.push('Outros');
    }
    saveCategories(updatedCats);
    
    // Update products in db to "Outros"
    const dbProducts = await dbService.getProducts();
    const updatedProducts = dbProducts.map(p => p.category === catToDelete ? { ...p, category: 'Outros' } : p);
    for (const p of updatedProducts) {
      if (p.category === 'Outros') {
        await dbService.saveProduct(p, currentUser.id, currentUser.name);
      }
    }
    
    await dbService.log(
      currentUser.id,
      currentUser.name,
      'CATEGORIA_REMOVIDA',
      `Eliminou a categoria "${catToDelete}". Os produtos dessa categoria foram movidos para "Outros".`
    );
    
    await loadData();
    triggerStatus('success', `Categoria "${catToDelete}" removida. Produtos movidos para "Outros".`);
  };

  // Custom Confirmation Dialog overlay states
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    type: 'edit' | 'delete' | null;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    type: null,
    message: '',
    onConfirm: () => {}
  });

  const handleOpenUserActions = (user: UserType) => {
    setSelectedUser(user);
    setIsUserActionModalOpen(true);
    setIsUserEditMode(false); // Reset to actions list
    setEditUserName(user.name);
    setEditUserPin(user.pin);
    setEditUserRole(user.role);
    setEditUserActive(user.active);
  };

  // FORM COMPRAS / DE CADASTRO STATES:
  const [formMode, setFormMode] = useState<'NOVO' | 'EDITAR' | 'COMPRA_RECORRENTE'>('NOVO');
  const [selectedProductId, setSelectedProductId] = useState<string>(''); // Used for existing product fast purchase
  const [productType, setProductType] = useState<'produto' | 'servico'>('produto');
  const [modalSalePrice, setModalSalePrice] = useState<string>('');
  const [productCode, setProductCode] = useState<string>('');
  const [productName, setProductName] = useState<string>('');
  const [productCategory, setProductCategory] = useState<string>(() => {
    const saved = localStorage.getItem('stock_parocos_categories');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.length > 0) return parsed[0];
      } catch {}
    }
    return 'Velas';
  });
  const [purchaseQuantity, setPurchaseQuantity] = useState<number>(10);
  const [costPrice, setCostPrice] = useState<number>(5.00);
  const [purchaseMinStock, setPurchaseMinStock] = useState<number>(5);
  const [purchaseDate, setPurchaseDate] = useState<string>(
    new Date().toISOString().substring(0, 10) // YYYY-MM-DD for standard date input
  );
  const [existingSalePrice, setExistingSalePrice] = useState<number | undefined>(undefined);

  // PRODUCT REGISTER & EDIT MODAL STATE:
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // PRICING TAB STATE:
  const [pricingInputs, setPricingInputs] = useState<Record<string, string>>({});
  const [priceFilterMode, setPriceFilterMode] = useState<'UNPRICED' | 'ALL'>('UNPRICED');

  // ADJUSTMENT OF STOCK SYSTEM STATES:
  const [adjustingProduct, setAdjustingProduct] = useState<Product | null>(null);
  const [adjustQuantity, setAdjustQuantity] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState<string>('');

  // Handle keydown listener for Clipper / MS Access terminal style F1-F6 keys:
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept shortcuts if active modal or focus is on key fields that could conflict
      // But typically F-keys are absolutely safe. We prioritize shifting activeTab.
      switch(e.key) {
        case 'F1':
          e.preventDefault();
          setActiveTab('products');
          break;
        case 'F2':
          e.preventDefault();
          setActiveTab('pricing');
          break;
        case 'F3':
          e.preventDefault();
          setActiveTab('sales');
          break;
        case 'F4':
          e.preventDefault();
          setActiveTab('categories');
          break;
        case 'F5':
          e.preventDefault();
          setActiveTab('reports');
          break;
        case 'F6':
          e.preventDefault();
          setActiveTab('audit');
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleSaveStockAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingProduct) return;
    if (adjustQuantity < 0) {
      triggerStatus('error', 'A quantidade ajustada não pode ser negativa.');
      return;
    }
    if (!adjustReason.trim()) {
      triggerStatus('error', 'Por favor, informe o motivo do ajuste manual.');
      return;
    }

    const originalQty = adjustingProduct.quantity;
    const finalProduct: Product = {
      ...adjustingProduct,
      quantity: adjustQuantity,
      updatedAt: new Date().toISOString()
    };

    await dbService.saveProduct(finalProduct, currentUser.id, currentUser.name);

    // Register this in the Audit with the critical status:
    await dbService.log(
      currentUser.id,
      currentUser.name,
      'ESTOQUE_AJUSTADO',
      `AJUSTE MANUAL - ${adjustingProduct.name}: De ${originalQty} para ${adjustQuantity} unidades. Motivo: ${adjustReason.trim()}`
    );

    triggerStatus('success', `Estoque de "${adjustingProduct.name}" ajustado manualmente de ${originalQty} para ${adjustQuantity} unidades com sucesso!`);
    setAdjustingProduct(null);
    setAdjustQuantity(0);
    setAdjustReason('');
    await loadData();
  };

  // Initial load
  const loadData = async () => {
    try {
      const loadedProds = await dbService.getProducts();
      setProducts(loadedProds);
      const [usrList, saleList, logs, custs, purchList] = await Promise.all([
        dbService.getUsers(),
        dbService.getSales(),
        dbService.getAuditLogs(),
        dbService.getCustomers(),
        dbService.getPurchases()
      ]);
      setUsers(usrList);
      setSales(saleList);
      setAuditLogs(logs);
      setCustomersList(custs);
      setPurchases(purchList);
      if (db) {
        setIsFirebaseConnected(true);
      }
    } catch (e) {
      console.error("Erro ao sincronizar dados do repositório paroquial:", e);
      setIsFirebaseConnected(false);
    }
  };

  useEffect(() => {
    loadData();

    // Trigger anonymous registration early on startup so security rules allow fast reads/writes
    const initAnonymousSession = async () => {
      try {
        await ensureAnonymousLogin();
        if (db) {
          setIsFirebaseConnected(true);
        }
      } catch (e) {
        console.warn("Sessão segura inicial adiada.", e);
      }
    };
    initAnonymousSession();

    // Auto-seed Firebase if first-time load and empty cloud database collections
    const executeCloudFirebaseSeed = async () => {
      try {
        const result = await seedDatabaseIfEmpty((msg) => {
          console.log(`[Segurança e Carga Firebase]: ${msg}`);
        });
        if (result.seeded) {
          triggerStatus('success', 'Base de dados paroquial sincronizada com a nuvem!');
        }
        await loadData();
      } catch (err) {
        console.warn("Carga do Firebase indisponível ou já sincronizada:", err);
      }
    };

    executeCloudFirebaseSeed();
  }, []);

  const triggerStatus = (type: 'success' | 'error', text: string) => {
    setStatusMessage({ type, text });
    setTimeout(() => {
      setStatusMessage(null);
    }, 5000);
  };

  const handleClearSales = () => {
    if (currentUser.role !== 'Administrador') {
      triggerStatus('error', 'Reservado para admin');
      return;
    }
    setIsConfirmClearOpen(true);
  };

  const executeClearSales = async () => {
    await dbService.clearSales();
    setSales([]);
    await dbService.log(
      currentUser.id,
      currentUser.name,
      'LIMPAR_REGISTOS',
      'O Administrador efetuou a limpeza completa de todos os registos de vendas do sistema.'
    );
    await loadData();
    setIsConfirmClearOpen(false);
    triggerStatus('success', 'Os registos de vendas foram limpos com sucesso.');
  };

  const handleClearHistory = () => {
    if (currentUser.role !== 'Administrador') {
      triggerStatus('error', 'Reservado para admin');
      return;
    }
    setIsConfirmClearHistoryOpen(true);
  };

  const executeClearHistory = async () => {
    await dbService.clearAuditLogs();
    await dbService.log(
      currentUser.id,
      currentUser.name,
      'LIMPAR_HISTORICO',
      'O Administrador efetuou a limpeza completa de todos os logs da trilha de auditoria.'
    );
    await loadData();
    setIsConfirmClearHistoryOpen(false);
    triggerStatus('success', 'A trilha do livro auditor foi limpa com sucesso.');
  };

  // Switch form to edit mode when a product is clicked from products DataGrid
  const handleSelectProductToEdit = (prod: Product) => {
    setFormMode('EDITAR');
    setSelectedProductId(prod.id);
    setProductCode(prod.code);
    setProductName(prod.name);
    setProductCategory(prod.category);
    setProductType(prod.type || 'produto');
    setModalSalePrice(prod.salePrice !== undefined && prod.salePrice !== null ? prod.salePrice.toString() : '');
    setPurchaseQuantity(prod.quantity);
    setCostPrice(prod.costPrice);
    setPurchaseMinStock(prod.minStock);
    setExistingSalePrice(prod.salePrice);
    
    // Set simulated purchase date as current
    setPurchaseDate(new Date().toISOString().substring(0, 10));
    
    setIsProductModalOpen(true);
  };

  // Switch to purchase state for existing items
  const handleSelectProductForStockRefill = (prod: Product) => {
    setFormMode('COMPRA_RECORRENTE');
    setSelectedProductId(prod.id);
    setProductCode(prod.code);
    setProductName(prod.name);
    setProductCategory(prod.category);
    setProductType(prod.type || 'produto');
    setModalSalePrice(prod.salePrice !== undefined && prod.salePrice !== null ? prod.salePrice.toString() : '');
    setPurchaseQuantity(10); // default refill
    setCostPrice(prod.costPrice);
    setPurchaseMinStock(prod.minStock);
    setExistingSalePrice(prod.salePrice);
    setPurchaseDate(new Date().toISOString().substring(0, 10));
    
    setIsProductModalOpen(true);
  };

  // Reset form inputs
  const handleClearForm = async () => {
    setFormMode('NOVO');
    setSelectedProductId('');
    setProductType('produto');
    setModalSalePrice('');
    
    // Gera código sequencial automático e exclusivo de 6 algarismos direto da nuvem (ou cache se offline)
    let allProds: Product[] = [];
    try {
      allProds = await dbService.getProducts();
    } catch (err) {
      console.warn("Erro ao buscar produtos para gerar código sequencial:", err);
      allProds = products;
    }

    let candidate = 100001;
    if (allProds && allProds.length > 0) {
      while (allProds.some(p => p.code.trim() === String(candidate))) {
        candidate++;
      }
    } else {
      // Se o banco retornar vazio (nuvem vazia), reinicia o SKU de forma limpa em 100001
      candidate = 100001;
    }
    setProductCode(String(candidate));
    
    setProductName('');
    setProductCategory(categories[0] || 'Velas');
    setPurchaseQuantity(10);
    setCostPrice(5.00);
    setPurchaseMinStock(5);
    setExistingSalePrice(undefined);
    setPurchaseDate(new Date().toISOString().substring(0, 10));
  };

  // Handle save/submit purchase/product edit
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (!productCode.trim()) {
        triggerStatus('error', 'O Código (SKU) do produto é obrigatório.');
        return;
      }
      if (!productName.trim()) {
        triggerStatus('error', 'O Nome do produto é obrigatório.');
        return;
      }
      
      if (productType === 'produto') {
        if (purchaseQuantity < 0) {
          triggerStatus('error', 'A quantidade não pode ser negativa.');
          return;
        }
        if (costPrice <= 0) {
          triggerStatus('error', 'O Preço de Custo deve ser maior que 0,00 MTn.');
          return;
        }
      }

      let parsedSalePrice: number | null = null;
      if (modalSalePrice.trim()) {
        const numPrice = Number(modalSalePrice.replace(',', '.'));
        if (isNaN(numPrice) || numPrice <= 0) {
          triggerStatus('error', 'O Preço de Venda / Taxa deve ser um número válido maior que 0,00 MTn.');
          return;
        }
        parsedSalePrice = numPrice;
      } else if (productType === 'servico') {
        triggerStatus('error', 'O Preço de Venda / Regulamento da Taxa é obrigatório para Serviços / Taxas.');
        return;
      }

      setIsSaving(true);

      const allProducts = await dbService.getProducts();

      if (formMode === 'NOVO') {
        // Check if product with same code already exists
        const codeExists = allProducts.find(p => p.code.trim() === productCode.trim());
        if (codeExists) {
          setIsSaving(false);
          if (confirm(`Já existe um produto cadastrado com o código "${productCode}" (${codeExists.name}). Deseja adicionar estoque a este produto em vez de criar um novo?`)) {
            setFormMode('COMPRA_RECORRENTE');
            setSelectedProductId(codeExists.id);
            setProductName(codeExists.name);
            setProductCategory(codeExists.category);
            setCostPrice(codeExists.costPrice);
            setPurchaseMinStock(codeExists.minStock);
            setExistingSalePrice(codeExists.salePrice);
            return;
          }
          return;
        }

        // Safe new creation
        const newProduct: Product = {
          id: `prod_${Date.now()}`,
          code: productCode.trim(),
          name: productName.trim(),
          category: productCategory,
          quantity: productType === 'servico' ? 0 : purchaseQuantity,
          costPrice: productType === 'servico' ? 0 : costPrice,
          minStock: productType === 'servico' ? 0 : purchaseMinStock,
          type: productType,
          createdAt: new Date(purchaseDate).toISOString(),
          updatedAt: new Date().toISOString(),
          salePrice: parsedSalePrice
        };

        await dbService.saveProduct(newProduct, currentUser.id, currentUser.name);
        
        if (productType === 'produto') {
          // Register purchase log for period statistics
          await dbService.registerPurchase(
            newProduct.id,
            newProduct.name,
            newProduct.category,
            newProduct.quantity,
            newProduct.costPrice,
            currentUser.id,
            currentUser.name,
            new Date(purchaseDate).toISOString()
          );
        }
        
        // Log purchase event in audit
        await dbService.log(
          currentUser.id, 
          currentUser.name, 
          'CADASTRO_PRODUTO', 
          productType === 'servico'
            ? `Cadastro de novo serviço/taxa: "${productName.trim()}" (Preço/Taxa: ${parsedSalePrice?.toFixed(2)} MTn)`
            : `Compra/Entrada de novo produto: ${purchaseQuantity}x "${productName.trim()}" (Custo Unit.: ${costPrice.toFixed(2)} MTn) de Categoria "${productCategory}"`
        );

        triggerStatus('success', 'Registo efetuado com sucesso. O formulário foi limpo para um novo cadastro.');
        await loadData();
        await handleClearForm();
      }
      else if (formMode === 'COMPRA_RECORRENTE') {
        // Look up target product
        const target = allProducts.find(p => p.id === selectedProductId);
        if (!target) {
          triggerStatus('error', 'Produto original não localizado no banco de dados.');
          return;
        }

        const originalQty = target.quantity;
        const finalProduct: Product = {
          ...target,
          quantity: originalQty + purchaseQuantity, // Sum the purchased quantity directly!
          costPrice: costPrice, // Update with the latest cost price
          updatedAt: new Date().toISOString(),
          salePrice: parsedSalePrice !== null ? parsedSalePrice : (target.salePrice !== undefined && target.salePrice !== null ? target.salePrice : null)
        };

        await dbService.saveProduct(finalProduct, currentUser.id, currentUser.name);

        // Register purchase log for period statistics
        await dbService.registerPurchase(
          target.id,
          target.name,
          target.category,
          purchaseQuantity,
          costPrice,
          currentUser.id,
          currentUser.name,
          new Date(purchaseDate).toISOString()
        );

        // Audit purchase logs
        await dbService.log(
          currentUser.id,
          currentUser.name,
          'ESTOQUE_AJUSTADO',
          `Entrada de estoque: Compra de +${purchaseQuantity} unidades do produto "${target.name}" (Novo Total: ${originalQty + purchaseQuantity})`
        );

        triggerStatus('success', 'Registo efetuado com sucesso');
        await loadData();
        await handleClearForm();
        setIsProductModalOpen(false);
      }
      else if (formMode === 'EDITAR') {
        const target = allProducts.find(p => p.id === selectedProductId);
        if (!target) {
          triggerStatus('error', 'Produto para edição não localizado no sistema.');
          return;
        }

        const finalProduct: Product = {
          ...target,
          code: productCode.trim(),
          name: productName.trim(),
          category: productCategory,
          quantity: productType === 'servico' ? 0 : purchaseQuantity, // manual set in edit mode
          costPrice: productType === 'servico' ? 0 : costPrice,
          minStock: productType === 'servico' ? 0 : purchaseMinStock,
          type: productType,
          updatedAt: new Date().toISOString(),
          salePrice: parsedSalePrice !== null ? parsedSalePrice : (target.salePrice !== undefined && target.salePrice !== null ? target.salePrice : null)
        };

        await dbService.saveProduct(finalProduct, currentUser.id, currentUser.name);
        triggerStatus('success', 'Registo efetuado com sucesso');
        await loadData();
        await handleClearForm();
        setIsProductModalOpen(false);
      }
    } catch (err: any) {
      console.error("Erro ao salvar produto:", err);
      triggerStatus('error', 'Erro ao salvar. Verifique a ligação ao banco de dados.');
    } finally {
      setIsSaving(false);
    }
  };

  // Perform exclusion
  const handleDeleteProduct = async () => {
    if (!selectedProductId) {
      triggerStatus('error', 'Nenhum produto selecionado para exclusão.');
      return;
    }

    const currentProd = products.find(p => p.id === selectedProductId);
    if (!currentProd) return;

    if (currentUser.role !== 'Administrador') {
      triggerStatus('error', 'Permissão negada. Somente Administradores (Párocos) podem excluir produtos.');
      return;
    }

    if (confirm(`EXCLUSÃO PERMANENTE:\nVocê tem certeza que deseja excluir o produto "${currentProd.name}" do estoque? Isto não poderá ser desfeito.`)) {
      await dbService.deleteProduct(selectedProductId, currentUser.id, currentUser.name);
      triggerStatus('success', `Produto "${currentProd.name}" excluído do estoque paroquial.`);
      await loadData();
      await handleClearForm();
      setIsProductModalOpen(false);
    }
  };

  // Inline pricing submit handler
  const handleAssignPrice = async (prodId: string) => {
    let priceStr = pricingInputs[prodId];
    
    // If not in state, look at the loaded product's current salePrice
    if (priceStr === undefined) {
      const currentP = products.find(p => p.id === prodId);
      if (currentP && currentP.salePrice) {
        priceStr = currentP.salePrice.toString();
      }
    }

    if (!priceStr || isNaN(Number(priceStr.replace(',', '.')))) {
      triggerStatus('error', 'Forneça um preço numérico válido maior que zero.');
      return;
    }

    const numPrice = Number(priceStr.replace(',', '.'));
    if (numPrice <= 0) {
      triggerStatus('error', 'O preço de venda deve ser maior que 0,00 MTn.');
      return;
    }

    const allProds = await dbService.getProducts();
    const target = allProds.find(p => p.id === prodId);
    if (!target) return;

    const updated = {
      ...target,
      salePrice: numPrice,
      updatedAt: new Date().toISOString()
    };

    await dbService.saveProduct(updated, currentUser.id, currentUser.name);
    
    // Clear the individual input value for clean state
    setPricingInputs(prev => {
      const copy = { ...prev };
      delete copy[prodId];
      return copy;
    });

    triggerStatus('success', `Preço de ${numPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} MTn definido para "${target.name}".`);
    await loadData();
  };

  // Submit checkout/sale logic - Triggers the Customer Selection Modal first
  const handleRegisterSale = () => {
    if (checkoutCart.length === 0) {
      triggerStatus('error', 'Por favor, selecione produtos no catálogo de vendas.');
      return;
    }
    // Deep reset identification fields
    setCheckoutCustomerName('');
    setCheckoutCustomerPhone('');
    setIsCustomerModalOpen(true);
  };

  // Finalizes the sale after choosing direct sale or identifying customer
  const processSaleFinal = async (custName?: string, custPhone?: string) => {
    if (checkoutCart.length === 0) {
      triggerStatus('error', 'Por favor, selecione produtos no catálogo de vendas.');
      return;
    }

    const saleItems = checkoutCart.map(item => ({
      productId: item.productId,
      quantity: item.quantity
    }));

    const finalName = custName?.trim();
    const finalPhone = custPhone?.trim();

    // If client is specified with contact, persist/register in the database
    if (finalName && finalPhone) {
      await dbService.addOrGetCustomer(finalName, finalPhone);
    }

    const process = await dbService.registerMultipleSales(
      saleItems,
      currentUser.id,
      currentUser.name,
      finalName || undefined,
      finalPhone || undefined
    );

    if (process.success && process.salesRegistered) {
      const itemsCount = checkoutCart.reduce((acc, item) => acc + item.quantity, 0);
      triggerStatus('success', `Venda de ${itemsCount} item(ns) realizada com sucesso!`);
      
      const totalAmount = checkoutCart.reduce((sum, item) => sum + (item.salePrice * item.quantity), 0);

      const newReceipt = {
        id: process.salesRegistered[0]?.id || `rec_${Date.now()}`,
        items: checkoutCart.map(item => ({
          productName: item.name,
          quantity: item.quantity,
          salePrice: item.salePrice,
          totalPrice: item.salePrice * item.quantity
        })),
        customerName: finalName || undefined,
        customerPhone: finalPhone || undefined,
        sellerName: currentUser.name,
        timestamp: new Date().toISOString(),
        totalAmount
      };

      // Set active receipt to generate the receipt view pop-up automatically
      setActiveReceipt(newReceipt);
      setCheckoutCart([]);
      setIsCustomerModalOpen(false);
      await loadData();
    } else {
      triggerStatus('error', process.message || 'Erro ao processar as vendas.');
    }
  };

  const handleCopyReceiptToClipboard = (receipt: typeof activeReceipt) => {
    if (!receipt) return;
    const itemsStr = receipt.items.map(it => `• ${it.quantity}x ${it.productName} (${it.salePrice.toLocaleString('pt-BR')} MTn)`).join('\n');
    const fullText = `*DECLARAÇÃO DE COMPRA PAROQUIAL - SEGUNDA VIA*\n` +
      `*PARÓQUIA NOSSA SENHORA DA IMACULADA CONCEIÇÃO*\n` +
      `*SÉ CATEDRAL DE INHAMBANE - SECRETARIA PAROQUIAL*\n` +
      `*INHAMBANE - MOÇAMBIQUE - CEL: 879440436*\n` +
      `------------------------------------------\n` +
      `*Código do Recibo:* ${receipt.id}\n` +
      `*Data/Hora:* ${new Date(receipt.timestamp).toLocaleString('pt-BR')}\n` +
      `*Operador:* ${receipt.sellerName}\n` +
      `*Cliente:* ${receipt.customerName || 'Consumidor Final'}\n` +
      `${receipt.customerPhone ? `*Contacto:* ${receipt.customerPhone}\n` : ''}` +
      `------------------------------------------\n` +
      `*Produtos Adquiridos:*\n${itemsStr}\n` +
      `------------------------------------------\n` +
      `*TOTAL DA CONTRIBUIÇÃO:* *${receipt.totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} MTn*\n` +
      `------------------------------------------\n` +
      `Muito obrigado por sua contribuição! Que Deus o abençoe!`;

    navigator.clipboard.writeText(fullText).then(() => {
      triggerStatus('success', 'Comprovativo copiado com sucesso! Pode colá-lo no seu E-mail.');
    }).catch(() => {
      triggerStatus('error', 'Falha ao copiar para a área de transferência.');
    });
  };

  const handleGerarPDF = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      setMensagemVerde("A preparar o documento de impressão...");

      // Captura a área dos dados selecionados
      const areaRelatorio = document.getElementById('area-relatorio') || document.querySelector('main');
      if (!areaRelatorio) {
        triggerStatus('error', "Erro: Área de dados não localizada.");
        setMensagemVerde(null);
        return;
      }

      const tituloDoc = tipoRelatorio === 'vendas' 
        ? 'Relatório de Vendas (Saídas)' 
        : tipoRelatorio === 'compras' 
          ? 'Relatório de Compras (Aquisições)' 
          : 'Relatório de Stock Atual';

      const dataInicial = new Date(reportStartDate + 'T00:00:00').toLocaleDateString('pt-BR');
      const dataFinal = new Date(reportEndDate + 'T23:59:59').toLocaleDateString('pt-BR');

      // Tratamento seguro para usar o logotipo carregado pelo utilizador ou o logo paroquial de fallback
      const logoSrc = parishLogo || (typeof logoParoquia === 'string' ? logoParoquia : '');

      // Criamos uma janela/documento temporário isolado e limpo
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        triggerStatus('error', "Popups bloqueadas! Ative as permissões de popup em seu navegador para emitir o relatório.");
        setMensagemVerde(null);
        return;
      }

      // Preparar conteúdo limpando e injetando regras CSS Inline nas tags de tabelas, cabeçalhos e células
      let conteudoLimpo = areaRelatorio.innerHTML;

      // Injeta estilos inline nas tabelas
      conteudoLimpo = conteudoLimpo.replace(/<table([^>]*)>/gi, '<table $1 style="border-collapse: collapse; width: 100%; margin-top: 20px; font-size: 13px; font-family: \'Segoe UI\', Arial, sans-serif;">');

      // Injeta estilos inline nos cabeçalhos (th), mantendo text-right e text-center caso herde
      conteudoLimpo = conteudoLimpo.replace(/<th([^>]*)>/gi, (match, attrs) => {
        const isRight = attrs.includes('text-right') || attrs.includes('align="right"');
        const isCenter = attrs.includes('text-center') || attrs.includes('align="center"');
        const textAlign = isRight ? 'right' : (isCenter ? 'center' : 'left');
        return `<th ${attrs} style="background-color: #f1f5f9; color: #0f172a; border: 1px solid #64748b; padding: 10px; font-weight: bold; text-transform: uppercase; white-space: nowrap; text-align: ${textAlign};">`;
      });

      // Injeta estilos inline nas células (td), mantendo text-right e text-center caso herde
      conteudoLimpo = conteudoLimpo.replace(/<td([^>]*)>/gi, (match, attrs) => {
        const isRight = attrs.includes('text-right') || attrs.includes('align="right"');
        const isCenter = attrs.includes('text-center') || attrs.includes('align="center"');
        const textAlign = isRight ? 'right' : (isCenter ? 'center' : 'left');
        return `<td ${attrs} style="border: 1px solid #cbd5e1; padding: 10px; color: #334155; white-space: nowrap; text-align: ${textAlign};">`;
      });

      // Montamos o HTML injetando regras de tamanho de célula fixas para EVITAR QUEBRAS e configurando a URL Base
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>${tituloDoc}</title>
            <base href="${window.location.origin}/">
            <style>
              body { font-family: "Segoe UI", Arial, sans-serif; padding: 40px; color: #1e293b; background: white; }
              .header { text-align: center; margin-bottom: 30px; }
              .header h2 { color: #0f172a; margin: 5px 0; font-size: 20px; font-weight: 700; text-transform: uppercase; }
              .header h3 { color: #475569; margin: 0 0 5px 0; font-size: 14px; font-weight: 600; }
              .header p { margin: 2px 0; color: #64748b; font-size: 13px; }
              
              /* OCULTA TODOS OS BOTÕES INTERNOS E SEGUNDAS VIAS */
              button, input, select, form, th:last-child, td:last-child, .no-print, [type="button"] { display: none !important; }
              
              /* REGRAS CRÍTICAS PARA TRAVAR QUEBRAS DE LINHA */
              table { border-collapse: collapse; width: 100%; margin-top: 20px; font-size: 13px; }
              tr { page-break-inside: avoid !important; break-inside: avoid !important; }
              tr:nth-child(even) { background-color: #f8fafc !important; }
              
              /* EVITA QUEBRA DE VALORES EM MTn */
              th, td { white-space: nowrap !important; }
              td:nth-child(2), th:nth-child(2) { white-space: normal !important; min-width: 240px; }
              .text-right { text-align: right !important; }
              .text-center { text-align: center !important; }
              .text-green-600 { color: #16a34a !important; font-weight: bold; }
              .font-bold { font-weight: bold; }
            </style>
          </head>
          <body>
            <div class="header">
              ${logoSrc ? `<img src="${logoSrc}" alt="Paróquia" style="height: 100px; width: auto; object-fit: contain; margin-bottom: 15px;" />` : ''}
              <h2>PÁROQUIA NOSSA SENHORA DA IMACULADA CONCEIÇÃO</h2>
              <h3>SÉ CATEDRAL DE INHAMBANE</h3>
              <p style="font-size: 16px; margin-top: 10px;"><strong>SISTEMA STOCK - ${tituloDoc}</strong></p>
              <p>Período: ${dataInicial} até ${dataFinal}</p>
              <hr style="border: 0; border-top: 2px solid #94a3b8; margin: 20px 0;" />
            </div>
            <div>
              ${conteudoLimpo}
            </div>
            <script>
              window.focus();
              window.onafterprint = function() {
                window.close();
              };
              // Executa a impressão diretamente sem depender exclusivamente de window.onload
              setTimeout(function() {
                window.print();
              }, 350);
            </script>
          </body>
        </html>
      `);

      printWindow.document.close();
      setMensagemVerde(null);
      triggerStatus('success', "Documento oficial de impressão gerado! Verifique a janela de impressão do navegador.");

    } catch (err) {
      console.error("Erro ao gerar impressão oficial:", err);
      setMensagemVerde(null);
      triggerStatus('error', "Falha ao processar o arquivo de impressão.");
    }
  };

  const getGroupedReceipts = () => {
    const map: { [key: string]: {
      id: string;
      timestamp: string;
      sellerName: string;
      customerName?: string;
      customerPhone?: string;
      items: { productName: string; quantity: number; salePrice: number; totalPrice: number }[];
      totalAmount: number;
    }} = {};
    
    sales.forEach(s => {
      const key = `${s.timestamp}_${s.sellerName}_${s.customerName || ''}`;
      if (!map[key]) {
        map[key] = {
          id: s.id,
          timestamp: s.timestamp,
          sellerName: s.sellerName,
          customerName: s.customerName,
          customerPhone: s.customerPhone,
          items: [],
          totalAmount: 0
        };
      }
      
      map[key].items.push({
        productName: s.productName,
        quantity: s.quantity,
        salePrice: s.salePrice,
        totalPrice: s.totalPrice
      });
      map[key].totalAmount += s.totalPrice;
    });
    
    return Object.values(map).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  };

  // Master reset database callback
  const handleDatabaseReset = async () => {
    if (window.confirm("Deseja redefinir os dados para os valores originais da Secretaria? Todas as novas compras paroquiais serão perdidas.")) {
      await dbService.resetToDefault();
      triggerStatus('success', 'Banco de dados restaurado aos padrões iniciais da Paróquia.');
      await loadData();
      handleClearForm();
    }
  };

  // Calculations
  const filteredProducts = products.filter(p => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    return p.name.toLowerCase().includes(query) || p.code.includes(query) || p.category.toLowerCase().includes(query);
  });

  // POINT OF SALE CHECKOUT FILTERING PRODUCTS:
  const checkoutAvailableProducts = products.filter(p => {
    // Rule 1: must have a sale price set
    if (!p.salePrice || p.salePrice <= 0) return false;

    // Category filter
    if (salesCategoryFilter !== 'Todos' && p.category !== salesCategoryFilter) return false;

    // Search query
    const query = salesSearchQuery.toLowerCase().trim();
    if (!query) return true;
    return p.name.toLowerCase().includes(query) || p.code.includes(query);
  });

  // REPORTS METRICS CALCULATOR:
  const getPeriodReportDetails = () => {
    const start = new Date(reportStartDate + 'T00:00:00');
    const end = new Date(reportEndDate + 'T23:59:59');

    // 1. Filter Purchase logs
    const purchasesList = purchases;
    const filteredPurchases = purchasesList.filter(p => {
      const ts = new Date(p.timestamp);
      return ts >= start && ts <= end;
    });

    const totalPurchasesValue = filteredPurchases.reduce((acc, curr) => acc + (curr.quantityAdded * curr.costPrice), 0);

    // 2. Filter Sales logs
    const filteredSales = sales.filter(s => {
      const ts = new Date(s.timestamp);
      return ts >= start && ts <= end;
    });

    const totalSalesValue = filteredSales.reduce((acc, curr) => acc + curr.totalPrice, 0);
    const totalSalesQty = filteredSales.reduce((acc, curr) => acc + curr.quantity, 0);

    // 3. Estimated Cost of Goods Sold (CMV) and profits
    let totalCMV = 0;
    filteredSales.forEach(s => {
      const prod = products.find(p => p.id === s.productId);
      const costBasis = prod ? prod.costPrice : s.salePrice * 0.5; // fallback
      totalCMV += s.quantity * costBasis;
    });

    const estimatedProfit = totalSalesValue - totalCMV;

    return {
      filteredPurchases,
      filteredSales,
      totalPurchasesValue,
      totalSalesValue,
      totalSalesQty,
      totalCMV,
      estimatedProfit
    };
  };

  // Filter products needing price set: Either undefined or <= 0
  const unpricedProducts = products.filter(p => !p.salePrice || p.salePrice <= 0);

  const totalStockValue = products.reduce((acc, curr) => acc + (curr.quantity * curr.costPrice), 0);
  const outOfStockCount = products.filter(p => p.quantity === 0).length;
  const lowStockCount = products.filter(p => p.quantity > 0 && p.quantity <= p.minStock).length;
  const totalSalesRevenue = sales.reduce((acc, curr) => acc + curr.totalPrice, 0);

  // Daily Calculations
  const todayPurchasesList = purchases.filter(p => {
    const d = new Date(p.timestamp);
    const today = new Date();
    return d.getDate() === today.getDate() &&
           d.getMonth() === today.getMonth() &&
           d.getFullYear() === today.getFullYear();
  });
  const dailyExpensesValue = todayPurchasesList.reduce((acc, curr) => acc + (curr.quantityAdded * curr.costPrice), 0);

  const todaySalesList = sales.filter(s => {
    const d = new Date(s.timestamp);
    const today = new Date();
    return d.getDate() === today.getDate() &&
           d.getMonth() === today.getMonth() &&
           d.getFullYear() === today.getFullYear();
  });
  const dailySalesValue = todaySalesList.reduce((acc, curr) => acc + curr.totalPrice, 0);

  const dailyOperationalBalance = dailySalesValue - dailyExpensesValue;

  return (
    <div className="flex flex-col min-h-screen bg-slate-100">
      
      {/* AREA CONGELADA / STICKY HEADER AND NAVIGATION ZONE */}
      <div className="sticky top-0 z-40 bg-slate-100 print-hide shadow-md">
        {/* 1. TOP TITLE BAR - Windows Modern WPF/Classic Identity */}
        <header className="bg-slate-900 text-slate-100 px-6 py-4 flex flex-col md:flex-row justify-between items-center border-b-4 border-blue-700 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="relative group cursor-pointer bg-slate-800 p-1 rounded border border-slate-700 shrink-0 flex items-center justify-center">
              {parishLogo ? (
                <img 
                  src={parishLogo} 
                  alt="Logo Paróquia" 
                  className="w-12 h-12 object-contain rounded"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-12 h-12 bg-blue-600 rounded flex items-center justify-center text-white text-md font-extrabold font-mono shadow-inner">
                  STK
                </div>
              )}
              
              {/* Hover to change */}
              <label className="absolute inset-0 bg-black/75 opacity-0 group-hover:opacity-100 transition duration-150 flex flex-col items-center justify-center rounded cursor-pointer text-[9px] text-white font-sans font-bold select-none text-center p-0.5 leading-none">
                <span>Alterar</span>
                <span className="mt-0.5">Logo</span>
                <input 
                  type="file" 
                  accept="image/png, image/jpeg" 
                  onChange={handleLogoUpload} 
                  className="hidden" 
                />
              </label>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-extrabold tracking-tight">SISTEMA STOCK</h1>
              </div>
              <p className="text-xs text-slate-400 font-mono flex items-center flex-wrap gap-2">
                <span>Secretaria Paroquial</span>
                {parishLogo && (
                  <>
                    <span className="text-slate-600">|</span>
                    <button 
                      onClick={handleLogoReset}
                      className="text-amber-400 hover:text-amber-300 underline text-[9px] font-bold cursor-pointer transition uppercase"
                    >
                      Remover Logo
                    </button>
                  </>
                )}
              </p>
            </div>
          </div>

          {/* User profile & Active Session State info */}
          <div className="flex flex-wrap items-center gap-4 mt-3 md:mt-0 bg-slate-800 px-4 py-2 rounded border border-slate-700">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded bg-blue-600 flex items-center justify-center text-white text-xs font-bold shadow-sm border border-blue-400 font-mono">
                {currentUser.name.substring(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="text-xs font-bold text-slate-200">{currentUser.name}</div>
                <div className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${currentUser.role === 'Administrador' ? 'bg-amber-400' : 'bg-green-400'}`}></span>
                  <span className="text-[10px] text-slate-400 font-mono font-medium">{currentUser.role}</span>
                </div>
              </div>
            </div>
            <span className="text-slate-650 hidden sm:inline">|</span>
            <label className="flex items-center gap-1.5 text-xs font-bold bg-blue-700 hover:bg-blue-600 active:bg-blue-800 text-white font-mono py-1.5 px-3 rounded shadow transition border border-blue-800 cursor-pointer print-hide leading-none">
              <Upload size={13} />
              <span>Configurar Logótipo</span>
              <input 
                type="file" 
                accept="image/png, image/jpeg" 
                onChange={handleLogoUpload} 
                className="hidden" 
              />
            </label>
            <span className="text-slate-650 hidden sm:inline">|</span>
            <button
              onClick={onLogout}
              className="flex items-center gap-1 text-xs font-bold bg-red-800 hover:bg-red-700 active:bg-red-900 text-red-100 font-mono py-1.5 px-3 rounded shadow transition border border-red-900 print-hide"
            >
              <span>Sair / Trocar Usuário</span>
            </button>
          </div>
        </header>

        {/* 4. TABBED CONTAINER HEADER - WinForms Style */}
        <div className="max-w-7xl mx-auto w-full px-6 pt-4">
          <div className="bg-slate-200 p-1 border border-slate-300 rounded-t flex flex-wrap gap-1">
            <button
              onClick={() => setActiveTab('products')}
              className={`px-4 py-2.5 text-xs font-bold rounded-t flex items-center gap-2 border-b-2 transition ${
                activeTab === 'products'
                  ? 'bg-white text-blue-900 border-blue-800 shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
              }`}
            >
              <FileSpreadsheet size={13} />
              <span>Cadastro & Compras</span>
            </button>

            <button
              onClick={() => setActiveTab('pricing')}
              className={`px-4 py-2.5 text-xs font-bold rounded-t flex items-center gap-2 border-b-2 transition relative ${
                activeTab === 'pricing'
                  ? 'bg-white text-blue-900 border-blue-800 shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
              }`}
            >
              <Coins size={13} />
              <span>Atribuição de Preços</span>
              {unpricedProducts.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-600 text-white font-mono text-[9px] font-bold px-1.5 py-0.5 rounded-full animate-bounce">
                  {unpricedProducts.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('sales')}
              className={`px-4 py-2.5 text-xs font-bold rounded-t flex items-center gap-2 border-b-2 transition ${
                activeTab === 'sales'
                  ? 'bg-white text-blue-900 border-blue-800 shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
              }`}
            >
              <SaleIcon size={13} />
              <span>Frente de Caixa</span>
            </button>

            <button
              onClick={() => setActiveTab('categories')}
              className={`px-4 py-2.5 text-xs font-bold rounded-t flex items-center gap-2 border-b-2 transition ${
                activeTab === 'categories'
                  ? 'bg-white text-blue-900 border-blue-800 shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
              }`}
            >
              <Layers size={13} />
              <span>Estoque Grupal</span>
            </button>

            <button
              onClick={() => setActiveTab('reports')}
              className={`px-4 py-2.5 text-xs font-bold rounded-t flex items-center gap-2 border-b-2 transition ${
                activeTab === 'reports'
                  ? 'bg-white text-blue-900 border-blue-800 shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
              }`}
            >
              <Calendar size={13} />
              <span>Relatórios</span>
            </button>

            <button
              onClick={() => setActiveTab('audit')}
              className={`px-4 py-2.5 text-xs font-bold rounded-t flex items-center gap-2 border-b-2 transition ${
                activeTab === 'audit'
                  ? 'bg-white text-blue-900 border-blue-800 shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
              }`}
            >
              <Activity size={13} />
              <span>Auditoria & Operadores</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. MAIN WORKSPACE CONTAINER */}
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6 pb-28">
        
        {/* Interactive Alerts Bar */}
        {statusMessage && (
          <div className={`p-3 rounded border text-xs flex items-center gap-2 shadow-sm animate-pulse print-hide ${
            statusMessage.type === 'success' 
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
              : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            {statusMessage.type === 'success' ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
            <span className="font-mono">{statusMessage.text}</span>
          </div>
        )}

        {/* 5. DATA CONTAINER PANEL */}
        <div className="bg-white border-x border-b border-slate-300 shadow-sm p-4 rounded-b">
          
          {/* TAB 1: FULL SCREEN PRODUCTS CATALOG WITH REGISTER TRIGGER BUTTON */}
          {activeTab === 'products' && (
            <div className="space-y-4 w-full">
              
              {/* Filter bar with Quick Action button */}
              <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center bg-slate-100 p-3 rounded border border-slate-300 shadow-sm print-hide">
                <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-750">FILTRAR STOCK:</span>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Buscar por descrição, SKU ou grupo..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8 pr-3 py-1.5 text-xs bg-white text-slate-800 border border-slate-300 rounded focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 w-64 font-sans"
                      />
                      <Search size={12} className="text-slate-400 absolute left-2.5 top-2.5" />
                    </div>
                  </div>

                  {/* Buttons group */}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsCategoryModalOpen(true);
                      }}
                      className="flex items-center gap-1 text-xs font-bold bg-slate-600 hover:bg-slate-700 active:bg-slate-800 text-white font-sans py-1.5 px-3 rounded shadow transition cursor-pointer"
                    >
                      <Layers size={14} />
                      <span>Gerenciar Categorias</span>
                    </button>

                    {/* Button to register a new product */}
                    <button
                      type="button"
                      onClick={async () => {
                        await handleClearForm();
                        setFormMode('NOVO');
                        setIsProductModalOpen(true);
                      }}
                      className="flex items-center gap-1 text-xs font-bold bg-blue-700 hover:bg-blue-800 active:bg-blue-900 text-white font-sans py-1.5 px-3 rounded shadow transition"
                    >
                      <Plus size={14} />
                      <span>Cadastrar Novo Produto</span>
                    </button>
                  </div>
                </div>

                <span className="text-[10px] text-slate-500 font-mono">
                  Mostrando <strong className="text-slate-800">{filteredProducts.length}</strong> de {products.length} itens.
                </span>
              </div>

              {/* Alternating row thin-border Excel table with independent overflow and sticky top-header */}
              <div className="overflow-x-auto border border-slate-300 rounded shadow-sm max-h-[500px] overflow-y-auto">
                <table className="excel-grid min-w-full font-sans text-xs">
                  <thead className="sticky top-0 bg-slate-100 z-10 shadow-sm">
                    <tr>
                      <th className="py-1.5 px-3 text-left w-24">CÓDIGO</th>
                      <th className="py-1.5 px-3 text-left">DESCRIÇÃO DO PRODUTO</th>
                      <th className="py-1.5 px-3 text-left w-36">CATEGORIA</th>
                      <th className="py-1.5 px-3 text-right w-32 whitespace-nowrap">CUSTO (MTn)</th>
                      <th className="py-1.5 px-3 text-right w-32 whitespace-nowrap">VENDA (MTn)</th>
                      <th className="py-1.5 px-3 text-right w-20">STOCK</th>
                      <th className="py-1.5 px-3 text-center w-28">ESTADO</th>
                      <th className="py-1.5 px-3 text-center w-36">AÇÕES</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.map((p) => {
                      const isZero = p.quantity === 0;
                      const isLow = p.quantity > 0 && p.quantity <= p.minStock;
                      let stockBadge = <span className="bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded text-[10px]">Normal</span>;
                      
                      if (p.type === 'servico') {
                        stockBadge = <span className="bg-slate-100 text-slate-600 border border-slate-300 font-semibold px-2 py-0.5 rounded text-[10px]">Não Aplicável</span>;
                      } else if (isZero) {
                        stockBadge = <span className="bg-red-200 text-red-900 border border-red-300 font-bold px-2 py-0.5 rounded text-[10px]">Esgotado</span>;
                      } else if (isLow) {
                        stockBadge = <span className="bg-amber-100 text-amber-800 border border-amber-300 font-semibold px-2 py-0.5 rounded text-[10px]">Baixo</span>;
                      }

                      // Determine if we currently select this product in form
                      const isSelectedInForm = selectedProductId === p.id;

                      return (
                        <tr key={p.id} className={isSelectedInForm ? 'bg-blue-50/70 border-l-4 border-l-blue-600 border-b border-slate-150' : 'hover:bg-slate-50 border-b border-slate-150'}>
                          <td className="py-1.5 px-3 font-mono text-slate-700 text-left font-bold">{p.code}</td>
                          <td className="py-1.5 px-3 text-slate-900 text-left">
                            <button
                              type="button"
                              onClick={() => handleOpenProductActions(p)}
                              className="text-blue-700 hover:text-blue-900 hover:underline font-bold text-left cursor-pointer focus:outline-none"
                            >
                              {p.name}
                            </button>
                          </td>
                          <td className="py-1.5 px-3 text-slate-650 text-left font-sans">
                            {p.category}
                          </td>
                          <td className="py-1.5 px-3 text-slate-600 text-right font-mono whitespace-nowrap">
                            {p.type === 'servico' ? 'N/A' : `${p.costPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} MTn`}
                          </td>
                          <td className="py-1.5 px-3 text-slate-900 text-right font-mono whitespace-nowrap">
                            {p.salePrice 
                              ? `${p.salePrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} MTn`
                              : <span className="text-red-500 italic text-[10px] whitespace-nowrap">Não precificado</span>
                            }
                          </td>
                          <td className={`py-1.5 px-3 text-right font-mono font-bold ${p.type === 'servico' ? 'text-slate-500' : isZero ? 'text-red-650 bg-red-50 animate-pulse' : 'text-slate-800'}`}>
                            {p.type === 'servico' ? (
                              <span className="bg-slate-100 text-slate-600 border border-slate-300 px-1.5 py-0.5 rounded text-[10px] font-semibold">N/A</span>
                            ) : (
                              p.quantity
                            )}
                          </td>
                          <td className="py-1.5 px-3 text-center">{stockBadge}</td>
                          <td className="py-1.5 px-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {/* Option 1: Edit Details (Load to Form dialog) */}
                              <button
                                onClick={() => handleSelectProductToEdit(p)}
                                className="text-[10px] font-mono bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-350 py-0.5 px-2 rounded transition font-semibold cursor-pointer"
                                title="Editar Produto"
                              >
                                Editar
                              </button>
                              
                              {/* Option 2: Record purchase/stock addition */}
                              {p.type !== 'servico' && (
                                <button
                                  onClick={() => handleSelectProductForStockRefill(p)}
                                  className="text-[10px] font-mono bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-250 py-0.5 px-2 rounded transition font-bold cursor-pointer"
                                  title="Registar nova compra de lote"
                                >
                                  Comprar
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}

                    {filteredProducts.length === 0 && (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-400 font-mono">
                          Nenhum produto localizado para os filtros informados.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: ATRIBUIÇÃO DE PREÇOS (PRECIFICAÇÃO) */}
          {activeTab === 'pricing' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 bg-slate-50 p-3 rounded border border-slate-200">
                <div className="space-y-1">
                  <span className="text-xs font-bold text-slate-705 uppercase tracking-wide font-mono block">
                    PAINEL EXCEL: Itens Aguardando Precificação de Venda
                  </span>
                  <p className="text-[11px] text-slate-500">
                    Regra Geral: Para o produto estar disponível no checkout, é obrigatório possuir preço maior que 0,00 MTn.
                  </p>
                </div>
                
                <span className="bg-amber-100 text-amber-900 text-[10px] font-bold px-2 py-1 rounded font-mono border border-amber-200">
                  {unpricedProducts.length} itens travados para comércio
                </span>
              </div>

              {/* Segmented control filter for pricing tab */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-2 bg-slate-100 rounded border border-slate-350 gap-2">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPriceFilterMode('UNPRICED')}
                    className={`px-3 py-1 font-mono text-[11px] font-bold rounded transition ${
                      priceFilterMode === 'UNPRICED'
                        ? 'bg-blue-700 text-white'
                        : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-300'
                    }`}
                  >
                    Aguardando Preço ({unpricedProducts.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPriceFilterMode('ALL')}
                    className={`px-3 py-1 font-mono text-[11px] font-bold rounded transition ${
                      priceFilterMode === 'ALL'
                        ? 'bg-blue-700 text-white'
                        : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-300'
                    }`}
                  >
                    Todos os Cadastrados ({products.length})
                  </button>
                </div>
                <p className="text-[10px] text-slate-505 font-mono italic">
                  * Altere qualquer preço da coluna "VENDA (MTn)" para atualizar instantaneamente todo o sistema.
                </p>
              </div>

              {(() => {
                const pricingProductsToDisplay = priceFilterMode === 'UNPRICED' 
                  ? unpricedProducts 
                  : products;

                if (pricingProductsToDisplay.length === 0) {
                  return (
                    <div className="text-center py-16 bg-slate-50 border border-dashed border-slate-200 rounded">
                      <CheckCircle size={32} className="text-emerald-500 mx-auto mb-3" />
                      <p className="text-slate-800 text-sm font-sans font-bold">Nenhum produto pendente ou cadastrado para exibição.</p>
                    </div>
                  );
                }

                return (
                  <div className="overflow-x-auto border border-slate-300 rounded shadow-inner max-h-[500px] overflow-y-auto bg-white">
                    <table className="excel-grid min-w-full font-sans text-xs">
                      <thead>
                        <tr className="bg-slate-100 font-mono">
                          <th className="py-1.5 px-3 text-left w-24">CÓDIGO (SKU)</th>
                          <th className="py-1.5 px-3 text-left">DESCRIÇÃO DO PRODUTO</th>
                          <th className="py-1.5 px-3 text-left w-36">CATEGORIA</th>
                          <th className="py-1.5 px-3 text-right w-32 whitespace-nowrap">CUSTO (MTn)</th>
                          <th className="py-1.5 px-3 text-right w-32 whitespace-nowrap">VENDA ATUAL (MTn)</th>
                          <th className="py-1.5 px-3 text-right w-24">ESTOQUE</th>
                          <th className="py-1.5 px-3 text-center w-52">EDITAR PREÇO VENDA</th>
                          <th className="py-1.5 px-3 text-center w-36">AÇÃO</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pricingProductsToDisplay.map((p) => {
                          const hasSalePrice = p.salePrice && p.salePrice > 0;
                          const currentValInInput = pricingInputs[p.id] !== undefined 
                            ? pricingInputs[p.id] 
                            : (hasSalePrice ? p.salePrice!.toString() : '');

                          return (
                            <tr key={p.id} className="hover:bg-slate-50 border-b border-slate-150">
                              <td className="py-1.5 px-3 font-mono text-slate-700 text-left font-bold">{p.code}</td>
                              <td className="py-1.5 px-3 text-left font-normal">
                                <button
                                  type="button"
                                  onClick={() => handleSelectProductToEdit(p)}
                                  className="text-blue-700 hover:text-blue-950 hover:underline font-normal text-left cursor-pointer focus:outline-none"
                                  title="Editar detalhes do produto"
                                >
                                  {p.name}
                                </button>
                              </td>
                              <td className="py-1.5 px-3 text-slate-600 text-left font-sans text-xs">
                                {p.category}
                              </td>
                              <td className="py-1.5 px-3 text-right font-mono whitespace-nowrap">
                                {p.type === 'servico' ? (
                                  <span className="text-slate-500">N/A</span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleSelectProductForStockRefill(p)}
                                    className="text-blue-700 hover:text-blue-950 hover:underline font-mono text-right cursor-pointer focus:outline-none font-semibold"
                                    title="Registrar nova compra / Lançar lote deste item"
                                  >
                                    {p.costPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} MTn
                                  </button>
                                )}
                              </td>
                              <td className="py-1.5 px-3 text-right font-mono whitespace-nowrap">
                                {hasSalePrice ? (
                                  <span className="text-slate-800 font-normal">{p.salePrice!.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} MTn</span>
                                ) : (
                                  <span className="text-red-500 italic text-[10px]">Não precificado</span>
                                )}
                              </td>
                              <td className="py-1.5 px-3 text-right font-mono font-normal text-slate-705">
                                {p.type === 'servico' ? (
                                  <span className="bg-slate-100 text-slate-600 border border-slate-300 px-1.5 py-0.5 rounded text-[10px] font-semibold">N/A</span>
                                ) : (
                                  p.quantity
                                )}
                              </td>
                              <td className="py-1 px-3 text-center">
                                <form 
                                  onSubmit={(e) => {
                                    e.preventDefault();
                                    setConfirmDialog({
                                      isOpen: true,
                                      type: 'edit',
                                      message: `Atribuir/Alterar preço de "${p.name}" para ${Number((currentValInInput || '0').replace(',', '.')).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} MTn?`,
                                      onConfirm: () => handleAssignPrice(p.id)
                                    });
                                  }}
                                  className="flex items-center justify-center gap-1 max-w-[150px] mx-auto"
                                >
                                  <input
                                    type="text"
                                    placeholder="0,00"
                                    value={currentValInInput}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setPricingInputs(prev => ({
                                        ...prev,
                                        [p.id]: val
                                      }));
                                    }}
                                    className="w-full px-2 py-0.5 text-xs text-right bg-white border border-slate-300 rounded font-mono font-normal focus:border-blue-700 font-sans cursor-text"
                                  />
                                  <span className="text-slate-400 font-mono text-[10px] shrink-0">MTn</span>
                                </form>
                              </td>
                              <td className="py-1 px-3 text-center">
                                <button
                                  onClick={() => {
                                    setConfirmDialog({
                                      isOpen: true,
                                      type: 'edit',
                                      message: `Atribuir/Alterar preço de "${p.name}" para ${Number((currentValInInput || '0').replace(',', '.')).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} MTn?`,
                                      onConfirm: () => handleAssignPrice(p.id)
                                    });
                                  }}
                                  className="px-3 py-0.5 bg-emerald-700 hover:bg-emerald-800 text-white font-mono rounded text-[10px] font-bold transition flex items-center gap-0.5 mx-auto cursor-pointer"
                                >
                                  <Check size={10} />
                                  <span>Salvar</span>
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>
          )}

          {/* TAB 3: TERMINAL FRENTE DE CAIXA (SISTEMA DE VENDAS) */}
          {activeTab === 'sales' && (
            <div className="space-y-6">
              
              {/* Header Title Information Box */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 bg-slate-50 p-3 rounded border border-slate-200">
                <div className="space-y-1">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wide font-mono block">
                    TERMINAL DE VENDAS: Frente de Caixa da Secretaria Paroquial
                  </span>
                  <p className="text-[11px] text-slate-500">
                    Selecione um produto precificado ao lado, informe a quantidade e confirme a transação no cupom fiscal paroquial.
                  </p>
                </div>
                <div className="flex gap-2">
                  <span className="bg-emerald-100 text-emerald-900 text-[10px] font-bold px-2.5 py-1 rounded font-mono border border-emerald-200">
                    Dinheiro / Dízimos Caixa Livre
                  </span>
                </div>
              </div>

              {/* Core POS Terminal Grid (Catalog vs Form Split) */}
              <div className="flex flex-col lg:flex-row gap-6 items-start">
                
                {/* Visual Sales Catalog */}
                <div className="flex-1 w-full space-y-4">
                  
                  {/* Search and Category Quick Toggles */}
                  <div className="flex flex-col sm:flex-row gap-2 bg-slate-50 p-2.5 rounded border border-slate-200">
                    <div className="relative flex-1">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                        <Search size={14} />
                      </span>
                      <input
                        type="text"
                        placeholder="Busca rápida por código ou descrição paroquial..."
                        value={salesSearchQuery}
                        onChange={(e) => setSalesSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-300 rounded focus:border-blue-700 focus:outline-none"
                      />
                    </div>
                    
                    {/* Category quick dropdown */}
                    <select
                      value={salesCategoryFilter}
                      onChange={(e) => setSalesCategoryFilter(e.target.value)}
                      className="bg-white px-3 py-2 text-xs border border-slate-300 rounded focus:border-blue-700 focus:outline-none font-mono"
                    >
                      <option value="Todos">Todas as Categorias</option>
                      {categories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  {/* Excel Style DataGrid of Products Available for Sale */}
                  {checkoutAvailableProducts.length === 0 ? (
                    <div className="text-center py-12 bg-slate-50 border border-dashed border-slate-200 rounded">
                      <AlertCircle size={28} className="text-slate-400 mx-auto mb-2" />
                      <p className="text-sm font-bold text-slate-755">Nenhum produto precificado corresponde à busca.</p>
                      <p className="text-xs text-slate-500 font-mono mt-1">
                        Verifique se definiu o preço de venda na subguia "[F2] Atribuição de Preços" antes de tentar comerciá-los.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto border border-slate-300 rounded shadow-inner max-h-[400px] overflow-y-auto">
                      <table className="excel-grid min-w-full font-sans text-xs">
                        <thead className="sticky top-0 bg-slate-100 z-10 shadow-sm">
                          <tr>
                            <th className="py-2 px-3 text-left whitespace-nowrap">DESCRIÇÃO DO PRODUTO</th>
                            <th className="py-2 px-3 text-left w-32 whitespace-nowrap">CATEGORIA</th>
                            <th className="py-2 px-3 text-right w-24 whitespace-nowrap">ESTOQUE ATUAL</th>
                            <th className="py-2 px-3 text-right w-28 whitespace-nowrap">VALOR DE VENDA (MTn)</th>
                            <th className="py-2 px-3 text-center w-28 whitespace-nowrap">SELEÇÃO</th>
                          </tr>
                        </thead>
                        <tbody>
                          {checkoutAvailableProducts.map((p) => {
                            const cartItem = checkoutCart.find(item => item.productId === p.id);
                            const isInCart = !!cartItem;
                            const isOutOfStock = p.quantity <= 0;
                            
                            return (
                              <tr 
                                key={p.id}
                                className={`transition border-b border-slate-150 ${
                                  isInCart 
                                    ? 'bg-blue-50/50 font-semibold' 
                                    : 'hover:bg-slate-50/70'
                                }`}
                              >
                                <td className="py-2 px-3 text-slate-900 text-left font-semibold whitespace-nowrap">{p.name}</td>
                                <td className="py-2 px-3 text-slate-600 text-left font-sans text-xs whitespace-nowrap">
                                  {p.category}
                                </td>
                                <td className={`py-2 px-3 text-right font-mono font-bold whitespace-nowrap ${
                                  isOutOfStock ? 'text-red-700 font-extrabold' : 'text-slate-750'
                                }`}>
                                  {isOutOfStock ? 'SEM ESTOQUE' : p.quantity}
                                </td>
                                <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                                  {p.salePrice?.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MTn
                                </td>
                                <td className="py-1 px-2 text-center">
                                  <button
                                    onClick={() => {
                                      if (isOutOfStock) {
                                        triggerStatus('error', `Aviso: "${p.name}" não possui saldo de estoque e não pode ser comercializado.`);
                                        return;
                                      }
                                      handleAddToCart(p);
                                    }}
                                    disabled={isOutOfStock}
                                    className={`px-2.5 py-1 text-[10px] font-mono font-bold rounded transition cursor-pointer ${
                                      isOutOfStock
                                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-350'
                                        : isInCart
                                        ? 'bg-blue-700 text-white border border-blue-800 font-bold shadow'
                                        : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-300'
                                    }`}
                                  >
                                    {isInCart ? `✓ NO CUPOM (${cartItem.quantity})` : 'SELECIONAR'}
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                </div>

                {/* Billing Checkout Form (Right Side) */}
                <div className="w-full lg:w-80 shrink-0 font-sans">
                  <div className="bg-slate-50 p-4 border border-slate-300 rounded shadow-md class-cash-panel">
                    
                    {/* Panel Header */}
                    <div className="pb-3 border-b border-slate-300 mb-3 flex items-center justify-between">
                      <span className="text-xs font-bold font-mono tracking-wide text-slate-700 block uppercase">
                        Cupom Paroquial Eletrônico
                      </span>
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" title="Terminal Ativo"></span>
                    </div>

                    {checkoutCart.length === 0 ? (
                      <div className="text-center py-16 text-slate-400 border border-dashed border-slate-300 rounded bg-white p-4">
                        <AlertCircle size={28} className="mx-auto mb-2 text-slate-350" />
                        <p className="text-xs font-mono font-bold text-slate-500">Cupom Vazio</p>
                        <p className="text-[10px] text-slate-400 mt-1">
                          Selecione produtos no catálogo à esquerda para ir acumulando neste espaço.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* Cart Items List Container with scroll if too long */}
                        <div className="max-h-[340px] overflow-y-auto space-y-2 border-b border-dashed border-slate-200 pb-3 pr-1">
                          {checkoutCart.map((item) => {
                            const unitPrice = item.salePrice;
                            const totalPrice = unitPrice * item.quantity;
                            
                            return (
                              <div key={item.productId} className="bg-white p-2.5 rounded border border-slate-200 hover:border-slate-300 shadow-sm transition space-y-2 relative">
                                {/* Name and remove button side by side */}
                                <div className="flex justify-between items-start gap-1">
                                  <div className="pr-5">
                                    <h4 className="text-xs font-bold text-slate-900 leading-tight font-sans break-words">{item.name}</h4>
                                    <span className="text-[9px] font-mono text-slate-400 block mt-0.5">SKU: {item.code}</span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveFromCart(item.productId)}
                                    className="text-slate-400 hover:text-red-650 transition p-0.5 rounded focus:outline-none cursor-pointer absolute top-2 right-2"
                                    title="Remover item do cupom"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>

                                {/* Controls, pricing, and total info row */}
                                <div className="flex items-center justify-between pt-1 border-t border-slate-100 mt-1">
                                  {/* Quantity adjustments */}
                                  <div className="flex items-center gap-1.5 bg-slate-50 rounded border border-slate-200 px-1 py-0.5">
                                    <button
                                      type="button"
                                      disabled={item.quantity <= 1}
                                      onClick={() => handleUpdateCartQuantity(item.productId, item.quantity - 1)}
                                      className={`w-4 h-4 rounded text-xs leading-none font-bold select-none cursor-pointer flex items-center justify-center transition focus:outline-none ${
                                        item.quantity <= 1
                                          ? 'text-slate-300 cursor-not-allowed'
                                          : 'text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                                      }`}
                                    >
                                      -
                                    </button>
                                    <span className="text-[10px] font-mono font-extrabold text-slate-850 min-w-[14px] text-center">
                                      {item.quantity}
                                    </span>
                                    <button
                                      type="button"
                                      disabled={item.quantity >= item.maxStock}
                                      onClick={() => handleUpdateCartQuantity(item.productId, item.quantity + 1)}
                                      className={`w-4 h-4 rounded text-xs leading-none font-bold select-none cursor-pointer flex items-center justify-center transition focus:outline-none ${
                                        item.quantity >= item.maxStock
                                          ? 'text-slate-300 cursor-not-allowed'
                                          : 'text-slate-650 hover:bg-slate-200 hover:text-slate-900'
                                      }`}
                                    >
                                      +
                                    </button>
                                  </div>

                                  {/* Prices breakdown */}
                                  <div className="text-right">
                                    <div className="text-[9px] text-slate-450 font-mono">
                                      {unitPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} × {item.quantity}
                                    </div>
                                    <div className="text-xs font-mono font-bold text-slate-800">
                                      {totalPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} MTn
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Grand Total Footer Panel */}
                        {(() => {
                          const totalSum = checkoutCart.reduce((sum, item) => sum + (item.salePrice * item.quantity), 0);
                          const totalItemsCount = checkoutCart.reduce((sum, item) => sum + item.quantity, 0);

                          return (
                            <div className="space-y-4">
                              <div className="bg-emerald-50 p-3 rounded border border-emerald-250 space-y-1">
                                <div className="flex justify-between text-[10px] font-mono text-emerald-800 uppercase tracking-tight">
                                  <span>Itens no cupom:</span>
                                  <span>{checkoutCart.length} tipo(s) ({totalItemsCount})</span>
                                </div>
                                <div className="pt-2 border-t border-emerald-250 flex justify-between items-baseline">
                                  <span className="text-xs font-mono font-bold text-emerald-950 uppercase">Total Geral:</span>
                                  <span className="text-lg font-black text-emerald-950 font-mono">
                                    {totalSum.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MTn
                                  </span>
                                </div>
                              </div>

                              {/* Action Buttons */}
                              <div className="flex flex-col gap-1.5">
                                <button
                                  type="button"
                                  onClick={handleRegisterSale}
                                  className="w-full py-2.5 text-xs font-extrabold text-white bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 border border-emerald-800 rounded font-mono flex items-center justify-center gap-2 shadow-sm transition hover:shadow-md cursor-pointer"
                                >
                                  <span>REGISTRAR VENDA [F3]</span>
                                  <ArrowRight size={12} />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => setCheckoutCart([])}
                                  className="w-full py-2 text-xs font-semibold text-slate-550 hover:text-slate-800 hover:bg-slate-100 border border-slate-250 rounded transition font-mono cursor-pointer"
                                >
                                  Esvaziar Cupom
                                </button>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                </div>

              </div>

              {/* Transactions Log Table (Read-only historical view for verification) */}
              <div className="space-y-2 pt-4">
                <div className="flex justify-between items-center bg-slate-50 p-2 rounded border border-slate-200">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wide font-mono block">
                    REGISTRO ANALÍTICO: Ultimas Vendas Realizadas (Livro-Caixa)
                  </span>
                  <button
                    type="button"
                    onClick={handleClearSales}
                    className="flex items-center gap-1 bg-red-700 hover:bg-red-600 active:bg-red-800 text-white text-[10px] font-mono font-bold uppercase tracking-wide px-2.5 py-1 rounded transition focus:outline-none cursor-pointer"
                  >
                    <Trash2 size={11} className="text-white" />
                    Limpar vendas
                  </button>
                </div>
                
                {sales.length === 0 ? (
                  <div className="text-center py-6 bg-slate-50 border border-slate-200 rounded">
                    <p className="text-xs text-slate-400 font-mono">Nenhuma venda paroquial faturada até o momento.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-slate-300 rounded shadow-sm">
                    <table className="excel-grid min-w-full font-sans text-[11px]">
                      <thead>
                        <tr className="bg-slate-100">
                          <th className="py-2 px-3 text-left w-20 whitespace-nowrap">Nº RECIBO</th>
                          <th className="py-2 px-3 text-left whitespace-nowrap">DESCRIÇÃO DO PRODUTO</th>
                          <th className="py-2 px-3 text-left w-28 whitespace-nowrap">CATEGORIA</th>
                          <th className="py-2 px-3 text-right w-24 whitespace-nowrap">QTD</th>
                          <th className="py-2 px-3 text-right w-28 whitespace-nowrap">PREÇO UNITÁRIO</th>
                          <th className="py-2 px-3 text-right w-32 font-bold select-all whitespace-nowrap">VALOR TOTAL (MTn)</th>
                          <th className="py-2 px-3 text-left w-44 whitespace-nowrap">OPERADOR EMISSOR</th>
                          <th className="py-2 px-3 text-right w-36 whitespace-nowrap">DATA / HORA REGISTRO</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sales.map((s) => (
                          <tr key={`${s.id}_${s.productId}_${s.timestamp}`} className="hover:bg-slate-50 border-b border-slate-150">
                            <td className="py-2 px-3 text-slate-800 text-left font-mono font-bold whitespace-nowrap">{s.id}</td>
                            <td className="py-2 px-3 text-slate-900 text-left font-semibold whitespace-nowrap">{s.productName}</td>
                            <td className="py-2 px-3 text-slate-600 text-left font-sans text-xs whitespace-nowrap">
                              {s.category}
                            </td>
                            <td className="py-2 px-3 text-slate-750 text-right font-mono font-medium whitespace-nowrap">{s.quantity}</td>
                            <td className="py-2 px-3 text-slate-600 text-right font-mono whitespace-nowrap">
                              {s.salePrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} MTn
                            </td>
                            <td className="py-2 px-3 text-emerald-800 text-right font-mono font-bold bg-slate-50/50 whitespace-nowrap">
                              {s.totalPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} MTn
                            </td>
                            <td className="py-2 px-3 text-slate-700 text-left font-semibold whitespace-nowrap">{s.sellerName}</td>
                            <td className="py-2 px-3 text-slate-500 text-right font-mono whitespace-nowrap">
                              {new Date(s.timestamp).toLocaleDateString('pt-BR')} {new Date(s.timestamp).toLocaleTimeString('pt-BR')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* TAB 4: CONSULTA AVANÇADA POR CATEGORIAS (Spreadsheet style grouped inventory) */}
          {activeTab === 'categories' && (
            <div className="space-y-4">
              
              {/* Informative Header Pane */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 bg-slate-50 p-3 rounded border border-slate-200 print-hide">
                <div className="space-y-1">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wide font-mono block">
                    PAINEL DE CONSULTA AVANÇADA: Inventário Agrupado por Categoria Litúrgica
                  </span>
                  <p className="text-[11px] text-slate-500">
                    Demonstração de estoque em tempo real. Linhas com estoque zerado (<code className="text-red-700 font-bold">0</code>) são automaticamente coloridas com formatação condicional Excel.
                  </p>
                </div>
              </div>

              {/* Loop over liturgical categories and render spreadsheet table */}
              <div className="overflow-x-auto border border-slate-300 rounded shadow-md max-h-[450px] overflow-y-auto">
                <table className="excel-grid min-w-full font-sans text-xs">
                  <thead className="sticky top-0 bg-slate-100 z-10 shadow-sm">
                    <tr className="bg-slate-100 text-slate-800 border-b border-slate-300 font-mono">
                      <th className="py-2.5 px-3 text-left w-36 whitespace-nowrap">CATEGORIA LITÚRGICA</th>
                      <th className="py-2.5 px-3 text-left w-24 whitespace-nowrap">CÓDIGO (SKU)</th>
                      <th className="py-2.5 px-3 text-left whitespace-nowrap">DESCRIÇÃO DO PRODUTO</th>
                      <th className="py-2.5 px-3 text-right w-28 whitespace-nowrap">ESTOQUE ATUAL</th>
                      <th className="py-2.5 px-3 text-right w-28 whitespace-nowrap">CUSTO UNITÁRIO</th>
                      <th className="py-2.5 px-3 text-right w-32 whitespace-nowrap">PREÇO DE VENDA</th>
                      <th className="py-2.5 px-3 text-right w-36 font-bold whitespace-nowrap">CUSTO TOTAL (MTn)</th>
                      <th className="py-2.5 px-3 text-right w-36 font-bold whitespace-nowrap">PATRIMÓNIO ESPERADO (MTn)</th>
                      {currentUser.role === 'Administrador' && (
                        <th className="py-2.5 px-3 text-center w-36 whitespace-nowrap">AÇÕES</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {categories.map(cat => {
                      const categoryProducts = products.filter(p => p.category === cat);
                      if (categoryProducts.length === 0) return null;

                      return (
                        <React.Fragment key={cat}>
                          {/* Inner Category Divider Strip */}
                          <tr className="bg-slate-200 text-slate-800 font-bold uppercase text-[10px] tracking-wider border-y border-slate-300">
                            <td colSpan={currentUser.role === 'Administrador' ? 9 : 8} className="py-2 px-3 text-left font-mono whitespace-nowrap">
                              📂 CATEGORIA: {cat} ({categoryProducts.length} itens ativos)
                            </td>
                          </tr>

                          {/* Loop through category products */}
                          {categoryProducts.map(p => {
                            const isOutOfStock = p.quantity === 0;
                            const totalCostValue = p.quantity * p.costPrice;
                            const totalExpectedValue = p.quantity * (p.salePrice || 0);

                            // Formatação condicional: fundo vermelho claro, texto vermelho escuro
                            const conditionalRowClass = isOutOfStock
                              ? 'bg-red-50 text-red-900 group-out-of-stock font-medium'
                              : 'hover:bg-slate-50/60 border-b border-slate-150';

                            return (
                              <tr key={p.id} className={conditionalRowClass}>
                                <td className="py-2.5 px-3 font-mono text-slate-450 text-left font-medium whitespace-nowrap">{p.category}</td>
                                <td className="py-2.5 px-3 font-mono text-slate-600 text-left font-bold whitespace-nowrap">{p.code}</td>
                                <td className="py-2.5 px-3 text-slate-900 text-left font-semibold whitespace-nowrap">{p.name}</td>
                                
                                {/* Highlight Cell if Stock is 0 */}
                                <td className={`py-2.5 px-3 text-right font-mono font-bold border-l border-slate-200 whitespace-nowrap ${
                                  isOutOfStock 
                                    ? 'bg-red-100 text-red-800 font-extrabold border-x border-red-300' 
                                    : 'text-slate-800'
                                }`}>
                                  {isOutOfStock ? '0 COMPRAR JÁ' : p.quantity}
                                </td>
                                
                                <td className="py-2.5 px-3 text-slate-650 text-right font-mono">
                                  {p.costPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MTn
                                </td>
                                
                                <td className={`py-2.5 px-3 text-right font-mono font-bold ${!p.salePrice ? 'text-amber-600' : 'text-slate-755'}`}>
                                  {p.salePrice 
                                    ? `${p.salePrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MTn` 
                                    : 'NÃO PRECIFICADO'
                                  }
                                </td>
                                
                                <td className="py-2.5 px-3 text-right font-mono text-slate-750 bg-slate-50/10 font-medium whitespace-nowrap">
                                  {totalCostValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MTn
                                </td>
                                
                                <td className="py-2.5 px-3 text-right font-mono text-slate-850 bg-slate-50/25 font-bold whitespace-nowrap">
                                  {p.salePrice 
                                    ? `${totalExpectedValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MTn`
                                    : '0,00 MTn'
                                  }
                                </td>

                                {currentUser.role === 'Administrador' && (
                                  <td className="py-2.5 px-3 text-center border-l border-slate-200 print-hide">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setAdjustingProduct(p);
                                        setAdjustQuantity(p.quantity);
                                        setAdjustReason('');
                                      }}
                                      className="px-2.5 py-1.5 bg-blue-700 hover:bg-blue-800 text-white font-mono font-bold rounded text-[10px] shadow transition flex items-center justify-center gap-1 mx-auto"
                                    >
                                      <Sliders size={11} />
                                      <span>Ajustar Saldo</span>
                                    </button>
                                  </td>
                                )}
                              </tr>
                            );
                          })}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>

            </div>
          )}

          {/* TAB 5: RELATÓRIOS PERSONALIZADOS POR DATA */}
          {activeTab === 'reports' && (() => {
            const rData = getPeriodReportDetails();
            const filteredReceipts = getGroupedReceipts().filter(r => {
              if (!r.customerName || r.customerName.trim() === '' || r.customerName === 'Consumidor Final') {
                return false;
              }

              const qMatched = !receiptSearchQuery || 
                (r.customerName?.toLowerCase().includes(receiptSearchQuery.toLowerCase())) ||
                (r.customerPhone?.includes(receiptSearchQuery)) ||
                (r.id.toLowerCase().includes(receiptSearchQuery.toLowerCase()));

              let dMatched = true;
              if (receiptSearchDate) {
                const rDateStr = new Date(r.timestamp).toISOString().split('T')[0];
                dMatched = (rDateStr === receiptSearchDate);
              }

              return qMatched && dMatched;
            });
            
            return (
              <div id="area-relatorio" className="space-y-6">
                
                {/* Print Only Header with Parish Logo */}
                <div className="hidden print:flex flex-col items-center justify-center text-center pb-5 border-b-2 border-slate-300 mb-6 w-full">
                  {parishLogo ? (
                    <img 
                      src={parishLogo} 
                      alt="Logo Paróquia" 
                      className="w-20 h-20 object-contain rounded mb-2 mx-auto"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-16 h-16 bg-blue-600 rounded flex items-center justify-center text-white text-xl font-bold font-mono shadow-inner mb-2 mx-auto">
                      STK
                    </div>
                  )}
                  <h2 className="text-md font-black text-slate-900 uppercase font-mono tracking-tight leading-normal">
                    PARÓQUIA NOSSA SENHORA DA IMACULADA CONCEIÇÃO
                  </h2>
                  <h3 className="text-xs font-bold text-slate-800 uppercase font-mono tracking-tight leading-none mt-0.5">
                    SÉ CATEDRAL DE INHAMBANE
                  </h3>
                  <p className="text-[10px] text-slate-500 uppercase font-mono tracking-wider font-bold mt-1">
                    SECRETARIA PAROQUIAL • INHAMBANE
                  </p>
                  <p className="text-[9px] text-slate-400 font-mono mt-1 uppercase">
                    Relatório Analítico de Balanço
                  </p>
                  <p className="text-[10px] text-slate-405 font-mono mt-1">
                    Filtro: {new Date(reportStartDate + 'T00:00:00').toLocaleDateString('pt-BR')} até {new Date(reportEndDate + 'T23:59:59').toLocaleDateString('pt-BR')}
                  </p>
                </div>

                {/* Visual Settings Form Bar */}
                <div className="bg-slate-50 p-4 border border-slate-300 rounded shadow-sm print-hide">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wide font-mono block mb-3">
                    Painel Gerador de Demonstrativos por Período
                  </span>
                  
                  <div className="flex flex-col sm:flex-row items-end gap-4 font-mono text-xs">
                    <div className="space-y-1 w-full sm:w-auto">
                      <label className="text-[10px] font-bold text-slate-500 block uppercase">Data Inicial:</label>
                      <input
                        type="date"
                        value={reportStartDate}
                        onChange={(e) => setReportStartDate(e.target.value)}
                        className="px-3 py-1.5 bg-white border border-slate-300 rounded font-mono font-bold focus:border-blue-700 focus:outline-none w-full"
                      />
                    </div>
                    
                    <div className="space-y-1 w-full sm:w-auto">
                      <label className="text-[10px] font-bold text-slate-500 block uppercase">Data Final:</label>
                      <input
                        type="date"
                        value={reportEndDate}
                        onChange={(e) => setReportEndDate(e.target.value)}
                        className="px-3 py-1.5 bg-white border border-slate-300 rounded font-mono font-bold focus:border-blue-700 focus:outline-none w-full"
                      />
                    </div>

                    <div className="space-y-1 w-full sm:w-auto">
                      <label className="text-[10px] font-bold text-slate-500 block uppercase">Tipo de Relatório:</label>
                      <select
                        value={tipoRelatorio}
                        onChange={(e) => setTipoRelatorio(e.target.value as 'vendas' | 'compras' | 'stock')}
                        className="px-3 py-1.5 bg-white border border-slate-300 rounded font-mono font-bold focus:border-blue-700 focus:outline-none w-full h-[32px] sm:w-48"
                      >
                        <option value="vendas">Vendas (Saídas)</option>
                        <option value="compras">Compras (Aquisições)</option>
                        <option value="stock">Stock Atual</option>
                      </select>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => handleGerarPDF(e)}
                      className="px-5 py-2 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded shadow transition font-sans text-xs h-[32px] shrink-0 flex items-center gap-1"
                    >
                      <Check size={12} />
                      <span>Gerar Relatório de Período</span>
                    </button>
                  </div>
                </div>

                {/* Analytical KPI Summary Cards (Excel Summary Box) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  
                  {tipoRelatorio === 'compras' && (
                    <div className="bg-white p-4 rounded border border-slate-300 shadow-sm border-l-4 border-blue-600 col-span-1 sm:col-span-2 lg:col-span-4">
                      <span className="text-[9px] text-slate-450 font-bold uppercase tracking-wider font-mono">Compras Realizadas</span>
                      <h4 className="text-xl font-mono font-extrabold text-slate-800 mt-1">
                        {rData.totalPurchasesValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MTn
                      </h4>
                      <p className="text-[10px] text-slate-400 font-mono mt-1">
                        {rData.filteredPurchases.length} lotes / refills faturados
                      </p>
                    </div>
                  )}

                  {tipoRelatorio === 'vendas' && (
                    <>
                      {/* KPI 2: Sales */}
                      <div className="bg-white p-4 rounded border border-slate-300 shadow-sm border-l-4 border-emerald-600">
                        <span className="text-[9px] text-slate-450 font-bold uppercase tracking-wider font-mono">Vendas Arrecadadas</span>
                        <h4 className="text-xl font-mono font-extrabold text-emerald-800 mt-1">
                          {rData.totalSalesValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MTn
                        </h4>
                        <p className="text-[10px] text-slate-400 font-mono mt-1">
                          {rData.totalSalesQty} vendidas ({rData.filteredSales.length} notas)
                        </p>
                      </div>

                      {/* KPI 3: CMV basis costs */}
                      <div className="bg-white p-4 rounded border border-slate-300 shadow-sm border-l-4 border-slate-500">
                        <span className="text-[9px] text-slate-455 font-bold uppercase tracking-wider font-mono">Custo de Saída (CMV)</span>
                        <h4 className="text-xl font-mono font-extrabold text-slate-700 mt-1">
                          {rData.totalCMV.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MTn
                        </h4>
                        <p className="text-[10px] text-slate-400 font-mono mt-1">
                          Base de custo real dos itens vendidos
                        </p>
                      </div>

                      {/* KPI 4: Net estimated profit (blocking rules logic matched) */}
                      <div className={`bg-white p-4 rounded border border-slate-300 shadow-sm border-l-4 ${
                        rData.estimatedProfit >= 0 ? 'border-indigo-650' : 'border-red-650'
                      }`}>
                        <span className="text-[9px] text-indigo-700 font-bold uppercase tracking-wider font-mono">Resultados: Lucro Bruto</span>
                        <h4 className={`text-xl font-mono font-extrabold mt-1 ${
                          rData.estimatedProfit >= 0 ? 'text-indigo-900' : 'text-red-700'
                        }`}>
                          {rData.estimatedProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MTn
                        </h4>
                        <p className="text-[10px] text-slate-400 font-mono mt-1">
                          Arrecadações - Custos de Compra
                        </p>
                      </div>
                    </>
                  )}

                  {tipoRelatorio === 'stock' && (
                    <>
                      {/* Stock Value */}
                      <div className="bg-white p-4 rounded border border-slate-300 shadow-sm border-l-4 border-blue-600 font-mono">
                        <span className="text-[9px] text-slate-450 font-bold uppercase tracking-wider font-mono">Valor Estimado do Stock</span>
                        <h4 className="text-xl font-mono font-extrabold text-slate-800 mt-1">
                          {totalStockValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MTn
                        </h4>
                        <p className="text-[10px] text-slate-400 font-mono mt-1">
                          Soma do custo unitário de todos os itens
                        </p>
                      </div>

                      {/* Out of Stock */}
                      <div className="bg-white p-4 rounded border border-slate-300 shadow-sm border-l-4 border-red-500 font-mono">
                        <span className="text-[9px] text-red-500 font-bold uppercase tracking-wider font-mono">Itens Esgotados</span>
                        <h4 className="text-xl font-mono font-extrabold text-red-700 mt-1">
                          {outOfStockCount} produtos e/ou tipos
                        </h4>
                        <p className="text-[10px] text-slate-400 font-mono mt-1">
                          Produtos com stock zerado
                        </p>
                      </div>

                      {/* Low Stock */}
                      <div className="bg-white p-4 rounded border border-slate-300 shadow-sm border-l-4 border-amber-500 font-mono">
                        <span className="text-[9px] text-amber-500 font-bold uppercase tracking-wider font-mono">Itens em Alerta de Stock Baixo</span>
                        <h4 className="text-xl font-mono font-extrabold text-amber-700 mt-1">
                          {lowStockCount} produtos e/ou tipos
                        </h4>
                        <p className="text-[10px] text-slate-400 font-mono mt-1">
                          Atingiram ou estão abaixo do stock mínimo
                        </p>
                      </div>

                      {/* Total Products */}
                      <div className="bg-white p-4 rounded border border-slate-300 shadow-sm border-l-4 border-indigo-500 font-mono">
                        <span className="text-[9px] text-indigo-500 font-bold uppercase tracking-wider font-mono">Total de Itens Registados</span>
                        <h4 className="text-xl font-mono font-extrabold text-indigo-800 mt-1">
                          {products.length} referências
                        </h4>
                        <p className="text-[10px] text-slate-400 font-mono mt-1">
                          No catálogo de produtos
                        </p>
                      </div>
                    </>
                  )}

                </div>

                {/* Comparative Double Table Segment */}
                <div className="grid grid-cols-1 gap-6 bg-slate-50 p-3 rounded border border-slate-200">
                  
                  {/* Left Side Period Sales List */}
                  {tipoRelatorio === 'vendas' && (
                    <div className="space-y-2">
                      <span className="text-xs font-bold text-emerald-900 uppercase tracking-wide font-mono block">
                        🧾 DETALHAMENTO DE SAÍDAS (VENDAS NO PERÍODO)
                      </span>
                      
                      {rData.filteredSales.length === 0 ? (
                        <div className="text-center py-10 bg-white border border-slate-200 rounded font-mono text-slate-400 text-xs">
                          Nenhuma venda encontrada na faixa de datas.
                        </div>
                      ) : (
                        <div className="overflow-x-auto border border-slate-300 rounded bg-white">
                          <table className="excel-grid min-w-full font-sans text-[10px]">
                            <thead>
                              <tr className="bg-slate-100">
                                <th className="py-1.5 px-2 text-left">DESCRIÇÃO</th>
                                <th className="py-1.5 px-2 text-right">QTD</th>
                                <th className="py-1.5 px-2 text-right font-bold">TOTAL</th>
                                <th className="py-1.5 px-2 text-right">DATA</th>
                              </tr>
                            </thead>
                            <tbody>
                              {rData.filteredSales.map((s, idx) => (
                                <tr key={`${s.id}_${s.productId}_${idx}`} className="hover:bg-slate-50 border-b border-slate-150">
                                  <td className="py-2 px-2 text-slate-900 font-semibold whitespace-nowrap">{s.productName}</td>
                                  <td className="py-2 px-2 text-right font-mono whitespace-nowrap">{s.quantity}</td>
                                  <td className="py-2 px-2 text-right font-mono font-bold text-emerald-800">
                                    {s.totalPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} MTn
                                  </td>
                                  <td className="py-2 px-2 text-right font-mono text-slate-500">
                                    {new Date(s.timestamp).toLocaleDateString('pt-BR')}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Right Side Period Purchases List */}
                  {tipoRelatorio === 'compras' && (
                    <div className="space-y-2">
                      <span className="text-xs font-bold text-blue-900 uppercase tracking-wide font-mono block">
                        📥 DETALHAMENTO DE AQUISIÇÕES (COMPRAS NO PERÍODO)
                      </span>

                      {rData.filteredPurchases.length === 0 ? (
                        <div className="text-center py-10 bg-white border border-slate-200 rounded font-mono text-slate-400 text-xs">
                          Nenhuma compra/entrada lançada na faixa de datas.
                        </div>
                      ) : (
                        <div className="overflow-x-auto border border-slate-300 rounded bg-white">
                          <table className="excel-grid min-w-full font-sans text-[10px]">
                            <thead>
                              <tr className="bg-slate-100">
                                <th className="py-1.5 px-2 text-left">DESCRIÇÃO</th>
                                <th className="py-1.5 px-2 text-right">QTD ENTRADA</th>
                                <th className="py-1.5 px-2 text-right font-bold">CUSTO TOTAL</th>
                                <th className="py-1.5 px-2 text-right">DATA</th>
                              </tr>
                            </thead>
                            <tbody>
                              {rData.filteredPurchases.map(p => {
                                const calculatedCost = p.quantityAdded * p.costPrice;
                                return (
                                  <tr key={p.id} className="hover:bg-slate-50 border-b border-slate-150">
                                    <td className="py-2 px-2 text-slate-900 font-semibold whitespace-nowrap">{p.productName}</td>
                                    <td className="py-2 px-2 text-right font-mono whitespace-nowrap">{p.quantityAdded}</td>
                                    <td className="py-2 px-2 text-right font-mono font-bold text-blue-800">
                                      {calculatedCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} MTn
                                    </td>
                                    <td className="py-2 px-2 text-right font-mono text-slate-500">
                                      {new Date(p.timestamp).toLocaleDateString('pt-BR')}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Stock List (Stock) */}
                  {tipoRelatorio === 'stock' && (
                    <div className="space-y-2">
                      <span className="text-xs font-bold text-indigo-950 uppercase tracking-wide font-mono block">
                        📦 COMPOSIÇÃO DE STOCK ATUAL E VALORES DE AQUISIÇÃO
                      </span>
                      
                      <div className="overflow-x-auto border border-slate-300 rounded bg-white">
                        <table className="excel-grid min-w-full font-sans text-[10px]">
                          <thead>
                            <tr className="bg-slate-100">
                              <th className="py-1.5 px-2 text-left w-24">CÓDIGO (SKU)</th>
                              <th className="py-1.5 px-2 text-left">DESCRIÇÃO DO PRODUTO</th>
                              <th className="py-1.5 px-2 text-left w-36">GRUPO / CATEGORIA</th>
                              <th className="py-1.5 px-2 text-right w-20">STOCK</th>
                              <th className="py-1.5 px-2 text-right w-32 whitespace-nowrap">CUSTO UNITÁRIO</th>
                              <th className="py-1.5 px-2 text-right w-32 font-bold whitespace-nowrap">VALOR TOTAL</th>
                              <th className="py-1.5 px-2 text-center w-28">ESTADO</th>
                            </tr>
                          </thead>
                          <tbody>
                            {products.map(p => {
                              const isZero = p.quantity === 0;
                              const isLow = p.quantity > 0 && p.quantity <= p.minStock;
                              let stockBadge = <span className="bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded text-[10px]">Normal</span>;
                              
                              if (p.type === 'servico') {
                                stockBadge = <span className="bg-slate-100 text-slate-600 border border-slate-300 font-semibold px-2 py-0.5 rounded text-[10px]">Não Aplicável</span>;
                              } else if (isZero) {
                                stockBadge = <span className="bg-red-200 text-red-900 border border-red-300 font-bold px-2 py-0.5 rounded text-[10px]">Esgotado</span>;
                              } else if (isLow) {
                                stockBadge = <span className="bg-amber-100 text-amber-800 border border-amber-300 font-semibold px-2 py-0.5 rounded text-[10px]">Baixo</span>;
                              }
                              
                              const totalVal = p.type === 'servico' ? 0 : p.quantity * p.costPrice;

                              return (
                                <tr key={p.id} className="hover:bg-slate-50 border-b border-slate-150">
                                  <td className="py-2 px-2 font-mono text-slate-700 text-left font-bold">{p.code}</td>
                                  <td className="py-2 px-2 text-slate-900 text-left font-bold whitespace-nowrap">{p.name}</td>
                                  <td className="py-2 px-2 text-slate-650 text-left whitespace-nowrap">{p.category}</td>
                                  <td className="py-2 px-2 text-right font-mono whitespace-nowrap">
                                    {p.type === 'servico' ? 'N/A' : p.quantity}
                                  </td>
                                  <td className="py-2 px-2 text-right font-mono">
                                    {p.type === 'servico' ? 'N/A' : `${p.costPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} MTn`}
                                  </td>
                                  <td className="py-2 px-2 text-right font-mono font-bold text-slate-800">
                                    {p.type === 'servico' ? 'N/A' : `${totalVal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} MTn`}
                                  </td>
                                  <td className="py-2 px-2 text-center">{stockBadge}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                </div>

                {/* BUSCA HISTÓRICA / SEGUNDA VIA DE RECIBOS */}
                <div className="bg-white border border-slate-350 rounded-lg shadow-sm overflow-hidden print-hide">
                  <div className="bg-slate-800 text-white px-4 py-2.5 flex items-center justify-between">
                    <span className="font-bold text-xs uppercase tracking-wider font-mono flex items-center gap-2">
                      <Search size={14} className="text-amber-400" />
                      Segunda Via de Recibo Eletrónico (Pesquisa Histórica)
                    </span>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={handleClearSales}
                        className="flex items-center gap-1 bg-red-700 hover:bg-red-600 active:bg-red-800 text-white text-[10px] font-mono font-bold uppercase tracking-wide px-2.5 py-1 rounded transition focus:outline-none cursor-pointer"
                      >
                        <Trash2 size={11} className="text-white" />
                        Limpar registos
                      </button>
                      <span className="text-[10px] font-mono text-slate-300">Moeda Oficial: MTn</span>
                    </div>
                  </div>

                  <div className="p-4 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Search Input */}
                      <div className="space-y-1">
                        <label className="block text-[10px] font-mono font-bold uppercase text-slate-500">Nome do Fiel / Telefone / ID Recibo</label>
                        <input
                          type="text"
                          value={receiptSearchQuery}
                          onChange={(e) => setReceiptSearchQuery(e.target.value)}
                          placeholder="Busque por nome do cliente, 84xxxxxxx ou ID..."
                          className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded font-mono focus:border-blue-700 focus:outline-none"
                        />
                      </div>

                      {/* Date Input */}
                      <div className="space-y-1">
                        <label className="block text-[10px] font-mono font-bold uppercase text-slate-500">Filtrar por data específica da venda</label>
                        <div className="flex gap-2">
                          <input
                            type="date"
                            value={receiptSearchDate}
                            onChange={(e) => setReceiptSearchDate(e.target.value)}
                            className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-300 rounded font-mono focus:border-blue-700 focus:outline-none"
                          />
                          {receiptSearchDate && (
                            <button
                              type="button"
                              onClick={() => setReceiptSearchDate('')}
                              className="px-2.5 py-1 text-xs bg-slate-100 border border-slate-300 rounded hover:bg-slate-200 transition text-slate-600 font-mono font-bold cursor-pointer"
                            >
                              Limpar
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Receipts List Table */}
                    <div className="border border-slate-300 rounded overflow-hidden">
                      <div className="max-h-[220px] overflow-y-auto">
                        <table className="excel-grid min-w-full font-sans text-xs">
                          <thead>
                            <tr className="bg-slate-100 text-slate-700 font-mono font-bold text-[10px] border-b border-slate-300">
                              <th className="py-2 px-3 text-left whitespace-nowrap">FILIAÇÃO / CLIENTE</th>
                              <th className="py-2 px-3 text-left whitespace-nowrap">CONTACTO</th>
                              <th className="py-2 px-3 text-right whitespace-nowrap">VALOR OPERADO</th>
                              <th className="py-2 px-3 text-center whitespace-nowrap flex-nowrap">DATA E HORA</th>
                              <th className="py-2 px-3 text-center w-36 whitespace-nowrap">AÇÃO</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredReceipts.length === 0 ? (
                              <tr>
                                <td colSpan={5} className="text-center py-8 text-slate-400 font-mono text-xs bg-white whitespace-nowrap">
                                  Nenhum comprovativo / recibo localizado com os critérios de busca.
                                </td>
                              </tr>
                            ) : (
                              filteredReceipts.map((rec) => (
                                <tr key={rec.id} className="hover:bg-slate-50 border-b border-slate-150 bg-white">
                                  <td className="py-2 px-3 text-left font-bold text-slate-800 uppercase whitespace-nowrap">
                                    {rec.customerName}
                                  </td>
                                  <td className="py-2 px-3 text-left font-mono whitespace-nowrap">{rec.customerPhone || '—'}</td>
                                  <td className="py-2 px-3 text-right font-mono font-bold text-emerald-800 whitespace-nowrap">
                                    {rec.totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} MTn
                                  </td>
                                  <td className="py-2 px-3 text-center font-mono text-slate-550 text-[11px] whitespace-nowrap">
                                    {new Date(rec.timestamp).toLocaleString('pt-BR')}
                                  </td>
                                  <td className="py-2 px-3 text-center whitespace-nowrap">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActiveReceipt(rec);
                                        triggerStatus('success', `Exibindo Segunda Via do Recibo ${rec.id}!`);
                                      }}
                                      className="py-1 px-3 bg-blue-50 text-blue-800 hover:bg-blue-100 border border-blue-200 rounded font-mono text-[10px] font-bold cursor-pointer transition uppercase"
                                    >
                                      Emitir 2ª Via
                                    </button>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            );
          })()}

          {/* TAB 6: AUDIT TRAIL LOGS AND USERS COEXISTENCE LIST */}
          {activeTab === 'audit' && (
            <div className="space-y-6 flex-1">
              
              {/* Dual Layout Panel containing Operators list on top/left and safety logs on bottom/right */}
              <div className="space-y-4">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wide font-mono block">
                  📂 FICHÁRIO COMPLETO: Operadores Autorizados na Secretaria
                </span>
                
                <div className="overflow-x-auto border border-slate-300 rounded shadow-sm bg-white">
                  <table className="excel-grid min-w-full font-sans text-xs">
                    <thead>
                      <tr className="bg-slate-150 text-slate-800 border-b border-slate-300 font-mono">
                        <th className="py-1.5 px-3 text-left whitespace-nowrap">NOME COMPLETO DO OPERADOR</th>
                        <th className="py-1.5 px-3 text-left w-44 whitespace-nowrap">PERMISSÃO CORPORATIVA</th>
                        <th className="py-1.5 px-3 text-center w-28 whitespace-nowrap">NÚMERO PIN acesso</th>
                        <th className="py-1.5 px-3 text-center w-36 whitespace-nowrap">ESTADO DO CADASTRO</th>
                        <th className="py-1.5 px-3 text-right w-48 whitespace-nowrap">CADASTRO CRIADO EM</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => {
                        const isActive = u.id === currentUser.id;
                        return (
                          <tr key={u.id} className={isActive ? 'bg-amber-50/40 font-medium border-b border-amber-200' : 'hover:bg-slate-50 border-b border-slate-150'}>
                            <td className="py-1.5 px-3 text-slate-900 text-left font-bold whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => handleOpenUserActions(u)}
                                className="text-blue-700 hover:text-blue-900 hover:underline font-bold font-sans text-xs text-left cursor-pointer flex items-center gap-2 focus:outline-none"
                              >
                                {u.name}
                                {isActive && (
                                  <span className="bg-amber-100 text-amber-800 border border-amber-300 text-[9px] px-1.5 py-0.5 rounded uppercase font-mono font-bold animate-pulse inline-block">
                                    Estação Ativa
                                  </span>
                                )}
                              </button>
                            </td>
                            <td className="py-1.5 px-3 text-left whitespace-nowrap">
                              <span className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold border ${
                                u.role === 'Administrador' 
                                  ? 'bg-blue-100 border-blue-200 text-blue-800' 
                                  : 'bg-slate-100 border-slate-200 text-slate-700'
                              }`}>
                                {u.role}
                              </span>
                            </td>
                            <td className="py-1.5 px-3 text-center font-mono font-bold whitespace-nowrap">**** (PIN {u.pin})</td>
                            <td className="py-1.5 px-3 text-center whitespace-nowrap">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${u.active ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-red-100 text-red-800 border border-red-200'}`}>
                                {u.active ? 'Acesso Regular' : 'Acesso Bloqueado'}
                              </span>
                            </td>
                            <td className="py-1.5 px-3 text-slate-500 text-right font-mono whitespace-nowrap">
                              {new Date(u.createdAt).toLocaleDateString('pt-BR')} {new Date(u.createdAt).toLocaleTimeString('pt-BR')}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Lower Section: Real Security Audit Trail */}
              <div className="space-y-2 pt-2">
                <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded border border-slate-200">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wide font-mono block">
                    🛡 TRILHA DO LIVRO AUDITOR: LOGS DE OPERAÇÃO DA ESTAÇÃO DE TRABALHO
                  </span>
                  <button
                    type="button"
                    onClick={handleClearHistory}
                    className="flex items-center gap-1 bg-red-700 hover:bg-red-600 active:bg-red-800 text-white text-[10px] font-mono font-bold uppercase tracking-wide px-2.5 py-1 rounded transition focus:outline-none cursor-pointer"
                  >
                    <Trash2 size={11} className="text-white" />
                    Limpar Histórico
                  </button>
                </div>

                <div className="overflow-x-auto border border-slate-300 rounded shadow-md max-h-[350px] overflow-y-auto bg-white">
                  <table className="excel-grid min-w-full font-sans text-xs">
                    <thead className="sticky top-0 bg-slate-100 z-10 font-mono shadow-inner">
                      <tr>
                        <th className="py-2 px-3 text-left w-36">AÇÃO REGISTRADA</th>
                        <th className="py-2 px-3 text-left w-48">USUÁRIO EMISSOR</th>
                        <th className="py-2 px-3 text-left">HISTÓRICO TÉCNICO COMPLETO DA ATIVIDADE</th>
                        <th className="py-2 px-3 text-right w-44">DATA / HORA DO EVENTO</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditLogs.map((log) => {
                        let actionClass = 'bg-slate-100 text-slate-700 border-slate-300';
                        if (log.action === 'LOGIN') actionClass = 'bg-green-50 text-green-800 border-green-220 font-bold';
                        if (log.action === 'LOGOUT') actionClass = 'bg-slate-200 text-slate-800 border-slate-350 font-semibold';
                        if (log.action === 'VENDA') actionClass = 'bg-indigo-50 border-indigo-200 text-indigo-800 font-bold';
                        if (log.action === 'CADASTRO_PRODUTO') actionClass = 'bg-emerald-50 border-emerald-250 text-emerald-800 font-bold';
                        if (log.action === 'ESTOQUE_AJUSTADO') actionClass = 'bg-amber-50 border-amber-250 text-amber-800';
                        if (log.action === 'PRECO_ATRIBUIDO') actionClass = 'bg-blue-50 border-blue-250 text-blue-800 font-semibold';
                        if (log.action === 'EXCLUSAO_PRODUTO') actionClass = 'bg-red-50 border-red-250 text-red-800 font-semibold';

                        return (
                          <tr key={log.id} className="hover:bg-slate-50 border-b border-slate-150">
                            <td className="py-2 px-3 text-left">
                              <span className={`px-2 py-0.5 rounded font-mono text-[10px] border ${actionClass}`}>
                                {log.action}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-slate-900 text-left font-bold">{log.userName}</td>
                            <td className="py-2 px-3 text-slate-750 text-left font-mono">{log.details}</td>
                            <td className="py-2 px-3 text-slate-500 text-right font-mono">
                              {new Date(log.timestamp).toLocaleDateString('pt-BR')} {new Date(log.timestamp).toLocaleTimeString('pt-BR')}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

        </div>

      </main>

      {/* 6. REAL-TIME CONSTANT CARDS & WPF STATUS BAR FOOTER - ALWAYS VISIBLE */}
      <footer className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t-2 border-blue-650 shadow-[0_-5px_15px_rgba(0,0,0,0.2)] z-30 print-hide">
        
        {/* Real-time KPI Ribbon - 3 Excel/WPF Style compact indicator cards */}
        <div className="max-w-7xl mx-auto px-4 py-2 gap-3 bg-slate-900 grid grid-cols-1 sm:grid-cols-3">
          
          {/* Card 1: Despesas Diárias */}
          <div className="bg-slate-850 border border-slate-700 rounded p-2 flex items-center justify-between shadow-inner">
            <div className="text-left">
              <span className="text-[9px] text-slate-400 block font-mono font-bold uppercase tracking-wider">DESPESAS DIÁRIAS (HOJE)</span>
              <strong className="text-xs text-rose-400 font-mono">
                {dailyExpensesValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MTn
              </strong>
            </div>
            <div className="bg-rose-955/20 p-1.5 rounded border border-rose-900/40 shrink-0">
              <TrendingDown size={13} className="text-rose-400" />
            </div>
          </div>

          {/* Card 2: Vendas Diárias */}
          <div className="bg-slate-850 border border-slate-700 rounded p-2 flex items-center justify-between shadow-inner">
            <div className="text-left">
              <span className="text-[9px] text-slate-400 block font-mono font-bold uppercase tracking-wider">VENDAS DIÁRIAS (HOJE)</span>
              <strong className="text-xs text-emerald-400 font-mono">
                {dailySalesValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MTn
              </strong>
            </div>
            <div className="bg-emerald-955/20 p-1.5 rounded border border-emerald-900/40 shrink-0">
              <TrendingUp size={13} className="text-emerald-400" />
            </div>
          </div>

          {/* Card 3: Saldo Operacional Diário */}
          {(() => {
            const isPositive = dailyOperationalBalance >= 0;
            const balanceColor = isPositive ? 'text-emerald-450 font-extrabold' : 'text-rose-450 font-extrabold';
            const balanceBg = isPositive ? 'bg-emerald-955/20 border-emerald-700/50' : 'bg-rose-955/20 border-rose-700/50';

            return (
              <div className="bg-slate-850 border border-slate-700 rounded p-2 flex items-center justify-between shadow-inner">
                <div className="text-left">
                  <span className="text-[9px] text-slate-400 block font-mono font-bold uppercase tracking-wider">SALDO OPERACIONAL DIÁRIO</span>
                  <strong className={`text-xs font-mono whitespace-nowrap ${balanceColor}`}>
                    {dailyOperationalBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MTn
                  </strong>
                </div>
                <div className={`p-1.5 rounded border shrink-0 ${balanceBg}`}>
                  <Coins size={13} className={isPositive ? 'text-emerald-400' : 'text-rose-400'} />
                </div>
              </div>
            );
          })()}

        </div>

        {/* Bottom Windows Status strip */}
        <div className="bg-slate-800 text-slate-400 text-[10px] px-6 py-1.5 border-t border-slate-700 flex flex-col sm:flex-row justify-between items-center font-mono gap-1 sm:gap-0">
          <div>
            <span>Licença: <strong className="text-white">Paróquia Sagrada Família de Nazaré</strong></span>
          </div>
          <div className="flex gap-4">
            <span>Operador: <strong className="text-blue-300">{currentUser.name} ({currentUser.role})</strong></span>
            <span>Banco de Dados: <strong className={isFirebaseConnected ? "text-emerald-400" : "text-amber-400"}>{isFirebaseConnected ? "NUVEM (Firestore Conectado)" : "ONLINE (LocalStorage LocalBD)"}</strong></span>
          </div>
        </div>
      </footer>

      {/* MODAL PARA AJUSTE MANUAL DE ESTOQUE (Administradores) */}
      {adjustingProduct && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 print-hide">
          <div className="bg-white border-2 border-slate-400 rounded shadow-2xl max-w-md w-full overflow-hidden font-sans text-left">
            {/* Header bar */}
            <div className="bg-slate-900 text-white px-4 py-3 flex justify-between items-center border-b border-slate-700">
              <div className="flex items-center gap-2">
                <Sliders size={16} className="text-blue-400" />
                <span className="font-bold font-mono text-xs tracking-tight">AJUSTE DE ESTOQUE MANUAL (.NET)</span>
              </div>
              <button
                type="button"
                onClick={() => setAdjustingProduct(null)}
                className="text-slate-400 hover:text-white font-bold font-mono text-sm"
              >
                ✕
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveStockAdjustment} className="p-5 space-y-4">
              <div className="bg-slate-50 p-3 rounded border border-slate-200 space-y-1">
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-mono">Produto Selecionado:</div>
                <div className="text-xs font-bold text-slate-800">{adjustingProduct.name}</div>
                <div className="text-[10px] text-slate-500 font-mono">ID: {adjustingProduct.id} • SKU: {adjustingProduct.code}</div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1 block text-left">
                  <label className="text-[10px] font-bold text-slate-500 block uppercase tracking-wider font-mono">Saldo Atual:</label>
                  <div className="px-3 py-1.5 bg-slate-100 border border-slate-300 rounded text-slate-700 font-mono font-bold text-sm">
                    {adjustingProduct.quantity}
                  </div>
                </div>

                <div className="space-y-1 block text-left">
                  <label className="text-[10px] font-bold text-slate-500 block uppercase tracking-wider font-mono">Novo Saldo Corrigido:</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={adjustQuantity}
                    onChange={(e) => setAdjustQuantity(Math.max(0, parseInt(e.target.value) || 0))}
                    className="px-3 py-1.5 bg-white border border-slate-300 rounded font-mono font-bold text-slate-800 text-sm focus:outline-none focus:border-blue-700 w-full"
                  />
                </div>
              </div>

              <div className="space-y-1 block text-left">
                <label className="text-[10px] font-bold text-slate-500 block uppercase tracking-wider font-mono">Motivo do Ajuste (Obrigatório):</label>
                <textarea
                  required
                  placeholder="Ex: Vela quebrada, Doação paroquial, Contagem física incorreta..."
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="px-3 py-2 bg-white border border-slate-300 rounded text-xs text-slate-800 focus:outline-none focus:border-blue-700 w-full h-20 resize-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAdjustingProduct(null)}
                  className="w-1/2 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 border border-slate-350 rounded transition font-mono"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 rounded transition shadow font-sans"
                >
                  Confirmar Correção
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SEÇÃO DE MENU DE AÇÃO DO PRODUTO (NOME DO PRODUTO CLICADO) */}
      {isProductActionModalOpen && selectedActionProduct && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 print-hide">
          <div className="bg-white border-2 border-slate-400 rounded shadow-2xl max-w-sm w-full font-sans text-left overflow-hidden">
            <div className="bg-slate-900 text-white px-4 py-2 flex justify-between items-center border-b-2 border-blue-600">
              <span className="font-bold text-xs uppercase tracking-wider font-mono">
                Opções do Produto
              </span>
              <button
                type="button"
                onClick={() => setIsProductActionModalOpen(false)}
                className="text-slate-400 hover:text-white font-bold font-mono text-sm leading-none"
              >
                ✕
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded">
                <span className="text-[10px] text-slate-500 font-mono block uppercase tracking-wide">PRODUTO SELECIONADO</span>
                <strong className="text-slate-900 font-sans text-sm">{selectedActionProduct.name}</strong>
                <span className="block text-[10px] text-slate-600 font-mono mt-0.5">Código: <strong>{selectedActionProduct.code}</strong></span>
              </div>
              
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setConfirmDialog({
                      isOpen: true,
                      type: 'edit',
                      message: 'Deseja Editar este dado?',
                      onConfirm: () => {
                        handleSelectProductToEdit(selectedActionProduct);
                        setIsProductActionModalOpen(false);
                      }
                    });
                  }}
                  className="w-full text-center py-2 px-3 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded text-xs font-mono font-bold transition"
                >
                  Editar Dados do Produto
                </button>
                
                <button
                  type="button"
                  onClick={() => {
                    setConfirmDialog({
                      isOpen: true,
                      type: 'delete',
                      message: 'Deseja Excluir este dado?',
                      onConfirm: async () => {
                        if (currentUser.role !== 'Administrador') {
                          triggerStatus('error', 'Permissão negada. Somente Administradores (Párocos) podem excluir produtos.');
                          return;
                        }
                        
                        await dbService.deleteProduct(selectedActionProduct.id, currentUser.id, currentUser.name);
                        triggerStatus('success', `Produto "${selectedActionProduct.name}" excluído do estoque paroquial.`);
                        setIsProductActionModalOpen(false);
                        await loadData();
                      }
                    });
                  }}
                  className="w-full text-center py-2 px-3 bg-red-50 hover:bg-red-100 text-red-800 border border-red-200 rounded text-xs font-mono font-bold transition"
                >
                  Excluir Produto
                </button>
                
                <button
                  type="button"
                  onClick={() => setIsProductActionModalOpen(false)}
                  className="w-full text-center py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-705 border border-slate-200 rounded text-xs font-mono font-bold transition"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SEÇÃO DE COEXISTÊNCIA DO MENU DE AÇÃO E DIÁLOGOS DE CONFIRMAÇÃO DO OPERADOR */}
      {isUserActionModalOpen && selectedUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 print-hide">
          <div className="bg-white border-2 border-slate-400 rounded shadow-2xl max-w-sm w-full font-sans text-left overflow-hidden">
            <div className="bg-slate-900 text-white px-4 py-2 flex justify-between items-center border-b-2 border-blue-600">
              <span className="font-bold text-xs uppercase tracking-wider font-mono">
                {isUserEditMode ? 'Editar Cadastro de Operador' : 'Opções do Operador'}
              </span>
              <button
                type="button"
                onClick={() => setIsUserActionModalOpen(false)}
                className="text-slate-400 hover:text-white font-bold font-mono text-sm leading-none"
              >
                ✕
              </button>
            </div>
            
            {!isUserEditMode ? (
              <div className="p-4 space-y-4">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded">
                  <span className="text-[10px] text-slate-500 font-mono block uppercase tracking-wide">OPERADOR SELECIONADO</span>
                  <strong className="text-slate-900 font-sans text-sm">{selectedUser.name}</strong>
                  <span className="block text-[10px] text-slate-600 font-mono mt-0.5">Permissão: <strong>{selectedUser.role}</strong></span>
                </div>
                
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmDialog({
                        isOpen: true,
                        type: 'edit',
                        message: 'Deseja Editar este dado?',
                        onConfirm: () => {
                          setIsUserEditMode(true);
                        }
                      });
                    }}
                    className="w-full text-center py-2 px-3 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded text-xs font-mono font-bold transition"
                  >
                    Editar Cadastro
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmDialog({
                        isOpen: true,
                        type: 'delete',
                        message: 'Deseja Excluir este dado?',
                        onConfirm: async () => {
                          await dbService.deleteUser(selectedUser.id);
                          await dbService.log(
                            currentUser.id,
                            currentUser.name,
                            'EXCLUSAO_OPERADOR',
                            `Cadastro do operador "${selectedUser.name}" exluído por ${currentUser.name}`
                          );
                          setIsUserActionModalOpen(false);
                          triggerStatus('success', `Operador "${selectedUser.name}" excluído com sucesso!`);
                          await loadData();
                        }
                      });
                    }}
                    className="w-full text-center py-2 px-3 bg-red-50 hover:bg-red-100 text-red-800 border border-red-200 rounded text-xs font-mono font-bold transition"
                  >
                    Excluir Operador
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => setIsUserActionModalOpen(false)}
                    className="w-full text-center py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded text-xs font-mono font-bold transition"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <form 
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!editUserName.trim()) {
                    triggerStatus('error', 'O nome do operador não pode ser vazio.');
                    return;
                  }
                  if (!editUserPin.trim() || isNaN(Number(editUserPin))) {
                    triggerStatus('error', 'O PIN deve ser um código numérico válido.');
                    return;
                  }
                  
                  const updatedUser: UserType = {
                    ...selectedUser,
                    name: editUserName.trim(),
                    pin: editUserPin.trim(),
                    role: editUserRole,
                    active: editUserActive
                  };
                  
                  await dbService.saveUser(updatedUser);
                  await dbService.log(
                    currentUser.id,
                    currentUser.name,
                    'PERFIL_ATUALIZADO',
                    `Cadastro do operador "${selectedUser.name}" editado por ${currentUser.name}`
                  );
                  
                  setIsUserActionModalOpen(false);
                  triggerStatus('success', `Alterações para "${editUserName.trim()}" salvas com sucesso!`);
                  await loadData();
                }}
                className="p-4 space-y-3"
              >
                <div>
                  <label className="block text-[10px] font-mono font-bold uppercase text-slate-500 mb-0.5">Nome Completo</label>
                  <input
                    type="text"
                    value={editUserName}
                    onChange={(e) => setEditUserName(e.target.value)}
                    className="w-full border border-slate-300 p-2 rounded text-xs focus:ring-1 focus:ring-blue-500 font-semibold cursor-text text-slate-900"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-[10px] font-mono font-bold uppercase text-slate-500 mb-0.5">Permissão Corporativa</label>
                  <select
                    value={editUserRole}
                    onChange={(e) => setEditUserRole(e.target.value as 'Administrador' | 'Operador')}
                    className="w-full border border-slate-300 p-2 rounded text-xs bg-white font-mono focus:ring-1 focus:ring-blue-500 text-slate-900"
                  >
                    <option value="Administrador">Administrador</option>
                    <option value="Operador">Operador (Restrito)</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-[10px] font-mono font-bold uppercase text-slate-500 mb-0.5">PIN de Acesso</label>
                  <input
                    type="text"
                    maxLength={6}
                    value={editUserPin}
                    onChange={(e) => setEditUserPin(e.target.value)}
                    className="w-full border border-slate-300 p-2 rounded text-xs font-mono focus:ring-1 focus:ring-blue-500 cursor-text text-slate-900 animate-none font-semibold"
                    required
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="editUserActive"
                    checked={editUserActive}
                    onChange={(e) => setEditUserActive(e.target.checked)}
                    className="rounded text-blue-700 focus:ring-blue-500"
                  />
                  <label htmlFor="editUserActive" className="text-xs font-semibold text-slate-700 select-none">
                    Estado do Cadastro Ativo
                  </label>
                </div>
                
                <div className="flex justify-end gap-2 pt-3 border-t">
                  <button
                    type="button"
                    onClick={() => setIsUserEditMode(false)}
                    className="px-3 py-1.5 border border-slate-300 text-slate-700 rounded font-mono text-xs hover:bg-slate-50 transition font-bold"
                  >
                    Voltar
                  </button>
                  <button
                    type="submit"
                    className="px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded font-mono text-xs transition font-bold"
                  >
                    Salvar
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* DIÁLOGO GERAL DE CONFIRMAÇÃO DO OPERADOR (SIM/NÃO) */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-55 p-4 print-hide">
          <div className="bg-white border-2 border-slate-400 rounded shadow-2xl p-5 max-w-sm w-full font-sans text-left">
            <div className="flex items-center gap-3 text-blue-700 mb-3">
              <AlertTriangle size={20} className="text-amber-500" />
              <h4 className="font-bold text-xs uppercase font-mono tracking-wider">Confirmação de Segurança</h4>
            </div>
            <p className="text-slate-800 text-sm mb-4 leading-relaxed font-semibold">
              {confirmDialog.message}
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-1.5 border border-slate-300 rounded text-slate-700 font-mono text-xs hover:bg-slate-50 transition font-bold"
              >
                Não
              </button>
              <button
                type="button"
                onClick={() => {
                  confirmDialog.onConfirm();
                  setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                }}
                className="px-4 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded font-mono text-xs transition font-bold"
              >
                Sim
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PARA CADASTRO / EDIÇÃO / COMPRA DE PRODUTO */}
      {isProductModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 print-hide">
          <div className="bg-white border-2 border-slate-400 rounded shadow-2xl max-w-lg w-full overflow-hidden font-sans text-left">
            
            {/* Header bar - WinForms Style */}
            <div className="bg-slate-900 text-white px-4 py-3 flex justify-between items-center border-b-2 border-blue-600">
              <div className="flex items-center gap-2">
                <Layers size={16} className="text-blue-400" />
                <span className="font-bold text-xs uppercase tracking-wider font-mono">
                  {formMode === 'NOVO' && 'Ficha: Nova Entrada de Produto'}
                  {formMode === 'EDITAR' && 'Ficha: Editando Detalhes do Produto'}
                  {formMode === 'COMPRA_RECORRENTE' && 'Ficha: Registrando Nova Compra de Lote'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  handleClearForm();
                  setIsProductModalOpen(false);
                }}
                className="text-slate-400 hover:text-white font-bold font-mono text-sm"
              >
                ✕
              </button>
            </div>

            {/* Form Body - Scrollable if content overflow */}
            <form onSubmit={handleSaveProduct} className="p-5 space-y-4 text-xs text-slate-800 max-h-[75vh] overflow-y-auto">
              {formMode === 'COMPRA_RECORRENTE' && (
                <div className="bg-amber-50 border border-amber-200 p-2.5 rounded text-[11px] text-amber-900 space-y-1">
                  <span className="font-bold font-mono">MODO COMPRA GRUPAL:</span>
                  <p>
                    Você está registrando uma nova nota de compra para <strong className="underline">{productName}</strong>. 
                    A quantidade digitada abaixo será **SOMADA** diretamente ao saldo ativo de {products.find(p => p.id === selectedProductId)?.quantity || 0} un.
                  </p>
                </div>
              )}

              {/* Seletor do Tipo do Item: Produto Físico vs Serviço/Taxa */}
              <div className="space-y-1 bg-slate-50 border border-slate-200 p-2.5 rounded">
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                  Tipo do Lançamento <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-6 mt-1">
                  <label className="flex items-center gap-1.5 cursor-pointer font-bold select-none text-slate-800">
                    <input
                      type="radio"
                      name="productType"
                      value="produto"
                      checked={productType === 'produto'}
                      onChange={() => setProductType('produto')}
                      disabled={formMode === 'COMPRA_RECORRENTE'}
                      className="cursor-pointer"
                    />
                    <span>📦 Produto Físico</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer font-bold select-none text-slate-800">
                    <input
                      type="radio"
                      name="productType"
                      value="servico"
                      checked={productType === 'servico'}
                      onChange={() => setProductType('servico')}
                      disabled={formMode === 'COMPRA_RECORRENTE'}
                      className="cursor-pointer"
                    />
                    <span>🎟️ Serviço / Taxa Paroquial</span>
                  </label>
                </div>
              </div>

              {/* Campo 1: Código de Barras / SKU */}
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                  Código do Produto (SKU / Barras) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded text-slate-850 font-mono font-bold focus:outline-none focus:bg-white focus:border-blue-750"
                  placeholder="Ex: 78910022"
                  value={productCode}
                  onChange={(e) => setProductCode(e.target.value)}
                  disabled={formMode === 'COMPRA_RECORRENTE'} // lock code for refills
                  required
                />
                <span className="text-[10px] text-slate-500 font-mono block mt-0.5">
                  💡 Código gerido automaticamente com comprimento de 6 dígitos. Garante unicidade absoluta (sem repetição).
                </span>
              </div>

              {/* Campo 2: Nome do Produto */}
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                  Nome / Descrição <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded text-slate-850 font-bold focus:outline-none focus:bg-white focus:border-blue-750"
                  placeholder="Ex: Hóstias de Sacerdote Grandes"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  disabled={formMode === 'COMPRA_RECORRENTE'} // lock name info on refills
                  required
                />
              </div>

              {/* Campo 3: Categoria Dropdown */}
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                  Categoria Paroquial <span className="text-red-500">*</span>
                </label>
                <select
                  className="w-full px-2 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded text-slate-850 focus:outline-none focus:bg-white focus:border-blue-700"
                  value={productCategory}
                  onChange={(e) => setProductCategory(e.target.value)}
                  disabled={formMode === 'COMPRA_RECORRENTE'}
                >
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {productType === 'produto' && (
                <>
                  {/* Row for quantities and min stock */}
                  <div className="grid grid-cols-2 gap-4">
                    
                    {/* Campo 4: Quantidade Comprada */}
                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                        {formMode === 'COMPRA_RECORRENTE' ? 'Qtd Comprada (+)' : 'Quantidade de Estoque'} <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded text-slate-850 font-mono font-bold focus:outline-none focus:bg-white focus:border-blue-750"
                        value={purchaseQuantity}
                        onChange={(e) => setPurchaseQuantity(Number(e.target.value))}
                        required
                      />
                    </div>

                    {/* Campo 5: Estoque Mínimo (Alerta) */}
                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                        Estoque Mínimo <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        min="1"
                        className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded text-slate-850 font-mono focus:outline-none focus:bg-white focus:border-blue-750"
                        value={purchaseMinStock}
                        onChange={(e) => setPurchaseMinStock(Number(e.target.value))}
                        disabled={formMode === 'COMPRA_RECORRENTE'}
                        required
                      />
                    </div>

                  </div>

                  {/* Row for prices and date */}
                  <div className="grid grid-cols-2 gap-4">
                    
                    {/* Campo 6: Preço de Custo (Unitário) */}
                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                        Custo Unitário (MTn) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded text-slate-850 font-mono font-bold focus:outline-none focus:bg-white focus:border-blue-750"
                        placeholder="5,50"
                        value={costPrice}
                        onChange={(e) => setCostPrice(Number(e.target.value.toString().replace(',', '.')))}
                        required
                      />
                    </div>

                    {/* Campo 7: Data da Compra */}
                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                        Data de Compra
                      </label>
                      <input
                        type="date"
                        className="w-full px-2 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded text-slate-850 font-mono focus:outline-none focus:bg-white focus:border-blue-750"
                        value={purchaseDate}
                        onChange={(e) => setPurchaseDate(e.target.value)}
                        required
                      />
                    </div>

                  </div>
                </>
              )}

              {/* Campo: Preço de Venda / Regulamento / Taxa */}
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                  {productType === 'servico' ? 'Valor da Taxa / Preço de Venda (MTn)' : 'Preço de Venda (MTn)'} {productType === 'servico' && <span className="text-red-500">*</span>}
                </label>
                <input
                  type="text"
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded text-slate-850 font-mono font-bold focus:outline-none focus:bg-white focus:border-blue-750"
                  placeholder={productType === 'servico' ? "Valor obrigatório (ex: 150,00)" : "Opcional - Deixe vazio se não precificado"}
                  value={modalSalePrice}
                  onChange={(e) => setModalSalePrice(e.target.value)}
                  required={productType === 'servico'}
                />
                <span className="text-[10px] text-slate-500 block">
                  {productType === 'servico' 
                    ? "💡 Serviços e taxas devem ter obrigatoriamente um preço fixado para podermos emitir o recibo na Frente de Caixa."
                    : "💡 Se deixar vazio (ou 'Não precificado'), o produto físico não integrará o catálogo de vendas até ser precificado."
                  }
                </span>
              </div>

              {/* Helper read only feedback to show selling price */}
              {formMode !== 'NOVO' && (
                <div className="bg-slate-55 p-3 rounded border border-slate-200">
                  <span className="text-[10px] text-slate-500 font-mono block">Preço de Venda Definido:</span>
                  <strong className="text-slate-800 text-xs font-mono">
                    {existingSalePrice 
                      ? `${existingSalePrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} MTn`
                      : 'Sem preço cadastrado (Venda Bloqueada!)'
                    }
                  </strong>
                </div>
              )}

              {/* Action buttons */}
              <div className="pt-4 border-t border-slate-200 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    handleClearForm();
                    setIsProductModalOpen(false);
                  }}
                  className="w-1/3 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 hover:text-slate-900 border border-slate-300 rounded transition font-mono"
                >
                  Fechar
                </button>

                <button
                  type="button"
                  onClick={handleDeleteProduct}
                  disabled={formMode === 'NOVO'}
                  className={`w-1/3 py-2 text-xs font-bold text-white rounded flex items-center justify-center gap-1 transition ${
                    formMode === 'NOVO'
                      ? 'bg-slate-200 cursor-not-allowed text-slate-400 border border-slate-200'
                      : currentUser.role !== 'Administrador'
                      ? 'bg-red-400 opacity-60 cursor-not-allowed'
                      : 'bg-red-700 hover:bg-red-800'
                  }`}
                  title={currentUser.role !== 'Administrador' ? "Apenas Administradores podem excluir" : "Excluir permanentemente"}
                >
                  <Trash2 size={12} />
                  <span>Excluir</span>
                </button>

                <button
                  type="submit"
                  disabled={isSaving}
                  className={`w-1/3 py-2 text-xs font-bold text-white rounded transition shadow flex items-center justify-center gap-1 ${
                    isSaving 
                      ? 'bg-blue-400 opacity-60 cursor-not-allowed' 
                      : 'bg-blue-700 hover:bg-blue-800'
                  }`}
                >
                  {isSaving ? (
                    <>
                      <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin inline-block shrink-0"></span>
                      <span>Salvando...</span>
                    </>
                  ) : (
                    <>
                      <Check size={12} />
                      <span>Salvar</span>
                    </>
                  )}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* MODAL: GERENCIAMENTO DE CATEGORIAS */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 print-hide">
          <div className="bg-white border-2 border-slate-400 rounded shadow-2xl max-w-lg w-full font-sans text-left overflow-hidden">
            <div className="bg-slate-900 text-white px-4 py-3 flex justify-between items-center border-b-2 border-blue-600">
              <span className="font-bold text-xs uppercase tracking-wider font-mono flex items-center gap-2">
                <Layers size={14} className="text-blue-400" />
                Gerenciamento de Categorias Paroquiais
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsCategoryModalOpen(false);
                  setNewCategoryName('');
                  setEditingCategoryIndex(null);
                }}
                className="text-slate-400 hover:text-white font-bold font-mono text-sm leading-none"
              >
                ✕
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Form to create a new category */}
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newCategoryName.trim()) return;
                  const name = newCategoryName.trim();
                  if (categories.some(c => c.toLowerCase() === name.toLowerCase())) {
                    triggerStatus('error', 'Uma categoria com este nome já existe.');
                    return;
                  }
                  
                  // Setup confirmation for creating new category
                  setConfirmDialog({
                    isOpen: true,
                    type: 'edit',
                    message: `Deseja criar a nova categoria "${name}"?`,
                    onConfirm: () => {
                      const updated = [...categories, name];
                      saveCategories(updated);
                      setNewCategoryName('');
                      dbService.log(
                        currentUser.id,
                        currentUser.name,
                        'CATEGORIA_CRIADA',
                        `Adicionou nova categoria de produtos: "${name}"`
                      );
                      triggerStatus('success', `Categoria "${name}" criada com sucesso!`);
                    }
                  });
                }}
                className="flex gap-2 items-end border-b pb-3 border-slate-200"
              >
                <div className="flex-1 space-y-1">
                  <label className="block text-[10px] font-mono font-bold uppercase text-slate-500">Nova Categoria</label>
                  <input
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="Ex: Campanários, Imagens..."
                    className="w-full px-2 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded text-slate-900 font-bold focus:outline-none focus:bg-white focus:border-blue-700"
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded font-mono text-xs font-bold transition h-8"
                >
                  Criar
                </button>
              </form>

              {/* List of existing categories */}
              <div className="space-y-2">
                <span className="text-[10px] text-slate-500 font-mono block uppercase tracking-wide font-bold">Categorias Atuais ({categories.length})</span>
                <div className="border border-slate-250 rounded max-h-[250px] overflow-y-auto divide-y divide-slate-150">
                  {categories.map((cat, idx) => {
                    const isEditing = editingCategoryIndex === idx;
                    const itemsCount = products.filter(p => p.category === cat).length;

                    return (
                      <div key={cat} className="flex justify-between items-center p-2.5 hover:bg-slate-50 transition text-xs">
                        {isEditing ? (
                          <div className="flex-1 flex gap-2 items-center">
                            <input
                              type="text"
                              value={editingCategoryValue}
                              onChange={(e) => setEditingCategoryValue(e.target.value)}
                              className="flex-1 px-2 py-1 border border-blue-500 rounded text-xs text-slate-900 font-bold focus:outline-none"
                              required
                            />
                            <div className="flex gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  if (!editingCategoryValue.trim()) return;
                                  const newVal = editingCategoryValue.trim();
                                  if (newVal === cat) {
                                    setEditingCategoryIndex(null);
                                    return;
                                  }
                                  
                                  setConfirmDialog({
                                    isOpen: true,
                                    type: 'edit',
                                    message: `Deseja Editar esta categoria para "${newVal}"?`,
                                    onConfirm: () => {
                                      handleRenameCategory(cat, newVal);
                                      setEditingCategoryIndex(null);
                                    }
                                  });
                                }}
                                className="p-1 text-green-700 hover:text-green-900 font-bold bg-green-50 rounded border border-green-200"
                                title="Salvar"
                              >
                                <Check size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingCategoryIndex(null)}
                                className="p-1 text-slate-500 hover:text-slate-700 font-bold bg-slate-100 rounded border border-slate-200"
                                title="Cancelar"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex flex-col">
                              <span className="font-semibold text-slate-800">{cat}</span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {itemsCount} {itemsCount === 1 ? 'produto associado' : 'produtos associados'}
                              </span>
                            </div>

                            <div className="flex gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingCategoryIndex(idx);
                                  setEditingCategoryValue(cat);
                                }}
                                className="px-2 py-1 text-[10px] font-mono font-bold bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded transition cursor-pointer"
                              >
                                Editar
                              </button>
                              
                              <button
                                type="button"
                                onClick={() => {
                                  if (cat === 'Outros') {
                                    triggerStatus('error', 'A categoria "Outros" não pode ser eliminada.');
                                    return;
                                  }
                                  setConfirmDialog({
                                    isOpen: true,
                                    type: 'delete',
                                    message: `Deseja Excluir a categoria "${cat}"? Os produtos associados serão movidos automaticamente para a categoria "Outros".`,
                                    onConfirm: () => {
                                      handleDeleteCategory(cat);
                                    }
                                  });
                                }}
                                className="px-2 py-1 text-[10px] font-mono font-bold bg-red-50 hover:bg-red-100 text-red-800 border border-red-200 rounded transition cursor-pointer"
                              >
                                Eliminar
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    setIsCategoryModalOpen(false);
                    setNewCategoryName('');
                    setEditingCategoryIndex(null);
                  }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-mono text-xs font-bold transition border border-slate-350"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: IDENTIFICAÇÃO DE CLIENTE (OPCIONAL NO FECHAMENTO F3) */}
      {isCustomerModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 print-hide">
          <div className="bg-white border-2 border-slate-400 rounded-lg shadow-2xl max-w-md w-full font-sans text-left overflow-hidden">
            <div className="bg-slate-900 text-white px-4 py-3 flex justify-between items-center border-b-2 border-emerald-600">
              <span className="font-bold text-xs uppercase tracking-wider font-mono flex items-center gap-2">
                <Users size={14} className="text-emerald-400" />
                Identificação do Cliente - Frente de Caixa
              </span>
              <button
                type="button"
                onClick={() => setIsCustomerModalOpen(false)}
                className="text-slate-400 hover:text-white font-bold font-mono text-sm leading-none"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-5">
              <div className="text-slate-600 text-xs text-center border-b border-slate-150 pb-3">
                Para fechar a venda de forma rápida e precisa, escolha se deseja processá-la diretamente sem identificação ou associar os dados do fiel/cliente.
              </div>

              {/* OPÇÃO A: Quick direct button */}
              <div className="space-y-2">
                <span className="text-[10px] font-mono font-bold text-slate-400 block uppercase tracking-wider">
                  Opção A: Sem Identificação
                </span>
                <button
                  type="button"
                  onClick={() => processSaleFinal()}
                  className="w-full py-3 bg-stone-100 hover:bg-stone-200 text-stone-900 border border-stone-300 rounded font-mono text-xs font-black transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  Continuar como VENDA DIRETA (Consumidor Final)
                  <ArrowRight size={12} />
                </button>
              </div>

              {/* Divider */}
              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-slate-200"></div>
                <span className="flex-shrink mx-3 text-slate-450 text-[10px] font-mono uppercase font-bold">OU</span>
                <div className="flex-grow border-t border-slate-200"></div>
              </div>

              {/* OPÇÃO B: Identify Client form */}
              <div className="space-y-3 bg-slate-50 p-3.5 rounded-lg border border-slate-200">
                <span className="text-[10px] font-mono font-bold text-blue-750 block uppercase tracking-wider">
                  Opção B: Identificar Cliente / Fiel
                </span>

                <div className="space-y-3">
                  {/* Phone / Contacto - Auto completion match */}
                  <div>
                    <label className="block text-[10px] font-mono font-bold uppercase text-slate-550 mb-1">
                      Contacto (Telefone/WhatsApp) *
                    </label>
                    <input
                      type="text"
                      value={checkoutCustomerPhone}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCheckoutCustomerPhone(val);
                        // Auto completes name if matched in existing clients
                        const existing = customersList.find(c => c.phone.trim() === val.trim() && val.trim().length > 0);
                        if (existing) {
                          setCheckoutCustomerName(existing.name);
                        }
                      }}
                      placeholder="Ex: 84xxxxxxx"
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded text-slate-900 font-mono font-bold focus:outline-none focus:border-blue-755"
                      required
                    />
                  </div>

                  {/* Client name */}
                  <div>
                    <label className="block text-[10px] font-mono font-bold uppercase text-slate-550 mb-1">
                      Nome do Cliente / Fiel *
                    </label>
                    <input
                      type="text"
                      value={checkoutCustomerName}
                      onChange={(e) => setCheckoutCustomerName(e.target.value)}
                      placeholder="Ex: João da Silva"
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded text-slate-900 font-bold focus:outline-none focus:border-blue-755"
                      required
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    disabled={!checkoutCustomerName.trim() || !checkoutCustomerPhone.trim()}
                    onClick={() => processSaleFinal(checkoutCustomerName, checkoutCustomerPhone)}
                    className="w-full py-2.5 bg-blue-700 hover:bg-blue-800 disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed disabled:border-slate-300 cursor-pointer text-white border border-blue-800 rounded font-mono text-xs font-black transition flex items-center justify-center gap-2 shadow-sm"
                  >
                    Salvar e Registrar com Cliente
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: COMPROVATIVO DE VENDA (RECIBO ESTILO TÉRMICO) */}
      {activeReceipt && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 printable-receipt-container">
          <div className="bg-slate-800 p-1 rounded-xl shadow-2xl max-w-sm w-full font-sans text-left overflow-hidden printable-receipt-wrapper">
            <div className="bg-white p-5 rounded-lg border border-slate-300 printable-receipt">
              
              {/* Receipt Header */}
              <div className="text-center space-y-1.5 pb-4 border-b border-dashed border-slate-300 flex flex-col items-center justify-center">
                {parishLogo && (
                  <img 
                    src={parishLogo} 
                    alt="Logo Paróquia" 
                    className="w-14 h-14 object-contain rounded mb-1 mx-auto printable-receipt-logo"
                    referrerPolicy="no-referrer"
                  />
                )}
                <div className="text-center leading-tight space-y-0.5">
                  <h3 className="text-[11px] font-black text-slate-900 uppercase font-mono tracking-tight leading-normal">PARÓQUIA NOSSA SENHORA DA IMACULADA CONCEIÇÃO</h3>
                  <p className="text-[10px] font-bold text-slate-800 uppercase font-mono tracking-tight leading-none">SÉ CATEDRAL DE INHAMBANE</p>
                  <p className="text-[9px] text-slate-500 uppercase tracking-wider font-mono font-bold">SECRETARIA PAROQUIAL</p>
                  <p className="text-[9px] text-slate-450 uppercase font-mono leading-none">INHAMBANE - 879440436</p>
                </div>
              </div>

              {/* Meta details */}
              <div className="py-3 text-[10px] font-mono text-slate-650 space-y-1 border-b border-dashed border-slate-200">
                <div className="flex justify-between">
                  <span>RECIBO Nº:</span>
                  <span className="font-extrabold text-slate-850">{activeReceipt.id}</span>
                </div>
                <div className="flex justify-between">
                  <span>DATA E HORA:</span>
                  <span className="font-extrabold text-slate-850">
                    {new Date(activeReceipt.timestamp).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>OPERADOR:</span>
                  <span className="font-extrabold uppercase text-slate-850">{activeReceipt.sellerName}</span>
                </div>
                <div className="flex justify-between">
                  <span>DESTINATÁRIO:</span>
                  <span className="font-black text-blue-700 uppercase">
                    {activeReceipt.customerName || 'CONSUMIDOR FINAL'}
                  </span>
                </div>
                {activeReceipt.customerPhone && (
                  <div className="flex justify-between">
                    <span>CONTACTO:</span>
                    <span className="font-black text-slate-850">{activeReceipt.customerPhone}</span>
                  </div>
                )}
              </div>

              {/* Items Table inside receipts */}
              <div className="py-3 font-mono text-[10px] space-y-2 border-b border-dashed border-slate-200">
                <div className="flex justify-between font-black text-slate-550 uppercase tracking-wider text-[9px]">
                  <span>Item / Detalhes</span>
                  <span className="text-right">Total</span>
                </div>
                
                <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                  {activeReceipt.items.map((it, idx) => (
                    <div key={idx} className="flex justify-between items-start gap-1">
                      <div className="text-slate-800 font-normal">
                        <div className="font-bold leading-tight">{it.productName}</div>
                        <div className="text-[9px] text-slate-400">
                          {it.quantity} × {it.salePrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} MTn
                        </div>
                      </div>
                      <span className="font-extrabold text-slate-900 shrink-0 text-right">
                        {it.totalPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} MTn
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals box */}
              <div className="py-4 space-y-2.5">
                <div className="flex justify-between items-baseline">
                  <span className="text-xs font-mono font-black text-slate-900 uppercase">Total Geral Pago:</span>
                  <span className="text-xl font-black text-slate-950 font-mono tracking-tight leading-none">
                    {activeReceipt.totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} MTn
                  </span>
                </div>

                <div className="text-center py-2 bg-slate-50 border border-slate-200 rounded text-[9px] text-slate-455 uppercase font-mono font-bold tracking-widest leading-normal">
                  *** Paz e Bem ***<br/>
                  Deus ajude a vossa generosidade!
                </div>
              </div>

              {/* Actions controls buttons */}
              <div className="mt-2 space-y-2 border-t border-slate-200 pt-2 print-hide">
                {/* Button 1: Gerar PDF / Enviar por E-mail */}
                <button
                  type="button"
                  onClick={() => {
                    window.print();
                  }}
                  className="w-full py-2 bg-blue-700 hover:bg-blue-800 text-white font-mono text-xs font-bold rounded flex items-center justify-center gap-1.5 shadow transition cursor-pointer text-center uppercase"
                >
                  <Printer size={12} />
                  <span>Gerar PDF / Enviar por E-mail</span>
                </button>

                {/* Button 2: Enviar via WhatsApp */}
                {(() => {
                  const cleanedContactNum = activeReceipt.customerPhone ? activeReceipt.customerPhone.replace(/[^0-9]/g, '') : '';
                  const mzPhoneNum = cleanedContactNum.length === 9 ? `258${cleanedContactNum}` : cleanedContactNum;
                  
                  const whatsappItemsFormat = activeReceipt.items.map(item => 
                    `• ${item.quantity}x ${item.productName} (${(item.salePrice).toLocaleString('pt-BR')} MTn)`
                  ).join('\n');

                  const rawWhatsAppMsg = `*RECIBO DE CONTRIBUIÇÃO / VENDA*
*PARÓQUIA NOSSA SENHORA DA IMACULADA CONCEIÇÃO*
*SÉ CATEDRAL DE INHAMBANE*
*SECRETARIA PAROQUIAL - INHAMBANE - 879440436*

*Data:* ${new Date(activeReceipt.timestamp).toLocaleString('pt-BR')}
*Nº Recibo:* ${activeReceipt.id}
*Atendido por:* ${activeReceipt.sellerName}
${activeReceipt.customerName ? `\n*Cliente/Fiel:* ${activeReceipt.customerName}\n*Contacto:* ${activeReceipt.customerPhone}` : '\n*Cliente:* Consumidor Final'}

----------------------------------------
*ITENS:*
${whatsappItemsFormat}

----------------------------------------
*TOTAL GERAL:* *${activeReceipt.totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} MTn*

Muito obrigado por sua contribuição e preferência! Que Deus o abençoe!`;

                  const buildWhatsAppHref = `https://api.whatsapp.com/send?phone=${mzPhoneNum}&text=${encodeURIComponent(rawWhatsAppMsg)}`;

                  return (
                    <a
                      href={buildWhatsAppHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-mono text-xs font-bold rounded flex items-center justify-center gap-1.5 shadow transition text-center uppercase cursor-pointer"
                    >
                      <ArrowRight size={12} />
                      <span>Enviar via WhatsApp</span>
                    </a>
                  );
                })()}

                <button
                  type="button"
                  onClick={() => setActiveReceipt(null)}
                  className="w-full py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-250 rounded font-mono text-[11px] font-bold transition cursor-pointer uppercase text-center"
                >
                  Fechar Comprovativo
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO DE LIMPEZA DE REGISTOS */}
      {isConfirmClearOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 print-hide">
          <div className="bg-white border-2 border-red-600 rounded-lg shadow-2xl max-w-md w-full font-sans text-left overflow-hidden">
            <div className="bg-red-700 text-white px-4 py-3 flex justify-between items-center border-b-2 border-red-800">
              <span className="font-bold text-xs uppercase tracking-wider font-mono flex items-center gap-2">
                <AlertTriangle size={14} className="text-yellow-300 animate-bounce" />
                Confirmação de Limpeza Paroquial
              </span>
              <button
                type="button"
                onClick={() => setIsConfirmClearOpen(false)}
                className="text-white hover:text-red-200 font-bold font-mono text-sm leading-none"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="text-red-600 shrink-0" size={32} />
                <div className="space-y-1.5">
                  <h4 className="font-extrabold text-sm text-slate-900 leading-snug">Você está prestes a apagar TODOS os registos!</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Esta ação irá remover de forma permanente todo o histórico de vendas e emissão de recibos eletrónicos na Secretaria Paroquial. Estes dados não poderão ser recuperados.
                  </p>
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-[11px] font-mono text-yellow-800 leading-normal">
                ⚠️ <strong>Apenas Administradores</strong> podem realizar este procedimento. O evento será registrado permanentemente no relatório de auditoria do sistema.
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-150 font-mono text-xs">
                <button
                  type="button"
                  onClick={() => setIsConfirmClearOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded font-bold transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={executeClearSales}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white rounded font-bold transition flex items-center gap-1.5 shadow-sm border border-red-700 cursor-pointer"
                >
                  <Trash2 size={13} />
                  Limpar Registos JÁ
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO DE LIMPEZA DE HISTÓRICO DE AUDITORIA */}
      {isConfirmClearHistoryOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 print-hide">
          <div className="bg-white border-2 border-red-600 rounded-lg shadow-2xl max-w-md w-full font-sans text-left overflow-hidden">
            <div className="bg-red-700 text-white px-4 py-3 flex justify-between items-center border-b-2 border-red-800">
              <span className="font-bold text-xs uppercase tracking-wider font-mono flex items-center gap-2">
                <AlertTriangle size={14} className="text-yellow-300 animate-bounce" />
                Confirmação de Limpeza do Histórico (Livro Auditor)
              </span>
              <button
                type="button"
                onClick={() => setIsConfirmClearHistoryOpen(false)}
                className="text-white hover:text-red-200 font-bold font-mono text-sm leading-none"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="text-red-600 shrink-0" size={32} />
                <div className="space-y-1.5">
                  <h4 className="font-extrabold text-sm text-slate-900 leading-snug">Você está prestes a apagar TODO o Histórico de Auditoria!</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Esta ação irá remover de forma permanente todas as trilhas de auditoria, logs de operações e logs do livro auditor na Secretaria Paroquial. Estes dados não poderão ser recuperados.
                  </p>
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-[11px] font-mono text-yellow-800 leading-normal">
                ⚠️ <strong>Apenas Administradores</strong> podem realizar este procedimento. O evento será registrado como o único e primeiro log no novo livro de auditorias.
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-150 font-mono text-xs">
                <button
                  type="button"
                  onClick={() => setIsConfirmClearHistoryOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded font-bold transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={executeClearHistory}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white rounded font-bold transition flex items-center gap-1.5 shadow-sm border border-red-700 cursor-pointer"
                >
                  <Trash2 size={13} />
                  Limpar Histórico JÁ
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
