import { useState, useEffect } from 'react';
import { Play, Plus, Trash2, RefreshCw, AlertCircle, ToggleLeft, ToggleRight, Calendar, Edit2, Upload, Download, Search, ChevronDown, ChevronRight, Server } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

export default function JobsFeature() {
  const [jobs, setJobs] = useState([]);
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { activeProjectId } = useAppStore();

  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedGroups, setExpandedGroups] = useState({});
  
  // Scheduling State
  const [schedType, setSchedType] = useState('manual');
  const [schedTime, setSchedTime] = useState('00:00');
  const [schedDate, setSchedDate] = useState('');
  const [schedDayOfWeek, setSchedDayOfWeek] = useState('mon');
  const [schedDayOfMonth, setSchedDayOfMonth] = useState('1');

  const [formData, setFormData] = useState({
    name: '', source_connection_id: '', destination_connection_id: '',
    tabella_sorgente: '', tipo: 'Full', col_watermark: '', query_base: 'SELECT * FROM ', is_active: true, chunk_size: 50000
  });

  const fetchData = async () => {
    if (!activeProjectId) return;
    setLoading(true);
    try {
      const [resJobs, resConn] = await Promise.all([
        fetch('http://localhost:8000/api/v1/jobs', { headers: { 'X-Project-ID': activeProjectId } }),
        fetch('http://localhost:8000/api/v1/connections', { headers: { 'X-Project-ID': activeProjectId } })
      ]);
      if (!resJobs.ok || !resConn.ok) throw new Error('Failed to fetch data');
      setJobs(await resJobs.json());
      setConnections(await resConn.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeProjectId]);

  const handleRunNow = async (jobId) => {
    try {
      const res = await fetch(`http://localhost:8000/api/v1/jobs/${jobId}/run`, { 
        method: 'POST',
        headers: { 'X-Project-ID': activeProjectId }
      });
      if (!res.ok) throw new Error('Failed to run job');
      alert(`Job ${jobId} avviato in background!`);
    } catch (err) {
      alert(`Errore esecuzione: ${err.message}`);
    }
  };

  const handleDelete = async (id) => {
    if(!confirm("Sicuro di eliminare questo job?")) return;
    try {
      await fetch(`http://localhost:8000/api/v1/jobs/${id}`, { 
        method: 'DELETE',
        headers: { 'X-Project-ID': activeProjectId }
      });
      fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleToggleActive = async (job) => {
    try {
      const res = await fetch(`http://localhost:8000/api/v1/jobs/${job.id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'X-Project-ID': activeProjectId 
        },
        body: JSON.stringify({
          ...job,
          is_active: !job.is_active
        })
      });
      if (!res.ok) throw new Error('Errore durante il cambio di stato del job');
      fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleEdit = (job) => {
    setEditId(job.id);
    setFormData({
      name: job.name, source_connection_id: job.source_connection_id || '', destination_connection_id: job.destination_connection_id || '',
      tabella_sorgente: job.tabella_sorgente, tipo: job.tipo, col_watermark: job.col_watermark || '', query_base: job.query_base, is_active: job.is_active, chunk_size: job.chunk_size || 50000
    });
    
    if (!job.cron) {
      setSchedType('manual');
    } else {
      try {
        const data = JSON.parse(job.cron);
        if (data.type === 'date') {
          setSchedType('once');
          setSchedDate(data.run_date);
        } else if (data.type === 'cron') {
          const k = data.kwargs;
          const time = `${String(k.hour).padStart(2, '0')}:${String(k.minute).padStart(2, '0')}`;
          setSchedTime(time);
          if (k.day) {
            setSchedType('monthly');
            setSchedDayOfMonth(k.day);
          } else if (k.day_of_week) {
            setSchedType('weekly');
            setSchedDayOfWeek(k.day_of_week);
          } else {
            setSchedType('daily');
          }
        }
      } catch (e) {
        setSchedType('manual');
      }
    }
    setShowModal(true);
  };

  const buildCronPayload = () => {
    if (schedType === 'manual') return null;
    if (schedType === 'once') {
      if (!schedDate) throw new Error("Seleziona una data per l'esecuzione una tantum.");
      return JSON.stringify({ type: 'date', run_date: schedDate });
    }
    
    const [hour, minute] = schedTime.split(':');
    const kwargs = { hour: parseInt(hour), minute: parseInt(minute) };
    
    if (schedType === 'weekly') {
      kwargs.day_of_week = schedDayOfWeek;
    } else if (schedType === 'monthly') {
      kwargs.day = schedDayOfMonth;
    }
    
    return JSON.stringify({ type: 'cron', kwargs });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      const cronPayload = buildCronPayload();
      
      const url = editId ? `http://localhost:8000/api/v1/jobs/${editId}` : 'http://localhost:8000/api/v1/jobs';
      const method = editId ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          'X-Project-ID': activeProjectId
        },
        body: JSON.stringify({
          ...formData,
          source_connection_id: formData.source_connection_id ? parseInt(formData.source_connection_id) : null,
          destination_connection_id: formData.destination_connection_id ? parseInt(formData.destination_connection_id) : null,
          chunk_size: formData.chunk_size ? parseInt(formData.chunk_size) : 50000,
          cron: cronPayload
        })
      });
      if (!res.ok) throw new Error(await res.text());
      setShowModal(false);
      fetchData();
    } catch (err) {
      alert(`Errore salvataggio: ${err.message}`);
    }
  };

  const formatCronDisplay = (cronStr) => {
    if (!cronStr) return 'Manuale';
    try {
      const data = JSON.parse(cronStr);
      if (data.type === 'date') return `Una tantum: ${new Date(data.run_date).toLocaleString()}`;
      if (data.type === 'cron') {
        const k = data.kwargs;
        const time = `${String(k.hour).padStart(2, '0')}:${String(k.minute).padStart(2, '0')}`;
        if (k.day) return `Mensile: Giorno ${k.day} alle ${time}`;
        if (k.day_of_week) return `Settimanale: ${k.day_of_week.toUpperCase()} alle ${time}`;
        return `Giornaliero alle ${time}`;
      }
    } catch (e) {
      return cronStr; // Fallback to raw string if not JSON
    }
    return cronStr;
  };

  const getConnectionName = (id) => {
    if (!id) return <span className="text-red-500 font-bold">Nessuna Connessione</span>;
    const conn = connections.find(c => c.id === id);
    return conn ? `${conn.name} (ID: ${id})` : <span className="text-red-500">ID: ${id} (Non Trovata)</span>;
  };

  const downloadTemplate = () => {
    // Genera un CSV semplice (compatibile con Excel se aperto correttamente)
    // o un vero XLSX base64 se preferito, ma il CSV è più semplice in Javascript puro.
    // L'API backend legge con pd.read_excel, quindi aspetta un .xlsx
    // Generare XLSX puro in JS richiede librerie (es. xlsx). Creiamo un template minimal
    // in array buffer usando window.open se avessimo un file statico, altrimenti
    // generiamo un CSV e avvisiamo. Per semplicità, chiederò all'utente di creare lui il file.
    alert("Crea un file Excel (.xlsx) con queste colonne nella prima riga:\n- Tabella\n- Sorgente\n- Destinazione\n- Chunk (opzionale, default 50000)");
  };

  const handleUploadExcel = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setLoading(true);
    const formData = new FormData();
    formData.append("file", file);
    
    try {
      const res = await fetch('http://localhost:8000/api/v1/jobs/upload', {
        method: 'POST',
        headers: { 'X-Project-ID': activeProjectId },
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Errore upload');
      alert(data.message);
      fetchData();
    } catch (err) {
      alert(`Errore: ${err.message}`);
      setLoading(false);
    }
    
    // reset input
    e.target.value = null;
  };

  // Funzioni helper per Raggruppamento e Ricerca
  const getRawConnectionName = (id) => {
    if (!id) return "Nessuna Connessione";
    const conn = connections.find(c => c.id === id);
    return conn ? conn.name : `ID: ${id}`;
  };

  const toggleGroup = (groupName) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupName]: !prev[groupName]
    }));
  };

  const filteredJobs = jobs.filter(job => {
    if (!searchTerm) return true;
    const destName = getRawConnectionName(job.destination_connection_id);
    const text = `${job.name} ${job.tabella_sorgente} ${job.tipo} ${destName}`.toLowerCase();
    return text.includes(searchTerm.toLowerCase());
  });

  const groupedJobs = {};
  filteredJobs.forEach(job => {
    const groupName = getRawConnectionName(job.source_connection_id);
    if (!groupedJobs[groupName]) {
      groupedJobs[groupName] = [];
      // Se vogliamo che di default siano aperti (prima volta), potremmo farlo. Ma lasciamo l'utente decidere.
      // Se c'è un solo gruppo, lo apriamo di default.
    }
    groupedJobs[groupName].push(job);
  });
  
  // Apri automaticamente il gruppo se ce n'è solo uno
  useEffect(() => {
    const keys = Object.keys(groupedJobs);
    if (keys.length === 1 && expandedGroups[keys[0]] === undefined) {
      setExpandedGroups({ [keys[0]]: true });
    }
  }, [groupedJobs]);

  return (
    <div className="flex flex-col gap-6 h-full relative">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-[#18181b] p-4 rounded-lg border border-gray-200 dark:border-[#27272a] shadow-sm">
        <div className="flex-1 w-full md:max-w-md">
          <div className="flex items-center gap-2 bg-gray-100 dark:bg-[#27272a] px-3 py-2.5 rounded-lg border border-transparent focus-within:border-teal-500 transition-colors">
            <Search size={18} className="text-gray-400" />
            <input 
              type="text" 
              placeholder="Cerca job, tabella o destinazione..." 
              className="bg-transparent border-none outline-none text-sm w-full font-medium"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <input type="file" id="excel-upload" accept=".xlsx" className="hidden" onChange={handleUploadExcel} />
          
          <button onClick={downloadTemplate} className="px-3 py-2 rounded flex items-center gap-2 text-xs font-bold transition-all border border-teal-300 text-teal-700 dark:border-teal-700 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/30">
            <Download size={16} /> Template
          </button>
          
          <button onClick={() => document.getElementById('excel-upload').click()} className="px-3 py-2 rounded flex items-center gap-2 text-xs font-bold transition-all bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300 hover:bg-teal-200 dark:hover:bg-teal-800/60">
            <Upload size={16} /> Importa Excel
          </button>
          
          <div className="w-px h-8 bg-gray-200 dark:bg-gray-700 mx-2 hidden md:block"></div>
          
          <button onClick={fetchData} className="px-3 py-2 rounded flex items-center gap-2 text-xs font-bold transition-all border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-[#27272a]">
            <RefreshCw size={16} />
          </button>
          <button onClick={() => {
            setEditId(null);
            setFormData({
              name: '', source_connection_id: '', destination_connection_id: '',
              tabella_sorgente: '', tipo: 'Full', col_watermark: '', query_base: 'SELECT * FROM ', is_active: true, chunk_size: 50000
            });
            setSchedType('manual');
            setShowModal(true);
          }} className="px-4 py-2 rounded flex items-center gap-2 text-xs font-bold transition-all bg-teal-600 hover:bg-teal-500 text-white shadow-lg shadow-teal-500/20">
            <Plus size={16} /> Nuovo Job
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 p-4 rounded-lg flex items-center gap-3 text-sm shadow-sm">
          <AlertCircle size={20} /> {error}
        </div>
      )}

      <div className="flex-1 overflow-auto flex flex-col gap-4 pb-4">
        {loading ? (
          <div className="p-8 text-center text-gray-500 bg-white dark:bg-[#18181b] rounded-lg border border-gray-200 dark:border-[#27272a]">
            <RefreshCw className="animate-spin inline-block mr-2" size={18} /> Caricamento in corso...
          </div>
        ) : Object.keys(groupedJobs).length === 0 ? (
          <div className="p-12 text-center text-gray-500 bg-white dark:bg-[#18181b] rounded-lg border border-gray-200 dark:border-[#27272a] shadow-sm flex flex-col items-center gap-4">
            <Server size={48} className="text-gray-300 dark:text-gray-700" />
            <div>
              <p className="font-bold text-lg text-gray-700 dark:text-gray-300">Nessun Job trovato</p>
              <p className="text-sm mt-1">Crea un nuovo job o cambia i filtri di ricerca.</p>
            </div>
          </div>
        ) : (
          Object.entries(groupedJobs).map(([groupName, groupJobs]) => (
            <div key={groupName} className="bg-white dark:bg-[#18181b] rounded-xl border border-gray-200 dark:border-[#27272a] overflow-hidden shadow-sm transition-all duration-300">
              
              {/* HEADER SOFFIETTO */}
              <div 
                className="flex items-center justify-between p-4 bg-gray-50/80 dark:bg-[#27272a]/30 cursor-pointer hover:bg-gray-100 dark:hover:bg-[#27272a]/80 transition-colors"
                onClick={() => toggleGroup(groupName)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-6 flex justify-center text-gray-400">
                    {expandedGroups[groupName] ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                  </div>
                  <div className="p-2 bg-teal-100 dark:bg-teal-900/40 rounded-lg text-teal-600 dark:text-teal-400">
                    <Server size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800 dark:text-gray-100">{groupName}</h3>
                    <p className="text-xs text-gray-500 font-medium">Sorgente Dati</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs px-2.5 py-1 rounded-full bg-gray-200 dark:bg-[#3f3f46] text-gray-700 dark:text-gray-300 font-bold border border-gray-300 dark:border-gray-600 shadow-sm">
                    {groupJobs.length} Job{groupJobs.length !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
              
              {/* BODY SOFFIETTO */}
              {expandedGroups[groupName] && (
                <div className="border-t border-gray-200 dark:border-[#27272a] overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-white dark:bg-[#18181b] border-b border-gray-100 dark:border-gray-800">
                      <tr>
                        <th className="px-5 py-3 font-medium text-gray-500 whitespace-nowrap">Nome Job</th>
                        <th className="px-5 py-3 font-medium text-gray-500 whitespace-nowrap">Tabella</th>
                        <th className="px-5 py-3 font-medium text-gray-500 whitespace-nowrap">Destinazione</th>
                        <th className="px-5 py-3 font-medium text-gray-500 whitespace-nowrap">Tipo</th>
                        <th className="px-5 py-3 font-medium text-gray-500 whitespace-nowrap">Schedulazione</th>
                        <th className="px-5 py-3 font-medium text-gray-500 whitespace-nowrap text-center">Attivo</th>
                        <th className="px-5 py-3 font-medium text-gray-500 whitespace-nowrap text-right">Azioni</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
                      {groupJobs.map(job => (
                        <tr key={job.id} className="hover:bg-blue-50/30 dark:hover:bg-[#27272a]/40 transition-colors group">
                          <td className="px-5 py-3 font-bold text-gray-800 dark:text-gray-200">{job.name}</td>
                          <td className="px-5 py-3 text-xs text-gray-600 dark:text-gray-400 font-mono bg-gray-50/50 dark:bg-black/20 rounded m-1">{job.tabella_sorgente}</td>
                          <td className="px-5 py-3 text-xs font-medium text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-teal-500 inline-block"></span>
                            {getConnectionName(job.destination_connection_id)}
                          </td>
                          <td className="px-5 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${job.tipo==='Full' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800' : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800'}`}>
                              {job.tipo}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-xs text-teal-600 dark:text-teal-400 font-medium">
                            {formatCronDisplay(job.cron)}
                          </td>
                          <td className="px-5 py-3 text-center">
                            <button 
                              onClick={() => handleToggleActive(job)} 
                              className="focus:outline-none hover:scale-110 transition-transform"
                              title={job.is_active ? "Disattiva Schedulazione" : "Attiva Schedulazione"}
                            >
                              {job.is_active ? <ToggleRight size={24} className="text-teal-500" /> : <ToggleLeft size={24} className="text-gray-400" />}
                            </button>
                          </td>
                          <td className="px-5 py-3 text-right">
                            <div className="flex justify-end gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                              <button 
                                onClick={() => handleRunNow(job.id)} 
                                disabled={!job.source_connection_id || !job.destination_connection_id}
                                className={`p-1.5 rounded-md transition-colors ${(!job.source_connection_id || !job.destination_connection_id) ? 'text-gray-300 dark:text-gray-700 cursor-not-allowed' : 'text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-500/10 hover:bg-teal-100 dark:hover:bg-teal-500/20'}`} 
                                title={(!job.source_connection_id || !job.destination_connection_id) ? 'Connessioni Mancanti' : 'Esegui Ora'}
                              >
                                <Play size={16} />
                              </button>
                              <button onClick={() => handleEdit(job)} className="p-1.5 rounded-md text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors">
                                <Edit2 size={16} />
                              </button>
                              <button onClick={() => handleDelete(job.id)} className="p-1.5 rounded-md text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors">
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#18181b] border border-gray-200 dark:border-[#27272a] rounded-lg shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-[#27272a]">
              <h2 className="text-lg font-bold">{editId ? 'Modifica Job' : 'Nuovo Job'}</h2>
            </div>
            <div className="p-6 overflow-auto">
              <form id="job-form" onSubmit={handleSave} className="flex flex-col gap-6 text-sm">
                
                {/* --- SEZIONE 1: DATI BASE --- */}
                <div className="bg-gray-50 dark:bg-[#27272a]/30 p-4 rounded-lg border border-gray-200 dark:border-[#27272a] flex flex-col gap-4">
                  <h3 className="font-bold text-gray-700 dark:text-gray-300">1. Dati Base</h3>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Nome Job</label>
                    <input required value={formData.name} onChange={e=>setFormData({...formData, name: e.target.value})} className="w-full bg-white dark:bg-[#18181b] border border-gray-300 dark:border-gray-700 rounded px-3 py-2 outline-none focus:border-teal-500" />
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="block text-xs font-bold text-gray-500 mb-1">Sorgente (Oracle)</label>
                      <select required value={formData.source_connection_id} onChange={e=>setFormData({...formData, source_connection_id: e.target.value})} className="w-full bg-white dark:bg-[#18181b] border border-gray-300 dark:border-gray-700 rounded px-3 py-2 outline-none focus:border-teal-500">
                        <option value="">Seleziona...</option>
                        {connections.filter(c => c.tipo === 'oracle').map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs font-bold text-gray-500 mb-1">Destinazione</label>
                      <select required value={formData.destination_connection_id} onChange={e=>setFormData({...formData, destination_connection_id: e.target.value})} className="w-full bg-white dark:bg-[#18181b] border border-gray-300 dark:border-gray-700 rounded px-3 py-2 outline-none focus:border-teal-500">
                        <option value="">Seleziona...</option>
                        {connections.filter(c => c.tipo !== 'oracle').map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="block text-xs font-bold text-gray-500 mb-1">Tipo Estrazione</label>
                      <select required value={formData.tipo} onChange={e=>setFormData({...formData, tipo: e.target.value})} className="w-full bg-white dark:bg-[#18181b] border border-gray-300 dark:border-gray-700 rounded px-3 py-2 outline-none focus:border-teal-500">
                        <option value="Full">Full</option>
                        <option value="Delta">Delta (Incrementale)</option>
                      </select>
                    </div>
                    {formData.tipo === 'Delta' && (
                      <div className="flex-1">
                        <label className="block text-xs font-bold text-gray-500 mb-1">Colonna Watermark</label>
                        <input required value={formData.col_watermark} onChange={e=>setFormData({...formData, col_watermark: e.target.value})} className="w-full bg-white dark:bg-[#18181b] border border-gray-300 dark:border-gray-700 rounded px-3 py-2 outline-none focus:border-teal-500" placeholder="es. DATA_MODIFICA" />
                      </div>
                    )}
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="block text-xs font-bold text-gray-500 mb-1">Tabella Sorgente</label>
                      <input required value={formData.tabella_sorgente} onChange={e=>setFormData({...formData, tabella_sorgente: e.target.value})} className="w-full bg-white dark:bg-[#18181b] border border-gray-300 dark:border-gray-700 rounded px-3 py-2 outline-none focus:border-teal-500" />
                    </div>
                    <div className="w-32">
                      <label className="block text-xs font-bold text-gray-500 mb-1" title="Dimensione blocco righe RAM">Chunk Size</label>
                      <input type="number" required value={formData.chunk_size} onChange={e=>setFormData({...formData, chunk_size: e.target.value})} className="w-full bg-white dark:bg-[#18181b] border border-gray-300 dark:border-gray-700 rounded px-3 py-2 outline-none focus:border-teal-500" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Query Base</label>
                    <textarea required value={formData.query_base} onChange={e=>setFormData({...formData, query_base: e.target.value})} className="w-full bg-white dark:bg-[#18181b] border border-gray-300 dark:border-gray-700 rounded px-3 py-2 outline-none focus:border-teal-500 h-20 font-mono text-xs" />
                  </div>
                </div>

                {/* --- SEZIONE 2: SCHEDULAZIONE --- */}
                <div className="bg-teal-50 dark:bg-teal-900/10 p-4 rounded-lg border border-teal-200 dark:border-teal-800/50 flex flex-col gap-4">
                  <h3 className="font-bold text-teal-800 dark:text-teal-400 flex items-center gap-2">
                    <Calendar size={18} /> 2. Schedulazione Automatica
                  </h3>
                  
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Frequenza</label>
                    <select value={schedType} onChange={e => setSchedType(e.target.value)} className="w-full bg-white dark:bg-[#18181b] border border-gray-300 dark:border-gray-700 rounded px-3 py-2 outline-none focus:border-teal-500 font-bold text-teal-700 dark:text-teal-400">
                      <option value="manual">Nessuna (Esecuzione Manuale)</option>
                      <option value="once">Una Tantum (Data e Ora precisa)</option>
                      <option value="daily">Giornaliera</option>
                      <option value="weekly">Settimanale</option>
                      <option value="monthly">Mensile</option>
                    </select>
                  </div>

                  {schedType === 'once' && (
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1">Data e Ora di Esecuzione</label>
                      <input type="datetime-local" value={schedDate} onChange={e => setSchedDate(e.target.value)} className="w-full bg-white dark:bg-[#18181b] border border-gray-300 dark:border-gray-700 rounded px-3 py-2 outline-none focus:border-teal-500" />
                    </div>
                  )}

                  {['daily', 'weekly', 'monthly'].includes(schedType) && (
                    <div className="flex gap-4">
                      {schedType === 'weekly' && (
                        <div className="flex-1">
                          <label className="block text-xs font-bold text-gray-500 mb-1">Giorno della Settimana</label>
                          <select value={schedDayOfWeek} onChange={e => setSchedDayOfWeek(e.target.value)} className="w-full bg-white dark:bg-[#18181b] border border-gray-300 dark:border-gray-700 rounded px-3 py-2 outline-none focus:border-teal-500">
                            <option value="mon">Lunedì</option>
                            <option value="tue">Martedì</option>
                            <option value="wed">Mercoledì</option>
                            <option value="thu">Giovedì</option>
                            <option value="fri">Venerdì</option>
                            <option value="sat">Sabato</option>
                            <option value="sun">Domenica</option>
                          </select>
                        </div>
                      )}

                      {schedType === 'monthly' && (
                        <div className="flex-1">
                          <label className="block text-xs font-bold text-gray-500 mb-1">Giorno del Mese</label>
                          <input type="text" value={schedDayOfMonth} onChange={e => setSchedDayOfMonth(e.target.value)} placeholder="es. 15, last, 1st sun" className="w-full bg-white dark:bg-[#18181b] border border-gray-300 dark:border-gray-700 rounded px-3 py-2 outline-none focus:border-teal-500" />
                          <p className="text-[10px] text-gray-400 mt-1">Puoi usare numeri (1-31) o costrutti (es. "1st sun" = Prima domenica)</p>
                        </div>
                      )}

                      <div className="w-32">
                        <label className="block text-xs font-bold text-gray-500 mb-1">Orario</label>
                        <input type="time" value={schedTime} onChange={e => setSchedTime(e.target.value)} className="w-full bg-white dark:bg-[#18181b] border border-gray-300 dark:border-gray-700 rounded px-3 py-2 outline-none focus:border-teal-500" />
                      </div>
                    </div>
                  )}
                  
                </div>
              </form>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 dark:border-[#27272a] flex justify-end gap-3 bg-gray-50 dark:bg-[#18181b] rounded-b-lg">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 rounded text-sm font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-[#27272a] transition-colors">Annulla</button>
              <button form="job-form" type="submit" className="px-4 py-2 rounded text-sm font-bold text-white bg-teal-600 hover:bg-teal-500 transition-colors">Salva Job e Schedula</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
