# Plataforma de Gestión de Reservas - Instituto

Una moderna plataforma de gestión académica y reserva de clases desarrollada con React, NestJS y PostgreSQL. Permite gestionar alumnos, profesores, secretaría y administradores bajo un estricto control de accesos (RBAC).

## 🚀 Tecnologías

* **Frontend:** React, Vite, TailwindCSS
* **Backend:** Node.js, NestJS, TypeScript
* **Base de Datos:** PostgreSQL
* **ORM:** Prisma
* **Autenticación:** JWT (JSON Web Tokens)

## 📦 Estructura del Proyecto

* `/frontend` - Aplicación Single Page Application (SPA) en React.
* `/backend` - API RESTful desarrollada en NestJS.

## 🛠️ Instalación y Configuración Local

### 1. Requisitos Previos
* Node.js (v18 o superior)
* PostgreSQL instalado y en ejecución

### 2. Configuración de Base de Datos
1. Entra a la carpeta `/backend`
2. Copia el archivo de ejemplo de variables de entorno:
   ```bash
   cp .env.example .env
   ```
3. Configura tus credenciales de PostgreSQL en el archivo `.env`.

### 3. Instalación Backend
```bash
cd backend
npm install
npx prisma db push     # Crea las tablas
npx prisma db seed     # Puebla la base con datos de prueba
npm run start:dev      # Inicia el servidor en http://localhost:3000
```

### 4. Instalación Frontend
```bash
cd frontend
npm install
npm run dev            # Inicia en http://localhost:5173
```

## 🔐 Usuarios de Prueba (Seed)
La base de datos se inicializa con los siguientes usuarios (contraseña para todos: `admin`):
* **Admin:** admin@ok.com
* **Secretaria:** sec@ok.com
* **Teacher:** teacher@ok.com
* **Alumnos:** est1@ok.com hasta est20@ok.com
