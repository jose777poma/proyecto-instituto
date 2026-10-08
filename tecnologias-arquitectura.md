# Tecnologías, Arquitectura y Patrones de Diseño

## Tecnologías Utilizadas

### Frontend
- **Framework/Librería:** React 19
- **Lenguaje:** TypeScript
- **Bundler y Build Tool:** Vite 8
- **Estilos:** Tailwind CSS v4, PostCSS, Autoprefixer
- **Rutas:** React Router DOM v7
- **Peticiones HTTP:** Axios
- **Iconografía:** Lucide React
- **Autenticación:** jwt-decode (para manejo de tokens en el cliente)
- **Linting:** Oxlint

### Backend
- **Framework:** NestJS 12 (basado en Express)
- **Lenguaje:** TypeScript
- **ORM (Object-Relational Mapping):** Prisma (v5.22)
- **Base de Datos:** PostgreSQL
- **Autenticación:** Passport, JWT (JSON Web Tokens), bcrypt (para hashing de contraseñas)
- **Testing:** Vitest (incluyendo entornos e2e y de coverage), Supertest
- **Linting & Formateo:** Oxlint, Prettier

## Arquitectura del Sistema

### Arquitectura Frontend (Cliente SPA)
El frontend sigue una arquitectura de **Single Page Application (SPA)** basada en componentes funcionales modernos de React.
- **Componentes Orientados por Roles:** La interfaz está dividida lógicamente en dashboards específicos según el tipo de usuario (`AdminDashboard.tsx`, `SecretaryDashboard.tsx`, `TeacherDashboard.tsx`, `StudentDashboard.tsx`).
- **Protección de Rutas:** Se implementa un sistema de rutas protegidas (`ProtectedRoute.tsx`) para asegurar que solo usuarios autenticados y con los permisos adecuados puedan acceder a ciertas vistas.
- **Capa de Servicios de API:** La comunicación con el servidor se centraliza mediante instancias configuradas de Axios (`api/axios.ts`), facilitando la inyección de tokens JWT en las cabeceras de cada petición.

### Arquitectura Backend (API REST)
El backend aprovecha la arquitectura robusta, modular y orientada a servicios que proporciona NestJS.
- **Arquitectura Modular:** El código se agrupa por dominios de negocio o "Módulos" (Users, Auth, Bookings, Classes, Audit, etc.).
- **Patrón Controlador-Servicio (Controller-Service):** 
  - **Controllers:** Se encargan exclusivamente de manejar las peticiones HTTP, validar los datos de entrada y definir las rutas.
  - **Services (Providers):** Aíslan toda la lógica de negocio pura y la comunicación con la base de datos, siendo inyectados en los controladores.
- **Inyección de Dependencias (DI):** NestJS utiliza un sistema de inyección de dependencias que promueve el bajo acoplamiento y facilita enormemente la creación de tests unitarios (mocks).
- **Seguridad Centralizada:** Se utilizan Guards (como los AuthGuards de Passport/JWT) para validar la autenticación y autorización (roles) en los endpoints de forma declarativa.

## Patrones de Diseño Aplicados

- **Patrón MVC (Variante para APIs):** Aunque no hay "Vistas" HTML renderizadas en el servidor, el flujo Modelo (entidades Prisma) - Controlador (Rutas HTTP) se mantiene para estructurar la aplicación.
- **Patrón Repositorio:** Prisma asume el rol del repositorio, proporcionando una interfaz abstracta y tipada (Prisma Client) para interactuar con la base de datos sin escribir SQL directo.
- **Singleton:** Los servicios de NestJS se instancian como singletons por defecto. Esto optimiza recursos garantizando que haya una única instancia de lógica de negocio o conexión a base de datos corriendo en la app.
- **Patrón Decorador:** Muy extendido en todo el backend (TypeScript/NestJS) mediante anotaciones como `@Controller()`, `@Injectable()`, `@Get()`, etc., añadiendo comportamiento a las clases de forma limpia e intrusiva.
