import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";
import { sql } from "drizzle-orm";

config({ path: ".env.local" });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL não está configurada.");
}

const database = drizzle(neon(process.env.DATABASE_URL));
await migrate(database, { migrationsFolder: "./drizzle" });
const adminEmails = (process.env.ADMIN_EMAILS ?? "").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean);
for (const email of adminEmails) {
  await database.execute(sql`insert into users (email, email_verified, account_type_configured, role, name) values (${email}, true, true, 'admin', 'Administrador AgroTruck') on conflict (email) do update set role = 'admin', account_type_configured = true, updated_at = now()`);
}
await database.execute(sql`
  with candidates as (
    select id, '+' || regexp_replace(phone, '\D', '', 'g') as normalized
    from users
    where phone is not null and length(regexp_replace(phone, '\D', '', 'g')) between 8 and 15
  ), unique_numbers as (
    select normalized from candidates group by normalized having count(*) = 1
  )
  update users set phone_number = candidates.normalized
  from candidates inner join unique_numbers using (normalized)
  where users.id = candidates.id and users.phone_number is null
`);
console.log("Migrações Neon aplicadas.");
