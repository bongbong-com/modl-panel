# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- `npm run dev`: Start development server with hot reloading (runs server on port 5000)
- `npm run build`: Build production application (client + server bundle)
- `npm start`: Start production server (requires build first)
- `npm run check`: Run TypeScript type checking
- `npm run db:push`: Push database schema changes using Drizzle

### Testing Commands

- `npm run test:minecraft-server`: Test Minecraft API server routes
- `npm run test:minecraft-client`: Test Minecraft client integration
- `npm run test:minecraft-evasion`: Test Minecraft evasion detection

## Architecture Overview

This is a full-stack TypeScript application for managing Minecraft server moderation and ticketing.

### Client Architecture
- **Framework**: React 18 with Vite bundler
- **Routing**: Wouter for client-side routing
- **State Management**: TanStack Query for server state, React Context for app state
- **UI**: Radix UI components with Tailwind CSS and shadcn/ui
- **Key Features**: 
  - Multi-window interface system (`client/src/lib/window-manager.ts`)
  - Responsive design with mobile support
  - Theme switching (light/dark mode)

### Server Architecture
- **Runtime**: Node.js with Express.js framework
- **Database**: PostgreSQL with Drizzle ORM (Neon serverless)
- **Session Management**: MongoDB sessions with connect-mongo
- **Key Features**:
  - Multi-tenant architecture with subdomain-based database switching
  - Rate limiting and security middleware
  - WebSocket support for real-time features
  - File upload handling for server icons

### Database Strategy
- **Primary DB**: PostgreSQL (Neon) for main application data
- **Session Store**: MongoDB for user sessions
- **Multi-tenancy**: Each subdomain gets its own database connection via `subdomainDbMiddleware`
- **Schema**: Shared schema in `@shared/schema` (external package)

### API Structure
- **Public APIs**: 
  - `/api/public/*` - Ticket API (requires `X-Ticket-API-Key`)
  - `/api/minecraft/*` - Minecraft integration API (requires `X-API-Key`)
- **Internal APIs**: Standard Express routes with session-based auth
- **Documentation**: See `PLATFORM-API-DOCS.md` for external API documentation

## Key Directories

- `client/src/components/` - React components organized by feature
- `client/src/pages/` - Page components for routing
- `client/src/hooks/` - Custom React hooks
- `client/src/contexts/` - React context providers
- `server/routes/` - Express route handlers organized by feature
- `server/middleware/` - Express middleware functions
- `server/db/` - Database connection and seeding utilities

## Development Notes

### Environment Setup
- Requires `DATABASE_URL` for PostgreSQL connection
- Requires `GLOBAL_MODL_DB_URI` for MongoDB sessions
- Session secret via `SESSION_SECRET` environment variable
- Development runs on port 5000 (both client and server)

### Authentication & Security
- Session-based authentication for web interface
- API key authentication for external integrations
- Rate limiting on all routes
- CORS and security headers configured
- Subdomain-based multi-tenancy with database isolation

### Build Process
- Client builds with Vite to `dist/` directory
- Server bundles with esbuild for production deployment
- Static assets served from `/uploads` directory
- Production serves both client and API from single port (5000)

### Key Integration Points
- Minecraft server integration via REST API
- Stripe webhook handling (raw body required)
- Domain status monitoring via Cloudflare API
- File uploads for server customization

## Common Patterns

- Use TanStack Query for all server state management
- Follow shadcn/ui component patterns for new UI elements
- Implement proper error boundaries and loading states
- Use Drizzle schema for all database operations
- Follow Express middleware pattern for route protection