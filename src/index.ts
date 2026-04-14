import express from 'express';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import puppeteer from 'puppeteer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import { PuppeteerScreenRecorder } from 'puppeteer-screen-recorder';
import ffmpeg from 'fluent-ffmpeg';
import axios from 'axios';
import logger from './logger.js';
import Handlebars from 'handlebars';
import { getDb } from './db.js';

const app = express();
app.use(express.json({ limit: '50mb' }));

const PORT = process.env.PORT || 5003;
const MCP_PORT = process.env.MCP_PORT || 8004;

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Ensure puppeteer works in docker
const getBrowser = async () => {
    return await puppeteer.launch({
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu'
        ],
        headless: true,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || puppeteer.executablePath()
    });
};

const notifyWebhook = async (webhookUrl: string, payload: any) => {
    if (!webhookUrl) return;
    try {
        await axios.post(webhookUrl, payload);
    } catch (err: any) {
        logger.error(`Failed to notify webhook ${webhookUrl}`, { error: err.message });
    }
};

// ─── TTS via Google Translate (no external dependency) ───────────────────────
const generateTTS = async (text: string, lang: string, outputPath: string): Promise<void> => {
    // Google TTS supports up to 200 chars per request — split if needed
    const MAX_LENGTH = 200;
    const chunks: string[] = [];

    for (let i = 0; i < text.length; i += MAX_LENGTH) {
        chunks.push(text.slice(i, i + MAX_LENGTH));
    }

    const buffers: Buffer[] = [];

    for (const chunk of chunks) {
        const response = await axios.get('https://translate.google.com/translate_tts', {
            params: {
                ie: 'UTF-8',
                q: chunk,
                tl: lang,
                client: 'tw-ob',
                ttsspeed: '1'
            },
            responseType: 'arraybuffer',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 15000
        });
        buffers.push(Buffer.from(response.data));
    }

    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    // Concatenate all mp3 chunks into a single file
    fs.writeFileSync(outputPath, Buffer.concat(buffers));
};
// ─────────────────────────────────────────────────────────────────────────────

