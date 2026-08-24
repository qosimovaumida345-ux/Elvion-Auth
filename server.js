import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// Google OAuth 2.0
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const REDIRECT_URI = process.env.REDIRECT_URI || 'https://elvion-auth.onrender.com/auth/google/callback';

app.get('/auth/google', (req, res) => {
    const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth'
        + '?client_id=' + encodeURIComponent(GOOGLE_CLIENT_ID)
        + '&redirect_uri=' + encodeURIComponent(REDIRECT_URI)
        + '&response_type=code'
        + '&scope=' + encodeURIComponent('email profile');
    res.redirect(authUrl);
});

app.get('/auth/google/callback', async (req, res) => {
    const code = req.query.code;
    if (!code) return res.redirect('/?error=access_denied');

    try {
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                code: code,
                client_id: GOOGLE_CLIENT_ID,
                client_secret: GOOGLE_CLIENT_SECRET,
                redirect_uri: REDIRECT_URI,
                grant_type: 'authorization_code'
            })
        });

        const tokenData = await tokenResponse.json();

        if (tokenData.access_token) {
            // Redirect to the new auth-success endpoint with token as query param
            const redirectUrl = `/auth-success?token=${encodeURIComponent(tokenData.access_token)}`;
            return res.redirect(redirectUrl);
        } else {
            return res.redirect('/?error=token_failed');
        }
    } catch (err) {
        console.error('Google Auth Error:', err);
        return res.redirect('/?error=server_error');
    }
});

