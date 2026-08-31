# EksporIn — Global Buyer Intelligence Platform

MVP fungsional dari spesifikasi produk (dokumen 01–08): platform intelijen buyer berbasis data customs untuk UKM eksportir Indonesia.

## Menjalankan

Butuh **Node.js 22.5+** saja — tanpa `npm install`, tanpa dependency eksternal.

```bash
node server.js
```

Buka **http://localhost:3000**.

Saat pertama dijalankan, database SQLite dibuat otomatis di `data/eksporin.db` dan di-seed dengan data demo realistis: 210 buyer di 5 negara (US, Jepang, Belanda, UAE, Australia), ±2.200 shipment 24 bulan terakhir, 46 eksportir (termasuk 20 kompetitor Indonesia), taksonomi HS untuk komoditas ekspor utama Indonesia, dan 10 template outreach dalam 5 bahasa.

**Akun demo (paket Growth, data terisi):** `demo@eksporin.id` / `demo1234` — atau daftar akun baru untuk merasakan onboarding wizard + paket Free.

Reset database: `npm run reset-db` (atau hapus folder `data/`).

## Fitur yang diimplementasikan (MVP F1–F8)

**F1 Buyer Directory by HS Code** — direktori HS hierarkis (Bab → Heading → Subheading) dengan jumlah buyer, volume, top negara; pencarian buyer dengan filter negara, ukuran, aktivitas impor, ketersediaan kontak, skor minimum; sorting, pagination, blur baris >20 untuk tier Free.

**F2 Buyer Profile 360°** — tab Ringkasan (skor + komponen, kontak dengan masking per tier), Riwayat Shipment (grafik bulanan + tabel bill-of-lading + ekspor CSV berwatermark), Pemasok (dengan sorotan kompetitor Indonesia), Produk per HS, Insight otomatis + rekomendasi angle outreach + buyer serupa, Catatan & aktivitas.

**F3 Shipment History Explorer** — query lintas buyer dengan filter HS/buyer/eksportir/asal/tujuan, mode agregasi per buyer/eksportir/HS/bulan.

**F4 Buyer Scoring Engine** — formula sesuai spesifikasi: Activity 30% (frekuensi × recency), Growth 20% (YoY), Product Fit 25% (dihitung per user dari HS fokus onboarding), Reachability 15%, Untapped 10%. Kategori Hot/Warm/Cold.

**F5 Saved Lists & Notes** — CRM-lite: daftar berwarna, status pipeline 6 tahap, prioritas, tag, reminder, catatan; tampilan tabel dan Kanban; outreach massal dari daftar.

**F6 Outreach Toolkit** — 10 template sistem (EN/ES/AR/ZH/JA, email + WhatsApp), substitusi variabel `{{buyer_name}}` dll., preview per buyer, kirim (simulasi + pelacakan dibuka/dibalas), mode salin/mailto, anti-duplikat 14 hari, template kustom.

**F7 Alerts** — buyer baru di HS fokus, aktivitas shipment buyer tersimpan, gerakan kompetitor Indonesia, reminder follow-up; dedup; batasan per tier.

**F8 Localized Onboarding** — UI penuh Bahasa Indonesia, wizard 5 langkah (profil, produk HS, negara target, status ekspor, tujuan) yang mem-personalisasi dashboard & rekomendasi.

**Monetisasi** — 4 tier (Free/Starter/Growth/Business) dengan kuota pencarian/profil/kirim/ekspor, masking kontak, gating template & alert, halaman upgrade dengan checkout tersimulasi (Midtrans).

## Arsitektur

Kesederhanaan disengaja: satu proses Node.js tanpa dependency (`node:http` + `node:sqlite`), frontend SPA vanilla JS dengan design system sesuai PRD §12 (Plus Jakarta Sans, token warna, komponen card/table/pill/kanban).

```
server.js          HTTP server + static + SPA fallback
src/db.js          Skema SQLite + bootstrap seed
src/seed.js        Generator data demo deterministik (PRNG seeded)
src/api.js         Seluruh REST API (~40 endpoint) + logika kuota/tier/skor
src/auth.js        Password scrypt + sesi cookie HttpOnly
public/            index.html, styles.css (design tokens), app.js (SPA)
```

Terhadap arsitektur produksi di dokumen 02 (Laravel + FastAPI + NestJS + Elasticsearch + ClickHouse): MVP ini memampatkan semua bounded context ke satu proses, tetapi kontrak API, skema data (subset doc 04), formula skor (doc 03 §3.4), matriks fitur-per-tier (doc 03 §7), dan design system (doc 01 §12) mengikuti spesifikasi — sehingga migrasi per-service dapat dilakukan bertahap tanpa mengubah frontend.

Belum termasuk: admin panel (doc 05), pipeline ingest Airflow (doc 08), OAuth Google/LinkedIn, pembayaran riil, email riil.
