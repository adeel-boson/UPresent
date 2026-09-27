// Scripts under db/ and drizzle-kit run outside Next, which is what loads
// `.env` for the app. Variables already set in the environment win, so
// `DATABASE_URL=… npm run db:migrate` targets another database.
export function loadEnv(): void {
  try {
    process.loadEnvFile(".env");
  } catch (error) {
    // No .env is fine: the variables may come from the environment (CI, a
    // deploy step).
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
      throw error;
    }
  }
}
