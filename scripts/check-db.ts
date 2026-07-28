import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required in .env.local");
  const sql = neon(connectionString);
  const [userCount, truckCount, verificationCount] = await Promise.all([
    sql`select count(*)::int as count from users`,
    sql`select count(*)::int as count from trucks`,
    sql`select count(*)::int as count from email_verification_codes`,
  ]);
  console.log(JSON.stringify({ connected: true, users: userCount[0].count, trucks: truckCount[0].count, verificationCodes: verificationCount[0].count }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
