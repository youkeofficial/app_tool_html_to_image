import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import logger from './logger.js';

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'saas.sqlite');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// Initialisation du Schéma SaaS
db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        permissions TEXT NOT NULL DEFAULT '[]',
        api_key TEXT UNIQUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS templates (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        name TEXT NOT NULL,
        description TEXT,
        type TEXT NOT NULL,
        html_content TEXT NOT NULL,
        variables TEXT NOT NULL,
        is_public INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        type TEXT NOT NULL, -- image, video, audio, compose
        status TEXT DEFAULT 'pending', -- pending, processing, completed, failed
        input_data TEXT,
        result_url TEXT,
        error_message TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS history (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        type TEXT NOT NULL,
        context TEXT,
        result_url TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
    );

    -- Tables mtier spcifiques
    CREATE TABLE IF NOT EXISTS audio_records (id TEXT PRIMARY KEY, user_id TEXT, text TEXT, lang TEXT, url TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS image_records (id TEXT PRIMARY KEY, user_id TEXT, html TEXT, url TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS video_records (id TEXT PRIMARY KEY, user_id TEXT, html TEXT, duration INTEGER, url TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS composition_records (id TEXT PRIMARY KEY, user_id TEXT, source_video TEXT, source_audio TEXT, url TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
`);

// Template Seeds (Public)
const seedTemplates = [
    {
        id: 'img_quote_01',
        name: 'Quote Card Classic',
        description: 'A beautiful static quote card with a background image or color.',
        type: 'image',
        variables: JSON.stringify(["quote", "author", "bgUrl"]),
        html_content: `
<div style="display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100vh; background: url('{{bgUrl}}') center/cover no-repeat; color: white; font-family: sans-serif; text-align: center; padding: 4rem;">
    <div style="background: rgba(0,0,0,0.6); padding: 3rem; border-radius: 20px; max-width: 800px; backdrop-filter: blur(10px);">
        <p style="font-size: 3rem; font-style: italic; margin-bottom: 2rem;">"{{quote}}"</p>
        <h3 style="font-size: 2rem; color: #f43f5e;">- {{author}}</h3>
    </div>
</div>`
    },
    {
        id: 'vid_pulse_01',
        name: 'Pulsing Text Video',
        description: 'Text scales up and down endlessly.',
        type: 'video',
        variables: JSON.stringify(["text", "bgColor", "textColor"]),
        html_content: `
<style>
  body { margin: 0; background: {{bgColor}}; color: {{textColor}}; font-family: system-ui, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; overflow: hidden; }
  h1 { font-size: 6rem; animation: pulse 1.5s infinite alternate; text-align: center; }
  @keyframes pulse { 0% { transform: scale(1); text-shadow: 0 0 0 rgba(0,0,0,0); } 100% { transform: scale(1.15); text-shadow: 0 20px 40px rgba(0,0,0,0.3); } }
</style>
<h1>{{text}}</h1>`
    },
    {
        id: 'vid_neon_01',
        name: 'Neon Glowing Text',
        description: 'Text that flickers and glows with neon effect.',
        type: 'video',
        variables: JSON.stringify(["text", "neonColor"]),
        html_content: `
<style>
  body { margin: 0; background: #000; color: #fff; display: flex; justify-content: center; align-items: center; height: 100vh; font-family: 'Courier New', Courier, monospace; overflow: hidden; }
  .neon { font-size: 6rem; padding: 2rem; border: 4px solid {{neonColor}}; border-radius: 20px; animation: flicker 2s linear infinite; text-shadow: 0 0 5px {{neonColor}}, 0 0 20px {{neonColor}}, 0 0 50px {{neonColor}}; box-shadow: inset 0 0 20px {{neonColor}}, 0 0 20px {{neonColor}}; }
  @keyframes flicker {
    0%, 18%, 22%, 25%, 53%, 57%, 100% { opacity: 1; }
    20%, 24%, 55% { opacity: 0.5; }
  }
</style>
<div class="neon">{{text}}</div>`
    }
];

const checkTemplate = db.prepare('SELECT id FROM templates WHERE id = ?');
const insertTemplate = db.prepare('INSERT INTO templates (id, name, description, type, html_content, variables, is_public) VALUES (@id, @name, @description, @type, @html_content, @variables, 1)');

for (const t of seedTemplates) {
    if (!checkTemplate.get(t.id)) {
        insertTemplate.run(t);
    }
}

export default db;
