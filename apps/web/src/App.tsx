import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Clientes from './pages/Clientes';
import ClienteDetalhe from './pages/ClienteDetalhe';
import EmBreve from './pages/EmBreve';

function Protegido({ children }: { children: JSX.Element }) {
  const { usuario, carregando } = useAuth();
  if (carregando) {
    return <div className="min-h-screen flex items-center justify-center text-slate-400">Carregando…</div>;
  }
  return usuario ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            element={
              <Protegido>
                <Layout />
              </Protegido>
            }
          >
            <Route path="/" element={<Dashboard />} />
            <Route path="/clientes" element={<Clientes />} />
            <Route path="/clientes/:id" element={<ClienteDetalhe />} />
            <Route path="/inbox" element={<EmBreve titulo="Inbox WhatsApp" etapa="etapa 6" />} />
            <Route path="/emissoes" element={<EmBreve titulo="Emissões" etapa="etapa 4" />} />
            <Route path="/planos" element={<EmBreve titulo="Planos & Mensalidades" etapa="etapa 5" />} />
            <Route path="/equipe" element={<EmBreve titulo="Equipe" etapa="etapa 2 (API pronta)" />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
