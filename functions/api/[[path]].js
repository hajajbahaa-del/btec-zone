// Cloudflare Pages Function: catch-all API router for /api/*
// Uses D1 (binding: DB) + optional GitHub upload (repo contents API).
// Notes:
// - Admin credentials are read from environment variables: ADMIN_USER / ADMIN_PASS
// - Student accounts + progress are stored in D1

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/?/, ""); // "" or "public/state" etc
  const method = request.method.toUpperCase();

  try {
    // CORS
    if (method === "OPTIONS") return cors(new Response(null, { status: 204 }));
    const res = await route({ env, request, url, path, method });
    return cors(res);
  } catch (err) {
    const msg = (err && err.message) ? err.message : String(err);
    return cors(json({ ok: false, error: msg }, 500));
  }
}

function cors(res) {
  const h = new Headers(res.headers);
  h.set("Access-Control-Allow-Origin", "*");
  h.set("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  h.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return new Response(res.body, { status: res.status, headers: h });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}

function uid(prefix = "id") {
  return `${prefix}_${crypto.randomUUID()}`;
}

// ----- Crypto helpers (PBKDF2) -----
async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: 150000 },
    key,
    256
  );
  return `${toB64(salt)}.${toB64(new Uint8Array(bits))}`;
}
async function verifyPassword(password, stored) {
  const [saltB64, hashB64] = (stored || "").split(".");
  if (!saltB64 || !hashB64) return false;
  const salt = fromB64(saltB64);
  const expected = fromB64(hashB64);
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: 150000 },
    key,
    256
  );
  const got = new Uint8Array(bits);
  return timingSafeEqual(got, expected);
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= (a[i] ^ b[i]);
  return diff === 0;
}
function toB64(u8) {
  let s = "";
  for (const b of u8) s += String.fromCharCode(b);
  return btoa(s);
}
function fromB64(b64) {
  const s = atob(b64);
  const u8 = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i);
  return u8;
}

