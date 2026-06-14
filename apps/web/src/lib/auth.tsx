import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api, tokenStore, Usuario } from './api';

interface AuthCtx {
  usuario: Usuario | null;
  carregando: boolean;
  login: (email: string, senha: string) => Promise<void>;
  logout: () => void;
}

const Ctx = createContext<AuthCtx>(null!);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!tokenStore.get()) {
      setCarregando(false);
      return;
    }
    api
      .get<Usuario>('/auth/me')
      .then(setUsuario)
      .catch(() => tokenStore.clear())
      .finally(() => setCarregando(false));
  }, []);

  async function login(email: string, senha: string) {
    const res = await api.post<{ access_token: string; usuario: Usuario }>(
      '/auth/login',
      { email, senha },
    );
    tokenStore.set(res.access_token);
    setUsuario(res.usuario);
  }

  function logout() {
    tokenStore.clear();
    setUsuario(null);
    location.href = '/login';
  }

  return (
    <Ctx.Provider value={{ usuario, carregando, login, logout }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
