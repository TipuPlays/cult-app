import "dotenv/config";

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "postgresql://cult:cult@127.0.0.1:5432/cult";
}
if (!process.env.AUTH_SECRET) {
  process.env.AUTH_SECRET = "test-secret-cult-phase1-hardening";
}