app.post('/api/v1/generate/image', async (req, res) => {
    const { html, templateId, variables, filename, width = 1280, height = 720, webhookUrl } = req.body;
    
    let finalHtml = html;
    try {
        if (templateId) {
            const db = await getDb();
            const template = await db.get('SELECT html_content FROM templates WHERE id = ?', templateId);
            if (!template) return res.status(404).json({ error: 'Template not found' });
            
            const compiled = Handlebars.compile(template.html_content);
            finalHtml = compiled(variables || {});
        }
    } catch (e: any) {
        return res.status(500).json({ error: 'Failed processing template: ' + e.message });
    }

    if (!finalHtml) return res.status(400).json({ error: 'HTML content or valid templateId missing' });

    const id = filename ? filename : uuidv4();
    const finalFilename = id.endsWith('.png') ? id : `${id}.png`;
    const outputPath = path.join(dataDir, finalFilename);

    const generate = async () => {
        let browser;
        try {
            browser = await getBrowser();
            const page = await browser.newPage();
            await page.setViewport({ width, height });
            await page.setContent(finalHtml, { waitUntil: 'networkidle0' });
            await page.screenshot({ path: outputPath });
            await notifyWebhook(webhookUrl, { id, status: 'success', type: 'image', file: finalFilename });
            return finalFilename;
        } catch (error: any) {
            await notifyWebhook(webhookUrl, { id, status: 'error', type: 'image', error: error.message });
            throw error;
        } finally {
            if (browser) await browser.close();
        }
    };

    if (webhookUrl) {
        res.json({ id, status: 'processing' });
        generate().catch(err => logger.error("Background generation error", { error: err.message }));
    } else {
        try {
            const file = await generate();
            res.json({ id, status: 'success', file });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    }
});

app.post('/api/v1/generate/video', async (req, res) => {
    const { html, templateId, variables, filename, width = 1280, height = 720, duration = 5, fps = 30, webhookUrl } = req.body;
    
    let finalHtml = html;
    try {
        if (templateId) {
            const db = await getDb();
            const template = await db.get('SELECT html_content FROM templates WHERE id = ?', templateId);
            if (!template) return res.status(404).json({ error: 'Template not found' });
            
            const compiled = Handlebars.compile(template.html_content);
            finalHtml = compiled(variables || {});
        }
    } catch (e: any) {
        return res.status(500).json({ error: 'Failed processing template: ' + e.message });
    }

    if (!finalHtml) return res.status(400).json({ error: 'HTML content or valid templateId missing' });

    const id = filename ? filename : uuidv4();
    const finalFilename = id.endsWith('.mp4') ? id : `${id}.mp4`;
    const outputPath = path.join(dataDir, finalFilename);

    const generate = async () => {
        let browser;
        try {
            browser = await getBrowser();
            const page = await browser.newPage();
            await page.setViewport({ width, height });
            await page.setContent(finalHtml, { waitUntil: 'networkidle0' });

            const recorder = new PuppeteerScreenRecorder(page, {
                fps,
                videoFrame: { width, height },
                videoCrf: 18,
                videoCodec: 'libx264',
                videoPreset: 'ultrafast',
                videoBitrate: 1000,
                autopad: { color: 'black' }
            });

            await recorder.start(outputPath);
            await new Promise(resolve => setTimeout(resolve, duration * 1000));
            await recorder.stop();

            await notifyWebhook(webhookUrl, { id, status: 'success', type: 'video', file: finalFilename });
            return finalFilename;
        } catch (error: any) {
            await notifyWebhook(webhookUrl, { id, status: 'error', type: 'video', error: error.message });
            throw error;
        } finally {
            if (browser) await browser.close();
        }
    };

    if (webhookUrl) {
        res.json({ id, status: 'processing' });
        generate().catch(err => logger.error("Background video generation error", { error: err.message }));
    } else {
        try {
            const file = await generate();
            res.json({ id, status: 'success', file });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    }
});

app.post('/api/v1/generate/audio', async (req, res) => {
    const { text, lang = 'fr', filename, webhookUrl } = req.body;
    if (!text) return res.status(400).json({ error: 'text missing' });

    const id = filename ? filename : uuidv4();
    const finalFilename = id.endsWith('.mp3') ? id : `${id}.mp3`;
    const outputPath = path.join(dataDir, finalFilename);

    const generate = async () => {
        try {
            await generateTTS(text, lang, outputPath);
            await notifyWebhook(webhookUrl, { id, status: 'success', type: 'audio', file: finalFilename });
            return finalFilename;
        } catch (error: any) {
            await notifyWebhook(webhookUrl, { id, status: 'error', type: 'audio', error: error.message });
            throw error;
        }
    };

    if (webhookUrl) {
        res.json({ id, status: 'processing' });
        generate().catch(err => logger.error("Background audio generation error", { error: err.message }));
    } else {
        try {
            const file = await generate();
            res.json({ id, status: 'success', file });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    }
});

app.post('/api/v1/compose/video-audio', async (req, res) => {
    const { videoFile, audioFile, filename, webhookUrl } = req.body;
    if (!videoFile || !audioFile) return res.status(400).json({ error: 'videoFile or audioFile missing' });

    const id = filename ? filename : uuidv4();
    const finalFilename = id.endsWith('.mp4') ? id : (filename ? `${id}.mp4` : `${id}_composed.mp4`);
    const outputPath = path.join(dataDir, finalFilename);
    const videoPath = path.join(dataDir, videoFile);
    const audioPath = path.join(dataDir, audioFile);

    const generate = () => new Promise<string>((resolve, reject) => {
        ffmpeg()
            .input(videoPath)
            .input(audioPath)
            .outputOptions(['-c:v copy', '-c:a aac', '-map 0:v:0', '-map 1:a:0', '-shortest'])
            .save(outputPath)
            .on('end', async () => {
                await notifyWebhook(webhookUrl, { id, status: 'success', type: 'compose', file: finalFilename });
                resolve(finalFilename);
            })
            .on('error', async (err) => {
                await notifyWebhook(webhookUrl, { id, status: 'error', type: 'compose', error: err.message });
                reject(err);
            });
    });

    if (webhookUrl) {
        res.json({ id, status: 'processing' });
        generate().catch(err => logger.error("Background compose-video generation error", { error: err.message }));
    } else {
        try {
            const file = await generate();
            res.json({ id, status: 'success', file });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    }
});

app.post('/api/v1/compose/image-audio', async (req, res) => {
    const { imageFile, audioFile, filename, webhookUrl } = req.body;
    if (!imageFile || !audioFile) return res.status(400).json({ error: 'imageFile or audioFile missing' });

    const id = filename ? filename : uuidv4();
    const finalFilename = id.endsWith('.mp4') ? id : (filename ? `${id}.mp4` : `${id}_composed.mp4`);
    const outputPath = path.join(dataDir, finalFilename);
    const imagePath = path.join(dataDir, imageFile);
    const audioPath = path.join(dataDir, audioFile);

    const generate = () => new Promise<string>((resolve, reject) => {
        ffmpeg()
            .input(imagePath)
            .loop()
            .input(audioPath)
            .outputOptions(['-c:v libx264', '-tune stillimage', '-c:a aac', '-b:a 192k', '-pix_fmt yuv420p', '-shortest'])
            .save(outputPath)
            .on('end', async () => {
                await notifyWebhook(webhookUrl, { id, status: 'success', type: 'compose-image', file: finalFilename });
                resolve(finalFilename);
            })
            .on('error', async (err) => {
                await notifyWebhook(webhookUrl, { id, status: 'error', type: 'compose-image', error: err.message });
                reject(err);
            });
    });

    if (webhookUrl) {
        res.json({ id, status: 'processing' });
        generate().catch(err => logger.error("Background compose-image generation error", { error: err.message }));
    } else {
        try {
            const file = await generate();
            res.json({ id, status: 'success', file });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    }
});

// Setup templates endpoint before static files
app.get('/api/v1/templates', async (req, res) => {
    try {
        const db = await getDb();
        const templates = await db.all('SELECT id, name, description, type, variables FROM templates');
        const processed = templates.map(t => ({...t, variables: JSON.parse(t.variables)}));
        res.json(processed);
    } catch (e: any) {
        logger.error('Error fetching templates', { error: e.message });
        res.status(500).json({ error: e.message });
    }
});

// Check files available in data directory
app.get('/api/v1/files', (req, res) => {
    try {
        const files = fs.readdirSync(dataDir).filter(f => !f.startsWith('.'));
        res.json({ files });
    } catch(e: any) {
        logger.error('Error fetching files', { error: e.message });
        res.status(500).json({ error: e.message });
    }
});

// Static files for download
app.use('/files', express.static(dataDir));

const publicDir = path.join(__dirname, '..', 'public');
if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
app.use('/', express.static(publicDir));

app.listen(PORT, () => {
    logger.info(`API Server running on port ${PORT}`);
});


// ─── MCP Server (StreamableHTTP — SSEServerTransport est déprécié) ────────────
const mcpServer = new McpServer({
    name: "html-to-image",
    version: "1.0.0"
});

mcpServer.tool("generate_image", "Generate an image from HTML", {
    html: z.string().describe("The HTML content"),
    width: z.number().optional().describe("Width of the image"),
    height: z.number().optional().describe("Height of the image")
}, async ({ html, width, height }) => {
    try {
        const res = await axios.post(`http://localhost:${PORT}/api/v1/generate/image`, { html, width, height });
        return {
            content: [{ type: "text", text: `Image generated. File: ${res.data.file}, URL: http://localhost:${PORT}/files/${res.data.file}` }]
        };
    } catch (e: any) {
        return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
});
mcpServer.registerTool(
    "generate_video", {
    _meta: {},
    annotations: {},
    description: "Generate an mp4 video from animated HTML",
    inputSchema: {
        html: z.string().describe("The HTML content with animations"),
        duration: z.number().describe("Duration in seconds"),
        fps: z.number().optional().describe("Frames per second"),
        width: z.number().optional(),
        height: z.number().optional()
    },
    outputSchema: {
        content: z.array(z.object({
            type: z.string(),
            text: z.string().optional(),
            file: z.string().optional(),
            url: z.string().optional()
        })),
        isError: z.boolean().optional()
    },
    title: "generate_video"
},
    async ({ html, duration, fps, width, height }) => {
        try {
            const res = await axios.post(`http://localhost:${PORT}/api/v1/generate/video`, { html, duration, fps, width, height });
            return {
                content: [{ type: "text", text: `Video generated. File: ${res.data.file}, URL: http://localhost:${PORT}/files/${res.data.file}` }]
            };
        } catch (e: any) {
            return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
        }
    }
);
// mcpServer.tool("generate_video", "Generate an mp4 video from animated HTML", {
//     html: z.string().describe("The HTML content with animations"),
//     duration: z.number().describe("Duration in seconds"),
//     fps: z.number().optional().describe("Frames per second"),
//     width: z.number().optional(),
//     height: z.number().optional()
// }, async ({ html, duration, fps, width, height }) => {
//     try {
//         const res = await axios.post(`http://localhost:${PORT}/api/v1/generate/video`, { html, duration, fps, width, height });
//         return {
//             content: [{ type: "text", text: `Video generated. File: ${res.data.file}, URL: http://localhost:${PORT}/files/${res.data.file}` }]
//         };
//     } catch (e: any) {
//         return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
//     }
// });

mcpServer.tool("generate_audio", "Generate speech audio from text", {
    text: z.string().describe("The text to synthesize"),
    lang: z.string().optional().describe("Language code e.g. fr, en, es, de")
}, async ({ text, lang }) => {
    try {
        const res = await axios.post(`http://localhost:${PORT}/api/v1/generate/audio`, { text, lang });
        return {
            content: [{ type: "text", text: `Audio generated. File: ${res.data.file}, URL: http://localhost:${PORT}/files/${res.data.file}` }]
        };
    } catch (e: any) {
        return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
});

mcpServer.tool("compose_video_audio", "Merge a video file and an audio file", {
    videoFile: z.string().describe("Filename of the video in data directory"),
    audioFile: z.string().describe("Filename of the audio in data directory")
}, async ({ videoFile, audioFile }) => {
    try {
        const res = await axios.post(`http://localhost:${PORT}/api/v1/compose/video-audio`, { videoFile, audioFile });
        return {
            content: [{ type: "text", text: `Composed. File: ${res.data.file}, URL: http://localhost:${PORT}/files/${res.data.file}` }]
        };
    } catch (e: any) {
        return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
});

mcpServer.tool("compose_image_audio", "Create a video from a static image and audio", {
    imageFile: z.string().describe("Filename of the image in data directory"),
    audioFile: z.string().describe("Filename of the audio in data directory")
}, async ({ imageFile, audioFile }) => {
    try {
        const res = await axios.post(`http://localhost:${PORT}/api/v1/compose/image-audio`, { imageFile, audioFile });
        return {
            content: [{ type: "text", text: `Composed. File: ${res.data.file}, URL: http://localhost:${PORT}/files/${res.data.file}` }]
        };
    } catch (e: any) {
        return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
});

// MCP via StreamableHTTP
const mcpApp = express();
mcpApp.use(express.json());

mcpApp.all('/mcp', async (req, res) => {
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    await mcpServer.connect(transport);
    await transport.handleRequest(req, res, req.body);
});

mcpApp.listen(MCP_PORT, () => {
    logger.info(`MCP Server running on port ${MCP_PORT} (/mcp)`);
});