// ----- JWT (HMAC SHA-256) -----
async function signJWT(payload, secret, ttlSeconds) {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: now, exp: now + ttlSeconds };
  const enc = (obj) => base64url(JSON.stringify(obj));
  const data = `${enc(header)}.${enc(body)}`;
  const sig = await hmacSHA256(data, secret);
  return `${data}.${sig}`;
}
async function verifyJWT(token, secret) {
  const parts = (token || "").split(".");
  if (parts.length !== 3) return null;
  const [h, p, s] = parts;
  const data = `${h}.${p}`;
  const sig = await hmacSHA256(data, secret);
  if (sig !== s) return null;
  const payload = JSON.parse(fromBase64url(p));
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && now > payload.exp) return null;
  return payload;
}
function base64url(str) {
  return btoa(unescape(encodeURIComponent(str))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function fromBase64url(b64url) {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((b64url.length + 3) % 4);
  return decodeURIComponent(escape(atob(b64)));
}
async function hmacSHA256(data, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return toBase64Url(new Uint8Array(sig));
}
function toBase64Url(u8) {
  return toB64(u8).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

// ----- GitHub upload (repo contents API) -----
async function githubUpload({ env, path, contentBytes, message }) {
  // Required env vars:
  // GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO
  // Optional: GITHUB_BRANCH (default main), GITHUB_BASE_PATH (default btec_uploads)
  if (!env.GITHUB_TOKEN || !env.GITHUB_OWNER || !env.GITHUB_REPO) {
    throw new Error("GitHub integration is not configured (missing secrets)."
    );
  }
  const branch = env.GITHUB_BRANCH || "main";
  const basePath = (env.GITHUB_BASE_PATH || "btec_uploads").replace(/^\/+|\/+$/g, "");
  const fullPath = `${basePath}/${path}`.replace(/\/+/, "/");
  const apiUrl = `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${encodeURIComponent(fullPath)}`;

  const contentB64 = btoa(String.fromCharCode(...contentBytes));
  const headers = {
    "Authorization": `Bearer ${env.GITHUB_TOKEN}`,
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28"
  };

  // Check if file exists to get sha (update)
  let sha = null;
  const getRes = await fetch(`${apiUrl}?ref=${encodeURIComponent(branch)}`, { headers });
  if (getRes.status === 200) {
    const j = await getRes.json();
    sha = j.sha;
  }

  const putBody = {
    message: message || `Upload ${fullPath}`,
    content: contentB64,
    branch
  };
  if (sha) putBody.sha = sha;

  const putRes = await fetch(apiUrl, {
    method: "PUT",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(putBody)
  });
  if (!putRes.ok) {
    const t = await putRes.text();
    throw new Error(`GitHub upload failed: ${putRes.status} ${t.slice(0, 200)}`);
  }
  const out = await putRes.json();
  return {
    github_path: fullPath,
    download_url: out?.content?.download_url || out?.content?.html_url || ""
  };
}

// ----- Router -----
async function route({ env, request, url, path, method }) {
  // Public root
  if (method === "GET" && (path === "" || path === "/")) return json({ ok: true, name: "BTEC API" });

  // Public: state
  if (method === "GET" && path === "public/state") {
    const tracks = await env.DB.prepare("SELECT * FROM tracks ORDER BY sort_order, created_at").all();
    const lessons = await env.DB.prepare("SELECT id, track_id, title, description, level, sort_order, created_at FROM lessons ORDER BY sort_order, created_at").all();
    const gens = await env.DB.prepare("SELECT * FROM generations ORDER BY id DESC").all();
    const tasks = await env.DB.prepare("SELECT * FROM tasks ORDER BY id DESC").all();
    const docs = await env.DB.prepare("SELECT * FROM task_docs ORDER BY id DESC").all();
    return json({
      ok: true,
      tracks: tracks.results || [],
      lessons: lessons.results || [],
      generations: gens.results || [],
      tasks: tasks.results || [],
      taskDocs: docs.results || []
    });
  }

  // Public: get lesson + slides
  if (method === "GET" && path === "public/lesson") {
    const lessonId = url.searchParams.get("id");
    if (!lessonId) return json({ ok: false, error: "Missing id" }, 400);
    const lesson = await env.DB.prepare("SELECT * FROM lessons WHERE id=?").bind(lessonId).first();
    if (!lesson) return json({ ok: false, error: "Not found" }, 404);
    const slides = await env.DB.prepare("SELECT idx, title, points_json, code, notes FROM lesson_slides WHERE lesson_id=? ORDER BY idx ASC").bind(lessonId).all();
    return json({
      ok: true,
      lesson,
      slides: (slides.results || []).map(s => ({ ...s, points: JSON.parse(s.points_json || "[]") }))
    });
  }

  // =========================
  // Student auth
  // =========================
  if (method === "POST" && path === "student/register") {
    const body = await request.json();
    const username = (body.username || "").trim();
    const email = (body.email || "").trim().toLowerCase();
    const password = (body.password || "");
    if ((!username && !email) || password.length < 4) {
      return json({ ok: false, error: "بيانات غير صحيحة" }, 400);
    }

    const existing = await env.DB.prepare("SELECT id FROM students WHERE username=? OR email=?")
      .bind(username || null, email || null)
      .first();
    if (existing) return json({ ok: false, error: "الحساب موجود مسبقاً" }, 409);

    const id = uid("stu");
    const password_hash = await hashPassword(password);
    await env.DB.prepare("INSERT INTO students (id, username, email, password_hash) VALUES (?,?,?,?)")
      .bind(id, username || null, email || null, password_hash)
      .run();

    const token = await signJWT({ sub: id, role: "student" }, env.JWT_SECRET, 60 * 60 * 24 * 30);
    return json({ ok: true, token });
  }

  if (method === "POST" && path === "student/login") {
    const body = await request.json();
    const login = (body.login || "").trim();
    const password = (body.password || "");
    if (!login || !password) return json({ ok: false, error: "بيانات غير صحيحة" }, 400);

    const row = await env.DB.prepare("SELECT * FROM students WHERE username=? OR email=?")
      .bind(login, login.toLowerCase())
      .first();
    if (!row) return json({ ok: false, error: "بيانات الدخول غير صحيحة" }, 401);
    const ok = await verifyPassword(password, row.password_hash);
    if (!ok) return json({ ok: false, error: "بيانات الدخول غير صحيحة" }, 401);

    const token = await signJWT({ sub: row.id, role: "student" }, env.JWT_SECRET, 60 * 60 * 24 * 30);
    return json({ ok: true, token, username: row.username, email: row.email });
  }

  // Student: basic profile + progress summary
  if (path === "student/me" && method === "GET") {
    const payload = await requireAuth(env, request, "student");
    const me = await env.DB.prepare("SELECT id, username, email, created_at FROM students WHERE id=?")
      .bind(payload.sub)
      .first();

    const totalLessons = await env.DB.prepare("SELECT COUNT(*) as c FROM lessons").first();
    const completedLessons = await env.DB.prepare("SELECT COUNT(*) as c FROM progress WHERE student_id=? AND completed=1")
      .bind(payload.sub)
      .first();

    const last = await env.DB.prepare(
      "SELECT lesson_id, last_slide_idx, completed, updated_at FROM progress WHERE student_id=? ORDER BY updated_at DESC LIMIT 1"
    ).bind(payload.sub).first();

    return json({
      ok: true,
      me: me || null,
      summary: {
        total_lessons: Number(totalLessons?.c || 0),
        completed_lessons: Number(completedLessons?.c || 0),
        last_progress: last || null
      }
    });
  }

  // Student: progress (single) + list
  if (path === "student/progress") {
    const payload = await requireAuth(env, request, "student");
    if (method === "GET") {
      const lessonId = url.searchParams.get("lessonId");
      if (!lessonId) return json({ ok: false, error: "Missing lessonId" }, 400);
      const prog = await env.DB.prepare("SELECT * FROM progress WHERE student_id=? AND lesson_id=?")
        .bind(payload.sub, lessonId)
        .first();
      return json({ ok: true, progress: prog || null });
    }
    if (method === "POST") {
      const body = await request.json();
      const lessonId = body.lessonId;
      const completed = body.completed ? 1 : 0;
      const lastSlideIdx = Number.isFinite(body.lastSlideIdx) ? body.lastSlideIdx : 0;
      if (!lessonId) return json({ ok: false, error: "Missing lessonId" }, 400);
      await env.DB.prepare(`
        INSERT INTO progress (student_id, lesson_id, completed, last_slide_idx, updated_at)
        VALUES (?,?,?,?, datetime('now'))
        ON CONFLICT(student_id, lesson_id) DO UPDATE SET
          completed=excluded.completed,
          last_slide_idx=excluded.last_slide_idx,
          updated_at=datetime('now')
      `).bind(payload.sub, lessonId, completed, lastSlideIdx).run();
      return json({ ok: true });
    }
  }

  if (path === "student/progress/list" && method === "GET") {
    const payload = await requireAuth(env, request, "student");
    const rows = await env.DB.prepare(
      "SELECT lesson_id, completed, last_slide_idx, updated_at FROM progress WHERE student_id=? ORDER BY updated_at DESC"
    ).bind(payload.sub).all();
    return json({ ok: true, progress: rows.results || [] });
  }

  // =========================
  // Admin auth
  // =========================
  if (method === "POST" && path === "admin/login") {
    const body = await request.json();
    const user = (body.user || "").trim();
    const pass = (body.pass || "");

    if (!env.ADMIN_USER || !env.ADMIN_PASS) {
      return json({ ok: false, error: "Admin credentials not set in environment" }, 500);
    }
    if (user !== env.ADMIN_USER || pass !== env.ADMIN_PASS) {
      return json({ ok: false, error: "بيانات الدخول غير صحيحة" }, 401);
    }
    const token = await signJWT({ sub: "admin", role: "admin" }, env.JWT_SECRET, 60 * 60 * 12);
    return json({ ok: true, token });
  }

  // =========================
  // Admin CRUD
  // =========================
  if (path.startsWith("admin/")) {
    await requireAuth(env, request, "admin");

    // Tracks
    if (path === "admin/tracks" && method === "GET") {
      const r = await env.DB.prepare("SELECT * FROM tracks ORDER BY sort_order, created_at").all();
      return json({ ok: true, tracks: r.results || [] });
    }

    if (path === "admin/tracks" && method === "POST") {
      const body = await request.json();
      const id = (body.id || "").trim() || uid("track");
      const title = (body.title || "").trim();
      if (!title) return json({ ok: false, error: "Title required" }, 400);
      await env.DB.prepare(
        "INSERT OR REPLACE INTO tracks (id,title,description,icon,sort_order,updated_at) VALUES (?,?,?,?,?, datetime('now'))"
      ).bind(id, title, body.description || "", body.icon || "", body.sort_order || 0).run();
      return json({ ok: true, id });
    }

    if (path === "admin/tracks" && method === "DELETE") {
      const id = url.searchParams.get("id");
      if (!id) return json({ ok: false, error: "Missing id" }, 400);
      await env.DB.prepare("DELETE FROM tracks WHERE id=?").bind(id).run();
      return json({ ok: true });
    }

    // Lessons + slides
    if (path === "admin/lessons" && method === "POST") {
      const body = await request.json();
      const id = body.id || uid("les");
      const trackId = body.track_id;
      const title = (body.title || "").trim();
      if (!trackId || !title) return json({ ok: false, error: "track_id and title required" }, 400);

      await env.DB.prepare(`
        INSERT OR REPLACE INTO lessons (id, track_id, title, description, level, sort_order, updated_at)
        VALUES (?,?,?,?,?,?, datetime('now'))
      `).bind(
        id,
        trackId,
        title,
        body.description || "",
        body.level || "",
        body.sort_order || 0
      ).run();

      // Replace slides
      if (Array.isArray(body.slides)) {
        await env.DB.prepare("DELETE FROM lesson_slides WHERE lesson_id=?").bind(id).run();
        for (let i = 0; i < body.slides.length; i++) {
          const s = body.slides[i] || {};
          const sid = uid("sl");
          const points = Array.isArray(s.points) ? s.points : [];
          await env.DB.prepare(`
            INSERT INTO lesson_slides (id, lesson_id, idx, title, points_json, code, notes)
            VALUES (?,?,?,?,?,?,?)
          `).bind(
            sid,
            id,
            i,
            s.title || `Slide ${i + 1}`,
            JSON.stringify(points),
            s.code || "",
            s.notes || ""
          ).run();
        }
      }
      return json({ ok: true, id });
    }

    if (path === "admin/lessons" && method === "DELETE") {
      const id = url.searchParams.get("id");
      if (!id) return json({ ok: false, error: "Missing id" }, 400);
      await env.DB.prepare("DELETE FROM lessons WHERE id=?").bind(id).run();
      return json({ ok: true });
    }

    // Generations
    if (path === "admin/generations" && method === "POST") {
      const body = await request.json();
      const name = (body.name || "").trim();
      if (!name) return json({ ok: false, error: "Name required" }, 400);
      const r = await env.DB.prepare("INSERT INTO generations (name) VALUES (?)").bind(name).run();
      return json({ ok: true, id: r.meta.last_row_id });
    }

    if (path === "admin/generations" && method === "DELETE") {
      const id = url.searchParams.get("id");
      if (!id) return json({ ok: false, error: "Missing id" }, 400);
      await env.DB.prepare("DELETE FROM generations WHERE id=?").bind(id).run();
      return json({ ok: true });
    }

    // Tasks
    if (path === "admin/tasks" && method === "POST") {
      const body = await request.json();
      const generationId = body.generation_id;
      const title = (body.title || "").trim();
      if (!generationId || !title) return json({ ok: false, error: "generation_id and title required" }, 400);
      const r = await env.DB.prepare("INSERT INTO tasks (generation_id, title, body) VALUES (?,?,?)")
        .bind(generationId, title, body.body || "")
        .run();
      return json({ ok: true, id: r.meta.last_row_id });
    }

    if (path === "admin/tasks" && method === "DELETE") {
      const id = url.searchParams.get("id");
      if (!id) return json({ ok: false, error: "Missing id" }, 400);
      await env.DB.prepare("DELETE FROM tasks WHERE id=?").bind(id).run();
      return json({ ok: true });
    }

    // Upload task document: POST /api/admin/task-docs/upload?taskId=123
    if (path === "admin/task-docs/upload" && method === "POST") {
      const taskId = url.searchParams.get("taskId");
      if (!taskId) return json({ ok: false, error: "Missing taskId" }, 400);

      const ct = request.headers.get("content-type") || "";
      if (!ct.includes("multipart/form-data")) {
        return json({ ok: false, error: "Use multipart/form-data with field name 'file'" }, 415);
      }

      const form = await request.formData();
      const file = form.get("file");
      if (!file) return json({ ok: false, error: "Missing file" }, 400);

      const filename = (file.name || "file").replace(/[^\w.\-() ]+/g, "_");
      const ab = await file.arrayBuffer();
      const bytes = new Uint8Array(ab);
      if (bytes.length > 20 * 1024 * 1024) return json({ ok: false, error: "File too large (max 20MB)" }, 413);

      const safePath = `${taskId}/${Date.now()}_${filename}`;
      const up = await githubUpload({ env, path: safePath, contentBytes: bytes, message: `Task ${taskId}: ${filename}` });

      await env.DB.prepare(`
        INSERT INTO task_docs (task_id, file_name, github_path, download_url, size_bytes)
        VALUES (?,?,?,?,?)
      `).bind(taskId, filename, up.github_path, up.download_url, bytes.length).run();

      return json({ ok: true, file_name: filename, download_url: up.download_url });
    }

    if (path === "admin/task-docs" && method === "DELETE") {
      const id = url.searchParams.get("id");
      if (!id) return json({ ok: false, error: "Missing id" }, 400);
      await env.DB.prepare("DELETE FROM task_docs WHERE id=?").bind(id).run();
      return json({ ok: true });
    }

    // Backup: exports JSON (small)
    if (path === "admin/backup" && method === "GET") {
      const tracks = await env.DB.prepare("SELECT * FROM tracks").all();
      const lessons = await env.DB.prepare("SELECT * FROM lessons").all();
      const slides = await env.DB.prepare("SELECT * FROM lesson_slides").all();
      const gens = await env.DB.prepare("SELECT * FROM generations").all();
      const tasks = await env.DB.prepare("SELECT * FROM tasks").all();
      const docs = await env.DB.prepare("SELECT * FROM task_docs").all();
      return json({
        ok: true,
        export: {
          tracks: tracks.results || [],
          lessons: lessons.results || [],
          slides: slides.results || [],
          generations: gens.results || [],
          tasks: tasks.results || [],
          task_docs: docs.results || []
        }
      });
    }
  }

  return json({ ok: false, error: "Not found" }, 404);
}

async function requireAuth(env, request, role) {
  const auth = request.headers.get("authorization") || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) throw new Error("Unauthorized");
  const token = m[1];
  const payload = await verifyJWT(token, env.JWT_SECRET);
  if (!payload || payload.role !== role) throw new Error("Unauthorized");
  return payload;
}
