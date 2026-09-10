// public/assets/trends.js
// Fitur "Riset Keyword dari Google Trends" — TERPISAH dari app.js (tab
// "Riset Keyword AI"). Tidak berbagi state/DOM apa pun dengan app.js.

(function () {
  "use strict";

  const form = document.getElementById("trends-form");
  if (!form) return; // panel tidak ada di halaman ini, aman untuk skip

  const keywordInput = document.getElementById("trendsKeyword");
  const geoInput = document.getElementById("trendsGeo");
  const timeframeSelect = document.getElementById("trendsTimeframe");
  const submitBtn = document.getElementById("trendsSubmitBtn");
  const formError = document.getElementById("trendsFormError");
  const summaryEl = document.getElementById("trendsSummary");
  const body = document.getElementById("trendsBody");
  const emptyState = document.getElementById("trendsEmptyState");
  const loadingState = document.getElementById("trendsLoadingState");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    formError.hidden = true;

    const seedKeyword = keywordInput.value.trim();
    if (!seedKeyword) return;

    setLoading(true);

    try {
      const res = await fetch("/.netlify/functions/google-trends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seedKeyword,
          geo: geoInput.value.trim() || "ID",
          timeframe: timeframeSelect.value,
        }),
      });

      const rawBody = await res.text();
      let data;
      try {
        data = JSON.parse(rawBody);
      } catch (parseErr) {
        throw new Error(
          `Server tidak mengembalikan JSON. Status HTTP: ${res.status}. Cuplikan: ${truncate(rawBody, 200)}`
        );
      }

      if (!res.ok) {
        const baseMsg = data.error || `Gagal mengambil data Trends. Status HTTP: ${res.status}.`;
        const detail = data.detail ? ` — Detail: ${truncate(data.detail, 300)}` : "";
        throw new Error(`${baseMsg}${detail}`);
      }

      renderResults(data);
    } catch (err) {
      formError.textContent = err.message || "Gagal mengambil data.";
      formError.hidden = false;
      body.innerHTML = "";
      emptyState.hidden = false;
      emptyState.querySelector("p").innerHTML =
        "Belum ada hasil. Isi form di sebelah kiri lalu klik <strong>Cek Trends</strong>.";
      summaryEl.hidden = true;
    } finally {
      setLoading(false);
    }
  });

  function setLoading(isLoading) {
    submitBtn.disabled = isLoading;
    submitBtn.textContent = isLoading ? "Mengambil data…" : "Cek Trends";
    loadingState.hidden = !isLoading;
    if (isLoading) {
      emptyState.hidden = true;
      body.innerHTML = "";
    }
  }

  function truncate(str, max) {
    const s = String(str);
    return s.length > max ? s.slice(0, max) + "…" : s;
  }

  function renderResults(data) {
    const ideas = Array.isArray(data.keywordIdeas) ? data.keywordIdeas : [];
    body.innerHTML = "";

    if (!ideas.length) {
      emptyState.hidden = false;
      emptyState.querySelector("p").textContent =
        "Tidak ada related queries yang ditemukan Google Trends untuk keyword ini. Coba keyword lain yang lebih umum.";
      summaryEl.hidden = true;
      return;
    }

    emptyState.hidden = true;
    summaryEl.hidden = false;
    const s = data.interestSummary || {};
    summaryEl.textContent = `keyword: "${data.seedKeyword}" · geo: ${data.geo} · rentang: ${data.timeframe} · rata-rata minat: ${
      s.average ?? "—"
    } · terbaru: ${s.latest ?? "—"} · ${ideas.length} related queries ditemukan`;

    const frag = document.createDocumentFragment();
    ideas.forEach((idea) => {
      frag.appendChild(buildRow(idea));
    });
    body.appendChild(frag);
  }

  function buildRow(idea) {
    const tr = document.createElement("tr");
    tr.appendChild(cell(idea.query, "kw-cell"));
    tr.appendChild(typeCell(idea.type));
    tr.appendChild(cell(idea.value || "—"));

    const linkTd = document.createElement("td");
    if (idea.link) {
      const a = document.createElement("a");
      a.href = idea.link;
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = "Lihat di Google Trends";
      linkTd.appendChild(a);
    } else {
      linkTd.textContent = "—";
    }
    tr.appendChild(linkTd);

    return tr;
  }

  function cell(text, className) {
    const td = document.createElement("td");
    if (className) td.className = className;
    td.textContent = text;
    return td;
  }

  function typeCell(type) {
    const td = document.createElement("td");
    const span = document.createElement("span");
    span.className = `pill ${type === "Rising" ? "pill--geo" : "pill--seo"}`;
    span.textContent = type || "—";
    td.appendChild(span);
    return td;
  }
})();
