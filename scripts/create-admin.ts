/**
 * Script untuk membuat akun admin secara manual.
 * Gunakan script ini ketika pindah ke database baru.
 *
 * Cara pakai:
 *   npx tsx scripts/create-admin.ts
 *
 * Atau dengan custom username/password:
 *   ADMIN_USERNAME=admin2 ADMIN_PASSWORD=password123 npx tsx scripts/create-admin.ts
 */

import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import bcrypt from "bcryptjs";
import * as schema from "../shared/schema";
import { eq } from "drizzle-orm";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL tidak ditemukan. Pastikan sudah diset di environment.");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

const USERNAME = process.env.ADMIN_USERNAME || "admin";
const PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
const NAME     = process.env.ADMIN_NAME     || "Administrator";

async function main() {
  console.log(`\n🔧 Membuat akun admin...`);
  console.log(`   Username : ${USERNAME}`);
  console.log(`   Password : ${PASSWORD}`);
  console.log(`   Nama     : ${NAME}\n`);

  const [existing] = await db
    .select()
    .from(schema.profiles)
    .where(eq(schema.profiles.username, USERNAME))
    .limit(1);

  if (existing) {
    console.log(`⚠️  Username "${USERNAME}" sudah ada di database.`);
    console.log(`   Gunakan username lain atau hapus akun lama terlebih dahulu.\n`);
    await pool.end();
    process.exit(0);
  }

  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  const [admin] = await db
    .insert(schema.profiles)
    .values({ username: USERNAME, name: NAME, passwordHash })
    .returning();

  await db
    .insert(schema.userRoles)
    .values({ userId: admin.id, role: "admin" });

  console.log(`✅ Akun admin berhasil dibuat!`);
  console.log(`   Username : ${USERNAME}`);
  console.log(`   Password : ${PASSWORD}`);
  console.log(`\n⚠️  Segera ganti password setelah login pertama.\n`);

  await pool.end();
}

main().catch((err) => {
  console.error("❌ Gagal membuat akun admin:", err.message);
  process.exit(1);
});
