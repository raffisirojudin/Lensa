/**
 * Lensa - Vision Analyzer
 * Foto atau upload sesuatu, AI menjelaskan apa yang dilihat. Mendukung
 * pertanyaan custom (baca teks, info nutrisi, terjemahkan teks di gambar, dst).
 * Didukung Groq API (model vision Llama 4 Scout). Jalan di Cloudflare Workers.
 */

const GROQ_VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/login" && request.method === "POST") {
      return handleLogin(request, env);
    }
    if (url.pathname === "/api/analyze" && request.method === "POST") {
      return handleAnalyze(request, env);
    }

    return new Response(HTML_PAGE, {
      headers: { "Content-Type": "text/html; charset=UTF-8" },
    });
  },
};

async function handleLogin(request, env) {
  const { password } = await request.json();
  const appPassword = env.APP_PASSWORD;
  if (!appPassword) {
    return jsonResponse({ ok: true });
  }
  return jsonResponse({ ok: password === appPassword });
}

async function handleAnalyze(request, env) {
  try {
    if (!env.GROQ_API_KEY) {
      return jsonResponse({ error: "GROQ_API_KEY belum diset di Secrets." }, 500);
    }

    const { imageDataUrl, question, password } = await request.json();

    if (env.APP_PASSWORD && password !== env.APP_PASSWORD) {
      return jsonResponse({ error: "Password salah atau belum dimasukkan." }, 401);
    }

    if (!imageDataUrl || typeof imageDataUrl !== "string") {
      return jsonResponse({ error: "Tidak ada gambar yang dikirim." }, 400);
    }

    const prompt =
      question && question.trim()
        ? question.trim()
        : "Jelaskan apa yang ada di gambar ini secara detail.";

    const result = await analyzeImage(imageDataUrl, prompt, env.GROQ_API_KEY);
    return jsonResponse({ result });
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}

async function analyzeImage(imageDataUrl, prompt, apiKey) {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: GROQ_VISION_MODEL,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: `${prompt} Selalu jawab dalam Bahasa Indonesia, jelas dan tidak bertele-tele.` },
            { type: "image_url", image_url: { url: imageDataUrl } },
          ],
        },
      ],
      temperature: 0.4,
      max_tokens: 1024,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(friendlyErrorMessage(response.status, errorText));
  }

  const data = await response.json();
  const result = data?.choices?.[0]?.message?.content;
  return result ? result.trim() : "Maaf, gagal menganalisis gambar itu.";
}

