# Tech Stack - MotoJá

## Languages

| Language | Version | Usage |
|----------|---------|-------|
| TypeScript | ~5.8 | Full-stack (frontend + backend) |

## Frontend

| Technology | Version | Purpose |
|-----------|---------|---------|
| React | ^19.2 | UI framework |
| Vite | ^7.3 | Build tool and dev server |
| Lucide React | ^0.562 | Icon library |
| Recharts | ^3.6 | Charts and analytics |
| React Leaflet | ^5.0 | Map rendering |
| Mapbox GL | ^3.18 | Map provider |

## Backend / BaaS

| Technology | Purpose |
|-----------|---------|
| **Supabase** (PostgreSQL) | Database, Auth, Realtime, Edge Functions |
| Mercado Pago SDK | Payment processing (PIX) |

## Authentication

| Technology | Purpose |
|-----------|---------|
| **Supabase Auth** | User authentication, session management, RLS integration |

> **Nota:** Atualmente usando Firebase Auth (em migração para Supabase Auth).

## Infrastructure

| Layer | Technology |
|-------|-----------|
| Frontend Hosting | **Vercel** |
| Backend / API | **Supabase Edge Functions** |
| Database | **Supabase PostgreSQL** |
| Realtime | **Supabase Realtime** (Broadcast Channels) |
| File Storage | **Supabase Storage** |
| Payments | **Mercado Pago** |

## Mobile

| Technology | Version | Purpose |
|-----------|---------|---------|
| Capacitor | ^8.0 | Native mobile wrapper (Android/iOS) |

## Key Dependencies

| Package | Purpose |
|---------|---------|
| axios | HTTP client |
| @dnd-kit | Drag and drop interactions |
| react-icons | Additional icon sets |
| firebase | Current backend (migrating to Supabase) |
