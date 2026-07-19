/* Frutopia — leaderboard API (Cloudflare Worker + KV).
   Endpoints:
     GET  /top?board=classic|daily-YYYY-MM-DD   → { scores: [{name, score}] }
     POST /submit  {board, name, score}         → { ok: true, rank }
*/

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const BOARD_RE = /^(classic|daily-\d{4}-\d{2}-\d{2})$/;
const MAX_KEEP = 100;   // guardados por board
const MAX_TOP = 25;     // devolvidos no GET
const MAX_SCORE = 200000;
const RATE_PER_MIN = 12;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

function cleanName(raw) {
  if (typeof raw !== "string") return "";
  // remove controlos e espaços repetidos; limita a 16 chars
  return raw.replace(/[\u0000-\u001F\u007F]/g, "").replace(/\s+/g, " ").trim().slice(0, 16);
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);

    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

    if (req.method === "GET" && url.pathname === "/top") {
      const board = url.searchParams.get("board") || "";
      if (!BOARD_RE.test(board)) return json({ error: "invalid board" }, 400);
      const scores = (await env.SCORES.get("board:" + board, "json")) || [];
      return json({ scores: scores.slice(0, MAX_TOP) });
    }

    if (req.method === "POST" && url.pathname === "/submit") {
      // rate limit simples por IP
      const ip = req.headers.get("CF-Connecting-IP") || "?";
      const rlKey = "rl:" + ip;
      const hits = parseInt((await env.SCORES.get(rlKey)) || "0", 10);
      if (hits >= RATE_PER_MIN) return json({ error: "slow down" }, 429);
      await env.SCORES.put(rlKey, String(hits + 1), { expirationTtl: 60 });

      let body;
      try { body = await req.json(); } catch { return json({ error: "bad json" }, 400); }

      const board = typeof body.board === "string" ? body.board : "";
      const name = cleanName(body.name);
      const score = body.score;
      if (!BOARD_RE.test(board)) return json({ error: "invalid board" }, 400);
      if (!name) return json({ error: "invalid name" }, 400);
      if (!Number.isInteger(score) || score < 1 || score > MAX_SCORE) {
        return json({ error: "invalid score" }, 400);
      }

      const key = "board:" + board;
      const scores = (await env.SCORES.get(key, "json")) || [];
      scores.push({ name, score, t: Date.now() });
      scores.sort((a, b) => b.score - a.score);
      const kept = scores.slice(0, MAX_KEEP);
      await env.SCORES.put(key, JSON.stringify(kept));

      const rank = kept.findIndex((s) => s.name === name && s.score === score) + 1;
      return json({ ok: true, rank: rank || null });
    }

    return json({ error: "not found" }, 404);
  },
};