function friendlyErrorMessage(status, rawErrorText) {
  const lower = rawErrorText.toLowerCase();
  if (status === 429 || lower.includes("rate limit")) {
    return "Kuota Groq habis untuk saat ini. Tunggu sebentar lalu coba lagi.";
  }
  if (status === 401 || status === 403) {
    return "API Key Groq tidak valid. Cek lagi nilai GROQ_API_KEY di Secrets.";
  }
  if (status === 503) {
    return "Server Groq sedang sibuk. Coba lagi sebentar.";
  }
  if (status === 413 || lower.includes("too large")) {
    return "Gambar terlalu besar. Coba foto/gambar lain yang lebih kecil.";
  }
  return `Terjadi kesalahan (${status}): ${rawErrorText}`;
}

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const HTML_PAGE = `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Lensa</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@600;700&family=Inter:wght@400;500;600&display=swap');

  :root {
    --bg: #15151a;
    --panel: #1f1f26;
    --border: #32323d;
    --accent: #f5d547;
    --text: #ededf2;
    --muted: #8a8a96;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: 'Inter', sans-serif;
    background: var(--bg);
    color: var(--text);
    display: flex;
    justify-content: center;
    min-height: 100vh;
  }
  .app { width: 100%; max-width: 600px; padding: 28px 20px 50px; }

  header { display: flex; align-items: center; gap: 14px; margin-bottom: 6px; }
  header h1 { margin: 0; font-family: 'Sora', sans-serif; font-size: 26px; }
  .tagline { margin: 0 0 22px; color: var(--muted); font-size: 14px; }

  .aperture { flex-shrink: 0; }
  .iris { transition: r 0.2s ease; }
  .aperture.analyzing .iris { animation: focus-pulse 1.3s ease-in-out infinite; }
  @keyframes focus-pulse {
    0%, 100% { r: 6; opacity: 1; }
    50% { r: 3; opacity: 0.55; }
  }

  .dropzone {
    border: 1.5px dashed var(--border);
    border-radius: 14px;
    padding: 28px 20px;
    text-align: center;
    cursor: pointer;
    background: var(--panel);
    margin-bottom: 16px;
    transition: border-color 0.15s ease;
  }
  .dropzone:hover, .dropzone.drag-over { border-color: var(--accent); }
  .dropzone p { margin: 8px 0 0; color: var(--muted); font-size: 13px; }
  .dropzone .pick-icon { font-size: 28px; }

  .preview-wrap { margin-bottom: 16px; border-radius: 14px; overflow: hidden; border: 1px solid var(--border); }
  .preview-wrap img { width: 100%; display: block; max-height: 320px; object-fit: contain; background: #000; }
  .preview-actions { display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; background: var(--panel); }
  .preview-actions button {
    background: transparent; border: none; color: var(--muted); font-size: 13px; cursor: pointer; font-family: inherit;
  }
  .preview-actions button:hover { color: var(--text); }

  .chips { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 14px; }
  .chip {
    border: 1px solid var(--border);
    background: var(--panel);
    color: var(--text);
    border-radius: 20px;
    padding: 7px 13px;
    font-size: 13px;
    cursor: pointer;
    font-family: inherit;
  }
  .chip:hover { border-color: var(--accent); color: var(--accent); }

  form#ask-form { display: flex; gap: 8px; margin-bottom: 18px; }
  form#ask-form input {
    flex: 1;
    padding: 12px 14px;
    border-radius: 10px;
    border: 1px solid var(--border);
    background: var(--panel);
    color: var(--text);
    font-family: inherit;
    font-size: 15px;
  }
  form#ask-form input::placeholder { color: var(--muted); }
  form#ask-form button {
    padding: 12px 20px;
    border-radius: 10px;
    border: none;
    background: var(--accent);
    color: #221c00;
    font-weight: 700;
    cursor: pointer;
    font-family: inherit;
  }
  form#ask-form button:disabled { opacity: 0.5; cursor: not-allowed; }

  .status { text-align: center; color: var(--muted); font-size: 13px; min-height: 18px; margin-bottom: 10px; }

  #log { display: flex; flex-direction: column; gap: 10px; }
  .entry { background: var(--panel); border: 1px solid var(--border); border-radius: 12px; padding: 14px; }
  .entry .q { font-size: 12px; color: var(--accent); text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 6px; }
  .entry .a { font-size: 15px; line-height: 1.6; white-space: pre-wrap; }

  .gate { display: flex; align-items: center; justify-content: center; min-height: 100vh; width: 100%; padding: 20px; }
  .gate-card { background: var(--panel); border: 1px solid var(--border); border-radius: 12px; padding: 32px; width: 100%; max-width: 320px; text-align: center; }
  .gate-card h2 { margin: 0 0 16px; font-family: 'Sora', sans-serif; font-size: 17px; }
  .gate-card input {
    width: 100%; margin-bottom: 12px; padding: 12px; border-radius: 8px;
    border: 1px solid var(--border); background: var(--bg); color: var(--text); font-size: 15px; font-family: inherit;
  }
  .gate-card button {
    width: 100%; padding: 12px; border-radius: 8px; border: none;
    background: var(--accent); color: #221c00; font-weight: 700; cursor: pointer; font-family: inherit;
  }
  .gate-error { color: #ff8a8a; font-size: 13px; margin: 10px 0 0; min-height: 16px; }
</style>
</head>
<body>
  <div class="gate" id="gate">
    <div class="gate-card">
      <h2>🔒 Akses Terbatas</h2>
      <input id="gate-input" type="password" placeholder="Masukkan password" autocomplete="current-password" />
      <button id="gate-btn" type="button">Masuk</button>
      <p class="gate-error" id="gate-error"></p>
    </div>
  </div>

  <div class="app" id="app" style="display:none;">
    <header>
      <svg class="aperture" id="aperture-icon" viewBox="0 0 48 48" width="38" height="38">
        <circle cx="24" cy="24" r="20" fill="none" stroke="#f5d547" stroke-width="1.5" opacity="0.4" />
        <g stroke="#f5d547" stroke-width="2" stroke-linecap="round">
          <line x1="24" y1="6" x2="24" y2="14" />
          <line x1="24" y1="6" x2="24" y2="14" transform="rotate(60 24 24)" />
          <line x1="24" y1="6" x2="24" y2="14" transform="rotate(120 24 24)" />
          <line x1="24" y1="6" x2="24" y2="14" transform="rotate(180 24 24)" />
          <line x1="24" y1="6" x2="24" y2="14" transform="rotate(240 24 24)" />
          <line x1="24" y1="6" x2="24" y2="14" transform="rotate(300 24 24)" />
        </g>
        <circle class="iris" cx="24" cy="24" r="6" fill="#f5d547" />
      </svg>
      <h1>Lensa</h1>
    </header>
    <p class="tagline">Foto atau upload sesuatu -- AI jelasin apa yang dilihat.</p>

    <div class="dropzone" id="dropzone">
      <div class="pick-icon">📷</div>
      <p>Klik buat upload foto, atau jepret langsung dari kamera</p>
    </div>
    <input type="file" id="file-input" accept="image/*" capture="environment" style="display:none;" />

    <div class="preview-wrap" id="preview-wrap" style="display:none;">
      <img id="preview-img" alt="Pratinjau gambar" />
      <div class="preview-actions">
        <span id="preview-info"></span>
        <button type="button" id="change-photo-btn">Ganti foto</button>
      </div>
    </div>

    <div class="chips" id="chips" style="display:none;">
      <button class="chip" type="button" data-q="Jelaskan apa yang ada di gambar ini secara detail.">🔍 Jelaskan</button>
      <button class="chip" type="button" data-q="Baca dan tuliskan ulang semua teks yang terlihat di gambar ini.">📝 Baca Teks</button>
      <button class="chip" type="button" data-q="Kalau ini makanan, perkirakan info nutrisinya (kalori, protein, dll). Kalau bukan makanan, katakan itu bukan makanan.">🍽️ Info Nutrisi</button>
      <button class="chip" type="button" data-q="Terjemahkan semua teks yang terlihat di gambar ini ke Bahasa Indonesia.">🌐 Terjemahkan Teks</button>
    </div>

    <form id="ask-form" style="display:none;">
      <input id="question-input" type="text" placeholder="Atau ketik pertanyaan sendiri..." aria-label="Pertanyaan tentang gambar" />
      <button type="submit" id="ask-btn">Tanya</button>
    </form>

    <p class="status" id="status" role="status" aria-live="polite"></p>

    <div id="log"></div>
  </div>

  <script>
    // ---------- Gerbang password ----------
    const gateEl = document.getElementById("gate");
    const appEl = document.getElementById("app");
    const gateInput = document.getElementById("gate-input");
    const gateBtn = document.getElementById("gate-btn");
    const gateError = document.getElementById("gate-error");
    let appPassword = "";

    function showApp() {
      gateEl.style.display = "none";
      appEl.style.display = "block";
    }

    async function checkPassword(password) {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: password }),
      });
      const data = await res.json();
      return data.ok;
    }

    async function tryLogin() {
      const password = gateInput.value;
      gateBtn.disabled = true;
      gateError.textContent = "";
      try {
        const ok = await checkPassword(password);
        if (ok) { appPassword = password; showApp(); }
        else gateError.textContent = "Password salah, coba lagi.";
      } catch (err) {
        gateError.textContent = "Gagal memeriksa password: " + err.message;
      } finally {
        gateBtn.disabled = false;
      }
    }

    checkPassword("").then(function (ok) {
      if (ok) { appPassword = ""; showApp(); }
    }).catch(function () {});

    gateBtn.addEventListener("click", tryLogin);
    gateInput.addEventListener("keydown", function (e) { if (e.key === "Enter") tryLogin(); });

    // ---------- Vision analyzer ----------
    const dropzone = document.getElementById("dropzone");
    const fileInput = document.getElementById("file-input");
    const previewWrap = document.getElementById("preview-wrap");
    const previewImg = document.getElementById("preview-img");
    const previewInfo = document.getElementById("preview-info");
    const changePhotoBtn = document.getElementById("change-photo-btn");
    const chips = document.getElementById("chips");
    const askForm = document.getElementById("ask-form");
    const askBtn = document.getElementById("ask-btn");
    const questionInput = document.getElementById("question-input");
    const statusEl = document.getElementById("status");
    const logEl = document.getElementById("log");
    const apertureIcon = document.getElementById("aperture-icon");

    let currentImageDataUrl = null;

    function resizeImage(file, maxDimension) {
      return new Promise(function (resolve, reject) {
        const reader = new FileReader();
        reader.onload = function (e) {
          const img = new Image();
          img.onload = function () {
            let width = img.width;
            let height = img.height;
            if (width > maxDimension || height > maxDimension) {
              if (width > height) {
                height = Math.round(height * (maxDimension / width));
                width = maxDimension;
              } else {
                width = Math.round(width * (maxDimension / height));
                height = maxDimension;
              }
            }
            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0, width, height);
            resolve({ dataUrl: canvas.toDataURL("image/jpeg", 0.85), width: width, height: height });
          };
          img.onerror = reject;
          img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    }

    dropzone.addEventListener("click", function () { fileInput.click(); });
    changePhotoBtn.addEventListener("click", function () { fileInput.click(); });

    fileInput.addEventListener("change", async function () {
      const file = fileInput.files[0];
      if (!file) return;
      statusEl.textContent = "Memproses gambar...";
      try {
        const resized = await resizeImage(file, 1024);
        currentImageDataUrl = resized.dataUrl;
        previewImg.src = resized.dataUrl;
        previewInfo.textContent = resized.width + "x" + resized.height + "px";
        previewWrap.style.display = "block";
        dropzone.style.display = "none";
        chips.style.display = "flex";
        askForm.style.display = "flex";
        logEl.innerHTML = "";
        statusEl.textContent = "";
      } catch (err) {
        statusEl.textContent = "Gagal memproses gambar: " + err.message;
      }
    });

    function addLogEntry(question, answer) {
      const entry = document.createElement("div");
      entry.className = "entry";
      const qEl = document.createElement("div");
      qEl.className = "q";
      qEl.textContent = question;
      const aEl = document.createElement("div");
      aEl.className = "a";
      aEl.textContent = answer;
      entry.appendChild(qEl);
      entry.appendChild(aEl);
      logEl.appendChild(entry);
      entry.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    async function analyze(question) {
      if (!currentImageDataUrl) return;
      statusEl.textContent = "Menganalisis gambar...";
      apertureIcon.classList.add("analyzing");
      askBtn.disabled = true;
      try {
        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageDataUrl: currentImageDataUrl,
            question: question,
            password: appPassword,
          }),
        });
        const data = await res.json();
        if (data.error) {
          statusEl.textContent = data.error;
        } else {
          addLogEntry(question || "Jelaskan gambar ini", data.result);
          statusEl.textContent = "";
        }
      } catch (err) {
        statusEl.textContent = "Gagal terhubung: " + err.message;
      } finally {
        apertureIcon.classList.remove("analyzing");
        askBtn.disabled = false;
      }
    }

    chips.addEventListener("click", function (e) {
      const btn = e.target.closest(".chip");
      if (!btn) return;
      analyze(btn.dataset.q);
    });

    askForm.addEventListener("submit", function (e) {
      e.preventDefault();
      const q = questionInput.value.trim();
      if (!q) return;
      questionInput.value = "";
      analyze(q);
    });
  </script>
</body>
</html>`;
