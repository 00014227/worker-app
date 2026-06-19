import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Truck, FileText, Users, Package, Sparkles, LogOut,
  LayoutDashboard, Shield, User, Map, Tags,
} from 'lucide-react';
import { getUser, clearAuth } from '../lib/auth';

const nav = [
  { to: '/dashboard',     label: 'Дашборд',         icon: LayoutDashboard },
  { to: '/shipments',     label: 'Перевозки',        icon: Package },
  { to: '/map',           label: 'Карта',            icon: Map },
  { to: '/rate-requests', label: 'Запросы ставок',   icon: FileText },
  { to: '/contractors',   label: 'Подрядчики',       icon: Users },
  { to: '/tariffs',       label: 'Тарифы',           icon: Tags },
  { to: '/ai-deal',       label: 'Сделка через ИИ',  icon: Sparkles },
];

export default function Layout() {
  const navigate = useNavigate();
  const user = getUser();

  const handleLogout = () => {
    clearAuth();
    navigate('/login', { replace: true });
  };

  return (
    <div className="flex min-h-screen bg-[#f5f6fa]">
      {/* Sidebar */}
      <aside className="w-[220px] shrink-0 flex flex-col bg-[#131c27] text-white">
        {/* Logo */}
        <div className="px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-blue-500 flex items-center justify-center shrink-0">
              <Truck size={15} className="text-white" />
            </div>
            <div>
              <div className="font-bold text-sm leading-none">TransAsia</div>
              <div className="text-[10px] text-white/40 mt-0.5 leading-none">TMS</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 px-2 space-y-0.5">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                [
                  'flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all',
                  isActive
                    ? 'bg-blue-500 text-white shadow-sm'
                    : 'text-white/50 hover:text-white hover:bg-white/5',
                ].join(' ')
              }
            >
              <Icon size={14} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User */}
        <div className="p-3 border-t border-white/10">
          <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg bg-white/5 mb-2">
            <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center shrink-0">
              {user?.isAdmin
                ? <Shield size={11} className="text-blue-400" />
                : <User size={11} className="text-white/60" />
              }
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium truncate leading-none">{user?.name ?? ''}</p>
              <p className="text-[10px] text-white/40 mt-0.5 leading-none">
                {user?.isAdmin ? 'Администратор' : 'Сотрудник'}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-white/40 hover:text-white hover:bg-white/5 transition-all"
          >
            <LogOut size={12} />
            Выйти
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto p-6">
        <Outlet />
      </main>
    </div>
  );
}
