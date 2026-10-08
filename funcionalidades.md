# Funcionalidades del Sistema

El sistema constituye una plataforma educativa integral para la programación de clases, gestión de reservas (bookings), control de cuotas de alumnos y seguimiento académico. A continuación se detallan las funcionalidades (presentes y requeridas) organizadas por módulo.

## 1. Autenticación, Autorización y Seguridad
- **Inicio de Sesión (Login):** Acceso seguro mediante validación de credenciales (email y contraseña encriptada).
- **Sistema de Tokens JWT:** Emisión de tokens de sesión con fecha de expiración para mantener la sesión viva de manera segura.
- **Control de Acceso Basado en Roles (RBAC):** La plataforma enruta al usuario a diferentes experiencias y restringe el acceso a la API dependiendo de si es Administrador, Secretario, Profesor o Estudiante.

## 2. Portal del Estudiante (Student Dashboard)
- **Panel de Cuotas Semanales:** Visualización en tiempo real de los tokens disponibles (Anchor Tokens y Join Tokens) para la semana en curso.
- **Motor de Reservas (Bookings):** 
  - Capacidad para explorar clases `OPEN` (abiertas).
  - Inscribirse en una clase vacía y definir la lección (gastando un Anchor Token).
  - Unirse a una clase ya iniciada por otro compañero si coincide con la lección que el estudiante necesita (gastando un Join Token).
- **Gestor de Progreso Académico:** Visualización de la lección actual requerida y el tipo de sesión que debe cursar el alumno.
- **Control de Suscripción:** Alertas sobre la fecha de vencimiento del acceso a la plataforma (`access_expires_at`).
- **Historial Académico:** Acceso a un registro histórico de clases pasadas, visualizando asistencia, calificaciones numéricas y retroalimentación (observaciones) del profesor.

## 3. Portal del Profesor (Teacher Dashboard)
- **Gestión de Disponibilidad Horaria:** Herramienta para que el docente configure sus bloques horarios semanales fijos.
- **Gestión de Excepciones:** Capacidad para bloquear fechas u horas específicas debido a permisos, vacaciones o contingencias (`TeacherExceptions`).
- **Gestión de Clases en Vivo:** Visualización del cronograma de clases asignadas y el listado de alumnos inscritos en cada una.
- **Pasar Lista y Calificar:** Módulo dentro de cada clase completada para:
  - Marcar a cada estudiante como Presente (`ATTENDED`) o Ausente (`ABSENT_NO_SHOW`).
  - Asignar calificaciones.
  - Redactar notas u observaciones sobre el desempeño.
- **Integración de Sala Virtual:** Acceso directo e incrustado a su enlace de videollamada personal (Google Meet/Zoom) para facilitar el inicio rápido de la clase.

## 4. Portal Administrativo y de Secretaría (Admin / Secretary Dashboard)
- **Gestor CRUD de Usuarios:** Creación, lectura, edición y suspensión de todos los tipos de usuarios (profesores, alumnos, staff).
- **Control Global de Calendarios:** Capacidad para crear, forzar el cierre, editar o cancelar manualmente sesiones de clase (`ClassSessions`), sobrescribiendo restricciones si es necesario.
- **Asignación Manual de Reservas:** Herramienta para asignar estudiantes a clases de forma administrativa (útil para solucionar problemas o reagendamientos especiales).
- **Administración de Suscripciones y Niveles:** Capacidad de renovar las fechas de expiración de acceso de los alumnos y forzar el avance (o retroceso) de sus niveles/lecciones actuales manualmente.
- **Monitoreo y Auditoría:** Acceso al log maestro del sistema (`AuditLog`) para auditar qué usuario realizó qué modificación, cuándo y sobre qué registro, garantizando la seguridad y responsabilidad dentro de la plataforma.

## 5. Automatizaciones y Lógica Core (Backend Engine)
- **Reglas de Motor de Tokens:** La lógica subyacente que valida que un estudiante no exceda su límite de 3 reservas "Anchor" ni 3 reservas "Join" por semana.
- **Bloqueo de Incongruencias:** Validación estricta que impide a un estudiante reservar una clase cuyo contenido ("lección ancla") o tipo de sesión no coincida con el nivel que tiene registrado en su perfil.
- **Transiciones Automáticas de Estado:** Al cerrarse una clase o completarse la evaluación por parte del profesor, el sistema actualiza automáticamente los perfiles de los estudiantes para avanzarlos de lección (dependiendo de la nota y tipo de sesión).
- **Registro Automático de Auditoría:** Cada endpoint crítico (POST, PUT, DELETE, PATCH) intercepta la acción para escribir un rastro imborrable en el `AuditLog`.
