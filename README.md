# Mediconcen Code Test

Backend code test using NestJS, TypeScript and MySQL 8.

Requires Node.js 22, npm and MySQL 8. Docker Compose is optional for running a local database.

## Run locally

```sh
npm ci
cp .env.example .env
```

To use the MySQL service provided by this project, set your local database
passwords in `.env`, then run:

```sh
docker compose up -d --wait mysql
```

If MySQL is already running, skip the command above and set `DB_HOST`, `DB_PORT`,
`DB_NAME`, `DB_USER` and `DB_PASSWORD` in `.env` to match it. The database must
already exist and the user needs permission to create tables and run migrations.
Do not start a second MySQL container on the same port.

Then run:

```sh
npm run migration:run
npm run start:dev
```

The app runs at `http://localhost:3000`. For now, `GET /` returns `Hello World!`.
The ID lookup endpoint is the next step.

## Database

`user_mappings` stores `id1`, `id2`, `user_id` and `created_at`.
The `(id1, id2)` pair is unique; IDs are case-sensitive and each supports up to
128 characters. `(A, B)` and `(B, A)` are different pairs.

Schema changes use TypeORM migrations; automatic synchronization is disabled.
To undo the latest migration locally, run `npm run migration:revert`.

Docker stores MySQL data in a named volume. `docker compose down` keeps that data.
Changing passwords in `.env` does not update an already initialized database.

## Checks

```sh
npm run build
npm run lint
npm test
npm run test:e2e
```

The HTTP smoke test covers the root controller without connecting to MySQL.
Database integration tests will be added with the lookup endpoint.
