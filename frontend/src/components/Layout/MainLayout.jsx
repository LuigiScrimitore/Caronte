import { Outlet, NavLink } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore';
import { LayoutDashboard, Network, PlaySquare, FileText, Menu, Moon, Sun } from 'lucide-react';
import clsx from 'clsx';
import logoUrl from '../../assets/caronte_logo.png';

export default function MainLayout() {
  const { isSidebarOpen, toggleSidebar, theme, toggleTheme, activeProjectId, setActiveProjectId, projects } = useAppStore();

  const navItems = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/connections', icon: Network, label: 'Connections' },
    { to: '/jobs', icon: PlaySquare, label: 'Jobs' },
    { to: '/logs', icon: FileText, label: 'Logs' },
  ];

  return (
    <div className="flex h-screen overflow-hidden font-sans bg-gray-50 dark:bg-[#09090b] text-gray-900 dark:text-gray-200 transition-colors">
      
      {/* Sidebar */}
      <aside 
        className={clsx(
          "bg-white dark:bg-[#18181b] border-r border-gray-200 dark:border-[#27272a] transition-all duration-300 flex flex-col",
          isSidebarOpen ? "w-[240px]" : "w-[68px]"
        )}
      >
        <div className="h-14 flex items-center justify-between px-4 border-b border-gray-200 dark:border-[#27272a]">
          {isSidebarOpen && (
            <div className="flex items-center gap-2">
              <img src={logoUrl} alt="Caronte Logo" className="w-8 h-8 object-contain" />
              <span className="font-bold text-lg bg-clip-text text-transparent bg-gradient-to-r from-teal-500 to-teal-700">
                CARONTE
              </span>
            </div>
          )}
          <button onClick={toggleSidebar} className="text-gray-500 hover:text-teal-500">
            <Menu size={20} />
          </button>
        </div>
        
        <nav className="flex-1 py-4 flex flex-col gap-2 px-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => clsx(
                "flex items-center gap-3 px-3 py-2 rounded transition-all group relative",
                isActive 
                  ? "bg-teal-50 dark:bg-teal-500/20 text-teal-600 dark:text-teal-400 font-medium" 
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#27272a]"
              )}
            >
              <item.icon size={20} className={clsx("min-w-[20px]", { "text-teal-500": false })} />
              {isSidebarOpen && <span className="text-sm">{item.label}</span>}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="h-14 backdrop-blur-md bg-white/80 dark:bg-[#18181b]/80 border-b border-gray-200 dark:border-[#27272a] flex items-center justify-between px-6 shrink-0 z-10">
          <div className="flex items-center gap-4">
            <select
              value={activeProjectId}
              onChange={(e) => setActiveProjectId(e.target.value)}
              className="bg-transparent border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm outline-none focus:border-teal-500 transition-colors"
            >
              {projects.map(p => (
                <option key={p.id} value={p.id} className="dark:bg-[#18181b]">{p.name}</option>
              ))}
            </select>
          </div>
          
          <div className="flex items-center gap-4">
            <button onClick={toggleTheme} className="text-gray-500 hover:text-teal-500 transition-colors">
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <div className="w-8 h-8 rounded-full bg-teal-600 text-white flex items-center justify-center text-xs font-bold">
              US
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>

    </div>
  );
}
