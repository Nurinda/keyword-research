// netlify/functions/ai-citation-checker.js
//
// Fitur TERPISAH dari keyword-research.js — cek apakah sebuah URL dikutip
// (di-cite) oleh Google AI Overview, Perplexity, atau ChatGPT (OpenAI web
// search) untuk sekumpulan keyword/prompt.
//
// PENTING - baca sebelum pakai (lihat juga README bagian "Fitur Cek AI Citation"):
// - Ini adalah "citation probe" real-time, BUKAN data historis/analytics resmi.
//   Setiap kali dicek, AI generate ulang jawabannya, jadi hasil bisa berbeda
//   dari waktu ke waktu (ini sifat alami AI generatif, bukan bug).
// - Tidak ada API resmi untuk membaca histori sitasi ChatGPT versi konsumen.
//   Pengecekan ChatGPT di sini pakai OpenAI Responses API dengan web search
//   tool sebagai pendekatan/approksimasi, bukan data langsung dari ChatGPT app.
//
// Env var:
//   SERPAPI_KEY         - wajib untuk cek Google AI Overview
//   PERPLEXITY_API_KEY  - opsional, untuk cek Perplexity
//   OPENAI_API_KEY      - sudah ada (dipakai juga oleh keyword-research.js), untuk cek ChatGPT
//   OPENAI_MODEL_CHATGPT_CHECK - opsional, default "gpt-4o-mini" (model cepat & murah, cukup untuk cek ini)

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed. Gunakan POST." }),
    };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch (err) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Body request bukan JSON valid." }),
    };
  }

  const url = (payload.url || "").trim();
  const keywords = Array.isArray(payload.keywords)
    ? payload.keywords.filter((k) => typeof k === "string" && k.trim()).slice(0, 10)
    : [];

  if (!url) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "url wajib diisi." }) };
  }
  if (!keywords.length) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "keywords wajib diisi (minimal 1)." }),
    };
  }

  const target = normalizeUrl(url);
  if (!target) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "URL tidak valid. Pastikan formatnya lengkap, contoh: https://domainmu.com/artikel" }),
    };
  }

  const serpApiKey = process.env.SERPAPI_KEY;
  const perplexityKey = process.env.PERPLEXITY_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  try {
    // Semua keyword & semua engine dijalankan PARALEL (Promise.all), bukan
    // berurutan, supaya tetap di bawah batas waktu 10 detik Netlify Functions
    // walau mengecek beberapa keyword x 3 engine sekaligus.
    const results = await Promise.all(
      keywords.map(async (keyword) => {
        const [google, perplexity, chatgpt] = await Promise.all([
          checkGoogleAIOverview(keyword, serpApiKey, target),
          checkPerplexity(keyword, perplexityKey, target),
          checkChatGPT(keyword, openaiKey, target),
        ]);
        return { keyword, google_ai_overview: google, perplexity, chatgpt };
      })
    );

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        url,
        checkedAt: new Date().toISOString(),
        count: results.length,
        results,
        note:
          "Hasil ini adalah pengecekan real-time (citation probe), bukan data historis. AI generatif bisa memberi jawaban berbeda tiap kali dicek.",
      }),
    };
  } catch (err) {
    console.error("Unexpected error in ai-citation-checker function:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Internal error.", detail: String(err) }),
    };
  }
};

// ---------- Helpers ----------

function normalizeUrl(u) {
  try {
    const parsed = new URL(u);
    const host = parsed.hostname.replace(/^www\./i, "").toLowerCase();
    const path = parsed.pathname.replace(/\/$/, "").toLowerCase();
    return { host, path, full: `${host}${path}` };
  } catch (_) {
    return null;
  }
}

// Cari URL di dalam teks mentah (JSON stringified) lalu cocokkan ke target.
// Pendekatan regex generik dipakai (bukan parsing field spesifik) supaya tahan
// terhadap perubahan struktur JSON dari pihak ketiga (SerpApi/Perplexity/OpenAI).
function findMatch(rawText, target) {
  if (!rawText) return { cited: false };
  const urlRegex = /https?:\/\/[^\s"'`)\]}<>]+/g;
  const found = rawText.match(urlRegex) || [];

  for (const raw of found) {
    const clean = raw.replace(/[.,;]+$/, "");
    const n = normalizeUrl(clean);
    if (n && n.full === target.full) {
      return { cited: true, matchType: "exact", matchedUrl: clean };
    }
  }
  for (const raw of found) {
    const clean = raw.replace(/[.,;]+$/, "");
    const n = normalizeUrl(clean);
    if (n && n.host === target.host) {
      return { cited: true, matchType: "domain", matchedUrl: clean };
    }
  }
  return { cited: false };
}

async function checkGoogleAIOverview(keyword, apiKey, target) {
  if (!apiKey) {
    return { cited: false, error: "SERPAPI_KEY belum diisi di environment variable Netlify." };
  }
  try {
    const p1 = new URLSearchParams({ engine: "google", q: keyword, api_key: apiKey, no_cache: "true" });
    const r1 = await fetch(`https://serpapi.com/search.json?${p1}`);
    const t1 = await r1.text();
    if (!r1.ok) {
      console.error("SerpApi google engine error:", t1);
      return { cited: false, error: `SerpApi error (HTTP ${r1.status})` };
    }
    let d1;
    try {
      d1 = JSON.parse(t1);
    } catch (_) {
      return { cited: false, error: "Respons SerpApi bukan JSON valid." };
    }

    if (!d1.ai_overview) {
      return { cited: false }; // memang tidak ada AI Overview untuk query ini
    }

    let overviewText = JSON.stringify(d1.ai_overview);

    if (d1.ai_overview.page_token) {
      const p2 = new URLSearchParams({
        engine: "google_ai_overview",
        page_token: d1.ai_overview.page_token,
        api_key: apiKey,
      });
      const r2 = await fetch(`https://serpapi.com/search.json?${p2}`);
      const t2 = await r2.text();
      if (r2.ok) {
        overviewText = t2;
      } else {
        console.error("SerpApi google_ai_overview engine error:", t2);
      }
    }

    return findMatch(overviewText, target);
  } catch (err) {
    console.error("checkGoogleAIOverview error:", err);
    return { cited: false, error: String(err) };
  }
}

async function checkPerplexity(keyword, apiKey, target) {
  if (!apiKey) {
    return { cited: false, error: "PERPLEXITY_API_KEY belum diisi (opsional)." };
  }
  try {
    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "sonar",
        messages: [{ role: "user", content: keyword }],
      }),
    });
    const text = await res.text();
    if (!res.ok) {
      console.error("Perplexity API error:", text);
      return { cited: false, error: `Perplexity API error (HTTP ${res.status})` };
    }
    return findMatch(text, target);
  } catch (err) {
    console.error("checkPerplexity error:", err);
    return { cited: false, error: String(err) };
  }
}

async function checkChatGPT(keyword, apiKey, target) {
  if (!apiKey) {
    return { cited: false, error: "OPENAI_API_KEY belum diisi." };
  }
  try {
    const model = process.env.OPENAI_MODEL_CHATGPT_CHECK || "gpt-4o-mini";
    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        input: keyword,
        tools: [{ type: "web_search_preview" }],
      }),
    });
    const text = await res.text();
    if (!res.ok) {
      console.error("OpenAI Responses API error:", text);
      return { cited: false, error: `OpenAI Responses API error (HTTP ${res.status})` };
    }
    return findMatch(text, target);
  } catch (err) {
    console.error("checkChatGPT error:", err);
    return { cited: false, error: String(err) };
  }
}
