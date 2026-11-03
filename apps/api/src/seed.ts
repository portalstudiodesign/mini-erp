/**
 * Date demo: o firmă care produce porți și garduri decupate laser.
 * Comenzile trec prin aceleași servicii ca în aplicație, ca jurnalul de stoc să fie consistent.
 */
import bcrypt from "bcryptjs";
import { prisma } from "./lib/prisma.js";
import { checkLowStock } from "./jobs/lowStock.js";
import { closeQueue } from "./lib/queue.js";
import { applyMovement } from "./modules/stock/stock.service.js";
import { changeOrderStatus, createOrder } from "./modules/orders/orders.service.js";
import type { Customer, OrderStatus, Product } from "./generated/prisma/client.js";

const DAY_MS = 24 * 60 * 60 * 1000;
export const DEMO_PASSWORD = "Demo1234!";

// Generator pseudo-aleator cu seed fix: aceleași date la fiecare rulare.
let seed = 42;
const rand = () => ((seed = (seed * 1_103_515_245 + 12_345) % 2 ** 31) / 2 ** 31);
const pick = <T>(arr: T[]) => arr[Math.floor(rand() * arr.length)]!;
const between = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));

/** CUI fictiv, dar cu cifra de control corectă. */
function fakeCui(body: number) {
  const key = [7, 5, 3, 2, 1, 7, 5, 3, 2];
  const digits = String(body).padStart(9, "0");
  const sum = [...digits].reduce((acc, d, i) => acc + Number(d) * key[i]!, 0);
  return `RO${body}${((sum * 10) % 11) % 10}`;
}

const products = [
  { sku: "PRT-LSR-001", name: "Poartă batantă decupată laser „Frunze” 3,5 m", unit: "buc", price: 8900, minStock: 2 },
  { sku: "PRT-LSR-002", name: "Poartă culisantă decupată laser „Geometric” 4 m", unit: "buc", price: 12400, minStock: 2 },
  { sku: "PRT-LSR-003", name: "Poartă pietonală decupată laser „Valuri”", unit: "buc", price: 3200, minStock: 3 },
  { sku: "GRD-PNL-001", name: "Panou gard decupat laser 2 x 1,5 m „Mozaic”", unit: "buc", price: 1450, minStock: 10 },
  { sku: "GRD-PNL-002", name: "Panou gard decupat laser 2 x 1,8 m „Bambus”", unit: "buc", price: 1620, minStock: 10 },
  { sku: "BAL-PNL-001", name: "Panou balustradă decupată laser „Floral”", unit: "buc", price: 980, minStock: 6 },
  { sku: "TBL-OTL-2MM", name: "Tablă oțel DC01 2 mm 1250 x 2500", unit: "buc", price: 520, minStock: 20 },
  { sku: "TBL-OTL-3MM", name: "Tablă oțel S235 3 mm 1500 x 3000", unit: "buc", price: 890, minStock: 15 },
  { sku: "TBL-COR-2MM", name: "Tablă Corten 2 mm 1250 x 2500", unit: "buc", price: 1350, minStock: 8 },
  { sku: "TVA-RCT-6040", name: "Țeavă rectangulară 60 x 40 x 2", unit: "m", price: 38.5, minStock: 100 },
  { sku: "TVA-PTR-4040", name: "Țeavă pătrată 40 x 40 x 2", unit: "m", price: 29.9, minStock: 120 },
  { sku: "VPS-ELC-9005", name: "Vopsea câmp electrostatic RAL 9005 negru mat", unit: "kg", price: 42, minStock: 50 },
  { sku: "VPS-ELC-7016", name: "Vopsea câmp electrostatic RAL 7016 antracit", unit: "kg", price: 44, minStock: 50 },
  { sku: "KIT-CUL-006", name: "Kit culisare poartă autoportantă 6 m", unit: "set", price: 1850, minStock: 4 },
  { sku: "AUT-CUL-800", name: "Automatizare poartă culisantă 800 kg", unit: "set", price: 2350, minStock: 3 },
  { sku: "AUT-BAT-002", name: "Automatizare poartă batantă 2 canate", unit: "set", price: 2650, minStock: 3 },
  { sku: "BAL-INX-001", name: "Balama reglabilă inox", unit: "buc", price: 145, minStock: 40 },
];

