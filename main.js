const form = document.querySelector("#search-form");
const input = document.querySelector("#search-input");
const results = document.querySelector("#results");

const params = new URLSearchParams(window.location.search);
const initialSearch = params.get("search") || params.get("q") || "";

if (initialSearch) {
  input.value = initialSearch;
  search(initialSearch);
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const query = input.value.trim();
  if (!query) return;
  const url = new URL(window.location.href);
  url.searchParams.set("search", query);
  window.history.pushState({}, "", url);
  search(query);
});

async function search(query) {
  results.innerHTML = `<p class="empty">Searching DuckDuckGo for ${escapeHtml(query)}...</p>`;
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`DuckDuckGo returned ${response.status}`);
    const data = await response.json();
    const items = collectResults(data, query);
    renderResults(items, query);
  } catch (error) {
    renderFallback(query, error.message);
  }
}

function collectResults(data, query) {
  const items = [];
  if (data.AbstractText || data.Answer) {
    items.push({
      title: data.Heading || query,
      url: data.AbstractURL || `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
      snippet: data.AbstractText || data.Answer
    });
  }

  for (const topic of flattenTopics(data.RelatedTopics || [])) {
    if (!topic.Text || !topic.FirstURL) continue;
    items.push({
      title: topic.Text.split(" - ")[0],
      url: topic.FirstURL,
      snippet: topic.Text
    });
  }

  return uniqueByUrl(items).slice(0, 12);
}

function flattenTopics(topics) {
  return topics.flatMap((topic) => topic.Topics ? flattenTopics(topic.Topics) : [topic]);
}

function uniqueByUrl(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = item.url || item.title;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function renderResults(items, query) {
  if (!items.length) {
    renderFallback(query, "No instant results came back.");
    return;
  }

  results.innerHTML = "";
  for (const item of items) {
    const card = document.createElement("article");
    card.className = "result";
    card.innerHTML = `
      <a href="${escapeAttr(item.url)}">${escapeHtml(item.title)}</a>
      <span class="url">${escapeHtml(item.url)}</span>
      <span class="snippet">${escapeHtml(item.snippet)}</span>
    `;
    results.append(card);
  }
}

function renderFallback(query, reason) {
  const encoded = encodeURIComponent(query);
  results.innerHTML = `
    <p class="empty">LowFrame Engine could not get instant API results. ${escapeHtml(reason)}</p>
    <article class="result">
      <a href="https://duckduckgo.com/?q=${encoded}">Search DuckDuckGo normally</a>
      <span class="url">duckduckgo.com</span>
      <span class="snippet">Open the full DuckDuckGo results page for this search.</span>
    </article>
    <article class="result">
      <a href="https://www.google.com/search?q=${encoded}">Search Google</a>
      <span class="url">google.com</span>
      <span class="snippet">Use Google for this search instead.</span>
    </article>
  `;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("'", "&#39;");
}
