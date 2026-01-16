-- BTEC zone database schema (Cloudflare D1)
-- هذا الملف يُستخدم لتجهيز قاعدة البيانات لأول مرة.
-- إذا كانت لديك قاعدة بيانات سابقة، اترك CREATE TABLE كما هو، ويمكنك فقط تشغيل جزء INSERT الخاص بالمسارات.

-- =========================
-- Core content (Tracks/Lessons)
-- =========================
CREATE TABLE IF NOT EXISTS tracks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  icon TEXT DEFAULT '',
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS lessons (
  id TEXT PRIMARY KEY,
  track_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  level TEXT DEFAULT '',
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY(track_id) REFERENCES tracks(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS lesson_slides (
  id TEXT PRIMARY KEY,
  lesson_id TEXT NOT NULL,
  idx INTEGER NOT NULL,
  title TEXT NOT NULL,
  points_json TEXT NOT NULL,
  code TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY(lesson_id) REFERENCES lessons(id) ON DELETE CASCADE
);

-- =========================
-- Tasks / documents
-- =========================
CREATE TABLE IF NOT EXISTS generations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  generation_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  body TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY(generation_id) REFERENCES generations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS task_docs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL,
  file_name TEXT NOT NULL,
  github_path TEXT NOT NULL,
  download_url TEXT NOT NULL,
  size_bytes INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

-- =========================
-- Students + progress
-- =========================
CREATE TABLE IF NOT EXISTS students (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE,
  email TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS progress (
  student_id TEXT NOT NULL,
  lesson_id TEXT NOT NULL,
  completed INTEGER DEFAULT 0,
  last_slide_idx INTEGER DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY(student_id, lesson_id),
  FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE
);

-- Admin audit (اختياري)
CREATE TABLE IF NOT EXISTS admin_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT NOT NULL,
  meta_json TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now'))
);

-- =========================
-- Seed default tracks
-- =========================
-- يمكنك تعديل هذه القائمة كما تريد. (INSERT OR IGNORE) لا يكرر نفس id.
INSERT OR IGNORE INTO tracks (id, title, description, icon, sort_order) VALUES
('it', 'أساسيات IT', 'مفاهيم تقنية عامة وبداية قوية في تكنولوجيا المعلومات.', '💻', 1),
('net', 'الشبكات', 'أساسيات الشبكات والاتصال + تطبيقات عملية.', '🌐', 2),
('cyber', 'الأمن السيبراني', 'التوعية والحماية الرقمية والاستخدام الآمن.', '🛡️', 3),

('python', 'Python', 'تعلم أساسيات بايثون بأسلوب الشرائح وأمثلة عملية.', '🐍', 10),
('csharp', 'C#', 'مسار متكامل لتعلم C# وبناء تطبيقات.', '♯', 11),
('cpp', 'C++', 'أساسيات C++ ومفاهيم البرمجة الكائنية.', '➕➕', 12),
('java', 'Java', 'تعلم Java من الصفر مع أمثلة واضحة.', '☕', 13),
('html', 'HTML', 'مسار HTML من الصفر لبناء صفحات الويب.', '🔤', 14),
('css', 'CSS', 'تصميم واجهات حديثة باستخدام CSS.', '🎨', 15),
('flutter', 'Flutter', 'تطوير تطبيقات موبايل باستخدام Flutter.', '📱', 16),
('dart', 'Dart', 'لغة Dart للمبتدئين (مناسبة لFlutter).', '🎯', 17);
