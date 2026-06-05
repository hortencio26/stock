import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { initializeFirestore, memoryLocalCache, doc, getDocFromServer, collection, getDocs, limit, query, writeBatch, getFirestore } from 'firebase/firestore';
import { INITIAL_USERS, INITIAL_PRODUCTS } from './initialData';
import firebaseConfigJson from '../../firebase-applet-config.json';

const metaEnv = (import.meta as any).env || {};

const isAiStudio = typeof window !== 'undefined' && (
  window.location.hostname.includes('.run.app') || 
  window.location.hostname.includes('localhost') || 
  window.location.hostname.includes('127.0.0.1')
);

const firebaseConfig = isAiStudio && firebaseConfigJson?.apiKey ? {
  apiKey: firebaseConfigJson.apiKey,
  authDomain: firebaseConfigJson.authDomain,
  projectId: firebaseConfigJson.projectId,
  storageBucket: firebaseConfigJson.storageBucket,
  messagingSenderId: firebaseConfigJson.messagingSenderId,
  appId: firebaseConfigJson.appId,
  firestoreDatabaseId: firebaseConfigJson.firestoreDatabaseId || ""
} : {
  apiKey: metaEnv.VITE_FIREBASE_API_KEY || "AIzaSyA_HdpyD-PI_sL22blcMR_BYTmez6yafpo",
  authDomain: metaEnv.VITE_FIREBASE_AUTH_DOMAIN || "stock-9c37b.firebaseapp.com",
  projectId: metaEnv.VITE_FIREBASE_PROJECT_ID || "stock-9c37b",
  storageBucket: metaEnv.VITE_FIREBASE_STORAGE_BUCKET || "stock-9c37b.firebasestorage.app",
  messagingSenderId: metaEnv.VITE_FIREBASE_MESSAGING_SENDER_ID || "238087820840",
  appId: metaEnv.VITE_FIREBASE_APP_ID || "1:238087820840:web:6b65819a2558a6127f071d",
  firestoreDatabaseId: (firebaseConfigJson as any).firestoreDatabaseId || ""
};

// Initialize Firebase App
export const app = firebaseConfig.apiKey ? (getApps().length === 0 ? initializeApp(firebaseConfig) : getApp()) : null;

// INICIALIZAÇÃO RESILIENTE (BLINDAGEM CONTRA TELA EM BRANCO DO VITE)
export const db = app ? (() => {
  try {
    return firebaseConfig.firestoreDatabaseId 
      ? initializeFirestore(app, { experimentalForceLongPolling: true }, firebaseConfig.firestoreDatabaseId)
      : initializeFirestore(app, { experimentalForceLongPolling: true });
  } catch (error: any) {
    console.warn("Instância recuperada com sucesso para evitar travamento.");
    return firebaseConfig.firestoreDatabaseId 
      ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
      : getFirestore(app);
  }
})() : null;

export const auth = app ? getAuth(app) : null;

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid || null,
      email: auth?.currentUser?.email || null,
      emailVerified: auth?.currentUser?.emailVerified || null,
      isAnonymous: auth?.currentUser?.isAnonymous || null,
      tenantId: auth?.currentUser?.tenantId || null,
      providerInfo: auth?.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error Incident Captured:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

let isAuthReadyPromise: Promise<void> | null = null;

export function ensureAuthReady(): Promise<void> {
  if (isAuthReadyPromise) return isAuthReadyPromise;

  isAuthReadyPromise = new Promise((resolve) => {
    const apiKey = firebaseConfig.apiKey;
    if (!apiKey || !auth) {
      resolve();
      return;
    }
    if (auth.currentUser) {
      resolve();
      return;
    }

    let resolved = false;
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      unsubscribe();
      if (!resolved) {
        resolved = true;
        if (user) {
          resolve();
        } else {
          try {
            await signInAnonymously(auth);
          } catch (authError: any) {
            console.warn("Autenticação anônima pendente.");
          }
          resolve();
        }
      }
    }, () => {
      unsubscribe();
      if (!resolved) {
        resolved = true;
        resolve();
      }
    });

    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve();
      }
    }, 2500);
  });

  return isAuthReadyPromise;
}

export async function ensureAnonymousLogin(): Promise<void> {
  await ensureAuthReady();
}

export async function testConnection() {
  if (!firebaseConfig.apiKey || !db) return;
  try {
    await ensureAnonymousLogin();
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    console.log("Verificação de rede em segundo plano.");
  }
}

testConnection();

export async function seedDatabaseIfEmpty(onProgress?: (msg: string) => void): Promise<{ seeded: boolean; error?: string }> {
  const apiKey = firebaseConfig.apiKey;
  if (!apiKey || !auth || !db) return { seeded: false };

  try {
    onProgress?.("Conectando ao banco de dados...");
    await ensureAuthReady();

    if (localStorage.getItem('stock_parocos_sys_seeded') === 'true') {
      return { seeded: false };
    }

    const seedDocRef = doc(db, 'system_config', 'seeding');
    let hasSeededMarker = false;
    try {
      const seedDocSnap = await getDocFromServer(seedDocRef);
      if (seedDocSnap.exists() && (seedDocSnap.data() as any)?.seeded) {
        hasSeededMarker = true;
      }
    } catch (e) {
      console.warn("Verificando marcador de sincronização.");
    }

    if (hasSeededMarker) {
      localStorage.setItem('stock_parocos_sys_seeded', 'true');
      return { seeded: false };
    }

    const productsRef = collection(db, 'products');
    const snapshot = await getDocs(query(productsRef, limit(1)));

    if (!snapshot.empty) {
      localStorage.setItem('stock_parocos_sys_seeded', 'true');
      return { seeded: false };
    }

    onProgress?.("Carregando configurações iniciais da paróquia...");
    const batch = writeBatch(db);

    for (const u of INITIAL_USERS) {
      batch.set(doc(db, 'users', u.id), u);
    }

    for (const p of INITIAL_PRODUCTS) {
      batch.set(doc(db, 'products', p.id), p);
    }

    batch.set(seedDocRef, { seeded: true, timestamp: new Date().toISOString() });
    await batch.commit();

    localStorage.setItem('stock_parocos_sys_seeded', 'true');
    onProgress?.("Sistema pronto para uso!");
    return { seeded: true };
  } catch (error: any) {
    return { seeded: false, error: error?.message || String(error) };
  }
}