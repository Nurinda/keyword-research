// public/assets/citation.js
// Fitur "Cek AI Citation" — TERPISAH dari app.js dan trends.js. Tidak
// berbagi state/DOM apa pun dengan fitur lain.

(function () {
  "use strict";

  const form = document.getElementById("cite-form");
  if (!form) return;

  const urlInput = document.getElementById("citeUrl");
  const kwTextarea = document.getElementById("citeKeywords");
  const submitBtn = document.getElementById("citeSubmitBtn");
  const formError = document.getElementById("citeFormError");
  const summaryEl = document.getElementById("citeSummary");
  const body = document.getElementById("citeBody");
  const emptyState = document.getElementById("citeEmptyState");
  const loadingState = document.getElementById("citeLoadingState");

  const BATCH_SIZE = 3; // aman di bawah batas waktu Netlify Functions (10 detik)

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    formError.hidden = true;

    const url = urlInput.value.trim();
    const keywords = kwTextarea.value
      .split("\n")
      .map((k) => k.trim())
      .filter(Boolean);

    if (!url || !keywords.length) return;

    const batches = [];
    for (let i = 0; i < keywords.length; i += BATCH_SIZE) {
      batches.push(keywords.slice(i, i + BATCH_SIZE));
    }

    setLoading(true, batches.length > 1 ? `Batch 1 dari ${batches.length}…` : null);

    const collected = [];

    try {
      for (let i = 0; i < batches.length; i++) {
        if (batches.length > 1) {
          setLoadingProgress(`Mengecek batch ${i + 1} dari ${batches.length}…`);
        }

        const res = await fetch("/.netlify/functions/ai-citation-checker", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url, keywords: batches[i] }),
        });

        const rawBody = await res.text();
        let data;
        try {
          data = JSON.parse(rawBody);
        } catch (parseErr) {
          throw new Error(
            `Server tidak mengembalikan JSON pada batch ${i + 1}. Status HTTP: ${res.status}. Cuplikan: ${truncate(
              rawBody,
              200
            )}`
          );
        }

        if (!res.ok) {
          const baseMsg = data.error || `Batch ${i + 1} gagal. Status HTTP: ${res.status}.`;
          const detail = data.detail ? ` — Detail: ${truncate(data.detail, 300)}` : "";
          throw new Error(`${baseMsg}${detail}`);
        }

        const results = Array.isArray(data.results) ? data.results : [];
        collected.push(...results);
      }

      renderResults(url, collected);
    } catch (err) {
      formError.textContent = err.message || "Gagal mengecek sitasi.";
      formError.hidden = false;
      if (collected.length) {
        renderResults(url, collected);
      } else {
        body.innerHTML = "";
        emptyState.hidden = false;
        summaryEl.hidden = true;
      }
    } finally {
      setLoading(false);
    }
  });

  function setLoading(isLoading, progressText) {
    submitBtn.disabled = isLoading;
    submitBtn.textContent = isLoading ? "Mengecek…" : "Cek Sitasi AI";
    loadingState.hidden = !isLoading;
    if (isLoading) {
      emptyState.hidden = true;
      body.innerHTML = "";
      setLoadingProgress(progressText || "Mengecek sitasi AI…");
    }
  }

  function setLoadingProgress(text) {
    const p = loadingState.querySelector("p");
    if (p) p.textContent = text;
  }

  function truncate(str, max) {
    const s = String(str);
    return s.length > max ? s.slice(0, max) + "…" : s;
  }

  function renderResults(url, results) {
    body.innerHTML = "";

    if (!results.length) {
      emptyState.hidden = false;
      summaryEl.hidden = true;
      return;
    }

    emptyState.hidden = true;
    summaryEl.hidden = false;

    const totalGoogle = results.filter((r) => r.google_ai_overview && r.google_ai_overview.cited).length;
    const totalPerplexity = results.filter((r) => r.perplexity && r.perplexity.cited).length;
    const totalChatgpt = results.filter((r) => r.chatgpt && r.chatgpt.cited).length;

    summaryEl.textContent = `URL: ${url} · ${results.length} keyword dicek · dikutip di AI Overview: ${totalGoogle} · Perplexity: ${totalPerplexity} · ChatGPT: ${totalChatgpt}`;

    const frag = document.createDocumentFragment();
    results.forEach((r) => {
      const tr = document.createElement("tr");
      tr.appendChild(cell(r.keyword, "kw-cell"));
      tr.appendChild(statusCell(r.google_ai_overview));
      tr.appendChild(statusCell(r.perplexity));
      tr.appendChild(statusCell(r.chatgpt));
      frag.appendChild(tr);
    });
    body.appendChild(frag);
  }

  function cell(text, className) {
    const td = document.createElement("td");
    if (className) td.className = className;
    td.textContent = text;
    return td;
  }

  function statusCell(info) {
    const td = document.createElement("td");
    if (!info) {
      td.textContent = "—";
      return td;
    }
    if (info.error) {
      const span = document.createElement("span");
      span.className = "tier tier--Medium";
      span.textContent = "Belum bisa dicek";
      span.title = info.error;
      td.appendChild(span);
      return td;
    }

    const span = document.createElement("span");
    span.className = `pill ${info.cited ? "pill--seo" : "pill--both"}`;
    span.textContent = info.cited ? "Dikutip" : "Tidak ditemukan";
    td.appendChild(span);

    if (info.cited && info.matchType) {
      const small = document.createElement("div");
      small.className = "reason-cell";
      small.textContent = info.matchType === "exact" ? "Match persis (URL sama)" : "Match domain";
      td.appendChild(small);
    }
    return td;
  }
})();
