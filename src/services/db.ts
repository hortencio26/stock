import { User, AuditLog, Product, Sale, PurchaseLog, Customer } from '../types';
import { db, handleFirestoreError, OperationType, seedDatabaseIfEmpty, ensureAuthReady } from './firebase';
import { collection, getDocs, doc, setDoc, getDocFromServer, writeBatch } from 'firebase/firestore';
import { INITIAL_USERS } from './initialData';

// Standard system keys for localStorage (used as fallback or for session storage)
const STORAGE_KEYS = {
  USERS: 'stock_parocos_users',
  AUDIT_LOGS: 'stock_parocos_audit_logs',
  PRODUCTS: 'stock_parocos_products',
  SALES: 'stock_parocos_sales',
  PURCHASES: 'stock_parocos_purchases',
  CURRENT_USER_SESSION: 'stock_parocos_session',
  CUSTOMERS: 'stock_parocos_customers',
};

// Helper to safely write/read from Firestore or fallback to localStorage
export const dbService = {
  // Initialize standard data structures and populate Firestore if empty
  async initialize(onProgress?: (msg: string) => void): Promise<void> {
    // Sync the Firebase database as requested
    await seedDatabaseIfEmpty(onProgress);
  },

  // Log auditing events
  async log(userId: string, userName: string, action: string, details: string): Promise<AuditLog> {
    const newLog: AuditLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      userId,
      userName,
      action,
      details,
      timestamp: new Date().toISOString(),
    };

    if (db) {
      try {
        await ensureAuthReady();
        await setDoc(doc(db, 'audit_logs', newLog.id), newLog);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `audit_logs/${newLog.id}`);
      }
    } else {
      const logs = JSON.parse(localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS) || '[]');
      logs.unshift(newLog); // Newer logs first!
      localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(logs));
    }
    return newLog;
  },

  // USERS
  async getUsers(): Promise<User[]> {
    if (db) {
      try {
        await ensureAuthReady();
        const snap = await getDocs(collection(db, 'users'));
        const usersList: User[] = [];
        snap.forEach(d => {
          usersList.push(d.data() as User);
        });
        if (usersList.length > 0) {
          return usersList;
        }
      } catch (err) {
        console.warn("Erro ao buscar usuários do Firestore (usando fallback local):", err);
      }
    }
    const localUsers = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]');
    if (localUsers.length > 0) {
      return localUsers;
    }
    return INITIAL_USERS;
  },

  async saveUser(user: User): Promise<void> {
    if (db) {
      try {
        await ensureAuthReady();
        await setDoc(doc(db, 'users', user.id), user);
        return;
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${user.id}`);
      }
    }
    const users = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]');
    const index = users.findIndex((u: any) => u.id === user.id);
    if (index >= 0) {
      users[index] = user;
    } else {
      users.push(user);
    }
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
  },

  // AUDIT LOGS
  async getAuditLogs(): Promise<AuditLog[]> {
    if (db) {
      try {
        await ensureAuthReady();
        const snap = await getDocs(collection(db, 'audit_logs'));
        const logsList: AuditLog[] = [];
        snap.forEach(d => {
          logsList.push(d.data() as AuditLog);
        });
        return logsList.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, 'audit_logs');
      }
    }
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS) || '[]');
  },

  // PRODUCTS & PURCHASES
  async getProducts(): Promise<Product[]> {
    if (db) {
      try {
        await ensureAuthReady();
        const snap = await getDocs(collection(db, 'products'));
        const productsList: Product[] = [];
        snap.forEach(d => {
          productsList.push(d.data() as Product);
        });
        return productsList;
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, 'products');
      }
    }
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.PRODUCTS) || '[]');
  },

  async getPurchases(): Promise<PurchaseLog[]> {
    if (db) {
      try {
        await ensureAuthReady();
        const snap = await getDocs(collection(db, 'purchase_logs'));
        const purchasesList: PurchaseLog[] = [];
        snap.forEach(d => {
          purchasesList.push(d.data() as PurchaseLog);
        });
        return purchasesList.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, 'purchase_logs');
      }
    }
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.PURCHASES) || '[]');
  },

  async registerPurchase(
    productId: string,
    productName: string,
    category: string,
    quantityAdded: number,
    costPrice: number,
    buyerId: string,
    buyerName: string,
    dateStr?: string
  ): Promise<PurchaseLog> {
    const timestamp = dateStr || new Date().toISOString();
    const newPurchase: PurchaseLog = {
      id: `purch_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      productId,
      productName,
      category,
      quantityAdded,
      costPrice,
      buyerId,
      buyerName,
      timestamp,
    };

    if (db) {
      try {
        await ensureAuthReady();
        const batch = writeBatch(db);
        batch.set(doc(db, 'purchase_logs', newPurchase.id), newPurchase);

        const pDoc = await getDocFromServer(doc(db, 'products', productId));
        if (pDoc.exists()) {
          const prodData = pDoc.data() as Product;
          prodData.quantity += quantityAdded;
          prodData.updatedAt = timestamp;
          batch.set(doc(db, 'products', productId), prodData);
        }
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `purchases_and_product_update`);
      }
    } else {
      const purchases = JSON.parse(localStorage.getItem(STORAGE_KEYS.PURCHASES) || '[]');
      purchases.unshift(newPurchase);
      localStorage.setItem(STORAGE_KEYS.PURCHASES, JSON.stringify(purchases));

      const products = JSON.parse(localStorage.getItem(STORAGE_KEYS.PRODUCTS) || '[]');
      const index = products.findIndex((p: any) => p.id === productId);
      if (index >= 0) {
        products[index].quantity += quantityAdded;
        products[index].updatedAt = timestamp;
        localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
      }
    }

    return newPurchase;
  },

  async saveProduct(product: Product, userId: string, userName: string): Promise<void> {
    const dateStr = new Date().toISOString();
    let actionType = 'CADASTRO_PRODUTO';
    let details = `Lançamento/atualização do produto "${product.name}"`;

    if (db) {
      try {
        await ensureAuthReady();
        const pDoc = await getDocFromServer(doc(db, 'products', product.id));
        if (pDoc.exists()) {
          const prev = pDoc.data() as Product;
          product.updatedAt = dateStr;
          product.createdAt = prev.createdAt || dateStr;

          if (prev.quantity !== product.quantity) {
            actionType = 'ESTOQUE_AJUSTADO';
            details = `Ajuste de estoque do produto "${product.name}": de ${prev.quantity} para ${product.quantity}`;
          } else if (prev.salePrice !== product.salePrice) {
            actionType = 'PRECO_ATRIBUIDO';
            details = `Ajuste de preço de venda de "${product.name}": de MTn ${prev.salePrice?.toFixed(2) || '0,00'} para MTn ${product.salePrice?.toFixed(2) || '0,00'}`;
          }
        } else {
          product.createdAt = dateStr;
          product.updatedAt = dateStr;
        }

        const batch = writeBatch(db);
        batch.set(doc(db, 'products', product.id), product);

        const newLog: AuditLog = {
          id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          userId,
          userName,
          action: actionType,
          details,
          timestamp: dateStr,
        };
        batch.set(doc(db, 'audit_logs', newLog.id), newLog);

        await batch.commit();
        return;
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `products/${product.id}`);
      }
    }

    const products = JSON.parse(localStorage.getItem(STORAGE_KEYS.PRODUCTS) || '[]');
    const index = products.findIndex((p: any) => p.id === product.id);
    if (index >= 0) {
      const prev = products[index];
      product.updatedAt = dateStr;
      product.createdAt = prev.createdAt;
      if (prev.quantity !== product.quantity) {
        actionType = 'ESTOQUE_AJUSTADO';
        details = `Ajuste de estoque do produto "${product.name}": de ${prev.quantity} para ${product.quantity}`;
      } else if (prev.salePrice !== product.salePrice) {
        actionType = 'PRECO_ATRIBUIDO';
        details = `Ajuste de preço de venda de "${product.name}": de MTn ${prev.salePrice?.toFixed(2) || '0,00'} para MTn ${product.salePrice?.toFixed(2) || '0,00'}`;
      }
      products[index] = product;
    } else {
      product.createdAt = dateStr;
      product.updatedAt = dateStr;
      products.push(product);
    }
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
    await this.log(userId, userName, actionType, details);
  },

  async deleteProduct(productId: string, userId: string, userName: string): Promise<void> {
    const timestamp = new Date().toISOString();
    let name = '';

    if (db) {
      try {
        await ensureAuthReady();
        const pDoc = await getDocFromServer(doc(db, 'products', productId));
        if (pDoc.exists()) {
          name = (pDoc.data() as Product).name;
          const batch = writeBatch(db);
          batch.delete(doc(db, 'products', productId));

          const newLog: AuditLog = {
            id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            userId,
            userName,
            action: 'EXCLUSAO_PRODUTO',
            details: `Produto "${name}" excluído.`,
            timestamp,
          };
          batch.set(doc(db, 'audit_logs', newLog.id), newLog);
          await batch.commit();
        }
        return;
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `products/${productId}`);
      }
    }

    const products = JSON.parse(localStorage.getItem(STORAGE_KEYS.PRODUCTS) || '[]');
    const item = products.find((p: any) => p.id === productId);
    if (!item) return;
    const filtered = products.filter((p: any) => p.id !== productId);
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(filtered));
    await this.log(userId, userName, 'EXCLUSAO_PRODUTO', `Produto "${item.name}" excluído.`);
  },

  // SALES
  async getSales(): Promise<Sale[]> {
    if (db) {
      try {
        await ensureAuthReady();
        const snap = await getDocs(collection(db, 'sales'));
        const salesList: Sale[] = [];
        snap.forEach(d => {
          salesList.push(d.data() as Sale);
        });
        return salesList.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, 'sales');
      }
    }
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.SALES) || '[]');
  },

  async generateNextReceiptNumber(timestampStr: string): Promise<string> {
    const timestampDate = new Date(timestampStr);
    const year = timestampDate.getFullYear();
    const sales = await this.getSales();
    
    // Filter sales belonging to the target year
    const targetSales = sales.filter(s => {
      const d = new Date(s.timestamp);
      return d.getFullYear() === year;
    });

    // Group the sales of this target year to get unique checkout transactions
    const transactionKeys = new Set<string>();
    targetSales.forEach(s => {
      const key = `${s.timestamp}_${s.sellerName}_${s.customerName || ''}`;
      transactionKeys.add(key);
    });

    const nextSeq = transactionKeys.size;
    const seqStr = String(nextSeq).padStart(2, '0');
    const yearStr = String(year).slice(-2);
    return `${seqStr}${yearStr}`;
  },

  async registerSale(productId: string, quantity: number, sellerId: string, sellerName: string): Promise<{ success: boolean; message: string }> {
    const timestamp = new Date().toISOString();
    const receiptNumber = await this.generateNextReceiptNumber(timestamp);

    if (db) {
      try {
        await ensureAuthReady();
        const pDoc = await getDocFromServer(doc(db, 'products', productId));
        if (!pDoc.exists()) {
          return { success: false, message: 'Produto não foi localizado no estoque.' };
        }
        const prod = pDoc.data() as Product;

        if (!prod.salePrice) {
          return { success: false, message: 'Este produto não possui preço de venda definido e não pode ser comercializado.' };
        }
        if (prod.quantity < quantity) {
          return { success: false, message: `Quantidade solicitada (${quantity}) excede o saldo de estoque atual (${prod.quantity}).` };
        }

        prod.quantity -= quantity;
        prod.updatedAt = timestamp;

        const batch = writeBatch(db);
        batch.set(doc(db, 'products', productId), prod);

        const totalPrice = prod.salePrice * quantity;
        const newSale: Sale = {
          id: receiptNumber,
          productId,
          productName: prod.name,
          category: prod.category,
          quantity,
          salePrice: prod.salePrice,
          totalPrice,
          sellerId,
          sellerName,
          timestamp,
        };
        const saleId = `${receiptNumber}_${productId}`;
        batch.set(doc(db, 'sales', saleId), newSale);

        const newLog: AuditLog = {
          id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          userId: sellerId,
          userName: sellerName,
          action: 'VENDA',
          details: `Venda de ${quantity}x "${prod.name}" por R$ ${totalPrice.toFixed(2)} (Unitário: R$ ${prod.salePrice.toFixed(2)})`,
          timestamp,
        };
        batch.set(doc(db, 'audit_logs', newLog.id), newLog);

        await batch.commit();
        return { success: true, message: 'Venda realizada com sucesso!' };
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `sales_item`);
      }
    }

    const products = JSON.parse(localStorage.getItem(STORAGE_KEYS.PRODUCTS) || '[]');
    const productIndex = products.findIndex((p: any) => p.id === productId);
    
    if (productIndex === -1) {
      return { success: false, message: 'Produto não foi localizado no estoque.' };
    }
    
    const product = products[productIndex];
    if (!product.salePrice) {
      return { success: false, message: 'Este produto não possui preço de venda definido e não pode ser comercializado.' };
    }
    if (product.quantity < quantity) {
      return { success: false, message: `Quantidade solicitada (${quantity}) excede o saldo de estoque atual (${product.quantity}).` };
    }
    
    product.quantity -= quantity;
    product.updatedAt = timestamp;
    products[productIndex] = product;
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
    
    const sales = JSON.parse(localStorage.getItem(STORAGE_KEYS.SALES) || '[]');
    const totalPrice = product.salePrice * quantity;
    const newSale: Sale = {
      id: receiptNumber,
      productId,
      productName: product.name,
      category: product.category,
      quantity,
      salePrice: product.salePrice,
      totalPrice,
      sellerId,
      sellerName,
      timestamp,
    };
    
    sales.unshift(newSale);
    localStorage.setItem(STORAGE_KEYS.SALES, JSON.stringify(sales));
    
    await this.log(
      sellerId,
      sellerName,
      'VENDA',
      `Venda de ${quantity}x "${product.name}" por R$ ${totalPrice.toFixed(2)} (Unitário: R$ ${product.salePrice.toFixed(2)})`
    );
    
    return { success: true, message: 'Venda realizada com sucesso!' };
  },

  async registerMultipleSales(
    items: { productId: string; quantity: number }[],
    sellerId: string,
    sellerName: string,
    customerName?: string,
    customerPhone?: string
  ): Promise<{ success: boolean; message: string; salesRegistered?: Sale[] }> {
    const timestamp = new Date().toISOString();
    const receiptNumber = await this.generateNextReceiptNumber(timestamp);

    if (db) {
      try {
        await ensureAuthReady();
        const batch = writeBatch(db);
        const processedSales: Sale[] = [];
        const logDetails: string[] = [];
        let totalSaleSum = 0;

        const prods: Product[] = [];
        for (const item of items) {
          if (item.quantity <= 0) {
            return { success: false, message: 'A quantidade de cada produto deve ser no mínimo 1.' };
          }
          const pDoc = await getDocFromServer(doc(db, 'products', item.productId));
          if (!pDoc.exists()) {
            return { success: false, message: `Produto solicitado não foi localizado no estoque.` };
          }
          const prod = pDoc.data() as Product;
          if (!prod.salePrice || prod.salePrice <= 0) {
            return { success: false, message: `O produto "${prod.name}" não possui preço de venda válido.` };
          }
          if (prod.quantity < item.quantity) {
            return { success: false, message: `Estoque insuficiente para "${prod.name}": solicitado ${item.quantity}, disponível ${prod.quantity}.` };
          }

          prod.quantity -= item.quantity;
          prod.updatedAt = timestamp;
          prods.push(prod);

          const totalPrice = (prod.salePrice || 0) * item.quantity;
          totalSaleSum += totalPrice;

          const newSale: Sale = {
            id: receiptNumber,
            productId: item.productId,
            productName: prod.name,
            category: prod.category,
            quantity: item.quantity,
            salePrice: prod.salePrice || 0,
            totalPrice,
            sellerId,
            sellerName,
            timestamp,
            customerName,
            customerPhone,
          };
          
          processedSales.push(newSale);
          logDetails.push(`${item.quantity}x "${prod.name}"`);
        }

        for (const p of prods) {
          batch.set(doc(db, 'products', p.id), p);
        }
        for (const s of processedSales) {
          const saleId = `${receiptNumber}_${s.productId}`;
          batch.set(doc(db, 'sales', saleId), s);
        }

        const clientDesc = customerName ? ` para Cliente Identified: ${customerName} (${customerPhone})` : '';
        const newLog: AuditLog = {
          id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          userId: sellerId,
          userName: sellerName,
          action: 'VENDA',
          details: `Venda de ${processedSales.length} itens no caixa${clientDesc}: [${logDetails.join(', ')}] totalizando ${totalSaleSum.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} MTn`,
          timestamp,
        };
        batch.set(doc(db, 'audit_logs', newLog.id), newLog);

        await batch.commit();
        return { success: true, message: 'Venda realizada com sucesso!', salesRegistered: processedSales };
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'sales_batch');
      }
    }

    const products = JSON.parse(localStorage.getItem(STORAGE_KEYS.PRODUCTS) || '[]');
    const sales = JSON.parse(localStorage.getItem(STORAGE_KEYS.SALES) || '[]');
    const processedSales: Sale[] = [];
    const logDetails: string[] = [];
    let totalSaleSum = 0;

    for (const item of items) {
      if (item.quantity <= 0) {
        return { success: false, message: 'A quantidade de cada produto deve ser no mínimo 1.' };
      }
      const prod = products.find((p: any) => p.id === item.productId);
      if (!prod) {
        return { success: false, message: `Produto solicitado não foi localizado no estoque.` };
      }
      if (!prod.salePrice || prod.salePrice <= 0) {
        return { success: false, message: `O produto "${prod.name}" não possui preço de venda válido.` };
      }
      if (prod.quantity < item.quantity) {
        return { success: false, message: `Estoque insuficiente para "${prod.name}": solicitado ${item.quantity}, disponível ${prod.quantity}.` };
      }
    }

    for (const item of items) {
      const prodIndex = products.findIndex((p: any) => p.id === item.productId);
      const prod = products[prodIndex];

      prod.quantity -= item.quantity;
      prod.updatedAt = timestamp;
      products[prodIndex] = prod;

      const totalPrice = (prod.salePrice || 0) * item.quantity;
      totalSaleSum += totalPrice;

      const newSale: Sale = {
        id: receiptNumber,
        productId: item.productId,
        productName: prod.name,
        category: prod.category,
        quantity: item.quantity,
        salePrice: prod.salePrice || 0,
        totalPrice,
        sellerId,
        sellerName,
        timestamp,
        customerName,
        customerPhone,
      };
      
      processedSales.push(newSale);
      logDetails.push(`${item.quantity}x "${prod.name}"`);
    }

    sales.unshift(...processedSales);
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
    localStorage.setItem(STORAGE_KEYS.SALES, JSON.stringify(sales));

    const clientDesc = customerName ? ` para Cliente Identified: ${customerName} (${customerPhone})` : '';
    await this.log(
      sellerId,
      sellerName,
      'VENDA',
      `Venda de ${processedSales.length} itens no caixa${clientDesc}: [${logDetails.join(', ')}] totalizando ${totalSaleSum.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} MTn`
    );

    return { success: true, message: 'Venda realizada com sucesso!', salesRegistered: processedSales };
  },

  // CLIENTS/CUSTOMERS METHODS
  async getCustomers(): Promise<Customer[]> {
    if (db) {
      try {
        await ensureAuthReady();
        const snap = await getDocs(collection(db, 'customers'));
        const list: Customer[] = [];
        snap.forEach(d => {
          list.push(d.data() as Customer);
        });
        return list;
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, 'customers');
      }
    }
    const clientsStr = localStorage.getItem(STORAGE_KEYS.CUSTOMERS);
    if (!clientsStr) return [];
    try {
      return JSON.parse(clientsStr);
    } catch {
      return [];
    }
  },

  async addOrGetCustomer(name: string, phone: string): Promise<Customer> {
    const trimmedPhone = phone.trim();

    if (db) {
      try {
        await ensureAuthReady();
        const customers = await this.getCustomers();
        const existing = customers.find(c => c.phone.trim() === trimmedPhone);
        
        if (existing) {
          if (existing.name !== name && name.trim()) {
            existing.name = name.trim();
            await setDoc(doc(db, 'customers', existing.id), existing);
          }
          return existing;
        }

        const newCustomer: Customer = {
          id: `cust_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          name: name.trim() || 'Consumidor Final',
          phone: trimmedPhone,
          createdAt: new Date().toISOString(),
        };

        await setDoc(doc(db, 'customers', newCustomer.id), newCustomer);
        return newCustomer;
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'customers');
      }
    }

    const customers = JSON.parse(localStorage.getItem(STORAGE_KEYS.CUSTOMERS) || '[]');
    const existing = customers.find((c: any) => c.phone.trim() === trimmedPhone);
    
    if (existing) {
      if (existing.name !== name && name.trim()) {
        existing.name = name.trim();
        localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(customers));
      }
      return existing;
    }

    const newCustomer: Customer = {
      id: `cust_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      name: name.trim() || 'Consumidor Final',
      phone: trimmedPhone,
      createdAt: new Date().toISOString(),
    };

    customers.push(newCustomer);
    localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(customers));
    return newCustomer;
  },

  // SESSION MANAGEMENT
  async loginByPin(pin: string): Promise<User | null> {
    const users = await this.getUsers();
    const user = users.find(u => String(u.pin).trim() === String(pin).trim() && u.active);
    if (user) {
      const session = {
        user,
        loginTime: new Date().toISOString(),
      };
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER_SESSION, JSON.stringify(session));
      try {
        await this.log(user.id, user.name, 'LOGIN', `Acesso ao sistema via PIN autenticado com sucesso.`);
      } catch (logErr) {
        console.warn("Falha ao registrar log de acesso no Firestore:", logErr);
      }
      return user;
    }
    return null;
  },

  getCurrentSession(): { user: User; loginTime: string } | null {
    const sessionStr = localStorage.getItem(STORAGE_KEYS.CURRENT_USER_SESSION);
    if (!sessionStr) return null;
    try {
      return JSON.parse(sessionStr);
    } catch {
      return null;
    }
  },

  async logout(): Promise<void> {
    const session = this.getCurrentSession();
    if (session) {
      await this.log(session.user.id, session.user.name, 'LOGOUT', `LOGOUT - Usuário ${session.user.name} encerrou a sessão`);
    }
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER_SESSION);
  },

  async clearSales(): Promise<void> {
    localStorage.setItem(STORAGE_KEYS.SALES, '[]');
    if (db) {
      try {
        await ensureAuthReady();
        const querySnapshot = await getDocs(collection(db, 'sales'));
        const batch = writeBatch(db);
        querySnapshot.forEach((document) => {
          batch.delete(doc(db, 'sales', document.id));
        });
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'clear_sales');
      }
    }
  },

  async clearAuditLogs(): Promise<void> {
    localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, '[]');
    if (db) {
      try {
        await ensureAuthReady();
        const querySnapshot = await getDocs(collection(db, 'audit_logs'));
        const batch = writeBatch(db);
        querySnapshot.forEach((document) => {
          batch.delete(doc(db, 'audit_logs', document.id));
        });
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'clear_audit_logs');
      }
    }
  },

  async deleteUser(userId: string): Promise<void> {
    const users = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]');
    const filtered = users.filter((u: any) => u.id !== userId);
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(filtered));
    if (db) {
      try {
        // Since we import writeBatch from firestore at top, we can use a bach or standard setDoc or similar. But we can just use setDoc (or deleteDoc style doc ref writing with null) or write a batch. Since doc() and deleteDoc imports are great, we can import deleteDoc. Wait, we don't have deleteDoc imported, but let's just write to Firestore.
        // Wait, can we delete doc? Yes, deleteDoc is easily imported, but we can also use setDoc to delete or we can just import deleteDoc from firebase/firestore.
        await ensureAuthReady();
        const { deleteDoc } = await import('firebase/firestore');
        await deleteDoc(doc(db, 'users', userId));
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `delete_user/${userId}`);
      }
    }
  },

  // Reset demo databases completely
  async resetToDefault(): Promise<void> {
    localStorage.removeItem(STORAGE_KEYS.USERS);
    localStorage.removeItem(STORAGE_KEYS.PRODUCTS);
    localStorage.removeItem(STORAGE_KEYS.AUDIT_LOGS);
    localStorage.removeItem(STORAGE_KEYS.SALES);
    localStorage.removeItem(STORAGE_KEYS.PURCHASES);
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER_SESSION);
    await this.initialize();
  },
};
