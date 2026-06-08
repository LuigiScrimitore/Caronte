import { useState, useEffect } from 'react';
import { Network, Plus, Trash2, RefreshCw, AlertCircle, Edit2 } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

export default function ConnectionsFeature() {
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { activeProjectId } = useAppStore();

  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [testStatus, setTestStatus] = useState(null);
  const [testMessage, setTestMessage] = useState('');
  
  const [sftpAuthType, setSftpAuthType] = useState('password'); // 'password' | 'key'
  
  const [formData, setFormData] = useState({
    name: '', tipo: 'oracle', host: '', port: '1521', service_sid_path: '', user: '', pwd: ''
  });

  const handleTipoChange = (e) => {
    const tipo = e.target.value;
    let port = '';
    if (tipo === 'oracle') port = '1521';
    else if (tipo === 'ftp') port = '21';
    else if (tipo === 'sftp') port = '22';
    
    setFormData({...formData, tipo, port});
  };

  const handleEdit = (c) => {
    setEditId(c.id);
    setFormData({
      name: c.name, tipo: c.tipo, host: c.host, port: c.port || '', service_sid_path: c.service_sid_path || '', user: c.user || '', pwd: c.pwd || ''
    });
    
    if (c.tipo === 'sftp' && c.pwd && c.pwd.includes('-----BEGIN')) {
      setSftpAuthType('key');
    } else {
      setSftpAuthType('password');
    }
    
    setTestStatus(null);
    setTestMessage('');
    setShowModal(true);
  };

  const fetchConnections = async () => {
    if (!activeProjectId) return;
    setLoading(true);
    try {
      const res = await fetch('http://localhost:8000/api/v1/connections');
      if (!res.ok) throw new Error('Failed to fetch connections');
      const data = await res.json();
      setConnections(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConnections();
  }, [activeProjectId]);

  const handleDelete = async (id) => {
    if(!confirm("Sei sicuro di eliminare questa connessione?")) return;
    try {
      const res = await fetch(`http://localhost:8000/api/v1/connections/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await res.text());
      fetchConnections();
    } catch (err) {
      alert(`Errore eliminazione: ${err.message}`);
    }
  }

  const handleTest = async () => {
    setTestStatus('testing');
    setTestMessage('Test in corso...');
    try {
      const res = await fetch('http://localhost:8000/api/v1/connections/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          port: formData.port ? parseInt(formData.port) : null
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Errore di connessione');
      setTestStatus('success');
      setTestMessage(data.message);
    } catch (err) {
      setTestStatus('error');
      setTestMessage(err.message);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      const url = editId ? `http://localhost:8000/api/v1/connections/${editId}` : 'http://localhost:8000/api/v1/connections';
      const method = editId ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          port: formData.port ? parseInt(formData.port) : null
        })
      });
      if (!res.ok) throw new Error(await res.text());
      setShowModal(false);
      fetchConnections();
    } catch (err) {
      alert(`Errore salvataggio: ${err.message}`);
    }
  }

  // Helper for dynamic labels
  const getHostLabel = () => {
    if (formData.tipo === 'azure') return 'Account URL / Storage Account Name';
    return 'Host IP / Domain';
  };
  
  const getServiceLabel = () => {
    if (formData.tipo === 'oracle') return 'SID / Service Name';
    if (formData.tipo === 'azure') return 'Container Name';
    return 'Remote Base Path (Opzionale)';
  };

  const getPasswordLabel = () => {
    if (formData.tipo === 'azure') return 'Connection String';
    if (formData.tipo === 'sftp' && sftpAuthType === 'key') return 'Private Key (PEM format)';
    return 'Password';
  };

  return (
    <div className="flex flex-col gap-6 h-full relative">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold dark:text-white">Connessioni</h1>
          <p className="text-sm text-gray-500 mt-1">Configura le sorgenti e le destinazioni per il progetto attivo</p>
        </div>
        <div className="flex gap-3">
          <button onClick={fetchConnections} className="px-3 py-1.5 rounded flex items-center gap-2 text-xs font-bold transition-all border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-[#27272a]">
            <RefreshCw size={16} /> Aggiorna
          </button>
          <button onClick={() => {
            setEditId(null);
            setFormData({ name: '', tipo: 'oracle', host: '', port: '1521', service_sid_path: '', user: '', pwd: '' });
            setSftpAuthType('password');
            setTestStatus(null);
            setShowModal(true);
          }} className="px-3 py-1.5 rounded flex items-center gap-2 text-xs font-bold transition-all bg-teal-600 hover:bg-teal-500 text-white shadow-lg shadow-teal-500/20">
            <Plus size={16} /> Nuova Connessione
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 p-4 rounded flex items-center gap-3 text-sm">
          <AlertCircle size={20} />
          {error}
        </div>
      )}

      <div className="bg-white dark:bg-[#18181b] border border-gray-200 dark:border-[#27272a] rounded flex-1 overflow-hidden flex flex-col">
        <div className="overflow-auto flex-1">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 dark:bg-[#27272a] border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-4 py-3 font-medium">ID</th>
                <th className="px-4 py-3 font-medium">Nome</th>
                <th className="px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3 font-medium">Host</th>
                <th className="px-4 py-3 font-medium text-right">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? (
                <tr>
                  <td colSpan="5" className="px-4 py-8 text-center text-gray-500">Caricamento in corso...</td>
                </tr>
              ) : connections.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-4 py-8 text-center text-gray-500">Nessuna connessione trovata.</td>
                </tr>
              ) : (
                connections.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-[#27272a]/50 transition-colors">
                    <td className="px-4 py-3 text-gray-500">{c.id}</td>
                    <td className="px-4 py-3 font-bold">{c.name}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        c.tipo === 'oracle' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                        c.tipo === 'azure' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                        'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                      }`}>
                        {c.tipo.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{c.host}:{c.port}</td>
                    <td className="px-4 py-3 text-right flex justify-end gap-2">
                      <button onClick={() => handleEdit(c)} className="p-1.5 rounded text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/20 transition-colors">
                        <Edit2 size={16} />
                      </button>
                      <button onClick={() => handleDelete(c.id)} className="p-1.5 rounded text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/20 transition-colors">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#18181b] border border-gray-200 dark:border-[#27272a] rounded-lg shadow-xl w-full max-w-md flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-[#27272a]">
              <h2 className="text-lg font-bold">{editId ? 'Modifica Connessione' : 'Nuova Connessione'}</h2>
            </div>
            <div className="p-6 overflow-auto">
              <form id="conn-form" onSubmit={handleSave} className="flex flex-col gap-4 text-sm">
                {testStatus && testStatus !== 'null' && (
                  <div className={`p-3 rounded text-xs font-bold ${testStatus === 'success' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : testStatus === 'error' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'}`}>
                    {testMessage}
                  </div>
                )}
                
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Nome Connessione</label>
                  <input required value={formData.name} onChange={e=>setFormData({...formData, name: e.target.value})} className="w-full bg-transparent border border-gray-300 dark:border-gray-700 rounded px-3 py-2 outline-none focus:border-teal-500" placeholder="es. Database Centrale" />
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Tipo</label>
                  <select required value={formData.tipo} onChange={handleTipoChange} className="w-full bg-transparent border border-gray-300 dark:border-gray-700 rounded px-3 py-2 outline-none focus:border-teal-500 dark:bg-[#18181b] font-bold text-teal-700 dark:text-teal-400">
                    <option value="oracle">Oracle DB</option>
                    <option value="ftp">FTP</option>
                    <option value="sftp">SFTP</option>
                    <option value="azure">Azure Blob Storage</option>
                  </select>
                </div>
                
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="block text-xs font-bold text-gray-500 mb-1">{getHostLabel()}</label>
                    <input required value={formData.host} onChange={e=>setFormData({...formData, host: e.target.value})} className="w-full bg-transparent border border-gray-300 dark:border-gray-700 rounded px-3 py-2 outline-none focus:border-teal-500" />
                  </div>
                  {formData.tipo !== 'azure' && (
                    <div className="w-24">
                      <label className="block text-xs font-bold text-gray-500 mb-1">Port</label>
                      <input type="number" required value={formData.port} onChange={e=>setFormData({...formData, port: e.target.value})} className="w-full bg-transparent border border-gray-300 dark:border-gray-700 rounded px-3 py-2 outline-none focus:border-teal-500" />
                    </div>
                  )}
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">{getServiceLabel()}</label>
                  <input required={formData.tipo === 'oracle'} value={formData.service_sid_path} onChange={e=>setFormData({...formData, service_sid_path: e.target.value})} className="w-full bg-transparent border border-gray-300 dark:border-gray-700 rounded px-3 py-2 outline-none focus:border-teal-500" />
                </div>
                
                {formData.tipo !== 'azure' && (
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">User</label>
                    <input value={formData.user} onChange={e=>setFormData({...formData, user: e.target.value})} className="w-full bg-transparent border border-gray-300 dark:border-gray-700 rounded px-3 py-2 outline-none focus:border-teal-500" />
                  </div>
                )}
                
                {formData.tipo === 'sftp' && (
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Autenticazione SFTP</label>
                    <select value={sftpAuthType} onChange={e => {
                      setSftpAuthType(e.target.value);
                      setFormData({...formData, pwd: ''}); // reset key/pwd
                    }} className="w-full bg-transparent border border-gray-300 dark:border-gray-700 rounded px-3 py-2 outline-none focus:border-teal-500 dark:bg-[#18181b]">
                      <option value="password">Password Tradizionale</option>
                      <option value="key">File Chiave Privata (PEM)</option>
                    </select>
                  </div>
                )}
                
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">{getPasswordLabel()}</label>
                  {sftpAuthType === 'key' && formData.tipo === 'sftp' ? (
                    <textarea required value={formData.pwd} onChange={e=>setFormData({...formData, pwd: e.target.value})} className="w-full bg-transparent border border-gray-300 dark:border-gray-700 rounded px-3 py-2 outline-none focus:border-teal-500 h-32 font-mono text-[10px]" placeholder="-----BEGIN PRIVATE KEY-----&#10;...&#10;-----END PRIVATE KEY-----" />
                  ) : (
                    <input type="password" required value={formData.pwd} onChange={e=>setFormData({...formData, pwd: e.target.value})} className="w-full bg-transparent border border-gray-300 dark:border-gray-700 rounded px-3 py-2 outline-none focus:border-teal-500" />
                  )}
                </div>
                
              </form>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 dark:border-[#27272a] flex justify-end gap-3 bg-gray-50 dark:bg-[#18181b] rounded-b-lg">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 rounded text-sm font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-[#27272a] transition-colors">
                Annulla
              </button>
              <button type="button" onClick={handleTest} disabled={testStatus === 'testing'} className="px-4 py-2 rounded text-sm font-bold text-gray-700 bg-gray-200 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
                {testStatus === 'testing' ? 'Test in corso...' : 'Test Connessione'}
              </button>
              <button form="conn-form" type="submit" className="px-4 py-2 rounded text-sm font-bold text-white bg-teal-600 hover:bg-teal-500 transition-colors">
                Salva Connessione
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
