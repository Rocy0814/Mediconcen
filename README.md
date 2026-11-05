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

## Resolve a user ID

```sh
curl -X POST http://localhost:3000/users/resolve \
  -H 'Content-Type: application/json' \
  -d '{"id1":"ABC123","id2":"XYZ456"}'
```

Returns HTTP 200 with `{ "userID": "<UUID v4>" }`. Repeating the same pair returns
its original ID, including when requests arrive concurrently.

Both IDs must be strings of 1–128 characters, without leading or trailing
whitespace. Unknown fields are rejected. Invalid requests return 400;
unexpected failures return 500 without database details.

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

`npm run test:e2e` requires the configured MySQL database with migrations applied.
It tests the endpoint against MySQL, including 20 concurrent requests for one pair.
Tests use a random ID prefix and remove their own records afterwards. The root
controller smoke test runs without MySQL.

## Redis cache

Redis caches successful ID lookups for one hour by default. MySQL remains the
permanent source of data and enforces uniqueness. A cache miss reads from MySQL
and caches the result only after the database operation succeeds.

To start the provided Redis service:

```sh
docker compose up -d --wait redis
```

If you already have Redis running, skip this and point `REDIS_URL` in `.env` to
it (default: `redis://127.0.0.1:6379`). Set `REDIS_TTL_SECONDS` to change the
expiry. Credentials, if needed, belong in `.env`, not in source code.

Redis connects and reconnects in the background. While disconnected, requests
use MySQL directly. Commands time out after 200 ms; failed cache reads and writes
do not fail the API request. Keys encode the ordered pair as a JSON array to
avoid delimiter collisions. Mappings have no update/delete endpoint, so no cache
invalidation is needed for this API. If the database is reset manually, clear
its corresponding cache entries as well.

Run `npm run test:redis` with MySQL and Redis available to check cache hits,
expiry and fallback after a disconnected cache. It uses random test IDs, sets a
one-second TTL, and removes its records afterwards.
