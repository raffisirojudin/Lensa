# Lensa - Vision Analyzer

Foto atau upload sesuatu, AI langsung menjelaskan apa yang dilihat. Bisa baca teks di gambar, perkirakan info nutrisi makanan, terjemahkan teks dalam foto, atau tanya apa saja soal gambarnya. Didukung **Groq API** (model vision Llama 4 Scout). Jalan di Cloudflare Workers, 100% gratis tanpa kartu kredit.

## Fitur

- 📷 **Upload atau jepret langsung** -- dukung kamera HP lewat `capture="environment"`
- 🔍 **Tombol cepat** -- Jelaskan, Baca Teks, Info Nutrisi, Terjemahkan Teks -- tanpa perlu ngetik
- ❓ **Tanya bebas** -- ketik pertanyaan sendiri tentang gambar yang sama, berkali-kali tanpa upload ulang
- 🗂️ **Riwayat per gambar** -- semua pertanyaan & jawaban tentang foto yang sama tersimpan dalam satu sesi
- 🔒 **Proteksi password (opsional)**

## Setup dari Nol

### 1. Dapatkan API Key Groq (gratis)

Kalau sudah punya dari proyek Tutur/Cabang/Sigap Discord Bot, key yang sama bisa dipakai lagi. Kalau belum, daftar gratis di [console.groq.com](https://console.groq.com).

### 2. Upload ke GitHub

Upload `src/index.js`, `wrangler.jsonc`, `.gitignore` -- **disarankan pakai "Add file → Create new file"**, paste manual, bukan drag & drop (berdasarkan pengalaman beberapa proyek sebelumnya yang file-nya kosong kalau di-drag).

### 3. Hubungkan ke Cloudflare Workers

Dashboard Cloudflare → **Workers & Pages** → **Create** → **Import a Git Repository** → pilih repo `lensa`.

### 4. Isi Secrets

- `GROQ_API_KEY` = API key Groq kamu
- `APP_PASSWORD` (opsional, disarankan)

### 5. Buka link-nya dan coba!

Upload foto apa saja, klik salah satu tombol cepat atau ketik pertanyaan sendiri.

## Catatan teknis

- **Model**: `meta-llama/llama-4-scout-17b-16e-instruct` -- model vision Groq saat ini. Catatan jujur: model ini masih berstatus "Preview" di sisi Groq, jadi sesekali bisa ada perubahan/gangguan kecil di luar kendali kita
- **Resize otomatis di browser** -- gambar diperkecil maksimal 1024px (sisi terpanjang) dan dikompresi jadi JPEG sebelum dikirim, supaya cepat diupload dan tetap dalam batas ukuran yang didukung
- **Gambar tidak disimpan di server** -- dikirim langsung dari browser ke Groq lewat Worker, tidak ada penyimpanan permanen
- **Riwayat cuma di memori browser** -- refresh halaman akan menghapusnya
