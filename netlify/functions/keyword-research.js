// netlify/functions/keyword-research.js
//
// Serverless function (runs on Netlify, Node 18+).
// Menerima seed keyword dari frontend, memanggil OpenAI API untuk:
//   1. Generate variasi/keyword turunan
//   2. Menentukan search intent
//   3. Estimasi tier volume & difficulty (BUKAN angka pasti - lihat README)
//   4. Skor & klasifikasi SEO vs GEO
//
// Env var yang dibutuhkan (di-set di Netlify dashboard, bukan di kode):
//   OPENAI_API_KEY   (wajib)
//   OPENAI_MODEL     (opsional, default gpt-4o-mini)

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

const SYSTEM_PROMPT = `Kamu adalah SEO & GEO (Generative Engine Optimization) strategist senior.
Tugasmu: dari satu seed keyword, hasilkan daftar keyword turunan yang relevan lalu klasifikasikan masing-masing.

Definisi penting:
- SEO keyword: keyword yang tujuannya menarik traffic klik dari hasil pencarian organik tradisional (Google SERP biasa). Biasanya head-term/mid-tail, punya intent transactional/commercial jelas, kompetitif.
- GEO keyword: keyword yang berpeluang membuat konten dikutip (cited) oleh AI Overview Google, ChatGPT, Perplexity, Copilot, dsb. Biasanya long-tail, berbentuk pertanyaan natural language ("apa itu...", "bagaimana cara...", "X vs Y", "rekomendasi...", "kenapa..."), butuh jawaban yang terstruktur, definitif, dan mudah di-extract oleh LLM sebagai satu jawaban ringkas.
- Sebuah keyword bisa saja relevan untuk KEDUANYA (Both) jika volume cukup besar sekaligus formatnya cocok untuk dikutip AI.

Untuk setiap keyword berikan estimasi TIER, bukan angka presisi, karena kamu tidak punya akses data search volume real:
- volume_tier: "High" | "Medium" | "Low"
- difficulty_tier: "High" | "Medium" | "Low"

Field wajib per keyword:
- keyword (string)
- cluster (nama topik/cluster singkat, untuk grouping)
- intent: "Informational" | "Commercial" | "Transactional" | "Navigational"
- volume_tier: "High" | "Medium" | "Low"
- difficulty_tier: "High" | "Medium" | "Low"
- seo_score (0-100, seberapa cocok untuk strategi SEO klasik/traffic)
- geo_score (0-100, seberapa cocok untuk strategi GEO/AI citation)
- recommended_channel: "SEO" | "GEO" | "Both"
- reasoning (1 kalimat singkat, bahasa Indonesia, jelaskan kenapa skornya begitu)

Balas HANYA dalam format JSON valid, tanpa markdown, tanpa teks pembuka/penutup, dengan struktur persis:
{
  "keywords": [ { ... }, { ... } ]
}`;

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

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error:
          "OPENAI_API_KEY belum di-set di environment variables Netlify. Buka Site settings > Environment variables.",
      }),
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

  const seedKeyword = (payload.seedKeyword || "").trim();
  const market = (payload.market || "Indonesia").trim();
  const language = (payload.language || "Bahasa Indonesia").trim();
  const count = Math.min(Math.max(parseInt(payload.count, 10) || 25, 5), 60);

  if (!seedKeyword) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "seedKeyword wajib diisi." }),
    };
  }

  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

  // Model reasoning generasi baru (gpt-5*, o1*, o3*, o4*) hanya mendukung
  // temperature default (1) dan menolak nilai custom seperti 0.7.
  const isReasoningModel = /^(gpt-5|o1|o3|o4)/i.test(model);

  const userPrompt = `Seed keyword: "${seedKeyword}"
Target market: ${market}
Bahasa target: ${language}
Jumlah keyword yang harus dihasilkan: sekitar ${count} keyword (boleh sedikit lebih/kurang).

Hasilkan campuran keyword head-term, mid-tail, dan long-tail (termasuk yang berbentuk pertanyaan natural language yang berpotensi dijawab AI Overview/ChatGPT/Perplexity). Pastikan ada representasi keyword yang condong SEO, yang condong GEO, dan yang Both.`;

  try {
    const requestBody = {
      model,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
    };

    // Hanya kirim temperature custom kalau modelnya mendukung (bukan reasoning model).
    if (!isReasoningModel) {
      requestBody.temperature = 0.7;
    } else {
      // Model reasoning (gpt-5.x, o-series) defaultnya "medium" reasoning effort,
      // yang bisa lebih lambat dari batas waktu eksekusi Netlify Functions (10 detik).
      // "minimal" mempercepat respons drastis - cocok untuk tugas klasifikasi seperti ini.
      requestBody.reasoning_effort = "minimal";
    }

    const response = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(
        `OpenAI API error — status ${response.status}, model "${model}":`,
        errText
      );
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({
          error: `OpenAI API mengembalikan error (HTTP ${response.status}).`,
          detail: errText,
        }),
      };
    }

    const data = await response.json();
    const rawText = data.choices?.[0]?.message?.content || "{}";

    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch (err) {
      return {
        statusCode: 502,
        headers,
        body: JSON.stringify({
          error: "Gagal parse respons OpenAI sebagai JSON.",
          raw: rawText,
        }),
      };
    }

    const keywords = Array.isArray(parsed.keywords) ? parsed.keywords : [];

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        seedKeyword,
        market,
        language,
        model,
        generatedAt: new Date().toISOString(),
        count: keywords.length,
        keywords,
        note:
          "volume_tier & difficulty_tier adalah ESTIMASI berbasis pola linguistik dari AI, bukan data pasti seperti Ahrefs/Google Keyword Planner.",
      }),
    };
  } catch (err) {
    console.error("Unexpected error in keyword-research function:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Internal error.", detail: String(err) }),
    };
  }
};