const customers = [
  { name: "Construct Vest SRL", taxId: fakeCui(3_184_557), city: "Cluj-Napoca", email: "office@constructvest.example" },
  { name: "Fier Forjat Design SRL", taxId: fakeCui(4_021_339), city: "Iași", email: "comenzi@fierforjat.example" },
  { name: "Casa Verde Residence SRL", taxId: fakeCui(3_877_120), city: "Brașov", email: "achizitii@casaverde.example" },
  { name: "Atelier Metalic Nord SRL", taxId: fakeCui(2_995_406), city: "Suceava", phone: "0730 000 111" },
  { name: "Ion Popa", taxId: null, city: "Piatra Neamț", phone: "0740 000 222" },
  { name: "Rezidențial Lacului SRL", taxId: fakeCui(4_410_872), city: "București", email: "proiecte@lacului.example" },
  { name: "Montaj Porți Expert SRL", taxId: fakeCui(3_560_018), city: "Bacău", phone: "0750 000 333" },
  { name: "Grădina cu Tei SRL", taxId: fakeCui(2_788_641), city: "Timișoara", email: "contact@gradinacutei.example" },
  { name: "Maria Constantinescu", taxId: null, city: "Constanța", phone: "0760 000 444" },
  { name: "Delta Garduri SRL", taxId: fakeCui(4_102_993), city: "Galați", email: "vanzari@deltagarduri.example" },
];

async function main() {
  console.log("Șterg datele existente…");
  await prisma.$transaction([
    prisma.stockAlert.deleteMany(),
    prisma.stockMovement.deleteMany(),
    prisma.orderItem.deleteMany(),
    prisma.order.deleteMany(),
    prisma.product.deleteMany(),
    prisma.customer.deleteMany(),
    prisma.user.deleteMany(),
  ]);

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const [admin, sales, warehouse] = await Promise.all([
    prisma.user.create({ data: { email: "admin@demo.ro", name: "Ana Popescu", role: "ADMIN", passwordHash } }),
    prisma.user.create({ data: { email: "vanzari@demo.ro", name: "Mihai Ionescu", role: "SALES", passwordHash } }),
    prisma.user.create({ data: { email: "depozit@demo.ro", name: "Elena Dumitru", role: "WAREHOUSE", passwordHash } }),
  ]);

  const createdProducts: Product[] = [];
  for (const p of products) createdProducts.push(await prisma.product.create({ data: p }));
  const createdCustomers: Customer[] = [];
  for (const c of customers) createdCustomers.push(await prisma.customer.create({ data: c }));

  console.log("Recepție inițială de stoc…");
  const receiptDate = new Date(Date.now() - 40 * DAY_MS);
  await prisma.$transaction(async (tx) => {
    for (const p of createdProducts) {
      await applyMovement(tx, {
        productId: p.id,
        quantity: p.minStock * 4 + between(0, p.minStock),
        type: "RECEIPT",
        reason: "Stoc inițial",
        userId: warehouse.id,
      });
    }
  });
  await prisma.stockMovement.updateMany({ data: { createdAt: receiptDate } });

  console.log("Comenzi…");
  for (let i = 0; i < 40; i++) {
    const daysAgo = between(0, 29);
    const lineCount = between(1, 4);
    const items = Array.from({ length: lineCount }, () => {
      const product = pick(createdProducts);
      const qty = product.unit === "buc" || product.unit === "set" ? between(1, 4) : between(10, 60);
      return { productId: product.id, quantity: qty };
    });

    const order = await createOrder(
      { customerId: pick(createdCustomers).id, items, notes: rand() < 0.3 ? "Livrare cu montaj" : undefined },
      sales,
    );

    // Comenzile vechi au avansat mai mult în flux decât cele recente.
    const roll = rand();
    const path: OrderStatus[] =
      daysAgo > 14
        ? roll < 0.75 ? ["CONFIRMED", "SHIPPED", "DELIVERED"] : roll < 0.9 ? ["CONFIRMED", "SHIPPED"] : ["CANCELLED"]
        : roll < 0.35 ? [] : roll < 0.7 ? ["CONFIRMED"] : roll < 0.9 ? ["CONFIRMED", "SHIPPED"] : ["CONFIRMED", "CANCELLED"];

    for (const status of path) {
      const actor = status === "SHIPPED" || status === "DELIVERED" ? warehouse : sales;
      try {
        await changeOrderStatus(order.id, status, actor);
      } catch {
        break; // stoc insuficient: comanda rămâne în statusul curent, ca în realitate
      }
    }

    const createdAt = new Date(Date.now() - daysAgo * DAY_MS - between(0, 8) * 60 * 60 * 1000);
    await prisma.order.update({ where: { id: order.id }, data: { createdAt } });
    await prisma.stockMovement.updateMany({ where: { orderId: order.id }, data: { createdAt } });
  }

  await checkLowStock("all");
  const openAlerts = await prisma.stockAlert.count({ where: { resolvedAt: null } });
  console.log(`Gata: ${createdProducts.length} produse, ${createdCustomers.length} clienți, 40 comenzi, ${openAlerts} alerte de stoc deschise.`);
  console.log(`Conturi demo (parola ${DEMO_PASSWORD}): ${admin.email}, ${sales.email}, ${warehouse.email}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => Promise.all([prisma.$disconnect(), closeQueue()]));
