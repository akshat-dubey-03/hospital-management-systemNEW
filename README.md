# MediCore HMS

**Online Hospital Management System** — B.Tech Academic Project

## Modules
- **Software Engineering** — Modular, layered architecture with RBAC
- **Artificial Intelligence** — AI chatbot with pluggable LLM provider abstraction  
- **Database Management Systems** — PostgreSQL with proper relational design

## Roles
- **Patient** — Register, book appointments, use AI chatbot
- **Doctor** — Manage appointments, view patients
- **Admin** — Full system management

## Tech Stack
| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite |
| Backend | Node.js + Express.js |
| Database | PostgreSQL 15 |
| ORM | Prisma |
| Auth | JWT + HTTP-only Refresh Cookie |
| AI | OpenAI GPT-4o (pluggable adapter) |

## Quick Start

### Prerequisites
- Node.js ≥ 20 LTS
- PostgreSQL 15 OR Docker + Docker Compose

### 1. Clone & Install

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 2. Environment Setup

```bash
# Backend
cp ../env.example backend/.env
# Edit backend/.env with your values
```

### 3. Database Setup

```bash
cd backend
npx prisma migrate dev --name init
npm run db:seed
```

### 4. Run Development Servers

```bash
# Terminal 1 — Backend (port 5000)
cd backend
npm run dev

# Terminal 2 — Frontend (port 5173)
cd frontend
npm run dev
```

## Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@medicore.dev | Admin@1234 |
| Doctor | dr.sharma@medicore.dev | Doctor@1234 |
| Patient | patient1@demo.com | Patient@1234 |

> ⚠️ These are development-only credentials. Never use in production.

## Architecture

See [implementation_plan.md](./docs/architecture.md) for full system design.
