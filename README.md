# Pharmacy OS

Production-grade SaaS operating system for independent pharmacies in India.

## Stack

- Monorepo: Turborepo + npm workspaces
- Web: React 18, TypeScript, Vite, TailwindCSS, TanStack Query, Zustand, React Hook Form, Zod, Framer Motion, Recharts, React PDF-ready billing, Socket.io client, Dexie offline queue, i18next
- API: Node.js, Express, TypeScript, Prisma, PostgreSQL, Redis, Bull, Socket.io, JWT refresh rotation, Cloudinary uploads, Razorpay, Twilio/WhatsApp, Nodemailer, Swagger
- Infra: Docker Compose, nginx, PM2, GitHub Actions, Makefile

## Architecture

```text
pharmacy-os
├── apps
│   ├── api  ── Express / Prisma / Bull / Socket.io
│   └── web  ── React / Vite / Tailwind / PWA
├── packages
│   ├── types ── shared Prisma-aligned domain contracts
│   ├── ui    ── shared clinical-luxury components
│   └── utils ── currency, date, billing, pagination helpers
└── infra
    ├── nginx
    └── pm2
```

## Quick Start

```bash
cp .env.example .env
npm install
npm --workspace @pharmacy-os/api run prisma:generate
docker compose up -d postgres redis
npm --workspace @pharmacy-os/api run migrate:dev
npm run seed
npm run dev
```

Demo login:

```text
admin@demo.com / Demo@1234
staff@demo.com / Demo@1234
```

## Docker

```bash
make dev
make seed
make logs
```

`make dev` starts Postgres, Redis, API, Web, and nginx. The nginx entrypoint is `http://localhost:8080`.

## Commands

```bash
make build
make migrate
make seed
make test
make lint
```

## Environment

All required variables are documented in `.env.example`. Development mode captures email, WhatsApp, and Cloudinary upload operations locally when provider credentials are absent.

## Screenshots

Place screenshots under:

```text
docs/screenshots/landing.png
docs/screenshots/dashboard.png
docs/screenshots/billing-pos.png
docs/screenshots/inventory.png
docs/screenshots/storefront.png
```

## API Docs

Swagger UI is served at:

```text
http://localhost:4000/api/docs
```

## Production Notes

- Use managed PostgreSQL and Redis for production.
- Set strong `JWT_SECRET` and `JWT_REFRESH_SECRET` values.
- Configure Razorpay webhook secret before enabling payments.
- Configure Cloudinary for prescription and logo storage.
- Configure Twilio/WhatsApp and SMTP for reminders and transactional messages.
- Put nginx behind TLS or enable the certbot volume in `docker-compose.prod.yml`.
