import { useState, useEffect, useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';

// Register AG Grid modules
ModuleRegistry.registerModules([AllCommunityModule]);

export default function LogsFeature() {
  const { activeProjectId, theme } = useAppStore();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchLogs = async () => {
    if (!activeProjectId) return;
    setLoading(true);
    try {
      const res = await fetch('http://localhost:8000/api/v1/logs', {
        headers: { 'X-Project-ID': activeProjectId }
      });
      if (!res.ok) throw new Error('Failed to fetch logs');
      setLogs(await res.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [activeProjectId]);

  const handleCancelJob = async (logId) => {
    if (!window.confirm("Sei sicuro di voler fermare questo job?")) return;
    try {
      const res = await fetch(`http://localhost:8000/api/v1/logs/${logId}/cancel`, {
        method: 'POST',
        headers: { 'X-Project-ID': activeProjectId }
      });
      if (!res.ok) throw new Error('Errore durante la cancellazione del job');
      fetchLogs();
    } catch (err) {
      setError(err.message);
    }
  };

  const columnDefs = useMemo(() => [
    { field: 'id', headerName: 'Log ID', width: 100 },
    { field: 'job_id', headerName: 'Job ID', width: 100 },
    { field: 'data_inizio', headerName: 'Data Inizio', flex: 1, valueFormatter: (p) => new Date(p.value).toLocaleString() },
    { field: 'data_fine', headerName: 'Data Fine', flex: 1, valueFormatter: (p) => p.value ? new Date(p.value).toLocaleString() : '-' },
    { field: 'righe_estratte', headerName: 'Righe', width: 120 },
    { 
      field: 'esito', 
      headerName: 'Esito', 
      width: 200,
      cellRenderer: (params) => {
        if(params.value === 'SUCCESS') return <span className="text-green-600 dark:text-green-400 font-bold">SUCCESS</span>;
        if(params.value === 'ERROR') return <span className="text-red-600 dark:text-red-400 font-bold">ERROR</span>;
        if(params.value === 'CANCELLED') return <span className="text-gray-500 font-bold flex items-center h-full">CANCELLED</span>;
        
        if(params.value === 'IN_PROGRESS') {
          return (
            <div className="flex items-center justify-between h-full">
              <span className="text-blue-600 dark:text-blue-400 font-bold animate-pulse">IN_PROGRESS</span>
              <button 
                onClick={() => handleCancelJob(params.data.id)}
                className="bg-red-500 hover:bg-red-600 text-white text-xs px-2 py-1 rounded transition-colors"
                title="Ferma forzatamente"
              >
                Ferma 🛑
              </button>
            </div>
          );
        }
        
        return <span className="text-yellow-600 dark:text-yellow-400 font-bold flex items-center h-full">{params.value}</span>;
      }
    },
    { field: 'messaggio_errore', headerName: 'Dettaglio Errore', flex: 2 }
  ], []);

  const defaultColDef = useMemo(() => ({
    sortable: true,
    filter: true,
    resizable: true
  }), []);

  return (
    <div className="flex flex-col gap-6 h-full">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold dark:text-white">Log di Esecuzione</h1>
          <p className="text-sm text-gray-500 mt-1">Storico delle estrazioni per il progetto {activeProjectId}</p>
        </div>
        <button onClick={fetchLogs} className="px-3 py-1.5 rounded flex items-center gap-2 text-xs font-bold transition-all border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-[#27272a]">
          <RefreshCw size={16} /> Aggiorna
        </button>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 p-4 rounded flex items-center gap-3 text-sm">
          <AlertCircle size={20} /> {error}
        </div>
      )}

      <div className="flex-1 bg-white dark:bg-[#18181b] border border-gray-200 dark:border-[#27272a] rounded overflow-hidden">
        <div className={theme === 'dark' ? "ag-theme-quartz-dark h-full w-full" : "ag-theme-quartz h-full w-full"} style={{ height: '100%', width: '100%' }}>
          <AgGridReact
            rowData={logs}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            pagination={true}
            paginationPageSize={50}
            overlayLoadingTemplate={'<span class="ag-overlay-loading-center">Caricamento log in corso...</span>'}
            overlayNoRowsTemplate={'<span class="ag-overlay-loading-center">Nessun log trovato.</span>'}
          />
        </div>
      </div>
    </div>
  );
}
