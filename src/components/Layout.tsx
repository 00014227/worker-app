import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  FileText, Users, Package, Sparkles, LogOut,
  LayoutDashboard, Shield, User, Map, Database, Send, Building2, UserCog,
} from 'lucide-react';
import { getUser, clearAuth } from '../lib/auth';
import { Logo } from './Logo';

const nav = [
  { to: '/dashboard',     label: 'Дашборд',         icon: LayoutDashboard },
  { to: '/shipments',     label: 'Перевозки',        icon: Package },
  { to: '/map',           label: 'Карта',            icon: Map },
  { to: '/rate-requests', label: 'Запросы ставок',   icon: FileText },
  { to: '/contractors',   label: 'Подрядчики',       icon: Users },
  { to: '/customers',     label: 'Клиенты',          icon: Building2 },
  { to: '/telegram-accounts', label: 'Telegram',     icon: Send },
  { to: '/tariff-sources',label: 'Тарифы',            icon: Database },
  { to: '/ai-deal',       label: 'Сделка через ИИ',  icon: Sparkles },
];

/** Разделы только для администраторов. Права всё равно проверяет бэкенд —
    здесь просто не показываем то, чем сотрудник не сможет воспользоваться. */
const adminNav = [
  { to: '/employees',     label: 'Сотрудники',       icon: UserCog },
];

export default function Layout() {
  const navigate = useNavigate();
  const user = getUser();

  const handleLogout = () => {
    clearAuth();
    navigate('/login', { replace: true });
  };

  return (
    // Фон прозрачный — сквозь него виден фирменный градиент body
    <div className="flex min-h-screen">
      {/* Sidebar — фирменный синий */}
      <aside className="w-[220px] shrink-0 flex flex-col bg-[#0c3078] text-white">
        {/* Logo — надпись белая: фирменный синий на синем фоне нечитаем */}
        <div className="px-5 py-5 border-b border-white/10">
          <Logo className="w-full h-auto" textColor="#ffffff" />
          <div className="text-[10px] text-white/40 mt-2 leading-none tracking-wide">
            Кабинет сотрудника
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 px-2 space-y-0.5">
          {[...nav, ...(user?.isAdmin ? adminNav : [])].map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                [
                  'flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all',
                  isActive
                    ? 'bg-white/15 text-white shadow-sm'
                    : 'text-white/60 hover:text-white hover:bg-white/5',
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
                ? <Shield size={11} className="text-[#ef3f22]" />
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
