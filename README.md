# Fullstack E-commerce App

React + Express e-commerce app backed by PostgreSQL and Prisma.

## Prerequisites

- Node.js
- npm
- Docker and Docker Compose

## Install dependencies

Install the root, server, and client dependencies:

```bash
npm install
npm install --prefix server
npm install --prefix client
```

## Environment

Create the server environment file:

```bash
cp server/.env.example server/.env
```

The default server config uses:

- API server: `http://localhost:4000`
- Health check: `http://localhost:4000/api/health`
- Postgres: `postgresql://ecomm_user:ecomm_pass@localhost:5432/ecomm_dev`

The client defaults to `http://localhost:4000/api`. To override it, set `VITE_API_URL` in a client environment file.

## Local database setup

Start Postgres:

```bash
docker compose up -d postgres
```

Apply Prisma migrations, generate the Prisma client, and seed development data:

```bash
npm run db:migrate
npm run db:generate
npm run db:seed
```

Check migration status:

```bash
npm run db:status
```

Open a SQL shell inside the Postgres container:
```bash
docker exec -it ecomm_postgres psql -U ecomm_user -d ecomm_dev
```

Example SQL once inside psql:
SELECT * FROM "Product";
SELECT * FROM "Category";


For deployed environments, apply committed migrations without creating new ones:

```bash
npm run db:deploy
```

When changing `server/prisma/schema.prisma`, create a migration with:

```bash
npm run db:migrate -- --name describe_change
```

## Run locally

Start the server and client together:

```bash
npm run dev
```

Or run them separately:

```bash
npm run dev:server
npm run dev:client
```

The server runs on `http://localhost:4000`. Vite will print the client URL, usually `http://localhost:5173`.

## Test

Run the server test suite:

```bash
npm test --prefix server
```

## Build

Build the server and client:

```bash
npm run build:server
npm run build:client
```

Start the compiled server:

```bash
npm start --prefix server
```
