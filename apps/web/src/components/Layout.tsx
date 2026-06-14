import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../lib/auth';

const nav = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/clientes', label: 'Carteira de MEIs' },
  { to: '/inbox', label: 'Inbox WhatsApp' },
  { to: '/emissoes', label: 'Emissões' },
  { to: '/serpro', label: 'SERPRO / DAS' },
  { to: '/planos', label: 'Planos & Mensalidades' },
  { to: '/equipe', label: 'Equipe' },
];

export default function Layout() {
  const { usuario, logout } = useAuth();

  return (
    <div className="min-h-screen flex">
      <aside className="w-60 bg-slate-900 text-slate-100 p-5 flex flex-col">
        <div className="text-xl font-bold mb-8">
          Atende<span className="text-brand">MEI</span>
        </div>
        <nav className="space-y-1 text-sm flex-1">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `block px-3 py-2 rounded-md ${
                  isActive ? 'bg-brand text-white' : 'text-slate-300 hover:bg-slate-800'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="text-xs text-slate-400 border-t border-slate-700 pt-4">
          <div className="font-medium text-slate-200">{usuario?.nome}</div>
          <div>{usuario?.role}</div>
          <button onClick={logout} className="mt-2 text-brand hover:underline">
            Sair
          </button>
        </div>
      </aside>

      <main className="flex-1 p-8 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
