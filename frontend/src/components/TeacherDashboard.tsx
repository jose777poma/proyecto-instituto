import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Users, CheckCircle, XCircle, Clock, BookOpen } from 'lucide-react';
import api from '../api/axios';

export default function TeacherDashboard() {
  const [activeTab, setActiveTab] = useState<'agenda' | 'history'>('agenda');
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [grades, setGrades] = useState<{[key: string]: string}>({});
  const [observations, setObservations] = useState<{[key: string]: string}>({});
  const navigate = useNavigate();

  const [meetLink, setMeetLink] = useState('');
  const [isEditingLink, setIsEditingLink] = useState(false);
  
  // Modal de Historial
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [selectedStudentForHistory, setSelectedStudentForHistory] = useState<any>(null);
  const [studentHistory, setStudentHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const calculateAge = (birthDate: string | null | undefined) => {
    if (!birthDate) return 'N/A';
    const dob = new Date(birthDate);
    const diff_ms = Date.now() - dob.getTime();
    const age_dt = new Date(diff_ms);
    return Math.abs(age_dt.getUTCFullYear() - 1970);
  };

  const renderSessionTypeBadge = (sessionType: string) => {
    switch (sessionType) {
      case 'EXAM_WRITTEN':
        return <span className="bg-red-100 text-red-700 text-xs font-bold px-3 py-1 rounded-full border border-red-200">EXAMEN ESCRITO</span>;
      case 'EXAM_ORAL':
        return <span className="bg-purple-100 text-purple-700 text-xs font-bold px-3 py-1 rounded-full border border-purple-200">EXAMEN ORAL</span>;
      default:
        return <span className="bg-blue-100 text-blue-700 text-xs font-bold px-3 py-1 rounded-full">{sessionType}</span>;
    }
  };

  useEffect(() => {
    fetchAgenda();
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await api.get('/users/me');
      if (res.data.teacherProfile?.meet_link) {
        setMeetLink(res.data.teacherProfile.meet_link);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchAgenda = async () => {
    try {
      const res = await api.get('/classes/teacher');
      setClasses(res.data);
    } catch (error) {
      console.error(error);
      navigate('/login');
    } finally {
      setLoading(false);
    }
  };

  const openStudentHistory = async (student: any) => {
    setSelectedStudentForHistory(student);
    setHistoryModalOpen(true);
    setLoadingHistory(true);
    try {
      const res = await api.get(`/classes/student/${student.userId}/history`);
      setStudentHistory(res.data);
    } catch (e) {
      console.error(e);
      alert('Error al cargar el historial del estudiante');
    } finally {
      setLoadingHistory(false);
    }
  };

  const saveMeetLink = async () => {
    try {
      await api.post('/users/me/meet-link', { meet_link: meetLink });
      alert('Link de Google Meet actualizado correctamente.');
      setIsEditingLink(false);
    } catch (e) {
      alert('Error al guardar el link');
      console.error(e);
    }
  };

  const handleGrade = async (booking: any) => {
    const rawGrade = grades[booking.id];
    if (rawGrade === undefined || rawGrade === '') {
      alert('Por favor, escribe una nota en la casilla antes de guardar.');
      return;
    }
    
    const gradeVal = parseInt(rawGrade, 10);
    const obsVal = observations[booking.id] || '';
    if (isNaN(gradeVal) || gradeVal < 0 || gradeVal > 100) {
      alert('Por favor ingresa una nota válida entre 0 y 100');
      return;
    }
    
    if (!window.confirm(`Se calificará al estudiante ${booking.student.name} con una nota de ${gradeVal}/100.\n\n¿Estás seguro de guardar esta calificación? Esta acción es definitiva.`)) {
      return;
    }

    try {
      await api.post(`/bookings/grade/${booking.id}`, { grade: gradeVal, observations: obsVal });
      alert('Nota y observaciones registradas');
      fetchAgenda();
    } catch (e: any) {
      alert(e.response?.data?.message || 'Error');
    }
  };

  const handleAbsent = async (bookingId: string) => {
    if (!window.confirm('¿Marcar inasistencia al estudiante?')) return;
    try {
      await api.post(`/bookings/absent/${bookingId}`);
      alert('Falta registrada');
      fetchAgenda();
    } catch (e: any) {
      alert(e.response?.data?.message || 'Error');
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  if (loading) return <div className="p-8 text-center text-gray-500 font-bold">Cargando agenda...</div>;

  const localDateStr = (dateString: string) => {
    // Convierte 2026-08-28T00:00:00.000Z a 2026-08-28 ignorando timezone
    return dateString.split('T')[0];
  };

  const todayStr = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/La_Paz' }); // o usar tu logica de timezone

  const upcomingClasses = classes.filter(c => localDateStr(c.date) >= todayStr && c.status !== 'COMPLETED' && c.status !== 'CANCELED');
  const pastClasses = classes.filter(c => localDateStr(c.date) < todayStr || c.status === 'COMPLETED' || c.status === 'CANCELED');

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      <nav className="bg-white shadow-sm px-6 md:px-8 py-4 flex justify-between items-center mb-6">
        <h1 className="text-xl font-bold text-blue-600">Instituto Virtual</h1>
        <div className="flex items-center gap-4">
          <span className="font-medium text-gray-700">Hola, Profesor</span>
          <button onClick={logout} className="text-sm text-red-500 hover:text-red-700 font-medium">Salir</button>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-8">
        
        {/* Configuración de Meet */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 mb-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-gray-800">Sala de Videollamada (Google Meet)</h2>
            <p className="text-gray-500 text-sm">Este es el link que los alumnos usarán para unirse a tus clases.</p>
          </div>
          <div className="flex w-full md:w-auto gap-2">
            <input 
              type="text" 
              value={meetLink}
              onChange={(e) => setMeetLink(e.target.value)}
              disabled={!isEditingLink}
              placeholder="https://meet.google.com/xxx-xxxx-xxx"
              className="flex-1 md:w-80 px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
            />
            {isEditingLink ? (
              <button onClick={saveMeetLink} className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-green-700">Guardar</button>
            ) : (
              <button onClick={() => setIsEditingLink(true)} className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-bold hover:bg-gray-300">Editar</button>
            )}
          </div>
        </div>

        <div className="flex border-b border-gray-200 mb-8">
          <button
            onClick={() => setActiveTab('agenda')}
            className={`pb-4 px-6 text-sm font-bold border-b-2 transition ${activeTab === 'agenda' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            Agenda del Día
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`pb-4 px-6 text-sm font-bold border-b-2 transition ${activeTab === 'history' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            Historial de Clases
          </button>
        </div>

        {activeTab === 'agenda' && (
          <>
            <div className="mb-8 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                <Calendar className="text-blue-600" /> Tus Clases Programadas
              </h2>
              <div className="bg-blue-100 text-blue-700 px-4 py-2 rounded-lg font-bold">
                {upcomingClasses.length} Clases
              </div>
            </div>

            <div className="space-y-6 mb-12">
              {upcomingClasses.length === 0 ? (
                <div className="p-8 text-center text-gray-500 bg-white border rounded-xl">No tienes clases programadas.</div>
              ) : (
                upcomingClasses.map((cls) => (
                  <div key={cls.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="bg-gray-50 border-b border-gray-200 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="text-xl font-black text-gray-800 uppercase">
                            {new Date(cls.date).toLocaleDateString('es-ES', { timeZone: 'UTC', day: 'numeric', month: 'short' })} - {cls.start_time}
                          </h3>
                          {renderSessionTypeBadge(cls.session_type)}
                          <span className="bg-gray-200 text-gray-700 text-xs font-bold px-3 py-1 rounded-full">
                            Lección {cls.anchor_lesson}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 flex items-center gap-2">
                          <Users size={16} /> {cls.bookings?.length || 0} alumnos inscritos
                        </p>
                      </div>
                      <button className="w-full md:w-auto px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition">
                        Abrir Sala de Meet
                      </button>
                    </div>

                    <div className="p-0 overflow-x-auto">
                      <table className="w-full text-left border-collapse min-w-[600px]">
                        <thead>
                          <tr className="bg-white border-b border-gray-100">
                            <th className="px-6 py-4 text-sm font-semibold text-gray-500">Alumno</th>
                            <th className="px-6 py-4 text-sm font-semibold text-gray-500">Estado</th>
                            <th className="px-6 py-4 text-sm font-semibold text-gray-500 text-right">Calificación</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {cls.bookings?.map((booking: any) => (
                            <tr key={booking.id} className="hover:bg-gray-50 transition">
                              <td className="px-6 py-4 font-medium text-gray-800">
                                <div className="flex items-center gap-2">
                                  <span>{booking.student.name}</span>
                                  <button 
                                    onClick={() => openStudentHistory(booking.student)}
                                    className="text-blue-500 hover:text-blue-700 bg-blue-50 p-1 rounded-full transition"
                                    title="Ver Historial Académico"
                                  >
                                    👁️
                                  </button>
                                </div>
                                <div className="text-xs text-gray-500 font-normal">
                                  Edad: {calculateAge(booking.student.birth_date)}
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                {booking.status === 'ATTENDED' ? (
                                  <span className="flex items-center gap-1 text-sm text-green-600 font-medium">
                                    <CheckCircle size={16} /> Calificado
                                  </span>
                                ) : booking.status === 'ABSENT_NO_SHOW' ? (
                                  <span className="flex items-center gap-1 text-sm text-red-600 font-medium">
                                    <XCircle size={16} /> Falta Injustificada
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-1 text-sm text-orange-500 font-medium">
                                    <Clock size={16} /> Pendiente
                                  </span>
                                )}
                              </td>
                              <td className="px-6 py-4 text-right">
                                {booking.status === 'ATTENDED' || booking.status === 'ABSENT_NO_SHOW' ? (
                                  <div className="flex flex-col items-end gap-1">
                                    <div className="text-xl font-bold text-gray-800">
                                      {booking.grade} <span className="text-sm text-gray-400 font-normal">/ 100</span>
                                    </div>
                                    {booking.observations && (
                                      <p className="text-xs text-gray-500 italic text-right max-w-xs">{booking.observations}</p>
                                    )}
                                  </div>
                                ) : (
                                  <div className="flex flex-col gap-2">
                                    <div className="flex items-center justify-end gap-2">
                                      <input 
                                        type="number" 
                                        min="0" 
                                        max="100" 
                                        placeholder="Nota"
                                        value={grades[booking.id] || ''}
                                        onChange={(e) => setGrades({...grades, [booking.id]: e.target.value})}
                                        className="w-20 p-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-center"
                                      />
                                      <button 
                                        onClick={() => handleGrade(booking)}
                                        className="px-4 py-2 bg-gray-800 text-white text-sm font-medium rounded-lg hover:bg-gray-900 transition"
                                      >
                                        Guardar
                                      </button>
                                      <button 
                                        onClick={() => handleAbsent(booking.id)}
                                        className="px-3 py-2 bg-red-50 text-red-600 text-sm font-medium rounded-lg hover:bg-red-100 transition" title="Marcar Inasistencia (Nota 0)"
                                      >
                                        Falta
                                      </button>
                                    </div>
                                    <textarea
                                      placeholder="Observaciones (solo visible para personal interno)"
                                      value={observations[booking.id] || ''}
                                      onChange={(e) => setObservations({...observations, [booking.id]: e.target.value})}
                                      className="w-full p-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none h-16"
                                    />
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                          {(!cls.bookings || cls.bookings.length === 0) && (
                            <tr><td colSpan={3} className="text-center p-4 text-gray-400 text-sm">Sin alumnos aún.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))
              )}
            </div>


          </>
        )}

        {activeTab === 'history' && (
          <div>
             <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2 mb-6">
               <BookOpen className="text-blue-600" /> Historial y Nómina
             </h2>
             <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
               <table className="w-full text-left border-collapse min-w-[800px]">
                 <thead>
                   <tr className="bg-gray-50 border-b border-gray-100">
                     <th className="px-6 py-4 text-sm font-semibold text-gray-500">Fecha</th>
                     <th className="px-6 py-4 text-sm font-semibold text-gray-500">Horario</th>
                     <th className="px-6 py-4 text-sm font-semibold text-gray-500">Nivel y Sesión</th>
                     <th className="px-6 py-4 text-sm font-semibold text-gray-500">Alumnos</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-gray-100">
                   {pastClasses.map(cls => (
                     <tr key={cls.id} className="hover:bg-gray-50">
                       <td className="px-6 py-4 text-sm">{new Date(cls.date).toLocaleDateString('es-ES', { timeZone: 'UTC' })}</td>
                       <td className="px-6 py-4 text-sm font-bold">{cls.start_time}</td>
                       <td className="px-6 py-4">
                         <span className="font-bold block mb-1">Lección {cls.anchor_lesson}</span>
                         {renderSessionTypeBadge(cls.session_type)}
                       </td>
                       <td className="px-6 py-4 text-sm">{cls.bookings?.length || 0}</td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>
          </div>
        )}
      </main>

      {/* Modal de Historial */}
      {historyModalOpen && selectedStudentForHistory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <h3 className="text-xl font-bold text-gray-800">
                Historial: <span className="text-blue-600">{selectedStudentForHistory.name}</span>
              </h3>
              <button onClick={() => setHistoryModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition">
                X
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
