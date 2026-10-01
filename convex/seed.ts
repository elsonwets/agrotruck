import { internalMutation } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { formatPhone, normalizePhone, type VehicleCategory } from "../src/shared/domain";
import { zoneLabels, type Zone } from "../src/shared/zones";
import { hashPassword } from "./lib/security";
import { slugify } from "./trucks";

// Comptes de démonstration pour la base de DÉVELOPPEMENT (jamais la production) :
//   npx convex run seed:run
// Connexion avec le numéro local (sans +245) et le PIN ci-dessous. Relancer ne crée pas de doublon.
const DEV_PIN = "1234";
const ADMIN_PIN = "1512";

type Truck = { name: string; category: VehicleCategory; capacityTons: number; brand: string; goods: string[] };
type Account = Pick<Doc<"users">, "role" | "displayName" | "companyName" | "mainZone" | "mainLocation" | "workZones"> & { phone: string; pin: string; truck?: Truck };

const accounts: Account[] = [
  { role: "admin", phone: "955000001", pin: ADMIN_PIN, displayName: "Elson Junior" },

  { role: "transporter", phone: "955200001", pin: DEV_PIN, displayName: "Mamadu Djaló", companyName: "Transportes Djaló", workZones: ["gabu", "bafata", "bissau"],
    truck: { name: "Mercedes Actros benne 20 t", category: "camion", capacityTons: 20, brand: "Mercedes-Benz", goods: ["Caju", "Arroz"] } },
  { role: "transporter", phone: "955200002", pin: DEV_PIN, displayName: "Braima Sané", workZones: ["oio", "cacheu", "bissau"],
    truck: { name: "Toyota Dyna 3,5 t", category: "camionnette", capacityTons: 3.5, brand: "Toyota", goods: ["Caju", "Legumes"] } },
  { role: "transporter", phone: "955200003", pin: DEV_PIN, displayName: "Aissatu Baldé", companyName: "Baldé Logística", workZones: ["bafata", "gabu"],
    truck: { name: "Semi-remorque Volvo FH 30 t", category: "semi_remorque", capacityTons: 30, brand: "Volvo", goods: ["Caju", "Arroz", "Cimento"] } },
  { role: "transporter", phone: "955200004", pin: DEV_PIN, displayName: "Carlos Mendes", workZones: ["quinara", "tombali", "bissau"],
    truck: { name: "Tracteur Massey Ferguson + remorque", category: "tracteur", capacityTons: 8, brand: "Massey Ferguson", goods: ["Arroz", "Caju"] } },
  { role: "transporter", phone: "955200005", pin: DEV_PIN, displayName: "Suleimane Embaló", workZones: ["biombo", "bissau"],
    truck: { name: "Moto tricycle Tuk-Tuk 1 t", category: "moto_tricycle", capacityTons: 1, brand: "Bajaj", goods: ["Legumes", "Caju"] } },

  { role: "producer", phone: "955100001", pin: DEV_PIN, displayName: "Cooperativa de Pirada", mainZone: "gabu", mainLocation: "Pirada" },
  { role: "producer", phone: "955100002", pin: DEV_PIN, displayName: "Fatumata Camará", mainZone: "bafata", mainLocation: "Contuboel" },
  { role: "producer", phone: "955100003", pin: DEV_PIN, displayName: "Associação de Bissorã", mainZone: "oio", mainLocation: "Bissorã" },
  { role: "producer", phone: "955100004", pin: DEV_PIN, displayName: "João Có", mainZone: "cacheu", mainLocation: "Canchungo" },
  { role: "producer", phone: "955100005", pin: DEV_PIN, displayName: "Mariama Seidi", mainZone: "quinara", mainLocation: "Buba" },
];

export const run = internalMutation({
  args: {},
  handler: async (ctx) => {
    const created: string[] = [];
    for (const { phone, pin, truck, ...profile } of accounts) {
      const phoneKey = normalizePhone(phone);
      if (await ctx.db.query("users").withIndex("by_phoneKey", (q) => q.eq("phoneKey", phoneKey)).unique()) continue;
      const userId = await ctx.db.insert("users", {
        ...profile,
        phone: formatPhone(phone),
        phoneKey,
        passwordHash: await hashPassword(pin),
        lang: "en",
        ...(truck ? { vehicleCategories: [truck.category] } : {}),
      });
      if (truck) {
        const zone = (profile.workZones?.[0] ?? "bissau") as Zone;
        await ctx.db.insert("trucks", {
          ownerId: userId, slug: slugify(truck.name), name: truck.name, category: truck.category, listingMode: "transport",
          brand: truck.brand, capacityTons: truck.capacityTons, zone, location: zoneLabels[zone],
          serviceZones: profile.workZones ?? [], goods: truck.goods, availability: "available",
          description: `${truck.name} — ${profile.companyName ?? profile.displayName}.`, photoIds: [], hidden: false, updatedAt: Date.now(),
        });
      }
      created.push(`${profile.role} ${profile.displayName}`);
    }
    return created;
  },
});
