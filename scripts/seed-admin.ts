import { createAccount, findAccountByPhone } from "../netlify/functions/_lib/accounts";

async function main() {
  const phone = process.argv[2];
  const displayName = process.argv[3];
  const password = process.argv[4];
  if (!phone || !displayName || !password) {
    console.error("Usage: tsx scripts/seed-admin.ts <phone> <displayName> <password>");
    process.exit(1);
  }
  const existing = await findAccountByPhone(phone);
  if (existing) {
    console.error(`Un compte existe déjà pour ${phone} (id: ${existing.id})`);
    process.exit(1);
  }
  const account = await createAccount({ phone, displayName, password, role: "admin" });
  console.log(`Compte admin créé : ${account.displayName} (${account.phone}), id ${account.id}`);
}

main();
