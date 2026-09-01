import { useState, useEffect } from 'react';
import { Shield, Users, Activity, DollarSign, Search, Filter } from 'lucide-react';
import api from '../api/axios';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<'overview' | 'audit' | 'teachers' | 'staff' | 'payments'>('overview');

  // Logs state
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // Payments state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  
  const [extendMonths, setExtendMonths] = useState(1);
  const [extending, setExtending] = useState(false);

  // Teachers state
  const [teachers, setTeachers] = useState<any[]>([]);
  const [newTeacher, setNewTeacher] = useState({ name: '', email: '', password: 'admin' });
  const [creatingTeacher, setCreatingTeacher] = useState(false);

  // Staff state
  const [staff, setStaff] = useState<any[]>([]);
  const [newStaff, setNewStaff] = useState({ name: '', email: '', password: 'admin', role: 'SECRETARY' });
  const [creatingStaff, setCreatingStaff] = useState(false);

  // Teacher Schedule state
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<any>(null);
  const [savingSchedule, setSavingSchedule] = useState(false);

  useEffect(() => {
    if (activeTab === 'audit') fetchLogs();
    if (activeTab === 'teachers') fetchTeachers();
    if (activeTab === 'staff') fetchStaff();
  }, [activeTab]);

  const fetchStaff = async () => {
    try {
      const res = await api.get('/users/staff');
      setStaff(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingStaff(true);
    try {
      await api.post('/users/staff', newStaff);
      alert('Personal creado exitosamente');
      setNewStaff({ name: '', email: '', password: 'admin', role: 'SECRETARY' });
      fetchStaff();
    } catch (e: any) {
      alert(e.response?.data?.message || 'Error al crear personal');
    } finally {
      setCreatingStaff(false);
    }
  };

  const fetchTeachers = async () => {
    try {
      const res = await api.get('/users/teachers');
      setTeachers(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingTeacher(true);
    try {
      await api.post('/users/teacher', newTeacher);
      alert('Profesor creado exitosamente');
      setNewTeacher({ name: '', email: '', password: 'admin' });
      fetchTeachers();
    } catch (e: any) {
      alert(e.response?.data?.message || 'Error al crear');
    } finally {
      setCreatingTeacher(false);
    }
  };

  // teacherSchedules will now be a Record: { "1-08:00": true, "2-09:00": true }
  const [selectedSlots, setSelectedSlots] = useState<Record<string, boolean>>({});

  const openScheduleModal = async (teacher: any) => {
    setSelectedTeacher(teacher);
    setScheduleModalOpen(true);
    setSelectedSlots({});
    try {
      const res = await api.get(`/users/teachers/${teacher.id}/availability`);
      const newSlots: Record<string, boolean> = {};
      res.data.forEach((s: any) => {
        newSlots[`${s.day_of_week}-${s.start_time}`] = true;
      });
      setSelectedSlots(newSlots);
    } catch (e) {
      console.error(e);
    }
  };

  const toggleSlot = (day: number, hour: string) => {
    const key = `${day}-${hour}`;
    setSelectedSlots(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const toggleDay = (day: number) => {
    const hours = [...Array(14)].map((_, i) => `${String(i + 8).padStart(2, '0')}:00`);
    const allSelected = hours.every(h => selectedSlots[`${day}-${h}`]);
    const newSlots = { ...selectedSlots };
    hours.forEach(h => {
      newSlots[`${day}-${h}`] = !allSelected;
    });
    setSelectedSlots(newSlots);
  };

  const saveSchedule = async () => {
    setSavingSchedule(true);
    const schedules = Object.entries(selectedSlots)
      .filter(([_, isSelected]) => isSelected)
      .map(([key]) => {
        const [day_of_week, start_time] = key.split('-');
        return { day_of_week: Number(day_of_week), start_time };
      });

    try {
      await api.post(`/users/teachers/${selectedTeacher.id}/availability`, { schedules });
      alert('Horarios actualizados exitosamente');
      setScheduleModalOpen(false);
    } catch (e: any) {
      alert(e.response?.data?.message || 'Error al guardar horarios');
    } finally {
      setSavingSchedule(false);
    }
  };

  const fetchLogs = async () => {
    setLogsLoading(true);
    try {
      const res = await api.get('/audit');
      setAuditLogs(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLogsLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery) return;
    
    setSearching(true);
    try {
      const res = await api.get(`/users/search?q=${searchQuery}`);
      setSearchResults(res.data);
    } catch (error) {
      console.error(error);
    } finally {
      setSearching(false);
    }
  };

  const toggleExamPermission = async (teacherId: string, currentStatus: boolean) => {
    try {
      await api.put(`/users/teachers/${teacherId}/exams-permission`, { can_conduct_exams: !currentStatus });
      fetchTeachers();
    } catch (e: any) {
      alert(e.response?.data?.message || 'Error al actualizar permiso');
    }
  };

  const handleExtend = async (studentUserId: string) => {
    if (!window.confirm(`¿Extender acceso por ${extendMonths} mes(es)?`)) return;
    setExtending(true);
    try {
      await api.post(`/users/${studentUserId}/extend`, { months: extendMonths });
      alert('Acceso extendido exitosamente');
      setSearchResults([]);
      setSearchQuery('');
    } catch (e) {
      alert('Error al extender acceso');
      console.error(e);
    } finally {
      setExtending(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    window.location.href = '/login';
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      <nav className="bg-gray-900 shadow-sm px-6 md:px-8 py-4 flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Shield className="text-blue-400" /> Directorio Global
        </h1>
        <div className="flex items-center gap-4">
          <span className="font-medium text-gray-300 text-sm md:text-base">Hola, Administrador</span>
          <button onClick={logout} className="text-sm text-red-400 hover:text-red-300 font-medium">Salir</button>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-8 mb-8">
        <div className="flex border-b border-gray-300 overflow-x-auto">
          <button
            onClick={() => setActiveTab('overview')}
            className={`pb-4 px-6 text-sm font-bold border-b-2 transition whitespace-nowrap ${activeTab === 'overview' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            Vista General
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`pb-4 px-6 text-sm font-bold border-b-2 transition whitespace-nowrap ${activeTab === 'audit' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            Registro de Auditoría (Logs)
          </button>
          <button
            onClick={() => setActiveTab('teachers')}
            className={`pb-4 px-6 text-sm font-bold border-b-2 transition whitespace-nowrap ${activeTab === 'teachers' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            Gestión de Profesores
          </button>
          <button
            onClick={() => setActiveTab('staff')}
            className={`pb-4 px-6 text-sm font-bold border-b-2 transition whitespace-nowrap ${activeTab === 'staff' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            Gestión de Personal
          </button>
          <button
            onClick={() => setActiveTab('payments')}
            className={`pb-4 px-6 text-sm font-bold border-b-2 transition whitespace-nowrap flex items-center gap-2 ${activeTab === 'payments' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            Control de Pagos
          </button>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-8">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-blue-100 text-blue-600 rounded-lg"><Users size={20} /></div>
                <span className="text-green-500 text-sm font-bold">+12%</span>
              </div>
              <h3 className="text-3xl font-black text-gray-800">1,240</h3>
              <p className="text-gray-500 text-sm font-medium">Alumnos Activos</p>
            </div>
            
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-purple-100 text-purple-600 rounded-lg"><Activity size={20} /></div>
                <span className="text-green-500 text-sm font-bold">+5%</span>
              </div>
              <h3 className="text-3xl font-black text-gray-800">342</h3>
              <p className="text-gray-500 text-sm font-medium">Clases esta semana</p>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-orange-100 text-orange-600 rounded-lg"><Users size={20} /></div>
                <span className="text-gray-400 text-sm font-bold">Estable</span>
              </div>
              <h3 className="text-3xl font-black text-gray-800">18</h3>
              <p className="text-gray-500 text-sm font-medium">Profesores en plantilla</p>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-green-100 text-green-600 rounded-lg"><DollarSign size={20} /></div>
              </div>
              <h3 className="text-3xl font-black text-gray-800">92%</h3>
              <p className="text-gray-500 text-sm font-medium">Eficiencia de Grupos</p>
            </div>
          </div>
        )}

        {activeTab === 'audit' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4 bg-gray-50">
              <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <Shield className="text-gray-700" size={24} /> Registro de Actividad Inmutable
              </h3>
              <div className="flex gap-2 w-full md:w-auto">
                <div className="relative flex-1 md:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input type="text" placeholder="Buscar acción o usuario..." className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-gray-900" />
                </div>
                <button className="p-2 border border-gray-300 rounded-lg hover:bg-gray-100 text-gray-600">
                  <Filter size={18} />
                </button>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="bg-white border-b border-gray-200">
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Hora</th>
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Actor / Perfil</th>
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Acción</th>
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Detalles Críticos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {logsLoading ? (
                    <tr><td colSpan={4} className="text-center py-8 text-gray-500">Cargando registros...</td></tr>
                  ) : auditLogs.length === 0 ? (
                    <tr><td colSpan={4} className="text-center py-8 text-gray-500">No hay registros de auditoría.</td></tr>
                  ) : (
                    auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50 transition">
                        <td className="px-6 py-4 text-sm font-medium text-gray-600">
                          {new Date(log.timestamp).toLocaleDateString()} {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${
                            log.actorRole === 'SECRETARY' || log.actorRole === 'ADMIN' ? 'bg-orange-100 text-orange-800' : 
                            log.actorRole === 'TEACHER' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                            {log.actorName} ({log.actorRole})
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm font-bold text-gray-800">{log.action}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{log.details}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'teachers' && (
          <div className="space-y-6">
            <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200">
              <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2"><Users /> Gestión de Profesores</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Crear Profesor */}
                <form onSubmit={handleCreateTeacher} className="space-y-4">
                  <h4 className="font-bold text-gray-700">Dar de Alta Nuevo Profesor</h4>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Nombre Completo</label>
                    <input required type="text" value={newTeacher.name} onChange={e => setNewTeacher({...newTeacher, name: e.target.value})} className="w-full p-2 border border-gray-300 rounded outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Correo (@ok.com)</label>
                    <input required type="email" value={newTeacher.email} onChange={e => setNewTeacher({...newTeacher, email: e.target.value})} className="w-full p-2 border border-gray-300 rounded outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Contraseña</label>
                    <input required type="text" value={newTeacher.password} onChange={e => setNewTeacher({...newTeacher, password: e.target.value})} className="w-full p-2 border border-gray-300 rounded outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <button type="submit" disabled={creatingTeacher} className="w-full bg-blue-600 text-white font-bold py-2 rounded hover:bg-blue-700 disabled:opacity-50">
                    {creatingTeacher ? 'Creando...' : 'Crear Profesor'}
                  </button>
                </form>

                {/* Lista de Profesores */}
                <div>
                  <h4 className="font-bold text-gray-700 mb-4">Profesores Activos</h4>
                  <div className="space-y-3 h-80 overflow-y-auto pr-2">
                    {teachers.map(t => (
                      <div key={t.id} className="border border-gray-200 p-3 rounded-lg bg-gray-50 flex justify-between items-center">
                        <div>
                          <p className="font-bold text-gray-800">{t.name}</p>
                          <p className="text-sm text-gray-500">{t.email}</p>
                          {t.teacherProfile?.meet_link ? (
                            <a href={t.teacherProfile.meet_link} target="_blank" rel="noreferrer" className="text-xs text-blue-600 truncate block max-w-[200px] hover:underline">
                              {t.teacherProfile.meet_link}
                            </a>
                          ) : (
                            <span className="text-xs text-red-500">Sin link de Meet</span>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => toggleExamPermission(t.id, t.teacherProfile?.can_conduct_exams)} 
                            className={`text-xs px-3 py-1 rounded font-bold transition ${t.teacherProfile?.can_conduct_exams ? 'bg-purple-600 text-white hover:bg-purple-700' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                            title="Habilitar o deshabilitar permisos para tomar exámenes"
                          >
                            {t.teacherProfile?.can_conduct_exams ? '✓ Examinador' : 'No Examinador'}
                          </button>
                          <button onClick={() => openScheduleModal(t)} className="bg-gray-800 text-white text-xs px-3 py-1 rounded font-bold hover:bg-gray-900 transition">
                            Horarios
                          </button>
                        </div>
                      </div>
                    ))}
                    {teachers.length === 0 && <p className="text-sm text-gray-500">No hay profesores registrados.</p>}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'staff' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <h3 className="text-lg font-bold text-gray-800 mb-4 border-b border-gray-100 pb-2">Registrar Nuevo Personal</h3>
                <form onSubmit={handleCreateStaff} className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Nombre Completo</label>
                    <input 
                      type="text" 
                      required 
                      value={newStaff.name}
                      onChange={e => setNewStaff({...newStaff, name: e.target.value})}
                      className="w-full p-2 border border-gray-300 rounded outline-none focus:border-blue-500 text-sm"
                      placeholder="Ej: Ana María"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Correo (Acceso)</label>
                    <input 
                      type="email" 
                      required 
                      value={newStaff.email}
                      onChange={e => setNewStaff({...newStaff, email: e.target.value})}
                      className="w-full p-2 border border-gray-300 rounded outline-none focus:border-blue-500 text-sm"
                      placeholder="ana@instituto.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Contraseña Inicial</label>
                    <input 
                      type="text" 
                      required 
                      value={newStaff.password}
                      onChange={e => setNewStaff({...newStaff, password: e.target.value})}
                      className="w-full p-2 border border-gray-300 rounded outline-none focus:border-blue-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Rol</label>
                    <select 
                      value={newStaff.role}
                      onChange={e => setNewStaff({...newStaff, role: e.target.value})}
                      className="w-full p-2 border border-gray-300 rounded outline-none focus:border-blue-500 text-sm font-bold"
                    >
                      <option value="SECRETARY">Secretaria</option>
                      <option value="ADMIN">Administrador</option>
                    </select>
                  </div>
                  <button type="submit" disabled={creatingStaff} className="w-full bg-blue-600 text-white font-bold py-2 rounded hover:bg-blue-700 transition disabled:opacity-50">
                    {creatingStaff ? 'Creando...' : 'Crear Cuenta'}
                  </button>
                </form>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <h3 className="text-lg font-bold text-gray-800 mb-4 border-b border-gray-100 pb-2 flex items-center gap-2">
                  <Users size={18} /> Personal Activo
                </h3>
                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                  {staff.map((s: any) => (
                    <div key={s.id} className="p-3 border border-gray-100 rounded-lg bg-gray-50 flex justify-between items-center">
                      <div>
                        <p className="font-bold text-gray-800 text-sm">{s.name}</p>
                        <p className="text-xs text-gray-500">{s.email}</p>
                      </div>
                      <div>
                        <span className={`text-xs px-2 py-1 rounded font-bold ${s.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                          {s.role === 'ADMIN' ? 'Admin' : 'Secretaria'}
                        </span>
                      </div>
                    </div>
                  ))}
                  {staff.length === 0 && <p className="text-sm text-gray-500">No hay personal registrado.</p>}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'payments' && (
          <div className="space-y-6">
            <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 text-center">
              <h3 className="text-xl font-bold text-gray-800 mb-2">Control de Vencimientos y Pagos</h3>
              <p className="text-gray-500 mb-6">Busca al estudiante para extender su tiempo de acceso. El sistema bloqueará automáticamente a los alumnos deudores.</p>
              
              <form onSubmit={handleSearch} className="max-w-md mx-auto relative mb-4">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Ej: luis.martinez@ok.com" 
                  className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button type="submit" disabled={searching} className="absolute right-2 top-1/2 -translate-y-1/2 bg-blue-600 text-white px-4 py-1.5 rounded-md text-sm font-bold hover:bg-blue-700 transition disabled:opacity-50">
                  {searching ? 'Buscando...' : 'Buscar'}
                </button>
              </form>
            </div>

            {/* Resultado de Búsqueda de Pago */}
            {searchResults.map((student) => {
              const expires = new Date(student.studentProfile?.access_expires_at || new Date());
              const isExpired = expires < new Date();
              const daysLeft = Math.ceil((expires.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));

              return (
                <div key={student.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden max-w-3xl mx-auto">
                  <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <div>
                      <h3 className="text-xl font-bold text-gray-800">{student.name}</h3>
                      <p className="text-gray-500 text-sm">{student.email} | Nivel: Lección {student.studentProfile?.current_lesson || 1} ({student.studentProfile?.current_session_type})</p>
                    </div>
                    <div className="text-right">
                      <span className={`${isExpired ? 'bg-red-100 text-red-700' : daysLeft < 5 ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'} text-xs font-bold px-3 py-1 rounded-full block mb-1`}>
                        {isExpired ? 'Acceso Vencido' : `Vence en ${daysLeft} días`}
                      </span>
                      <p className="text-xs text-gray-500">{expires.toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="p-6">
                    <label className="block text-sm font-bold text-gray-700 mb-3">Extender Acceso (Meses):</label>
                    <div className="flex gap-4 items-center">
                      <select 
                        value={extendMonths}
                        onChange={(e) => setExtendMonths(Number(e.target.value))}
                        className="flex-1 p-3 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                      >
                        <option value="1">1 Mes (+30 días)</option>
                        <option value="2">2 Meses (+60 días)</option>
                        <option value="3">3 Meses (+90 días)</option>
                        <option value="6">6 Meses (Medio Curso)</option>
                        <option value="10">10 Meses (Curso Completo)</option>
                      </select>
                      <button 
                        onClick={() => handleExtend(student.id)}
                        disabled={extending}
                        className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition flex items-center gap-2 disabled:opacity-50"
                      >
                        <DollarSign size={18} /> {extending ? 'Registrando...' : 'Registrar Pago y Extender'}
                      </button>
                    </div>
                    <p className="text-xs text-gray-400 mt-4 italic">
                      Nota: El tiempo se suma a la fecha de vencimiento actual. Si ya está vencido, se calcula desde hoy.
                    </p>
                  </div>
                </div>
              );
            })}
            
            {searchResults.length === 0 && searchQuery && !searching && (
              <p className="text-center text-gray-500 mt-8">No se encontraron estudiantes.</p>
            )}
          </div>
        )}

        {scheduleModalOpen && selectedTeacher && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white z-10">
                <h2 className="text-xl font-bold text-gray-800">
                  Horarios: <span className="text-blue-600">{selectedTeacher.name}</span>
                </h2>
                <button onClick={() => setScheduleModalOpen(false)} className="text-gray-400 hover:text-gray-600 font-bold">X</button>
              </div>
              <div className="p-6">
                <p className="text-sm text-gray-500 mb-6">Añade los bloques de tiempo donde este profesor estará disponible. El sistema guardará esta disponibilidad para que los estudiantes y secretarias puedan asignarle clases.</p>
                
                <div className="overflow-x-auto mb-6">
                  <table className="w-full text-center border-collapse">
                    <thead>
                      <tr>
                        <th className="p-2 border border-gray-300 bg-gray-100 text-xs">Hora</th>
                        {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map((day, i) => (
                          <th key={i} className="p-2 border border-gray-300 bg-gray-100 text-xs cursor-pointer hover:bg-gray-200" onClick={() => toggleDay(i + 1)}>
                            {day}<br/><span className="text-[10px] text-gray-500 font-normal">Todo el día</span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[...Array(14)].map((_, hourIndex) => {
                        const hour = `${String(hourIndex + 8).padStart(2, '0')}:00`;
                        return (
                          <tr key={hourIndex}>
                            <td className="p-2 border border-gray-300 bg-gray-50 text-xs font-bold text-gray-600">{hour}</td>
                            {[1, 2, 3, 4, 5, 6].map(day => (
                              <td 
                                key={day} 
                                onClick={() => toggleSlot(day, hour)}
                                className={`p-2 border border-gray-300 cursor-pointer transition ${selectedSlots[`${day}-${hour}`] ? 'bg-blue-500 hover:bg-blue-600' : 'bg-white hover:bg-gray-100'}`}
                              >
                                {selectedSlots[`${day}-${hour}`] && <span className="text-white">✓</span>}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <p className="text-xs text-gray-500 mt-2 italic">* Haz clic en la cabecera de un día para seleccionar/deseleccionar todo el día. Los domingos no se imparten clases.</p>
                </div>

                <div className="flex justify-end items-center border-t border-gray-200 pt-6">
                  <button onClick={saveSchedule} disabled={savingSchedule} className="bg-blue-600 text-white font-bold px-6 py-2 rounded hover:bg-blue-700 transition disabled:opacity-50">
                    {savingSchedule ? 'Guardando...' : 'Guardar Horarios'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
