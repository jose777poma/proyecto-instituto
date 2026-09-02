export const formatRelativeDate = (dateString: string) => {
  // Aseguramos que dateString (ej: '2026-09-01T00:00:00.000Z') se parsee sin afectar la zona horaria
  const [year, month, day] = dateString.split('T')[0].split('-').map(Number);
  
  // Fecha de la clase (medianoche local)
  const targetDate = new Date(year, month - 1, day);
  
  // Fecha actual (medianoche local)
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Diferencia en días
  const diffTime = targetDate.getTime() - today.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  const formattedDate = targetDate.toLocaleDateString('es-ES', { 
    day: 'numeric', 
    month: 'long' 
  });

  if (diffDays === 0) {
    return `Hoy (${formattedDate})`;
  } else if (diffDays === 1) {
    return `Mañana (${formattedDate})`;
  } else if (diffDays === -1) {
    return `Ayer (${formattedDate})`;
  }

  return formattedDate;
};
