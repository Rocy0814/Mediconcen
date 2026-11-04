# Mediconcen Code Test

Backend code test using NestJS and TypeScript.

Requires Node.js 22 and npm.

```sh
npm ci
npm run start:dev
```

The app runs at `http://localhost:3000`. For now, `GET /` returns `Hello World!`.

```sh
npm run build
npm run lint
npm test
npm run test:e2e
```

The next step is to add MySQL and implement the ID lookup endpoint.
