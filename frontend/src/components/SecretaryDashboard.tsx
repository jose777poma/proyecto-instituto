import { useState, useEffect } from 'react';
import { Calendar, Users, Search, AlertCircle, ShieldAlert, BookOpen, X } from 'lucide-react';
import api from '../api/axios';

export default function SecretaryDashboard() {
  const [activeTab, setActiveTab] = useState<'classes' | 'students' | 'register_student' | 'teachers'>('classes');
  const [classes, setClasses] = useState<any[]>([]);

  // Estados para Búsqueda y Forzar Cupo
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);

  // Estado para Crear Alumno
  const [newStudent, setNewStudent] = useState({
    name: '', email: '', password: '', birth_date: '', current_lesson: 1, current_session_type: 'ESSENTIAL', months_access: 1
  });
  const [creatingStudent, setCreatingStudent] = useState(false);
  
  // States para gestión de profesores
  const [teachers, setTeachers] = useState<any[]>([]);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<any>(null);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [selectedSlots, setSelectedSlots] = useState<Record<string, boolean>>({});

  const [bookingModalOpen, setBookingModalOpen] = useState(false);

  // Estados para modal de Ver Alumnos
  const [viewStudentsModalOpen, setViewStudentsModalOpen] = useState(false);
  const [selectedClassForStudents, setSelectedClassForStudents] = useState<any>(null);
  
  // Estados para Modal de Nivel
  const [levelModalOpen, setLevelModalOpen] = useState(false);
  const [editingLevel, setEditingLevel] = useState({ current_lesson: 1, current_session_type: 'ESSENTIAL' });
  const [updatingLevel, setUpdatingLevel] = useState(false);

  // Estados para Historial
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [studentHistory, setStudentHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const calculateAge = (birthDate: string | null | undefined) => {
    if (!birthDate) return 'N/A';
    const dob = new Date(birthDate);
    const diff_ms = Date.now() - dob.getTime();
    const age_dt = new Date(diff_ms);
    return Math.abs(age_dt.getUTCFullYear() - 1970);
  };
  
  // Estados para creación de clase ancla (Secretary)
  const [anchorDate, setAnchorDate] = useState('');
  const [anchorTime, setAnchorTime] = useState('');
  const [availableTeachers, setAvailableTeachers] = useState<any[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState('');

  useEffect(() => {
    if (activeTab === 'classes') {
      fetchClasses();
    } else if (activeTab === 'teachers') {
      fetchTeachers();
    }
  }, [activeTab]);

  const fetchTeachers = async () => {
    try {
      const res = await api.get('/users/teachers');
      setTeachers(res.data);
    } catch (e) {
      console.error(e);
    }
  };

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

  const fetchClasses = async () => {
    try {
      const res = await api.get('/classes/secretary');
      setClasses(res.data);
    } catch (error) {
      console.error(error);
    }
  };

  const handleSearchTeachers = async () => {
    if (!anchorDate || !anchorTime) return alert('Selecciona fecha y hora');
    
    // Bloquear Domingos
    const [year, month, day] = anchorDate.split('-');
    const selectedDate = new Date(Number(year), Number(month) - 1, Number(day));
    if (selectedDate.getDay() === 0) {
      return alert('El instituto no imparte clases los días Domingo. Por favor selecciona otro día.');
    }

    // Validar hora pasada
    const now = new Date();
    const isToday = now.getFullYear() === selectedDate.getFullYear() && 
                    now.getMonth() === selectedDate.getMonth() && 
                    now.getDate() === selectedDate.getDate();
    
    if (isToday) {
      const [hours, minutes] = anchorTime.split(':').map(Number);
      const classTime = new Date();
      classTime.setHours(hours, minutes, 0, 0);
      if (classTime.getTime() <= now.getTime()) {
        return alert('La hora que seleccionaste ya ha pasado. Por favor selecciona un horario futuro.');
      }
    }

    try {
      const res = await api.get(`/bookings/available-teachers?date=${anchorDate}&startTime=${anchorTime}`);
      setAvailableTeachers(res.data);
      if (res.data.length === 0) {
        alert('No hay profesores disponibles para esta fecha y hora.');
      }
    } catch (e) {
      console.error(e);
      alert('Error al buscar profesores.');
    }
  };

  const handleCreateAnchorClass = async () => {
    if (!selectedTeacherId) return alert('Selecciona un profesor');
    try {
      await api.post('/bookings/force-create-anchor', {
        studentUserId: selectedStudent.id,
        teacherId: selectedTeacherId,
        date: anchorDate,
        startTime: anchorTime
      });
      alert('Clase ancla creada e inscrita.');
      setBookingModalOpen(false);
      fetchClasses();
    } catch (e: any) {
      alert(e.response?.data?.message || 'Error al crear clase ancla');
    }
  };

  const handleForceBook = async (classId: string, isFull: boolean) => {
    if (!selectedStudent) return;
    
    const message = isFull 
      ? `🚨 ATENCIÓN 🚨\nEsta clase ya está LLENA. Estás a punto de forzar el ingreso de un 6to alumno.\n¿Estás seguro de que quieres sobreescribir las reglas y forzar este cupo para ${selectedStudent.name}?` 
      : `¿Estás seguro de inscribir a ${selectedStudent.name} en esta clase?`;

    if (!window.confirm(message)) return;

    try {
      await api.post('/bookings/force-book', { studentUserId: selectedStudent.id, classId });
      alert('Clase reservada exitosamente (Impersonación).');
      setBookingModalOpen(false);
      setSelectedStudent(null);
      fetchClasses();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Error al forzar reserva');
    }
  };

  const handleCancelClass = async (classId: string) => {
    if (!window.confirm('¿Estás seguro de cancelar esta clase? Los alumnos serán notificados y se les devolverá el cupo.')) return;
    try {
      await api.post(`/classes/${classId}/cancel`);
      alert('Clase cancelada exitosamente.');
      fetchClasses();
    } catch (e: any) {
      alert(e.response?.data?.message || 'Error al cancelar la clase.');
    }
  };

  const cancelStudentBooking = async (booking: any) => {
    if (!window.confirm(`¿Seguro que deseas cancelar la reserva de ${booking.student_name}?`)) return;
    try {
      await api.post(`/bookings/cancel/${booking.id}`, { studentId: booking.student_user_id });
      alert(`Reserva de ${booking.student_name} cancelada exitosamente.`);
      setViewStudentsModalOpen(false);
      fetchClasses();
    } catch (e: any) {
      alert(e.response?.data?.message || 'Error al cancelar la reserva del alumno.');
    }
  };

  const handleUpdateLevel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;
    setUpdatingLevel(true);
    try {
      await api.post(`/users/${selectedStudent.id}/level`, editingLevel);
      alert('Nivel y Lección actualizados exitosamente.');
      setLevelModalOpen(false);
      handleSearch(new Event('submit') as any);
    } catch (error: any) {
      alert(error.response?.data?.message || 'Error al actualizar el nivel');
    } finally {
      setUpdatingLevel(false);
    }
  };

  const openStudentHistory = async (student: any) => {
    setSelectedStudent(student);
    setHistoryModalOpen(true);
    setLoadingHistory(true);
    try {
      const res = await api.get(`/classes/student/${student.id}/history`);
      setStudentHistory(res.data);
    } catch (e) {
      console.error(e);
      alert('Error al cargar el historial del estudiante');
    } finally {
      setLoadingHistory(false);
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

  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingStudent(true);
    try {
      await api.post('/users/student', newStudent);
      alert('Alumno dado de alta exitosamente');
      setNewStudent({ name: '', email: '', password: '', birth_date: '', current_lesson: 1, current_session_type: 'ESSENTIAL', months_access: 1 });
    } catch (e: any) {
      alert(e.response?.data?.message || 'Error al crear el alumno');
      console.error(e);
    } finally {
      setCreatingStudent(false);
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

  const logout = () => {
    localStorage.removeItem('token');
    window.location.href = '/login';
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      <nav className="bg-white shadow-sm px-6 md:px-8 py-4 flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <h1 className="text-xl font-bold text-blue-600">Instituto Virtual</h1>
        <div className="flex items-center gap-4">
          <span className="font-medium text-gray-700 text-sm md:text-base">Hola, Secretaria</span>
          <button onClick={logout} className="text-sm text-red-500 hover:text-red-700 font-medium">Salir</button>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-8 mb-8">
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('classes')}
            className={`pb-4 px-6 text-sm font-bold border-b-2 transition ${activeTab === 'classes' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            Monitor de Clases Programadas
          </button>
          <button
            onClick={() => setActiveTab('students')}
            className={`pb-4 px-6 text-sm font-bold border-b-2 transition ${activeTab === 'students' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            Gestión de Alumnos (Soporte)
          </button>
          <button
            onClick={() => setActiveTab('register_student')}
            className={`pb-4 px-6 text-sm font-bold border-b-2 transition ${activeTab === 'register_student' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            Alta de Alumnos
          </button>
          <button
            onClick={() => setActiveTab('teachers')}
            className={`pb-4 px-6 text-sm font-bold border-b-2 transition ${activeTab === 'teachers' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            Gestión de Profesores
          </button>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-8">
        {activeTab === 'classes' && (
          <div>
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
              <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                <Calendar className="text-blue-600" /> Clases Programadas
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {classes.map((cls) => (
                <div key={cls.id} className={`bg-white rounded-xl shadow-sm border ${cls.bookings_count >= 5 ? 'border-orange-300' : 'border-gray-200'} p-6 relative`}>
                  {cls.bookings_count >= 5 && (
                    <div className="absolute top-4 right-4 text-orange-500" title="Grupo Lleno">
                      <AlertCircle size={20} />
                    </div>
                  )}
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <p className="text-sm text-blue-600 font-bold uppercase tracking-wider mb-1">
                        {new Date(cls.date).toLocaleDateString('es-ES', { timeZone: 'UTC', day: 'numeric', month: 'long' })}
                      </p>
                      <h3 className="text-3xl font-black text-gray-800">{cls.start_time}</h3>
                      <p className="text-gray-500 font-medium mt-1">{cls.teacher_name}</p>
                    </div>
                    <div className="text-right">
                      <span className="bg-blue-100 text-blue-700 text-xs font-bold px-3 py-1 rounded-full uppercase block mb-1">
                        {cls.session_type}
                      </span>
                      <span className="text-sm text-gray-500 font-bold">Lección {cls.anchor_lesson}</span>
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 p-4 rounded-lg flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2 text-gray-700 font-bold">
                      <Users size={18} />
                      Cupos: {cls.bookings_count} / 5
                    </div>
                    {cls.bookings_count >= 5 && (
                      <span className="text-xs bg-red-100 text-red-600 font-bold px-2 py-1 rounded-md">Lleno</span>
                    )}
                  </div>

                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                      <button 
                        className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded-lg text-sm font-bold transition flex justify-center items-center gap-2" 
                        onClick={() => {
                          setSelectedClassForStudents(cls);
                          setViewStudentsModalOpen(true);
                        }}
                      >
                        <Search size={16} /> Ver Alumnos
                      </button>
                      <button className="flex-1 bg-orange-100 hover:bg-orange-200 text-orange-700 py-2 rounded-lg text-sm font-bold transition flex justify-center items-center gap-2" title="Forzar inscripción de un alumno extra" onClick={() => alert('Busca al alumno en la pestaña Gestión de Alumnos para inscribirlo forzosamente.')}>
                        <ShieldAlert size={16} /> Forzar Cupo
                      </button>
                    </div>
                    <button onClick={() => handleCancelClass(cls.id)} className="w-full bg-red-100 hover:bg-red-200 text-red-700 py-2 rounded-lg text-sm font-bold transition flex justify-center items-center gap-2" title="Cancelar clase por emergencia o enfermedad">
                      Cancelar Clase (Emergencia)
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'students' && (
          <div className="space-y-6">
            <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 text-center">
              <h3 className="text-xl font-bold text-gray-800 mb-2">Buscador de Estudiantes</h3>
              <p className="text-gray-500 mb-6">Busca a un estudiante por correo o nombre para ver su progreso, justificar faltas, corregir errores o reservar por ellos.</p>
              
              <form onSubmit={handleSearch} className="max-w-md mx-auto relative mb-4">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input 
                  type="text" 
                  placeholder="Ej: juan.perez@ok.com" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button type="submit" disabled={searching} className="absolute right-2 top-1/2 -translate-y-1/2 bg-blue-600 text-white px-4 py-1.5 rounded-md text-sm font-bold hover:bg-blue-700 transition disabled:opacity-50">
                  {searching ? 'Buscando...' : 'Buscar'}
                </button>
              </form>
            </div>

            {/* Resultados de Búsqueda */}
            {searchResults.map(student => (
              <div key={student.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                  <div>
                    <h3 className="text-xl font-bold text-gray-800">{student.name}</h3>
                    <p className="text-gray-500 text-sm">{student.email} | Nivel: Lección {student.studentProfile?.current_lesson || 1} ({student.studentProfile?.current_session_type})</p>
                  </div>
                  <span className="bg-green-100 text-green-700 text-xs font-bold px-3 py-1 rounded-full">
                    Activo
                  </span>
                </div>
                <div className="p-6 grid grid-cols-1 md:grid-cols-4 gap-4">
                  <button 
                    onClick={() => { setSelectedStudent(student); setBookingModalOpen(true); }}
                    className="bg-blue-50 hover:bg-blue-100 text-blue-700 py-4 px-4 rounded-xl font-bold text-sm flex flex-col items-center gap-2 transition text-center"
                  >
                    <Calendar size={24} />
                    Agendar Clase por el Alumno
                  </button>
                  <button 
                    onClick={() => {
                      setSelectedStudent(student);
                      setEditingLevel({
                        current_lesson: student.studentProfile?.current_lesson || 1,
                        current_session_type: student.studentProfile?.current_session_type || 'ESSENTIAL'
                      });
                      setLevelModalOpen(true);
                    }}
                    className="bg-purple-50 hover:bg-purple-100 text-purple-700 py-4 px-4 rounded-xl font-bold text-sm flex flex-col items-center gap-2 transition text-center"
                  >
                    <BookOpen size={24} />
                    Corregir Lección / Nivel
                  </button>
                  <button 
                    onClick={() => openStudentHistory(student)}
                    className="bg-teal-50 hover:bg-teal-100 text-teal-700 py-4 px-4 rounded-xl font-bold text-sm flex flex-col items-center gap-2 transition text-center"
                  >
                    <span className="text-2xl">👁️</span>
                    Ver Historial Académico
                  </button>
                  <button className="bg-red-50 hover:bg-red-100 text-red-700 py-4 px-4 rounded-xl font-bold text-sm flex flex-col items-center gap-2 transition text-center">
                    <ShieldAlert size={24} />
                    Justificar / Perdonar Falta
                  </button>
                </div>
              </div>
            ))}
            {searchResults.length === 0 && searchQuery && !searching && (
              <p className="text-center text-gray-500 mt-8">No se encontraron resultados para la búsqueda.</p>
            )}
          </div>
        )}

        {activeTab === 'register_student' && (
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200">
              <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2"><Users /> Alta de Nuevo Alumno</h3>
              
              <form onSubmit={handleCreateStudent} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Nombre Completo</label>
                    <input required type="text" value={newStudent.name} onChange={e => setNewStudent({...newStudent, name: e.target.value})} className="w-full p-3 border border-gray-300 rounded outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Correo (@ok.com)</label>
                    <input required type="email" value={newStudent.email} onChange={e => setNewStudent({...newStudent, email: e.target.value})} className="w-full p-3 border border-gray-300 rounded outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Contraseña Inicial</label>
                    <input required type="text" value={newStudent.password} onChange={e => setNewStudent({...newStudent, password: e.target.value})} placeholder="admin" className="w-full p-3 border border-gray-300 rounded outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Fecha de Nacimiento</label>
                    <input required type="date" value={newStudent.birth_date} onChange={e => setNewStudent({...newStudent, birth_date: e.target.value})} className="w-full p-3 border border-gray-300 rounded outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Meses de Acceso Pagados</label>
                    <select value={newStudent.months_access} onChange={e => setNewStudent({...newStudent, months_access: Number(e.target.value)})} className="w-full p-3 border border-gray-300 rounded outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="1">1 Mes (+30 días)</option>
                      <option value="2">2 Meses (+60 días)</option>
                      <option value="3">3 Meses (+90 días)</option>
                      <option value="6">6 Meses (Medio Curso)</option>
                      <option value="10">10 Meses (Curso Completo)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Lección de Inicio (1-50)</label>
                    <input required type="number" min="1" max="50" value={newStudent.current_lesson} onChange={e => setNewStudent({...newStudent, current_lesson: Number(e.target.value)})} className="w-full p-3 border border-gray-300 rounded outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Tipo de Sesión de Inicio</label>
                    <select value={newStudent.current_session_type} onChange={e => setNewStudent({...newStudent, current_session_type: e.target.value})} className="w-full p-3 border border-gray-300 rounded outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="ESSENTIAL">Essential</option>
                      <option value="WORKING_CLASS">Working Class</option>
                      <option value="SPEAK_OUT">Speak Out</option>
                      <option value="EXAM_WRITTEN">Examen Escrito</option>
                      <option value="EXAM_ORAL">Examen Oral</option>
                    </select>
                  </div>
                </div>
                <div className="pt-4">
                  <button type="submit" disabled={creatingStudent} className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition disabled:opacity-50">
                    {creatingStudent ? 'Registrando...' : 'Registrar Alumno Oficialmente'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
        {activeTab === 'teachers' && (
          <div className="space-y-6">
            <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200">
              <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2"><Users /> Gestión de Profesores</h3>
              
              <div className="max-w-3xl">
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
                          Gestionar Horarios
                        </button>
                      </div>
                    </div>
                  ))}
                  {teachers.length === 0 && <p className="text-sm text-gray-500">No hay profesores registrados.</p>}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modal de Reservas para Secretaria */}
      {bookingModalOpen && selectedStudent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white z-10">
              <h2 className="text-xl font-bold text-gray-800">
                Agendar Clase para: <span className="text-blue-600">{selectedStudent.name}</span>
              </h2>
              <button onClick={() => setBookingModalOpen(false)} className="text-gray-400 hover:text-gray-600 font-bold">X</button>
            </div>
            
            <div className="p-6">
              <p className="text-sm text-gray-500 mb-6">
                Como secretaria, puedes forzar el ingreso a clases que ya estén llenas o cerradas.
              </p>

              {(() => {
                const now = new Date();
                const futureClasses = classes.filter(cls => {
                  const [year, month, day] = cls.date.split('T')[0].split('-').map(Number);
                  const [hours, minutes] = cls.start_time.split(':').map(Number);
                  const classDateTime = new Date(year, month - 1, day, hours, minutes, 0, 0);
                  
                  const isFuture = classDateTime.getTime() > now.getTime() && cls.status !== 'COMPLETED';
                  const isMatchingSession = cls.session_type === selectedStudent.studentProfile.current_session_type;
                  const offset = cls.anchor_lesson > 30 ? 3 : 2;
                  const isMatchingRange = selectedStudent.studentProfile.current_lesson >= cls.anchor_lesson - offset && selectedStudent.studentProfile.current_lesson <= cls.anchor_lesson + offset;

                  return isFuture && isMatchingSession && isMatchingRange;
                });

                if (futureClasses.length === 0) {
                  return <p className="text-gray-500 text-center py-8">No hay clases disponibles para agendar.</p>;
                }

                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {futureClasses.map((cls) => (
                    <div key={cls.id} className={`border rounded-xl p-4 flex flex-col justify-between ${cls.bookings_count >= 5 ? 'border-orange-300 bg-orange-50' : 'border-gray-200'}`}>
                      <div>
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-xs font-bold bg-blue-100 text-blue-700 px-2 py-1 rounded">
                            {new Date(cls.date).toLocaleDateString('es-ES', { timeZone: 'UTC', day: 'numeric', month: 'short' })}
                          </span>
                          <span className="text-xs font-bold text-gray-500">Cupos: {cls.bookings_count}/5</span>
                        </div>
                        <h4 className="text-xl font-black text-gray-800">{cls.start_time}</h4>
                        <p className="text-sm text-gray-600 font-medium mb-1">{cls.teacher_name}</p>
                        <p className="text-xs text-gray-500">
                          {cls.session_type} - Lección {cls.anchor_lesson}
                        </p>
                      </div>
                      
                      <button
                        onClick={() => handleForceBook(cls.id, cls.bookings_count >= 5)}
                        className={`mt-4 w-full py-2 rounded-lg font-bold text-sm transition ${
                          cls.bookings_count >= 5 
                            ? 'bg-orange-500 hover:bg-orange-600 text-white'
                            : 'bg-blue-600 hover:bg-blue-700 text-white'
                        }`}
                      >
                        {cls.bookings_count >= 5 ? 'Forzar Ingreso (6to cupo)' : 'Inscribir'}
                      </button>
                      
                      <button
                        onClick={() => handleCancelClass(cls.id)}
                        className="mt-2 w-full py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg font-bold text-sm transition"
                      >
                        Cancelar Clase (Enfermedad)
                      </button>
                    </div>
                  ))}
                </div>
                );
              })()}

              <div className="mt-8 pt-6 border-t border-gray-200">
                <h3 className="text-lg font-bold text-gray-800 mb-4">¿No hay clases? Forzar Nueva Clase Ancla</h3>
                {(() => {
                  const getLocalString = (d: Date) => {
                    const y = d.getFullYear();
                    const m = String(d.getMonth() + 1).padStart(2, '0');
                    const day = String(d.getDate()).padStart(2, '0');
                    return `${y}-${m}-${day}`;
                  };
                  const todayStr = getLocalString(new Date());

                  return (
                    <div className="flex gap-4 mb-4">
                      <div className="flex-1">
                        <label className="block text-sm font-bold text-gray-700 mb-1">Fecha</label>
                        <input type="date" min={todayStr} value={anchorDate} onChange={e => { setAnchorDate(e.target.value); setAvailableTeachers([]); setSelectedTeacherId(''); }} className="w-full p-2 border border-gray-300 rounded" />
                      </div>
                      <div className="flex-1">
                        <label className="block text-sm font-bold text-gray-700 mb-1">Hora (ej. 14:00)</label>
                        <select value={anchorTime} onChange={e => { setAnchorTime(e.target.value); setAvailableTeachers([]); setSelectedTeacherId(''); }} className="w-full p-2 border border-gray-300 rounded">
                          <option value="">-- Hora --</option>
                          {[...Array(14)].map((_, i) => (
                            <option key={i} value={`${String(i + 8).padStart(2, '0')}:00`}>{`${String(i + 8).padStart(2, '0')}:00`}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex items-end">
                        <button onClick={handleSearchTeachers} className="bg-gray-800 text-white px-4 py-2 rounded font-bold hover:bg-gray-900">
                          Buscar Profesores Libres
                        </button>
                      </div>
                    </div>
                  );
                })()}

                {availableTeachers.length > 0 && (
                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                    <label className="block text-sm font-bold text-gray-700 mb-2">Selecciona un profesor libre para asignarle el grupo:</label>
                    <div className="flex gap-4">
                      <select value={selectedTeacherId} onChange={e => setSelectedTeacherId(e.target.value)} className="flex-1 p-2 border border-gray-300 rounded outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="">-- Profesores Disponibles --</option>
                        {availableTeachers.map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                      <button onClick={handleCreateAnchorClass} className="bg-blue-600 text-white px-6 py-2 rounded font-bold hover:bg-blue-700">
                        Forzar Creación e Inscribir
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
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
              <p className="text-sm text-gray-500 mb-6">Añade o quita los bloques de tiempo donde este profesor estará disponible. El sistema guardará esta disponibilidad para que los estudiantes y tú puedan asignarle clases.</p>
              
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

      {/* Modal Ver Alumnos */}
      {viewStudentsModalOpen && selectedClassForStudents && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <div>
                <h3 className="text-xl font-black text-gray-800">Alumnos Inscritos</h3>
                <p className="text-sm text-gray-500">{selectedClassForStudents.date.split('T')[0]} a las {selectedClassForStudents.start_time}</p>
              </div>
              <button onClick={() => setViewStudentsModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition">
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              {selectedClassForStudents.bookings?.length === 0 ? (
                <div className="text-center text-gray-500 py-8">No hay alumnos inscritos en esta clase aún.</div>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {selectedClassForStudents.bookings?.map((booking: any) => (
                    <li key={booking.id} className="py-4 flex justify-between items-center">
                      <div>
                        <p className="font-bold text-gray-800">{booking.student_name}</p>
                        <p className="text-sm text-gray-500">{booking.student_email}</p>
                        <p className="text-xs text-gray-400 mt-1">Edad: {calculateAge(booking.student_birth_date)}</p>
                      </div>
                      <div className="flex gap-2 items-center">
                        {booking.status === 'ATTENDED' && <span className="bg-green-100 text-green-700 text-xs font-bold px-3 py-1 rounded-full">Asistió</span>}
                        {booking.status === 'ABSENT_NO_SHOW' && <span className="bg-red-100 text-red-700 text-xs font-bold px-3 py-1 rounded-full">Faltó</span>}
                        {booking.status === 'BOOKED' && (
                          <>
                            <span className="bg-orange-100 text-orange-700 text-xs font-bold px-3 py-1 rounded-full">Pendiente</span>
                            <button 
                              onClick={() => cancelStudentBooking(booking)}
                              className="text-xs bg-red-50 text-red-600 border border-red-200 px-3 py-1 rounded hover:bg-red-100 transition font-bold ml-2"
                            >
                              Cancelar
                            </button>
                          </>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            
            <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end">
              <button onClick={() => setViewStudentsModalOpen(false)} className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg font-bold hover:bg-gray-300 transition">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para Corregir Lección / Nivel */}
      {levelModalOpen && selectedStudent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <h3 className="text-xl font-bold text-gray-800">Corregir Nivel</h3>
              <button onClick={() => setLevelModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition">
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleUpdateLevel} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Lección Actual (1-50)</label>
                <input 
                  type="number" min="1" max="50" required
                  value={editingLevel.current_lesson} 
                  onChange={e => setEditingLevel({...editingLevel, current_lesson: Number(e.target.value)})} 
                  className="w-full p-3 border border-gray-300 rounded outline-none focus:ring-2 focus:ring-blue-500" 
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Tipo de Sesión</label>
                <select 
                  value={editingLevel.current_session_type} 
                  onChange={e => setEditingLevel({...editingLevel, current_session_type: e.target.value})} 
                  className="w-full p-3 border border-gray-300 rounded outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ESSENTIAL">Essential</option>
                  <option value="WORKING_CLASS">Working Class</option>
                  <option value="SPEAK_OUT">Speak Out</option>
                  <option value="EXAM_WRITTEN">Examen Escrito</option>
                  <option value="EXAM_ORAL">Examen Oral</option>
                </select>
              </div>
              <div className="pt-4 flex gap-4">
                <button type="button" onClick={() => setLevelModalOpen(false)} className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-lg hover:bg-gray-200 transition">
                  Cancelar
                </button>
                <button type="submit" disabled={updatingLevel} className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition disabled:opacity-50">
                  {updatingLevel ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Historial Académico */}
      {historyModalOpen && selectedStudent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <h3 className="text-xl font-bold text-gray-800">
                Historial Académico: <span className="text-blue-600">{selectedStudent.name}</span>
              </h3>
              <button onClick={() => setHistoryModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition">
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 bg-gray-50">
              {loadingHistory ? (
                <p className="text-center text-gray-500 py-8 font-bold">Cargando historial...</p>
              ) : studentHistory.length === 0 ? (
                <p className="text-center text-gray-500 py-8">El alumno no tiene clases pasadas aún.</p>
              ) : (
                <div className="space-y-4">
                  {studentHistory.map((record: any) => (
                    <div key={record.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <span className="text-xs font-bold bg-blue-100 text-blue-700 px-2 py-1 rounded">
                            {new Date(record.date).toLocaleDateString('es-ES', { timeZone: 'UTC' })} a las {record.start_time}
                          </span>
                          <h4 className="font-bold text-gray-800 mt-2">Lección {record.anchor_lesson} ({record.session_type})</h4>
                          <p className="text-xs text-gray-500 mt-1">Profesor: {record.teacher_name}</p>
                        </div>
                        <div className="text-right">
                          {record.status === 'ATTENDED' ? (
                            <div className="text-xl font-black text-green-600">{record.grade}/100</div>
                          ) : (
                            <span className="text-xs font-bold text-red-600 bg-red-100 px-2 py-1 rounded">Inasistencia</span>
                          )}
                        </div>
                      </div>
                      {record.observations && (
                        <div className="mt-3 bg-gray-50 p-3 rounded-lg border border-gray-100 text-sm text-gray-700 italic">
                          "{record.observations}"
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
