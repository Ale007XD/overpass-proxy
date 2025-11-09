const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://lz4.overpass-api.de/api/interpreter"
];

const MAX_BODY_SIZE = "100kb";
const MAX_QUERY_LENGTH = 5000;

app.use(express.text({ type: "*/*", limit: MAX_BODY_SIZE }));

app.use(
  cors({
    origin: [
      "https://ale007xd.github.io", // твой GitHub Pages
      "http://localhost:3000"
    ],
    methods: ["POST", "OPTIONS"]
  })
);

app.get("/", (req, res) => {
  res.json({ ok: true, service: "overpass-proxy" });
});

app.post("/overpass", async (req, res) => {
  const query = req.body || "";

  if (!query.trim()) {
    return res.status(400).json({ error: "Empty Overpass query" });
  }
  if (query.length > MAX_QUERY_LENGTH) {
    return res.status(413).json({ error: "Query too large" });
  }
  if (!query.includes("[out:json")) {
    return res.status(400).json({ error: "Only [out:json] queries allowed" });
  }

  let lastError = null;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 25000);

      const upstreamRes = await fetch(endpoint, {
        method: "POST",
        body: query,
        headers: {
          "Content-Type": "text/plain",
          "User-Agent":
            "OSM-FoodFinder-OverpassProxy/1.0 (contact: your-email@example.com)"
        },
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!upstreamRes.ok) {
        lastError = new Error(
          `Overpass ${endpoint} responded with ${upstreamRes.status}`
        );
        continue;
      }

      const data = await upstreamRes.text();
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      return res.status(200).send(data);
    } catch (err) {
      lastError = err;
      continue;
    }
  }

  console.error("All Overpass endpoints failed:", lastError);
  return res.status(502).json({
    error: "All Overpass endpoints failed",
    details: lastError ? String(lastError) : null
  });
});

app.listen(PORT, () => {
  console.log(`Overpass proxy server running on port ${PORT}`);
});
