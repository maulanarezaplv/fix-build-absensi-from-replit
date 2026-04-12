#!/bin/bash
# Script untuk menjalankan migrasi database ke Neon (production)
# Pastikan DATABASE_URL sudah di-set sebelum menjalankan script ini
# Contoh: DATABASE_URL="postgresql://..." bash scripts/migrate-prod.sh

echo "======================================"
echo "  Migrasi Database E-Absensi"
echo "======================================"

if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL belum di-set!"
  echo "Contoh: DATABASE_URL=\"postgresql://user:pass@host/db\" bash scripts/migrate-prod.sh"
  exit 1
fi

echo "Menjalankan schema push ke database..."
npx drizzle-kit push

echo ""
echo "✅ Migrasi selesai!"
