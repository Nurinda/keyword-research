// netlify/functions/google-trends.js
//
// Fitur TERPISAH dari keyword-research.js — riset keyword berdasarkan data
// Google Trends asli (bukan estimasi AI).
//
// API yang dipakai: SerpApi Google Trends API
// Dokumentasi: https://serpapi.com/google-trends-api
// Daftar akun: https://serpapi.com/users/sign_up
//
// Env var yang dibutuhkan:
//   SERPAPI_KEY (wajib untuk fitur ini)

const SERPAPI_BASE = "https://serpapi.com/search.json";

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

  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error:
          "SERPAPI_KEY belum di-set di environment variables Netlify. Daftar di serpapi.com lalu tambahkan key-nya (lihat README bagian 'Fitur Google Trends').",
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
  const geo = (payload.geo || "ID").trim();
  const timeframe = (payload.timeframe || "today 12-m").trim();

  if (!seedKeyword) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "seedKeyword wajib diisi." }),
    };
  }

  try {
    const commonParams = { engine: "google_trends", q: seedKeyword, geo, date: timeframe, api_key: apiKey };

    const tsParams = new URLSearchParams({ ...commonParams, data_type: "TIMESERIES" });
    const relParams = new URLSearchParams({ ...commonParams, data_type: "RELATED_QUERIES" });

    const [tsRes, relRes] = await Promise.all([
      fetch(`${SERPAPI_BASE}?${tsParams}`),
      fetch(`${SERPAPI_BASE}?${relParams}`),
    ]);

    const tsText = await tsRes.text();
    const relText = await relRes.text();

    let tsData = null;
    let relData = null;
    try {
      tsData = JSON.parse(tsText);
    } catch (_) {}
    try {
      relData = JSON.parse(relText);
    } catch (_) {}

    if (!tsRes.ok || tsData?.error) {
      console.error("SerpApi Google Trends (TIMESERIES) error:", tsText);
      return {
        statusCode: tsRes.status && tsRes.status >= 400 ? tsRes.status : 502,
        headers,
        body: JSON.stringify({
          error: `SerpApi (Google Trends) mengembalikan error.`,
          detail: tsData?.error || tsText,
        }),
      };
    }

    if (!relRes.ok || relData?.error) {
      // Related queries bisa saja legitimately kosong untuk seed yang sangat spesifik/baru.
      // Jangan gagalkan seluruh request, cukup log dan lanjut dengan array kosong.
      console.error("SerpApi Google Trends (RELATED_QUERIES) warning:", relText);
    }

    const timeline = tsData?.interest_over_time?.timeline_data || [];
    const values = timeline
      .map((t) => Number(t.values?.[0]?.extracted_value ?? t.values?.[0]?.value))
      .filter((v) => !Number.isNaN(v));
    const average = values.length
      ? Math.round(values.reduce((a, b) => a + b, 0) / values.length)
      : null;
    const latest = values.length ? values[values.length - 1] : null;

    const top = relData?.related_queries?.top || [];
    const rising = relData?.related_queries?.rising || [];

    const keywordIdeas = [
      ...top.map((q) => ({
        query: q.query,
        type: "Top",
        value: q.value,
        extracted_value: q.extracted_value,
        link: q.link,
      })),
      ...rising.map((q) => ({
        query: q.query,
        type: "Rising",
        value: q.value,
        extracted_value: q.extracted_value,
        link: q.link,
      })),
    ];

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        seedKeyword,
        geo,
        timeframe,
        interestSummary: { average, latest },
        keywordIdeas,
        count: keywordIdeas.length,
        note:
          "Data asli dari Google Trends (via SerpApi). Nilai 'minat' adalah indeks relatif 0-100 terhadap titik tertinggi pada rentang waktu ini, BUKAN angka volume pencarian absolut.",
      }),
    };
  } catch (err) {
    console.error("Unexpected error in google-trends function:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Internal error.", detail: String(err) }),
    };
  }
};
