// Reads and validates environment variables once at startup.
// Values come from apps/api/.env (loaded by `node --env-file=.env`).

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable ${name}. Copy apps/api/.env.example to apps/api/.env.`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  db: {
    host: process.env.DB_HOST ?? "localhost",
    port: Number(process.env.DB_PORT ?? 5432),
    database: process.env.DB_NAME ?? "cinemind_db",
    user: required("DB_USER"),
    password: required("DB_PASSWORD"),
  },
  jwtSecret: required("JWT_SECRET"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "8h",
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:3000",
};

if (env.jwtSecret.length < 32) {
  throw new Error("JWT_SECRET must be at least 32 characters long.");
}
