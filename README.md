# Keyword Research SEO & GEO

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
│       ├── keyword-research.js       # Tab 1: AI keyword research (OpenAI)
│       ├── google-trends.js          # Tab 2: Google Trends (SerpApi)
│       └── ai-citation-checker.js    # Tab 3: Cek AI Citation (SerpApi + Perplexity + OpenAI)
├── public/
│   ├── index.html                    # UI - 3 tab
│   └── assets/
│       ├── style.css
│       ├── app.js                    # Logic tab 1 (tidak diubah saat tab baru ditambahkan)
│       ├── tabs.js                   # Logic switch tab
│       ├── trends.js                 # Logic tab 2
│       └── citation.js               # Logic tab 3
├── netlify.toml                      # Konfigurasi Netlify (redirect /api/* -> functions)
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
   git commit -m "Initial commit: Keyword Research SEO & GEO"
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

## Catatan soal model reasoning (GPT-5.x, o-series) & batas waktu Netlify

Netlify Functions (paket gratis) punya batas eksekusi **10 detik** per request.
Model reasoning seperti `gpt-5.5` secara default mikir dengan level
"medium reasoning effort", yang kadang butuh waktu lebih dari itu — terutama
kalau diminta generate banyak keyword sekaligus. Untuk mengatasi ini, function
di project ini otomatis mengirim `reasoning_effort: "minimal"` khusus untuk
model reasoning, supaya responsnya jauh lebih cepat.

Kalau kamu tetap mengalami timeout:
- Turunkan jumlah keyword yang di-generate per request (slider di form)
- Atau ganti `OPENAI_MODEL` di Netlify ke model non-reasoning yang lebih
  cepat seperti `gpt-4o-mini` atau `gpt-4.1-mini`
- Kalau butuh tetap pakai model reasoning dengan banyak keyword, pertimbangkan
  upgrade paket Netlify (Pro ke atas punya limit lebih longgar) atau pindah
  ke arsitektur background function

## Fitur: Riset Keyword dari Google Trends (tab terpisah)

Tab ini **berbeda total** dari tab "Riset Keyword AI" — di sini datanya
**asli dari Google Trends**, bukan estimasi AI.

**API yang dibutuhkan: [SerpApi](https://serpapi.com/) — Google Trends API**

Kenapa SerpApi? Google **tidak** menyediakan API resmi publik untuk Google
Trends. SerpApi adalah layanan pihak ketiga yang paling banyak dipakai untuk
ini secara legal (mereka handle sisi scraping/parsing-nya), dengan hasil JSON
yang rapi dan terdokumentasi resmi.

**Cara setup:**
1. Daftar di [serpapi.com/users/sign_up](https://serpapi.com/users/sign_up) (ada free trial credits)
2. Ambil API key dari dashboard
3. Tambahkan environment variable di Netlify: `SERPAPI_KEY`

**Endpoint yang dipakai function ini:**
- `GET https://serpapi.com/search.json?engine=google_trends&data_type=TIMESERIES&q=<keyword>&geo=<geo>&date=<timeframe>&api_key=<key>` — data minat dari waktu ke waktu
- `GET https://serpapi.com/search.json?engine=google_trends&data_type=RELATED_QUERIES&q=<keyword>&geo=<geo>&date=<timeframe>&api_key=<key>` — ide keyword terkait (Top & Rising)

Dokumentasi resmi: [serpapi.com/google-trends-api](https://serpapi.com/google-trends-api)

**Catatan:** angka "minat" dari Google Trends adalah indeks relatif 0-100
(terhadap titik tertinggi di rentang waktu itu), **bukan** angka volume
pencarian absolut seperti di Ahrefs/Keyword Planner.

---

## Fitur: Cek AI Citation (tab terpisah)

Tab ini mengecek apakah sebuah **URL** kamu dikutip (di-cite) oleh AI untuk
sekumpulan keyword/prompt yang kamu masukkan — dicek ke 3 sumber berbeda:

### 1. Google AI Overview
**API:** SerpApi (key sama dengan fitur Google Trends: `SERPAPI_KEY`)

Alurnya 2 langkah (sesuai cara kerja SerpApi untuk AI Overview):
1. `GET https://serpapi.com/search.json?engine=google&q=<keyword>&api_key=<key>` — search normal, cek apakah ada field `ai_overview` di hasilnya
2. Kalau `ai_overview.page_token` ada (kontennya belum lengkap), lanjut fetch:
   `GET https://serpapi.com/search.json?engine=google_ai_overview&page_token=<token>&api_key=<key>` — `page_token` ini **hanya valid ±4 menit**, jadi harus langsung dipakai

Dokumentasi resmi: [serpapi.com/google-ai-overview-api](https://serpapi.com/google-ai-overview-api)

### 2. Perplexity
**API:** [Perplexity Sonar API](https://docs.perplexity.ai/) (resmi dari Perplexity)

**Cara setup:**
1. Daftar & ambil API key di [perplexity.ai/settings/api](https://www.perplexity.ai/settings/api)
2. Tambahkan environment variable di Netlify: `PERPLEXITY_API_KEY` (opsional — kalau kosong, kolom Perplexity akan menampilkan "Belum bisa dicek")

Endpoint: `POST https://api.perplexity.ai/chat/completions` dengan model `sonar`. Respons Perplexity sudah menyertakan field `citations` (daftar URL sumber) yang kita cocokkan dengan URL kamu.

**Batasan jujur:** urutan/isi sitasi di Sonar API bisa berbeda dari yang
tampil di aplikasi Perplexity konsumen (beberapa riset independen menemukan
overlap-nya tidak 100%). Anggap ini sebagai *sinyal indikatif*, bukan data
pasti 1:1 dengan yang dilihat pengguna Perplexity.

### 3. ChatGPT (approksimasi)
**API:** OpenAI Responses API — pakai `OPENAI_API_KEY` yang **sudah ada**
(tidak perlu key baru), dengan `OPENAI_MODEL_CHATGPT_CHECK` opsional (default
`gpt-4o-mini`, dipilih karena cepat & murah untuk sekadar cek sitasi).

Endpoint: `POST https://api.openai.com/v1/responses` dengan
`tools: [{ "type": "web_search_preview" }]`. Sitasi muncul sebagai
`url_citation` annotations di teks jawaban.

**Batasan penting:** **Tidak ada API resmi** untuk membaca histori sitasi
ChatGPT versi konsumen (chatgpt.com). Pengecekan ini pakai model OpenAI yang
sama, dengan browsing web live, sebagai **pendekatan/approksimasi** —
bukan data langsung dari aplikasi ChatGPT yang dipakai orang lain.

### Batasan umum fitur ini (berlaku untuk ketiga sumber)
- Ini adalah **citation probe real-time**, bukan data historis/analytics.
  AI generatif menjawab ulang setiap kali diminta, jadi hasilnya bisa
  berbeda dari pengecekan ke pengecekan berikutnya (ini sifat alami AI,
  bukan bug) — sebaiknya cek berkala untuk melihat pola, bukan sekali saja.
- Setiap keyword yang dicek memanggil sampai 3 API berbayar sekaligus.
  Jaga jumlah keyword tetap wajar (di bawah ~20) supaya biaya & waktu proses
  terkendali. Frontend otomatis membagi jadi batch kecil (3 keyword per
  request) untuk menghindari timeout Netlify.

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
