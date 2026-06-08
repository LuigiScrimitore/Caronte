import { useState, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { Network, PlaySquare, Activity, CheckCircle2, XCircle, RefreshCw, AlertCircle } from 'lucide-react';

export default function DashboardFeature() {
  const { activeProjectId } = useAppStore();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStats = async () => {
    if (!activeProjectId) return;
    setLoading(true);
    try {
      const res = await fetch('http://localhost:8000/api/v1/dashboard/stats');
      if (!res.ok) throw new Error('Failed to fetch dashboard stats');
      setStats(await res.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [activeProjectId]);

  return (
    <div className="flex flex-col gap-6 h-full">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold dark:text-white">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Panoramica del progetto {activeProjectId}</p>
        </div>
        <button onClick={fetchStats} className="px-3 py-1.5 rounded flex items-center gap-2 text-xs font-bold transition-all border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-[#27272a]">
          <RefreshCw size={16} /> Aggiorna
        </button>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 p-4 rounded flex items-center gap-3 text-sm">
          <AlertCircle size={20} /> {error}
        </div>
      )}

      {loading && !stats ? (
        <div className="flex-1 flex items-center justify-center text-gray-500">Caricamento metriche...</div>
      ) : stats ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard title="Connessioni Totali" value={stats.total_connections} icon={Network} color="text-blue-500" bg="bg-blue-50 dark:bg-blue-500/10" />
          <StatCard title="Job Configurati" value={stats.total_jobs} icon={PlaySquare} color="text-indigo-500" bg="bg-indigo-50 dark:bg-indigo-500/10" />
          <StatCard title="Job Attivi (Cron)" value={stats.active_jobs} icon={Activity} color="text-teal-500" bg="bg-teal-50 dark:bg-teal-500/10" />
          <StatCard title="Esecuzioni 24h" value={stats.last_24h_runs} icon={Activity} color="text-purple-500" bg="bg-purple-50 dark:bg-purple-500/10" />
          
          <div className="col-span-1 md:col-span-2 lg:col-span-2 bg-white dark:bg-[#18181b] border border-gray-200 dark:border-[#27272a] p-6 rounded flex items-center gap-6">
            <div className="flex-1">
              <h3 className="text-sm font-bold text-gray-500 mb-4">Success Rate (Ultime 24h)</h3>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="text-green-500" size={32} />
                  <div>
                    <div className="text-2xl font-bold dark:text-white">{stats.success_runs}</div>
                    <div className="text-xs text-gray-500">Completati</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <XCircle className="text-red-500" size={32} />
                  <div>
                    <div className="text-2xl font-bold dark:text-white">{stats.error_runs}</div>
                    <div className="text-xs text-gray-500">Falliti</div>
                  </div>
                </div>
              </div>
            </div>
            {stats.last_24h_runs > 0 && (
              <div className="w-32 h-32 rounded-full border-[16px] border-green-500 relative flex items-center justify-center">
                 <div className="absolute inset-[-16px] rounded-full border-[16px] border-red-500" style={{ clipPath: `polygon(0 0, 100% 0, 100% ${(stats.error_runs/stats.last_24h_runs)*100}%, 0 ${(stats.error_runs/stats.last_24h_runs)*100}%)` }}></div>
                 <span className="font-bold text-xl dark:text-white relative z-10">{Math.round((stats.success_runs/stats.last_24h_runs)*100)}%</span>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color, bg }) {
  return (
    <div className="bg-white dark:bg-[#18181b] border border-gray-200 dark:border-[#27272a] p-6 rounded flex items-start justify-between">
      <div>
        <h3 className="text-sm font-bold text-gray-500 mb-1">{title}</h3>
        <p className="text-3xl font-bold dark:text-white">{value}</p>
      </div>
      <div className={`p-3 rounded-lg ${bg} ${color}`}>
        <Icon size={24} />
      </div>
    </div>
  );
}
