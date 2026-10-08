# Especificación de Requisitos Funcionales (RF)

En base al análisis del código fuente (controladores y rutas), se han identificado los siguientes **Roles / Actores** en el sistema:

1. **Usuario Anónimo (PUBLIC):** Usuario no autenticado que busca acceder al sistema.
2. **Estudiante (STUDENT):** Usuario que consume las clases, hace reservas y lleva un seguimiento de su progreso.
3. **Profesor (TEACHER):** Usuario que imparte las clases, marca asistencias y emite calificaciones.
4. **Secretaría (SECRETARY):** Personal administrativo que gestiona estudiantes, profesores, reservas y horarios a nivel operativo.
5. **Administrador (ADMIN):** Usuario con privilegios absolutos, que además de funciones operativas gestiona altas de personal, pagos (extensiones) y auditoría.

A continuación, la tabla formal de requisitos funcionales extraída directamente de los endpoints del backend:

| Código | Nombre del Requisito | Actor(es) | Descripción Corta | Endpoint Asociado |
| :--- | :--- | :--- | :--- | :--- |
| **RF-01** | Registro de Usuario Público | PUBLIC | Permite a un usuario registrarse inicialmente en el sistema. | `POST /auth/register` |
| **RF-02** | Autenticación y Login | PUBLIC | Permite a un usuario iniciar sesión y obtener un token JWT. | `POST /auth/login` |
| **RF-03** | Visualizar Perfil Propio | ALL ROLES | Obtener la información del perfil del usuario autenticado (incluye cuotas y subperfiles). | `GET /users/me` |
| **RF-04** | Búsqueda de Estudiantes | SEC, ADMIN | Buscar estudiantes por nombre o correo electrónico para gestión. | `GET /users/search` |
| **RF-05** | Creación de Personal (Staff) | ADMIN | Crear un usuario administrativo (Secretaría o Admin). | `POST /users/staff` |
| **RF-06** | Listado de Personal | ADMIN | Ver la lista de personal administrativo del sistema. | `GET /users/staff` |
| **RF-07** | Creación de Profesor | ADMIN | Crear un nuevo perfil de profesor en la plataforma. | `POST /users/teacher` |
| **RF-08** | Listado de Profesores | SEC, ADMIN | Obtener la lista completa de profesores registrados. | `GET /users/teachers` |
| **RF-09** | Gestión Permisos de Exámenes | SEC, ADMIN | Habilitar o deshabilitar a un profesor para evaluar exámenes. | `PUT /users/teachers/:id/exams-permission` |
| **RF-10** | Ver Disponibilidad Docente | SEC, ADMIN | Visualizar los horarios base de un profesor específico. | `GET /users/teachers/:id/availability` |
| **RF-11** | Editar Disponibilidad Docente | SEC, ADMIN | Modificar los horarios en los que un profesor imparte clases. | `POST /users/teachers/:id/availability` |
| **RF-12** | Ver Excepciones y Feriados | SEC, ADMIN | Ver días bloqueados o feriados a nivel global o por profesor. | `GET /users/exceptions` |
| **RF-13** | Crear Excepciones | SEC, ADMIN | Registrar un día libre o feriado para un profesor o global. | `POST /users/exceptions` |
| **RF-14** | Eliminar Excepción | SEC, ADMIN | Borrar una excepción o feriado previamente creado. | `POST /users/exceptions/:id/delete` |
| **RF-15** | Creación de Estudiante | SEC, ADMIN | Registrar a un estudiante indicando lección actual y tiempo de acceso. | `POST /users/student` |
| **RF-16** | Extensión de Acceso (Pagos) | ADMIN | Aumentar los meses de acceso de un alumno en la plataforma. | `POST /users/:id/extend` |
| **RF-17** | Actualización Manual de Nivel | SEC, ADMIN | Modificar manualmente la lección o tipo de sesión de un alumno. | `POST /users/:id/level` |
| **RF-18** | Mi Historial de Clases | STUDENT | El alumno puede ver las clases que ha tomado y sus notas. | `GET /users/me/history` |
| **RF-19** | Mis Excepciones (Profesor) | TEACHER | El profesor visualiza los feriados y días libres que le afectan. | `GET /users/me/exceptions` |
| **RF-20** | Actualizar Link de Clase | TEACHER | El profesor actualiza su enlace de videollamada (Meet/Zoom). | `POST /users/me/meet-link` |
| **RF-21** | Ver Clases Disponibles | STU, SEC, ADM | Ver clases abiertas a las que el alumno es apto para unirse. | `GET /classes/available` |
| **RF-22** | Ver Profesores Disponibles | STU, SEC, ADM | Buscar docentes disponibles para abrir una nueva clase (Anchor). | `GET /bookings/available-teachers` |
| **RF-23** | Reserva de Clase Inteligente | STU, SEC, ADM | El sistema deduce si crea una clase (Anchor) o se une a una (Join). | `POST /bookings/book` |
| **RF-24** | Forzar Reserva a Clase | SEC, ADMIN | Un administrativo fuerza la inscripción de un alumno a una clase. | `POST /bookings/force-book` |
| **RF-25** | Forzar Creación Clase Ancla | SEC, ADMIN | Administrativo fuerza la apertura de una clase para un alumno. | `POST /bookings/force-create-anchor` |
| **RF-26** | Cancelar Reserva | STU, SEC, ADM | Cancelar la asistencia a una clase previamente reservada. | `POST /bookings/cancel/:id` |
| **RF-27** | Cancelar Clase Completa | SEC, ADMIN | Administrativo cancela una clase entera y notifica/libera alumnos. | `POST /classes/:id/cancel` |
| **RF-28** | Ver Clases del Profesor | TEACHER | El profesor visualiza sus próximas clases programadas. | `GET /classes/teacher` |
| **RF-29** | Ver Todas las Clases | SEC, ADMIN | Panel global para ver la parrilla de todas las clases del instituto. | `GET /classes/secretary` |
| **RF-30** | Historial Estudiantil Global | TEA, SEC, ADM | Visualizar todo el historial de clases de un estudiante específico. | `GET /classes/student/:id/history` |
| **RF-31** | Calificar Asistencia | TEA, SEC, ADM | Evaluar a un alumno tras la clase, asignando nota y feedback. | `POST /bookings/grade/:id` |
| **RF-32** | Marcar Ausencia | TEA, SEC, ADM | Marcar a un estudiante como "No Show" (ausente). | `POST /bookings/absent/:id` |
| **RF-33** | Ver Auditoría del Sistema | ADMIN | Revisar el registro inmutable de todas las acciones importantes. | `GET /audit` |

*(Notas: STU = STUDENT, SEC = SECRETARY, ADM = ADMIN, TEA = TEACHER)*
