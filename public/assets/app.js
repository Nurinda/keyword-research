// public/assets/app.js
// Vanilla JS - tanpa build step. Berkomunikasi dengan Netlify Function
// di /api/keyword-research (di-redirect ke /.netlify/functions/keyword-research
// lewat netlify.toml).

(function () {
  "use strict";

  const form = document.getElementById("research-form");
  const seedInput = document.getElementById("seedKeyword");
  const marketInput = document.getElementById("market");
  const languageInput = document.getElementById("language");
  const countInput = document.getElementById("count");
  const countValue = document.getElementById("countValue");
  const submitBtn = document.getElementById("submitBtn");
  const formError = document.getElementById("formError");

  const channelFilter = document.getElementById("channelFilter");
  const intentFilter = document.getElementById("intentFilter");
  const searchBox = document.getElementById("searchBox");
  const exportBtn = document.getElementById("exportBtn");

  const resultsBody = document.getElementById("resultsBody");
  const resultMeta = document.getElementById("resultMeta");
  const emptyState = document.getElementById("emptyState");
  const loadingState = document.getElementById("loadingState");

  let allKeywords = [];
  let activeChannel = "All";
  let lastResponseMeta = null;

  countInput.addEventListener("input", () => {
    countValue.textContent = countInput.value;
  });

  channelFilter.addEventListener("click", (e) => {
    const btn = e.target.closest(".segmented__btn");
    if (!btn) return;
    activeChannel = btn.dataset.value;
    [...channelFilter.querySelectorAll(".segmented__btn")].forEach((b) =>
      b.classList.toggle("is-active", b === btn)
    );
    renderTable();
  });

  intentFilter.addEventListener("change", renderTable);
  searchBox.addEventListener("input", renderTable);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    formError.hidden = true;

    const seedKeyword = seedInput.value.trim();
    if (!seedKeyword) return;

    setLoading(true);

    try {
      const res = await fetch("/api/keyword-research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seedKeyword,
          market: marketInput.value.trim() || "Indonesia",
          language: languageInput.value.trim() || "Bahasa Indonesia",
          count: parseInt(countInput.value, 10),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        const baseMsg = data.error || "Terjadi kesalahan saat memanggil API.";
        const detail = data.detail ? ` — Detail: ${truncate(data.detail, 300)}` : "";
        throw new Error(`${baseMsg}${detail}`);
      }

      allKeywords = Array.isArray(data.keywords) ? data.keywords : [];
      lastResponseMeta = data;
      renderTable();
      renderMeta();
      exportBtn.disabled = allKeywords.length === 0;
    } catch (err) {
      formError.textContent = err.message || "Gagal mengambil data. Coba lagi.";
      formError.hidden = false;
      allKeywords = [];
      renderTable();
    } finally {
      setLoading(false);
    }
  });

  exportBtn.addEventListener("click", () => {
    const rows = getFilteredKeywords();
    if (!rows.length) return;

    const headers = [
      "keyword",
      "cluster",
      "intent",
      "volume_tier",
      "difficulty_tier",
      "seo_score",
      "geo_score",
      "recommended_channel",
      "reasoning",
    ];

    const csvLines = [headers.join(",")];
    rows.forEach((row) => {
      const line = headers
        .map((h) => csvEscape(row[h] ?? ""))
        .join(",");
      csvLines.push(line);
    });

    const blob = new Blob([csvLines.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const seed = (lastResponseMeta?.seedKeyword || "keywords").replace(
      /[^a-z0-9]+/gi,
      "-"
    );
    a.href = url;
    a.download = `keyword-genius-${seed}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  function truncate(str, max) {
    const s = String(str);
    return s.length > max ? s.slice(0, max) + "…" : s;
  }

  function csvEscape(value) {
    const str = String(value);
    if (/[",\n]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  function setLoading(isLoading) {
    submitBtn.disabled = isLoading;
    submitBtn.textContent = isLoading ? "Menghasilkan…" : "Generate keyword";
    loadingState.hidden = !isLoading;
    if (isLoading) {
      emptyState.hidden = true;
      resultsBody.innerHTML = "";
    }
  }

  function getFilteredKeywords() {
    const intentVal = intentFilter.value;
    const q = searchBox.value.trim().toLowerCase();

    return allKeywords.filter((kw) => {
      if (activeChannel !== "All" && kw.recommended_channel !== activeChannel) {
        return false;
      }
      if (intentVal !== "All" && kw.intent !== intentVal) {
        return false;
      }
      if (q && !String(kw.keyword || "").toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }

  function renderMeta() {
    if (!lastResponseMeta) {
      resultMeta.hidden = true;
      return;
    }
    resultMeta.hidden = false;
    resultMeta.textContent = `seed: "${lastResponseMeta.seedKeyword}" · model: ${lastResponseMeta.model} · ${lastResponseMeta.count} keyword dihasilkan · ${new Date(
      lastResponseMeta.generatedAt
    ).toLocaleString("id-ID")}`;
  }

  function renderTable() {
    const rows = getFilteredKeywords();
    resultsBody.innerHTML = "";

    if (!rows.length) {
      emptyState.hidden = false;
      emptyState.querySelector("p").innerHTML = allKeywords.length
        ? "Tidak ada keyword yang cocok dengan filter ini."
        : "Belum ada hasil. Isi form di sebelah kiri lalu klik <strong>Generate keyword</strong>.";
      return;
    }

    emptyState.hidden = true;

    const frag = document.createDocumentFragment();
    rows.forEach((kw) => {
      frag.appendChild(buildRow(kw));
    });
    resultsBody.appendChild(frag);
  }

  function buildRow(kw) {
    const tr = document.createElement("tr");

    tr.appendChild(cell(kw.keyword, "kw-cell"));
    tr.appendChild(cell(kw.cluster || "—", "cluster-cell"));
    tr.appendChild(cell(kw.intent || "—"));
    tr.appendChild(tierCell(kw.volume_tier));
    tr.appendChild(tierCell(kw.difficulty_tier));
    tr.appendChild(scoreCell(kw.seo_score, "seo"));
    tr.appendChild(scoreCell(kw.geo_score, "geo"));
    tr.appendChild(channelCell(kw.recommended_channel));
    tr.appendChild(cell(kw.reasoning || "—", "reason-cell"));

    return tr;
  }

  function cell(text, className) {
    const td = document.createElement("td");
    if (className) td.className = className;
    td.textContent = text;
    return td;
  }

  function tierCell(tier) {
    const td = document.createElement("td");
    const span = document.createElement("span");
    span.className = `tier tier--${tier || "Low"}`;
    span.textContent = tier || "—";
    td.appendChild(span);
    return td;
  }

  function scoreCell(score, type) {
    const td = document.createElement("td");
    const val = Math.max(0, Math.min(100, Number(score) || 0));

    const wrap = document.createElement("div");
    wrap.className = "score-bar-wrap";

    const bar = document.createElement("div");
    bar.className = `score-bar score-bar--${type}`;
    const fill = document.createElement("span");
    fill.style.width = `${val}%`;
    bar.appendChild(fill);

    const num = document.createElement("span");
    num.className = "score-num";
    num.textContent = val;

    wrap.appendChild(bar);
    wrap.appendChild(num);
    td.appendChild(wrap);
    return td;
  }

  function channelCell(channel) {
    const td = document.createElement("td");
    const span = document.createElement("span");
    const ch = channel || "SEO";
    span.className = `pill pill--${ch.toLowerCase()}`;
    span.textContent = ch;
    td.appendChild(span);
    return td;
  }
})();
