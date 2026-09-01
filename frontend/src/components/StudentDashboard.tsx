import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, CheckCircle, Clock, Users, ArrowRight, Target, Calendar } from 'lucide-react';
import api from '../api/axios';

export default function StudentDashboard() {
  const [activeTab, setActiveTab] = useState<'booking' | 'history'>('booking');
  const [profile, setProfile] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [recommendedClasses, setRecommendedClasses] = useState<any[]>([]);
  const [anchorDate, setAnchorDate] = useState('');
  const [anchorTime, setAnchorTime] = useState('');
  const [availableTeachers, setAvailableTeachers] = useState<any[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [showAnchorForm, setShowAnchorForm] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchProfile();
    fetchRecommendedClasses();
    fetchHistory();
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await api.get('/users/me');
      setProfile(res.data);
    } catch (error) {
      console.error(error);
      navigate('/login');
    }
  };

  const fetchRecommendedClasses = async () => {
    try {
      const res = await api.get('/classes/available');
      setRecommendedClasses(res.data);
    } catch (error) {
      console.error(error);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await api.get('/users/me/history');
      setHistory(res.data);
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
        alert('Lo sentimos, no hay docentes disponibles para este horario.');
      }
    } catch (e) {
      console.error(e);
      alert('Error al buscar profesores.');
    }
  };

  const handleBookClass = async (date: string, startTime: string, teacherId?: string) => {
    try {
      await api.post('/bookings/book', { date, startTime, teacherId });
      alert(teacherId ? '¡Clase ancla creada y reserva confirmada!' : '¡Reserva confirmada exitosamente!');
      fetchProfile(); // Refrescar metas semanales (si hubiera)
      fetchRecommendedClasses(); // Refrescar los cupos disponibles
      fetchHistory(); // Actualizar historial
      setShowAnchorForm(false);
      setAvailableTeachers([]);
    } catch (error: any) {
      alert(error.response?.data?.message || 'Error al realizar la reserva');
    }
  };

  const cancelBooking = async (booking: any) => {
    const [year, month, day] = booking.classSession.date.split('T')[0].split('-').map(Number);
    const [hours, minutes] = booking.classSession.start_time.split(':').map(Number);
    const classDateTime = new Date(year, month - 1, day, hours, minutes, 0, 0);
    const now = new Date();
    const diffMs = classDateTime.getTime() - now.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    let confirmMsg = '¿Seguro que deseas cancelar esta reserva?';
    if (diffHours < 5) {
      confirmMsg = '¡ADVERTENCIA DE CANCELACIÓN TARDÍA!\n\nEstás cancelando con menos de 5 horas de anticipación. Consecuencias:\n\n1. Se te registrará como Falta Injustificada con nota 0.\n2. NO podrás reservar otra clase para el día de hoy.\n3. Recién podrás reservar tu siguiente clase a partir de mañana.\n\n¿Estás completamente seguro de que deseas cancelar la clase?';
    }

    if (!window.confirm(confirmMsg)) return;

    try {
      await api.post(`/bookings/cancel/${booking.id}`);
      alert('Clase cancelada exitosamente.');
      fetchProfile();
      fetchHistory();
      fetchRecommendedClasses();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Error al cancelar la reserva');
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  if (!profile) return <div className="p-8 text-center text-gray-500 font-bold">Cargando perfil...</div>;

  const studentProfile = profile.studentProfile || {};

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      <nav className="bg-white shadow-sm px-6 md:px-8 py-4 flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <h1 className="text-xl font-bold text-blue-600">Instituto Virtual</h1>
        <div className="flex items-center gap-4">
          <span className="font-medium text-gray-700 text-sm md:text-base">Hola, {profile.name}</span>
          <button onClick={logout} className="text-sm text-red-500 hover:text-red-700 font-medium">Salir</button>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-8 mb-8">
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('booking')}
            className={`pb-4 px-6 text-sm font-bold border-b-2 transition ${activeTab === 'booking' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            Reservar Clases
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`pb-4 px-6 text-sm font-bold border-b-2 transition ${activeTab === 'history' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            Historial Académico
          </button>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-8">
        
        {activeTab === 'booking' && (
          <>
            {/* Resumen */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
                <div className="p-4 bg-blue-100 text-blue-600 rounded-full">
                  <BookOpen size={24} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Progreso Actual</p>
                  <h3 className="text-xl font-bold">Lección {studentProfile.current_lesson || 1} - {studentProfile.current_session_type || 'ESSENTIAL'}</h3>
                </div>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
                <div className="p-4 bg-purple-100 text-purple-600 rounded-full">
                  <Target size={24} />
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-end mb-1">
                    <p className="text-sm font-bold text-gray-500">Meta Semanal</p>
                    <span className="text-sm font-black text-purple-600">0 / 3</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2.5 mb-1">
                    <div className="bg-purple-500 h-2.5 rounded-full" style={{ width: '0%' }}></div>
                  </div>
                  <p className="text-xs text-gray-400 font-medium">Clases obligatorias</p>
                </div>
              </div>
              
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
                <div className="p-4 bg-green-100 text-green-600 rounded-full">
                  <CheckCircle size={24} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Expiración de Acceso</p>
                  <h3 className="text-lg font-bold text-gray-800">
                    {studentProfile.access_expires_at ? new Date(studentProfile.access_expires_at).toLocaleDateString() : 'Activo'}
                  </h3>
                </div>
              </div>
            </div>

            {/* Tus Próximas Clases */}
            {history.filter((b: any) => b.status === 'BOOKED').length > 0 && (
              <div className="mb-12">
                <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                  <Calendar className="text-blue-600" /> Tus Próximas Clases
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {history.filter((b: any) => b.status === 'BOOKED').map((booking: any) => {
                    // Calcular si faltan menos de 5 minutos
                    const [year, month, day] = booking.classSession.date.split('T')[0].split('-').map(Number);
                    const [hours, minutes] = booking.classSession.start_time.split(':').map(Number);
                    const classDateTime = new Date(year, month - 1, day, hours, minutes, 0, 0);
                    
                    const now = new Date();
                    const diffMs = classDateTime.getTime() - now.getTime();
                    const diffMinutes = diffMs / (1000 * 60);
                    const canJoin = diffMinutes <= 5;
                    const meetLink = booking.classSession.teacher?.meet_link;

                    return (
                      <div key={booking.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="p-5 flex flex-col md:flex-row justify-between md:items-center gap-4">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-bold bg-blue-100 text-blue-700 px-2 py-1 rounded">
                                {new Date(booking.classSession.date).toLocaleDateString('es-ES', { timeZone: 'UTC', day: 'numeric', month: 'short' })}
                              </span>
                              <span className="text-sm font-medium text-gray-500">
                                {booking.classSession.session_type} - Lección {booking.classSession.anchor_lesson}
                              </span>
                            </div>
                            <h4 className="text-2xl font-black text-gray-800">{booking.classSession.start_time}</h4>
                            <p className="text-gray-600 font-medium">Profesor: {booking.classSession.teacher?.user?.name || 'Asignado'}</p>
                          </div>
                          <div className="flex gap-2">
                            {canJoin ? (
                              <a 
                                href={meetLink || '#'} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg text-sm transition text-center flex-1"
                              >
                                Unirse a Videollamada
                              </a>
                            ) : (
                              <button 
                                disabled
                                className="px-4 py-2 bg-gray-100 text-gray-400 font-bold rounded-lg text-sm flex-1 cursor-not-allowed"
                              >
                                Disponible 5 min antes
                              </button>
                            )}
                            <button 
                              onClick={() => cancelBooking(booking)}
                              className="px-4 py-2 border border-red-200 text-red-600 hover:bg-red-50 font-bold rounded-lg text-sm transition"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="mb-12">
              <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                <Clock className="text-blue-600" /> Horarios Recomendados para ti
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {recommendedClasses.length === 0 ? (
                   <div className="col-span-3 text-center p-8 bg-white border rounded-xl text-gray-500">No hay clases recomendadas en este momento.</div>
                ) : (
                  recommendedClasses.map((cls: any) => (
                    <div key={cls.id} className="bg-white border-2 border-transparent hover:border-blue-500 rounded-2xl p-6 shadow-sm hover:shadow-lg transition cursor-pointer group relative overflow-hidden">
                      <div className="absolute top-0 right-0 bg-blue-500 text-white text-xs font-bold px-4 py-1 rounded-bl-xl">
                        {cls.available_spots} cupos libres
                      </div>
                      <p className="text-sm text-blue-600 font-bold uppercase tracking-wider mb-1">
                        {new Date(cls.date).toLocaleDateString('es-ES', { timeZone: 'UTC' })}
                      </p>
                      <div className="flex justify-between items-end mb-2">
                        <h3 className="text-4xl font-black text-gray-800">
                           {cls.start_time}
                        </h3>
                        <span className="bg-gray-100 text-gray-600 text-[10px] px-2 py-1 rounded-md font-bold uppercase whitespace-nowrap">
                          {cls.session_type}
                        </span>
                      </div>
                      <div className="flex justify-between items-center mb-6">
                        <p className="text-gray-500 text-sm flex items-center gap-2">
                          <Users size={16} /> Prof. {cls.teacher_name || 'Asignado'}
                        </p>
                        <p className="text-xs text-blue-800 font-bold bg-blue-50 px-2 py-1 rounded">
                          Lecciones {Math.max(1, cls.anchor_lesson - (cls.anchor_lesson > 30 ? 3 : 2))} al {Math.min(50, cls.anchor_lesson + (cls.anchor_lesson > 30 ? 3 : 2))}
                        </p>
                      </div>
                      <button 
                        onClick={() => handleBookClass(cls.date, cls.start_time)}
                        className="w-full py-3 bg-blue-50 text-blue-700 font-bold rounded-xl group-hover:bg-blue-600 group-hover:text-white transition flex items-center justify-center gap-2"
                      >
                        Unirme a este grupo <ArrowRight size={18} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
            
            {/* Formulario Ancla */}
            <div className="bg-gray-100 rounded-2xl border border-gray-200 p-8 mt-8">
              {!showAnchorForm ? (
                <div className="text-center">
                  <h2 className="text-xl font-bold text-gray-800 mb-2">¿No encuentras un horario que te sirva?</h2>
                  <p className="text-gray-600 mb-4">Usa uno de tus comodines semanales para abrir una clase nueva en tu horario preferido.</p>
                  <button onClick={() => setShowAnchorForm(true)} className="bg-white border-2 border-blue-600 text-blue-600 px-6 py-2 rounded-lg font-bold hover:bg-blue-50">
                    Crear mi propia clase
                  </button>
                </div>
              ) : (
                <div>
                  <h2 className="text-xl font-bold text-gray-800 mb-4">Aperturar Nuevo Horario</h2>
                  <p className="text-sm text-gray-500 mb-6">Selecciona el día y la hora que deseas estudiar. Buscaremos si hay algún profesor disponible.</p>
                  
                  {(() => {
                    const getLocalString = (d: Date) => {
                      const y = d.getFullYear();
                      const m = String(d.getMonth() + 1).padStart(2, '0');
                      const day = String(d.getDate()).padStart(2, '0');
                      return `${y}-${m}-${day}`;
                    };

                    const today = new Date();
                    const max = new Date();
                    max.setDate(today.getDate() + 2);
                    
                    const todayStr = getLocalString(today);
                    const maxStr = getLocalString(max);

                    return (
                      <div className="flex gap-4 mb-6">
                        <div className="flex-1">
                          <label className="block text-sm font-bold text-gray-700 mb-1">Día</label>
                          <input 
                            type="date" 
                            min={todayStr} 
                            max={maxStr}
                            value={anchorDate} 
                            onChange={e => { setAnchorDate(e.target.value); setAvailableTeachers([]); setSelectedTeacherId(''); }} 
                            className="w-full p-3 rounded-lg border border-gray-300" 
                          />
                        </div>
                        <div className="flex-1">
                          <label className="block text-sm font-bold text-gray-700 mb-1">Hora (ej. 14:00)</label>
                          <select value={anchorTime} onChange={e => { setAnchorTime(e.target.value); setAvailableTeachers([]); setSelectedTeacherId(''); }} className="w-full p-3 rounded-lg border border-gray-300">
                            <option value="">-- Hora --</option>
                            {[...Array(14)].map((_, i) => (
                              <option key={i} value={`${String(i + 8).padStart(2, '0')}:00`}>{`${String(i + 8).padStart(2, '0')}:00`}</option>
                            ))}
                          </select>
                        </div>
                        <div className="flex items-end">
                          <button onClick={handleSearchTeachers} className="bg-gray-800 text-white px-6 py-3 rounded-lg font-bold hover:bg-gray-900">
                            Buscar Profesores
                          </button>
                        </div>
                      </div>
                    );
                  })()}

                  {availableTeachers.length > 0 && (
                    <div className="bg-white p-6 rounded-xl border border-gray-200">
                      <label className="block text-sm font-bold text-gray-700 mb-2">¡Genial! Hemos encontrado profesores disponibles. Selecciona uno:</label>
                      <div className="flex gap-4">
                        <select value={selectedTeacherId} onChange={e => setSelectedTeacherId(e.target.value)} className="flex-1 p-3 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500">
                          <option value="">-- Selecciona tu profesor --</option>
                          {availableTeachers.map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </select>
                        <button 
                          onClick={() => handleBookClass(anchorDate, anchorTime, selectedTeacherId)}
                          disabled={!selectedTeacherId}
                          className="bg-blue-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50"
                        >
                          Confirmar y Reservar
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="mt-4 text-center">
                    <button onClick={() => setShowAnchorForm(false)} className="text-gray-500 hover:text-gray-700 font-bold text-sm">
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === 'history' && (
          <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
              <BookOpen className="text-blue-600" /> Tu Historial Académico
            </h2>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[600px]">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="px-6 py-4 text-sm font-semibold text-gray-500">Fecha</th>
                      <th className="px-6 py-4 text-sm font-semibold text-gray-500">Nivel y Sesión</th>
                      <th className="px-6 py-4 text-sm font-semibold text-gray-500">Docente</th>
                      <th className="px-6 py-4 text-sm font-semibold text-gray-500 text-right">Nota / Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {history.length === 0 ? (
                       <tr><td colSpan={4} className="text-center p-8 text-gray-500">No tienes clases registradas aún.</td></tr>
                    ) : (
                      history.map((booking: any) => (
                        <tr key={booking.id} className="hover:bg-gray-50 transition">
                          <td className="px-6 py-4 text-sm text-gray-700">
                            {booking.classSession?.date ? new Date(booking.classSession.date).toLocaleDateString('es-ES', { timeZone: 'UTC' }) : new Date(booking.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4">
                            <span className="font-bold text-gray-800 block">Lección {booking.classSession?.anchor_lesson || '?'}</span>
                            <span className="text-xs text-blue-600 font-bold uppercase tracking-wider">{booking.classSession?.session_type || 'N/A'}</span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-700">{booking.classSession?.teacher?.user?.name || '-'}</td>
                          <td className="px-6 py-4 text-right">
                             <span className={`font-bold text-xl ${booking.status === 'CANCELED' ? 'text-gray-400 text-sm italic' : booking.grade !== null && booking.grade >= 80 ? 'text-green-600' : 'text-red-600'}`}>
                               {booking.status === 'CANCELED' ? 'Cancelada' : (booking.grade ?? 'Pendiente')}
                             </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