// New route handling auth success UI
app.get('/auth-success', (req, res) => {
    const token = req.query.token || '';
    const authUri = `elvion-ide://auth-success?token=${encodeURIComponent(token)}`;
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Auth Success — Open Elvion IDE</title>
<link rel="icon" href="/logo.png" type="image/png">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{--bg:#080b14;--surface:rgba(15,20,35,0.85);--border:rgba(100,130,255,0.08);--accent:#4f6ef7;--accent2:#7c5bf5;--text:#e8ecf4;--text2:#8893a7;--success:#22c55e;}
html,body{height:100%;background:var(--bg);color:var(--text);font-family:'Inter',sans-serif;display:flex;align-items:center;justify-content:center}
.card{width:100%;max-width:440px;background:var(--surface);border:1px solid var(--border);border-radius:24px;padding:48px 40px;text-align:center;backdrop-filter:blur(40px);box-shadow:0 0 80px rgba(79,110,247,0.1),0 32px 64px rgba(0,0,0,0.5)}
.icon-wrap{width:72px;height:72px;margin:0 auto 24px;border-radius:50%;background:rgba(34,197,94,0.12);border:1px solid rgba(34,197,94,0.25);display:flex;align-items:center;justify-content:center}
.icon-wrap svg{width:36px;height:36px;stroke:var(--success);fill:none;stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round}
h1{font-size:24px;font-weight:700;margin-bottom:8px;letter-spacing:-0.5px}
p{font-size:14px;color:var(--text2);margin-bottom:32px;line-height:1.6}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:10px;width:100%;padding:16px 24px;background:linear-gradient(135deg,var(--accent),var(--accent2));color:#fff;border-radius:12px;text-decoration:none;font-weight:600;font-size:15px;box-shadow:0 8px 32px rgba(79,110,247,0.3);transition:transform .2s,box-shadow .2s}
.btn:hover{transform:translateY(-2px);box-shadow:0 12px 40px rgba(79,110,247,0.4)}
.btn:active{transform:translateY(0)}
.hint{font-size:12px;color:var(--text2);margin-top:20px}
</style>
</head>
<body>
<div class="card">
  <div class="icon-wrap">
    <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
  </div>
  <h1>Authentication Successful</h1>
  <p>Your Google account has been connected to Elvion.<br>Opening Elvion IDE now...</p>
  <a href="${authUri}" class="btn" id="openBtn">
    <span>Open Elvion IDE</span>
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
  </a>
  <div class="hint">If the app doesn't open automatically, click the button above.</div>
</div>
<script>
window.location.href = "${authUri}";
</script>
</body>
</html>`);
});


// AI Configuration
const AI_PROVIDERS = {
    groq: {
        baseUrl: 'https://api.groq.com/openai/v1',
        model: 'llama-3.3-70b-versatile',
        apiKey: process.env.GROQ_API_KEY || ''
    },
    cerebras: {
        baseUrl: 'https://api.cerebras.ai/v1',
        model: 'llama-3.3-70b',
        apiKey: process.env.CEREBRAS_API_KEY || ''
    }
};

let activeProvider = 'groq';

const SYSTEM_PROMPT = `You are Elvion AI, an advanced intelligent coding assistant integrated into the Elvion IDE. Your goal is to provide precise, accurate, and helpful answers to the developer. Provide fully functional, clean, and elegant code. Do not add unnecessary fluff, but be polite and clear.`;

app.post('/switch-provider', (req, res) => {
    const provider = req.body?.provider;
    if (provider && AI_PROVIDERS[provider]) {
        activeProvider = provider;
        res.json({ success: true, activeProvider });
    } else {
        res.status(400).json({ error: 'Invalid provider' });
    }
});

// AI Translator (Google -> OpenAI)
app.use(async (req, res, next) => {
    if (req.path === '/v1/models' || req.path === '/api/v1/models' || req.path === '/models') {
        return res.json({
            object: 'list',
            data: [
                { id: AI_PROVIDERS.groq.model, object: 'model', created: Date.now(), owned_by: 'elvion', title: 'Elvion Fast (Groq)' },
                { id: AI_PROVIDERS.cerebras.model, object: 'model', created: Date.now(), owned_by: 'elvion', title: 'Elvion Ultra (Cerebras)' }
            ]
        });
    }

    if (req.path === '/' || req.path === '/index.html' || req.path.startsWith('/auth') || req.method === 'GET') {
        return next();
    }

    try {
        console.log('[Elvion-Auth] AI Request Intercepted: ' + req.method + ' ' + req.path);

        const isStream = req.path.includes('streamGenerateContent');
        const googlePayload = req.body;
        
        // Dynamically select provider based on path, defaulting to activeProvider
        const modelId = req.path.match(/models\/([^:]+)/)?.[1];
        const isCerebras = modelId === AI_PROVIDERS.cerebras.model || (modelId === undefined && activeProvider === 'cerebras');
        const providerConfig = isCerebras ? AI_PROVIDERS.cerebras : AI_PROVIDERS.groq;

        // Build OpenAI messages
        const messages = [];
        messages.push({ role: 'system', content: SYSTEM_PROMPT });

        if (googlePayload && googlePayload.contents) {
            for (const content of googlePayload.contents) {
                const role = content.role === 'model' ? 'assistant' : 'user';
                const text = content.parts ? content.parts.map(p => p.text).join('\n') : '';
                messages.push({ role, content: text });
            }
        } else {
            messages.push({ role: 'user', content: JSON.stringify(googlePayload) });
        }

        const openAIPayload = {
            model: providerConfig.model,
            messages: messages,
            stream: isStream,
            temperature: 0.3
        };

        const response = await fetch(providerConfig.baseUrl + '/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + providerConfig.apiKey
            },
            body: JSON.stringify(openAIPayload)
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error('[AI Bridge] Upstream error from ' + (isCerebras ? 'Cerebras' : 'Groq') + ':', errText);
            return res.status(response.status).json({ error: errText });
        }

        if (isStream) {
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let aiTextBuffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                        try {
                            const data = JSON.parse(line.slice(6));
                            if (data.choices && data.choices[0].delta && data.choices[0].delta.content) {
                                const text = data.choices[0].delta.content;
                                aiTextBuffer += text;

                                // Translate back to Google stream format
                                const googleChunk = [{
                                    candidates: [{
                                        content: { parts: [{ text }] },
                                        finishReason: null
                                    }]
                                }];

                                res.write('data: ' + JSON.stringify(googleChunk) + '\r\n\r\n');
                            }
                        } catch (e) {
                            // ignore parse error on incomplete chunks
                        }
                    }
                }
            }
            res.write('data: [DONE]\r\n\r\n');
            res.end();
        } else {
            const data = await response.json();
            const textContent = data.choices[0].message.content;

            // Translate back to Google format
            const googleResponse = {
                candidates: [{
                    content: { parts: [{ text: textContent }] },
                    finishReason: 'STOP'
                }]
            };
            res.json(googleResponse);
        }
    } catch (err) {
        console.error('[Elvion-Auth] Bridge Error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log('Elvion-Auth Server running on port ' + PORT);
});
