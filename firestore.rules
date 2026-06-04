/**
 * Types and interfaces for the Stock application
 */

export type UserRole = 'Administrador' | 'Operador';

export interface User {
  id: string;
  name: string;
  pin: string; // 4-digit PIN
  role: UserRole;
  active: boolean;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  action: string; // 'LOGIN' | 'LOGOUT' | 'CADASTRO_PRODUTO' | 'PRECO_ATRIBUIDO' | 'VENDA' | 'ESTOQUE_AJUSTADO'
  details: string;
  timestamp: string;
}

export interface Product {
  id: string;
  code: string; // Barcode or code
  name: string;
  category: string;
  quantity: number; // current inventory status
  costPrice: number; // cost/purchase price
  salePrice?: number | null; // active selling price (required for sale)
  minStock: number; // alert threshhold
  type: 'produto' | 'servico';
  createdAt: string;
  updatedAt: string;
}

export interface Sale {
  id: string;
  productId: string;
  productName: string;
  category: string;
  quantity: number;
  salePrice: number;
  totalPrice: number;
  sellerId: string;
  sellerName: string;
  timestamp: string;
  customerName?: string;
  customerPhone?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string; // Contacto (Telefone/WhatsApp)
  createdAt: string;
}

export interface PurchaseLog {
  id: string;
  productId: string;
  productName: string;
  category: string;
  quantityAdded: number;
  costPrice: number;
  buyerId: string;
  buyerName: string;
  timestamp: string;
}

declare global {
  interface Window {
    html2pdf: any;
  }
}

