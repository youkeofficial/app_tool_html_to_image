import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import logger from './logger.js';

let dbInstance: Database<sqlite3.Database, sqlite3.Statement> | null = null;

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const templatesData = [
    {
        id: 'img_quote_01',
        name: 'Quote Card Classic',
        description: 'A beautiful static quote card with a background image or color.',
        type: 'image',
        variables: '["quote", "author", "bgUrl"]',
        html_content: `
<div style="display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100vh; background: url('{{bgUrl}}') center/cover no-repeat; color: white; font-family: sans-serif; text-align: center; padding: 4rem;">
    <div style="background: rgba(0,0,0,0.6); padding: 3rem; border-radius: 20px; max-width: 800px; backdrop-filter: blur(10px);">
        <p style="font-size: 3rem; font-style: italic; margin-bottom: 2rem;">"{{quote}}"</p>
        <h3 style="font-size: 2rem; color: #f43f5e;">- {{author}}</h3>
    </div>
</div>`
    },
    {
        id: 'img_news_01',
        name: 'News Announcement',
        description: 'Lower third style news announcement card.',
        type: 'image',
        variables: '["headline", "subheadline", "bgUrl"]',
        html_content: `
<div style="height: 100vh; background: url('{{bgUrl}}') center/cover no-repeat; display: flex; align-items: flex-end; font-family: 'Arial', sans-serif;">
    <div style="background: linear-gradient(to right, rgba(220,38,38,0.9), rgba(185,28,28,0.8)); color: white; padding: 2rem 4rem; width: 100%; border-top: 8px solid white;">
        <h1 style="font-size: 4rem; margin: 0; text-transform: uppercase;">{{headline}}</h1>
        <p style="font-size: 2rem; margin: 0.5rem 0 0 0; color: #fca5a5;">{{subheadline}}</p>
    </div>
</div>`
    },
    {
        id: 'img_product_01',
        name: 'Product Showcase',
        description: 'Showcase a product with name and price.',
        type: 'image',
        variables: '["productName", "price", "productImage"]',
        html_content: `
<div style="display: flex; height: 100vh; background: #f8fafc; font-family: system-ui, sans-serif;">
    <div style="flex: 1; display: flex; justify-content: center; align-items: center; padding: 4rem;">
        <img src="{{productImage}}" style="max-width: 100%; max-height: 80vh; filter: drop-shadow(0 20px 30px rgba(0,0,0,0.2));" />
    </div>
    <div style="flex: 1; display: flex; flex-direction: column; justify-content: center; padding: 4rem; background: #ffffff;">
        <h1 style="font-size: 5rem; color: #1e293b; margin: 0;">{{productName}}</h1>
        <p style="font-size: 4rem; color: #10b981; font-weight: bold; margin: 2rem 0;">{{price}}</p>
        <div style="padding: 1rem 3rem; background: #3b82f6; color: white; display: inline-block; border-radius: 50px; font-size: 2rem; align-self: flex-start;">Buy Now</div>
    </div>
</div>`
    },
    {
        id: 'img_gradient_01',
        name: 'Gradient Title Card',
        description: 'A simple, modern title card with gradient background.',
        type: 'image',
        variables: '["title", "color1", "color2"]',
        html_content: `
<div style="display: flex; height: 100vh; background: linear-gradient(135deg, {{color1}}, {{color2}}); color: white; justify-content: center; align-items: center; font-family: sans-serif;">
    <h1 style="font-size: 6rem; text-shadow: 0 10px 20px rgba(0,0,0,0.4); text-align: center; max-width: 80%;">{{title}}</h1>
</div>`
    },
    {
        id: 'img_event_01',
        name: 'Event Invitation',
        description: 'A stylish event card.',
        type: 'image',
        variables: '["eventName", "date", "location"]',
        html_content: `
<div style="display: flex; height: 100vh; background: #111827; color: white; justify-content: center; align-items: center; font-family: sans-serif;">
    <div style="border: 2px solid #fbbf24; padding: 4rem; border-radius: 12px; text-align: center; max-width: 800px; background: rgba(251, 191, 36, 0.1);">
        <h2 style="color: #fbbf24; letter-spacing: 4px; text-transform: uppercase;">You're Invited</h2>
        <h1 style="font-size: 5rem; margin: 2rem 0;">{{eventName}}</h1>
        <p style="font-size: 2rem; color: #9ca3af;">{{date}}</p>
        <p style="font-size: 1.5rem; color: #d1d5db; margin-top: 1rem;">@ {{location}}</p>
    </div>
</div>`
    },
    {
        id: 'vid_pulse_01',
        name: 'Pulsing Text Video',
        description: 'Text scales up and down endlessly.',
        type: 'video',
        variables: '["text", "bgColor", "textColor"]',
        html_content: `
<style>
  body { margin: 0; background: {{bgColor}}; color: {{textColor}}; font-family: system-ui, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; overflow: hidden; }
  h1 { font-size: 6rem; animation: pulse 1.5s infinite alternate; text-align: center; }
  @keyframes pulse { 0% { transform: scale(1); text-shadow: 0 0 0 rgba(0,0,0,0); } 100% { transform: scale(1.15); text-shadow: 0 20px 40px rgba(0,0,0,0.3); } }
</style>
<h1>{{text}}</h1>`
    },
    {
        id: 'vid_slide_01',
        name: 'Sliding Image Video',
        description: 'Image and text sliding in from the left.',
        type: 'video',
        variables: '["title", "imageUrl"]',
        html_content: `
<style>
  body { margin: 0; background: #0f172a; color: white; font-family: sans-serif; height: 100vh; overflow: hidden; display: flex; align-items: center; }
  .card { display: flex; align-items: center; transform: translateX(-100%); animation: slideIn 2s forwards cubic-bezier(0.2, 0.8, 0.2, 1); width: 100%; padding: 4rem; }
  img { width: 400px; height: 400px; border-radius: 200px; object-fit: cover; border: 10px solid #38bdf8; margin-right: 4rem; }
  h1 { font-size: 5rem; text-transform: uppercase; line-height: 1.1; }
  @keyframes slideIn { 100% { transform: translateX(0); } }
</style>
<div class="card">
    <img src="{{imageUrl}}" />
    <h1>{{title}}</h1>
</div>`
    },
    {
        id: 'vid_neon_01',
        name: 'Neon Glowing Text',
        description: 'Text that flickers and glows with neon effect.',
        type: 'video',
        variables: '["text", "neonColor"]',
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
    },
    {
        id: 'vid_typewriter_01',
        name: 'Typewriter Effect',
        description: 'Text types out character by character.',
        type: 'video',
        variables: '["text"]',
        html_content: `
<style>
  body { margin: 0; background: #1e1e1e; color: #4ade80; display: flex; justify-content: center; align-items: center; height: 100vh; font-family: 'JetBrains Mono', monospace; padding: 4rem; }
  .typewriter { font-size: 4rem; overflow: hidden; border-right: .15em solid #4ade80; white-space: pre-wrap; margin: 0 auto; letter-spacing: .15em; animation: typing 3.5s steps(40, end), blink-caret .75s step-end infinite; max-width: 100%; word-break: break-word; }
  @keyframes typing { from { width: 0 } to { width: 100% } }
  @keyframes blink-caret { from, to { border-color: transparent } 50% { border-color: #4ade80; } }
</style>
<div class="typewriter">{{text}}</div>`
    },
    {
        id: 'vid_zoom_01',
        name: 'Slow Zoom Pan',
        description: 'Image slowly zooms in for a cinematic feel.',
        type: 'video',
        variables: '["imageUrl", "caption"]',
        html_content: `
<style>
  body { margin: 0; height: 100vh; overflow: hidden; background: #000; position: relative; font-family: sans-serif; display: flex; justify-content: center; align-items: flex-end; }
  .bg { position: absolute; inset: 0; background: url('{{imageUrl}}') center/cover no-repeat; animation: zoomIn 10s linear forwards; z-index: 0; }
  .overlay { position: absolute; inset: 0; background: linear-gradient(to top, rgba(0,0,0,0.8), transparent); z-index: 1; }
  h1 { position: relative; z-index: 2; color: white; font-size: 4rem; padding: 4rem; font-weight: 300; letter-spacing: 2px; text-shadow: 0 2px 10px rgba(0,0,0,0.5); }
  @keyframes zoomIn { 0% { transform: scale(1); } 100% { transform: scale(1.3); } }
</style>
<div class="bg"></div>
<div class="overlay"></div>
<h1>{{caption}}</h1>`
    }
];

export async function getDb() {
    if (!dbInstance) {
        dbInstance = await open({
            filename: path.join(dataDir, 'database.sqlite'),
            driver: sqlite3.Database
        });

        await dbInstance.exec(`
            CREATE TABLE IF NOT EXISTS templates (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                type TEXT NOT NULL,
                html_content TEXT NOT NULL,
                variables TEXT NOT NULL
            );
        `);

        // Check if templated exist
        const count = await dbInstance.get('SELECT COUNT(*) as c FROM templates');
        if (count.c === 0) {
            logger.info('Database empty. Seeding templates...');
            const insertStmt = await dbInstance.prepare('INSERT INTO templates (id, name, description, type, html_content, variables) VALUES (?, ?, ?, ?, ?, ?)');

            for (const t of templatesData) {
                await insertStmt.run(t.id, t.name, t.description, t.type, t.html_content, t.variables);
            }
            await insertStmt.finalize();
            logger.info(`Seeded ${templatesData.length} templates.`);
        }
    }
    return dbInstance;
}
