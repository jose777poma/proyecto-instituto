# Diseño de la Base de Datos

El almacenamiento de datos está implementado en **PostgreSQL** y gestionado mediante el ORM **Prisma**. El diseño es completamente relacional, normalizado y fuertemente tipado.

## Esquema General de Entidades

### 1. Gestión de Usuarios y Perfiles
El sistema adopta un modelo donde la tabla central `User` maneja exclusivamente la autenticación y los datos base, mientras que los detalles específicos de cada rol se delegan a perfiles extendidos mediante relaciones Uno-a-Uno (1:1).

- **`User`**: Almacena credenciales (email, password_hash), nombre, rol (`ADMIN`, `SECRETARY`, `TEACHER`, `STUDENT`) y timestamps básicos de creación/actualización.
- **`StudentProfile`**: Relacionado 1:1 con `User`. Almacena información vital del estudiante: fecha de nacimiento, lección actual, tipo de sesión en curso y fecha límite de expiración de su acceso a la plataforma.
- **`TeacherProfile`**: Relacionado 1:1 con `User`. Contiene atributos del profesor: estado de actividad (activo/inactivo), su enlace fijo de videollamada (Meet/Zoom) y una bandera booleana para saber si está habilitado para realizar exámenes orales/escritos.

### 2. Gestión de Disponibilidad Docente
- **`TeacherAvailability`**: Define la plantilla de horario semanal del profesor (día de la semana en formato numérico y hora de inicio). Mantiene una relación 1:N con `TeacherProfile`.
- **`TeacherException`**: Permite registrar las excepciones a su horario habitual (ej. vacaciones, permisos de salud). Incluye fecha exacta y un texto descriptivo.

### 3. Sistema de Clases (Scheduling)
- **`ClassSession`**: Representa un bloque de clase programada en el calendario. 
  - Está asignada a un profesor específico.
  - Almacena la fecha exacta, hora de inicio, y el estado del ciclo de vida de la clase (`OPEN`, `CLOSED`, `COMPLETED`, `CANCELED`).
  - Registra el tipo de sesión (`ESSENTIAL`, `WORKING_CLASS`, `SPEAK_OUT`, `EXAM_WRITTEN`, `EXAM_ORAL`).
  - Almacena la "lección ancla", la cual dicta el tópico y restringe qué otros alumnos pueden unirse a esa misma clase.

### 4. Sistema de Reservas (Bookings) y Cuotas Semanales
- **`Booking`**: Funciona como la tabla intermedia (M:N) que asocia a un `StudentProfile` con una `ClassSession`.
  - Registra si el estudiante usó un token tipo `ANCHOR` (fue el primero, definió la lección) o `JOIN` (se unió a una lección existente).
  - Gestiona el estado de asistencia (`BOOKED`, `CANCELED`, `ATTENDED`, `ABSENT_NO_SHOW`).
  - Permite guardar la nota (`grade`) y observaciones que el profesor deja sobre el desempeño del alumno.
- **`StudentWeeklyQuota`**: Lleva el control transaccional semanal del límite de reservas por alumno. Registra cuántos tokens `anchor` y `join` han sido consumidos en la semana corriente (usualmente limitado a 3 de cada tipo).

### 5. Auditoría y Trazabilidad (Audit Trail)
- **`AuditLog`**: Una entidad totalmente independiente dedicada a registrar el historial de acciones críticas del sistema. Guarda el identificador y rol del usuario que ejecutó la acción (`actorId`, `actorRole`), el tipo de acción (`action`), la entidad afectada (`entityType`, `entityId`), detalles en texto y el sello de tiempo. Esencial para soporte técnico, seguridad y resolución de conflictos.

## Enumeraciones (Enums)
Para asegurar la consistencia y validación de datos a nivel de base de datos, se utilizan los siguientes enums:
- **`Role`**: ADMIN, SECRETARY, TEACHER, STUDENT
- **`SessionType`**: ESSENTIAL, WORKING_CLASS, SPEAK_OUT, EXAM_WRITTEN, EXAM_ORAL
- **`ClassStatus`**: OPEN, CLOSED, COMPLETED, CANCELED
- **`BookingStatus`**: BOOKED, CANCELED, ATTENDED, ABSENT_NO_SHOW
- **`TokenType`**: ANCHOR, JOIN
