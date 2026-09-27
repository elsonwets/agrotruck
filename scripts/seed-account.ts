import { randomUUID } from "node:crypto";
import { BlobsServer } from "@netlify/blobs/server";
import { createAccount, findAccountByPhone } from "../netlify/functions/_lib/accounts";
import type { AccountRole } from "../types/account";

// Hors de Netlify, on écrit dans le bac à sable local lu par `netlify dev` / `netlify functions:serve`
// (même dossier et même siteID "unlinked" que la CLI pour un site non lié).
async function startLocalBlobsSandbox() {
  const token = randomUUID();
  const server = new BlobsServer({ directory: ".netlify/blobs-serve", token });
  const { port } = await server.start();
  const context = { deployID: "0", edgeURL: `http://localhost:${port}`, siteID: "unlinked", token };
  process.env.NETLIFY_BLOBS_CONTEXT = Buffer.from(JSON.stringify(context)).toString("base64");
  return server;
}

async function main() {
  const [phone, displayName, password, role = "admin"] = process.argv.slice(2);
  if (!phone || !displayName || !password || !["admin", "partner", "producer"].includes(role)) {
    console.error("Usage: pnpm seed:account <phone> <displayName> <password> [admin|partner|producer]");
    process.exit(1);
  }
  const sandbox = process.env.NETLIFY_BLOBS_CONTEXT || process.env.NETLIFY_SITE_ID ? null : await startLocalBlobsSandbox();
  try {
    const existing = await findAccountByPhone(phone);
    if (existing) {
      console.error(`Un compte existe déjà pour ${phone} (id: ${existing.id})`);
      process.exitCode = 1;
      return;
    }
    const account = await createAccount({ phone, displayName, password, role: role as AccountRole });
    console.log(`Compte ${account.role} créé : ${account.displayName} (${account.phone}), id ${account.id}`);
  } finally {
    await sandbox?.stop();
  }
}

main();
