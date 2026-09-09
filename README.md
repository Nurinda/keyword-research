# Keyword Genius

Tool riset keyword bertenaga **OpenAI API** yang memisahkan keyword mana yang
cocok untuk **SEO** (menarik traffic klik dari SERP tradisional) dan mana yang
cocok untuk **GEO / Generative Engine Optimization** (berpotensi dikutip oleh
AI Overview Google, ChatGPT, Perplexity, Copilot, dll).

Dibuat sebagai project statis + serverless function, siap di-deploy ke
**Netlify** langsung dari repo GitHub ini.

---

## ⚠️ Batasan penting — baca dulu sebelum pakai

Tool ini **tidak** memakai data dari Ahrefs/SEMrush/Google Keyword Planner.
OpenAI (model bahasa) **tidak punya akses ke data search volume yang real**.
Yang ditampilkan di kolom **Volume** dan **Difficulty** adalah **estimasi
tier** (`High` / `Medium` / `Low`) berdasarkan pola linguistik & pengetahuan
umum model — bukan angka pasti seperti di Ahrefs.

Yang **bisa** dikerjakan AI dengan cukup baik di tool ini:
- Brainstorm variasi keyword dari satu seed keyword
- Mengelompokkan keyword ke dalam cluster topik
- Menentukan search intent (Informational / Commercial / Transactional / Navigational)
- Menilai kecocokan tiap keyword untuk strategi **SEO** vs **GEO** beserta alasannya

Kalau kamu butuh angka volume pencarian yang akurat, lihat bagian
[Menambahkan data volume asli](#menambahkan-data-volume-asli-opsional) di bawah.

---

## Struktur project

```
keyword-genius/
├── netlify/
│   └── functions/
│       └── keyword-research.js   # Serverless function, panggil OpenAI API
├── public/
│   ├── index.html                 # UI utama
│   └── assets/
│       ├── style.css
│       └── app.js
├── netlify.toml                   # Konfigurasi Netlify (redirect /api/* -> functions)
├── package.json
├── .env.example
└── README.md
```

Tidak ada build step (React/Vue/dsb) — murni HTML/CSS/JS supaya minim
kemungkinan error saat deploy.

---

## Cara menjalankan di lokal

1. Install [Netlify CLI](https://docs.netlify.com/cli/get-started/):
   ```bash
   npm install -g netlify-cli
   ```
2. Copy `.env.example` menjadi `.env` lalu isi `OPENAI_API_KEY` dengan API key
   dari [platform.openai.com](https://platform.openai.com/api-keys).
3. Jalankan:
   ```bash
   netlify dev
   ```
4. Buka `http://localhost:8888`.

---

## Cara deploy ke Netlify (dari GitHub)

1. **Push project ini ke repo GitHub kamu:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit: Keyword Genius"
   git branch -M main
   git remote add origin https://github.com/USERNAME/keyword-genius.git
   git push -u origin main
   ```
2. Login ke [app.netlify.com](https://app.netlify.com) → **Add new site** →
   **Import an existing project** → pilih repo `keyword-genius` dari GitHub.
3. Netlify akan otomatis mendeteksi setting dari `netlify.toml`:
   - Publish directory: `public`
   - Functions directory: `netlify/functions`
   Kamu tidak perlu ubah apa pun di step build settings.
4. **Sebelum klik Deploy**, buka tab **Environment variables** di setup
   Netlify (atau nanti di *Site settings → Environment variables*) dan
   tambahkan:
   | Key | Value |
   |---|---|
   | `OPENAI_API_KEY` | API key OpenAI kamu (jangan pernah commit ini ke GitHub) |
   | `OPENAI_MODEL` | `gpt-4o-mini` (opsional, bisa ganti model lain) |
5. Klik **Deploy site**. Setelah selesai, site akan live di URL seperti
   `https://nama-acak.netlify.app` — bisa diganti custom domain di
   Site settings.
6. Setiap kali kamu `git push` ke branch `main`, Netlify otomatis re-deploy.

---

## Bisakah dipasang di WordPress?

Bisa, tapi arsitekturnya beda total dari yang dibuat di sini (yang berbasis
Netlify Functions + static frontend). Untuk WordPress kamu perlu:
- Bikin **plugin PHP** yang menyimpan `OPENAI_API_KEY` (misalnya lewat
  halaman Settings custom, disimpan di `wp_options`, jangan hardcode)
- Panggil OpenAI API dari server pakai `wp_remote_post()` (PHP), bukan
  `fetch()` di browser — supaya API key tidak bocor ke client
- Render UI-nya pakai shortcode atau Gutenberg block

Kode React/vanilla JS di project ini **tidak bisa langsung** dipasang di
WordPress tanpa dibungkus jadi plugin. Kalau kamu memang butuh versi
WordPress, itu project terpisah — beri tahu saya kalau mau saya buatkan.

**Rekomendasi:** pakai Netlify dulu (repo ini sudah siap), karena jauh lebih
cepat dan simpel untuk versioning + auto-deploy dari GitHub.

---

## Menambahkan data volume asli (opsional)

Kalau nanti mau naik level dari estimasi AI ke data volume pencarian yang
akurat, opsi yang paling praktis:

1. **DataForSEO API** (berbayar, murah, self-serve) — paling mirip Ahrefs,
   punya endpoint volume, CPC, difficulty, SERP data.
2. **Google Ads API (Keyword Planner)** — gratis, tapi butuh akun Google Ads
   aktif dan approval developer token.

Caranya: tambahkan file function baru, misalnya
`netlify/functions/volume-lookup.js`, yang dipanggil setelah
`keyword-research.js` selesai, lalu merge hasil volume asli ke tabel
berdasarkan field `keyword`. Struktur project ini sudah disiapkan supaya
gampang ditambah function baru tanpa mengubah frontend secara drastis.

---

## Kustomisasi prompt klasifikasi SEO vs GEO

Logika & definisi SEO vs GEO ada di `SYSTEM_PROMPT` dalam file
`netlify/functions/keyword-research.js`. Silakan edit definisi atau kriteria
skornya sesuai kebutuhan brand/industri kamu.

## Lisensi

MIT — bebas dipakai, dimodifikasi, dan didistribusikan ulang.
