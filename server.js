import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.raw({ type: ['application/grpc-web*', 'application/grpc*'], limit: '50mb' }));

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// Google OAuth 2.0 Credentials from Environment
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const REDIRECT_URI = process.env.REDIRECT_URI || 'https://elvion-auth.onrender.com/auth/google/callback';

// AI Providers configuration from Environment
const AI_PROVIDERS = {
    groq: {
        baseUrl: 'https://api.groq.com/openai/v1',
        apiKey: process.env.GROQ_API_KEY || '',
        models: [
            'openai/gpt-oss-120b',
            'openai/gpt-oss-20b',
            'qwen/qwen3.6-27b',
            'groq/compound',
            'llama-3.3-70b-versatile',
            'llama-3.1-8b-instant'
        ]
    },
    cerebras: {
        baseUrl: 'https://api.cerebras.ai/v1',
        apiKey: process.env.CEREBRAS_API_KEY || '',
        models: [
            'gpt-oss-120b',
            'gemma-4-31b'
        ]
    }
};

let activeProvider = process.env.DEFAULT_PROVIDER || 'groq';

const SYSTEM_PROMPT = `You are Elvion AI, a world-class coding assistant inside Elvion IDE. Provide high quality, concise, and clean code. Answer directly and cleanly.`;

// Google OAuth Routes
app.get('/auth/google', (req, res) => {
    if (!GOOGLE_CLIENT_ID) {
        return res.status(500).send('GOOGLE_CLIENT_ID environment variable is missing.');
    }
    const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth'
        + '?client_id=' + encodeURIComponent(GOOGLE_CLIENT_ID)
        + '&redirect_uri=' + encodeURIComponent(REDIRECT_URI)
        + '&response_type=code'
        + '&scope=' + encodeURIComponent('openid email profile')
        + '&access_type=offline'
        + '&prompt=consent';
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
            const userInfoResp = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                headers: { Authorization: `Bearer ${tokenData.access_token}` }
            });
            const userInfo = await userInfoResp.json();

            const payload = JSON.stringify({
                token: tokenData.access_token,
                refresh_token: tokenData.refresh_token || '',
                email: userInfo.email || '',
                name: userInfo.name || '',
                picture: userInfo.picture || '',
                id_token: tokenData.id_token || ''
            });
            const encodedPayload = encodeURIComponent(payload);
            const redirectUrl = `/auth-success?token=${encodedPayload}`;
            return res.redirect(redirectUrl);
        } else {
            console.error('OAuth Token exchange failed:', tokenData);
            return res.redirect('/?error=token_failed');
        }
    } catch (err) {
        console.error('Google Auth Error:', err);
        return res.redirect('/?error=server_error');
    }
});

app.get('/auth-success', (req, res) => {
    const token = req.query.token || '';
    const authUri = `elvion-ide://auth-success?token=${encodeURIComponent(token)}`;
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Auth Success — Elvion IDE</title>
<link rel="icon" href="/logo.png" type="image/png">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{--bg:#080b14;--surface:rgba(15,20,35,0.85);--border:rgba(100,130,255,0.1);--accent:#7c5bf5;--accent2:#9d4edd;--text:#e8ecf4;--text2:#8893a7;--success:#22c55e;}
html,body{height:100%;background:var(--bg);color:var(--text);font-family:'Inter',sans-serif;display:flex;align-items:center;justify-content:center}
.card{width:100%;max-width:440px;background:var(--surface);border:1px solid var(--border);border-radius:24px;padding:48px 40px;text-align:center;backdrop-filter:blur(40px);box-shadow:0 0 80px rgba(124,91,245,0.15),0 32px 64px rgba(0,0,0,0.5)}
.icon-wrap{width:72px;height:72px;margin:0 auto 24px;border-radius:50%;background:rgba(34,197,94,0.12);border:1px solid rgba(34,197,94,0.25);display:flex;align-items:center;justify-content:center}
.icon-wrap svg{width:36px;height:36px;stroke:var(--success);fill:none;stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round}
h1{font-size:24px;font-weight:700;margin-bottom:8px;}
p{font-size:14px;color:var(--text2);margin-bottom:32px;line-height:1.6}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:10px;width:100%;padding:16px 24px;background:linear-gradient(135deg,var(--accent),var(--accent2));color:#fff;border-radius:12px;text-decoration:none;font-weight:600;font-size:15px;box-shadow:0 8px 32px rgba(124,91,245,0.3);transition:transform .2s}
.btn:hover{transform:translateY(-2px)}
.hint{font-size:12px;color:var(--text2);margin-top:20px}
</style>
</head>
<body>
<div class="card">
  <div class="icon-wrap">
    <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
  </div>
  <h1>Authentication Successful</h1>
  <p>Your Google account has been connected to Elvion IDE.<br>Opening Elvion IDE now...</p>
  <a href="${authUri}" class="btn" id="openBtn">
    <span>Open Elvion IDE</span>
  </a>
  <div class="hint">If the app doesn't open automatically, click the button above.</div>
</div>
<script>
window.location.href = "${authUri}";
</script>
</body>
</html>`);
});

// User Info & Session endpoints
app.get(['/user/info', '/api/user/info'], async (req, res) => {
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) {
        return res.json({
            email: 'user@elvion.dev',
            name: 'Elvion Developer',
            picture: '',
            id: '1'
        });
    }
    try {
        const userInfoResp = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (userInfoResp.ok) {
            const userInfo = await userInfoResp.json();
            return res.json({
                email: userInfo.email || 'user@elvion.dev',
                name: userInfo.name || 'Elvion Developer',
                picture: userInfo.picture || '',
                id: userInfo.id || '1'
            });
        }
    } catch (err) {
        console.warn('Google userinfo fetch failed:', err.message);
    }
    return res.json({
        email: 'user@elvion.dev',
        name: 'Elvion Developer',
        picture: '',
        id: '1'
    });
});

// Status & Quota mock endpoints
app.all([
    '/user/status',
    '/api/user/status',
    '*/GetUserStatus',
    '*/GetProfileData',
    '*/RetrieveUserQuotaSummary'
], (req, res) => {
    return res.json({
        signedIn: true,
        userTier: {
            name: 'Elvion Pro (Unlimited)',
            description: 'Unlimited access to Groq & Cerebras Fast AI Models',
            upgradeButtonText: 'Elvion Pro'
        },
        groups: [
            {
                displayName: 'Groq Models',
                remainingFraction: 1.0,
                description: 'Unlimited Groq Inference'
            },
            {
                displayName: 'Cerebras Models',
                remainingFraction: 1.0,
                description: 'Unlimited Cerebras Ultra Speed'
            }
        ]
    });
});

// All Available Models Endpoint (Groq + Cerebras)
app.get(['/v1/models', '/api/v1/models', '/models'], (req, res) => {
    return res.json({
        object: 'list',
        data: [
            // Cerebras Models
            {
                id: 'cerebras/gpt-oss-120b',
                object: 'model',
                owned_by: 'cerebras',
                name: 'Elvion Ultra 120B (Cerebras ~3000 t/s)'
            },
            {
                id: 'cerebras/gemma-4-31b',
                object: 'model',
                owned_by: 'cerebras',
                name: 'Elvion Gemma 31B (Cerebras)'
            },
            // Groq Models
            {
                id: 'groq/gpt-oss-120b',
                object: 'model',
                owned_by: 'groq',
                name: 'Elvion Fast 120B (Groq)'
            },
            {
                id: 'groq/gpt-oss-20b',
                object: 'model',
                owned_by: 'groq',
                name: 'Elvion Compact 20B (Groq)'
            },
            {
                id: 'groq/qwen3.6-27b',
                object: 'model',
                owned_by: 'groq',
                name: 'Elvion Qwen 3.6 27B (Groq)'
            },
            {
                id: 'groq/compound',
                object: 'model',
                owned_by: 'groq',
                name: 'Elvion Compound System (Groq)'
            },
            {
                id: 'groq/llama-3.3-70b-versatile',
                object: 'model',
                owned_by: 'groq',
                name: 'Elvion Llama 3.3 70B (Groq)'
            },
            // Direct alias
            {
                id: 'gpt-oss-120b',
                object: 'model',
                owned_by: 'elvion',
                name: 'GPT-OSS 120B (Default)'
            }
        ]
    });
});

// Helper to determine AI provider & model from request
function resolveProviderAndModel(requestedModel) {
    const m = (requestedModel || '').toLowerCase();

    if (m.includes('cerebras') || m.includes('gemma')) {
        return {
            provider: AI_PROVIDERS.cerebras,
            model: m.includes('gemma') ? 'gemma-4-31b' : 'gpt-oss-120b'
        };
    }

    if (m.includes('20b')) {
        return {
            provider: AI_PROVIDERS.groq,
            model: 'openai/gpt-oss-20b'
        };
    }

    if (m.includes('qwen')) {
        return {
            provider: AI_PROVIDERS.groq,
            model: 'qwen/qwen3.6-27b'
        };
    }

    if (m.includes('compound')) {
        return {
            provider: AI_PROVIDERS.groq,
            model: 'groq/compound'
        };
    }

    if (m.includes('llama') || m.includes('70b')) {
        return {
            provider: AI_PROVIDERS.groq,
            model: 'llama-3.3-70b-versatile'
        };
    }

    if (activeProvider === 'cerebras') {
        return {
            provider: AI_PROVIDERS.cerebras,
            model: 'gpt-oss-120b'
        };
    }

    return {
        provider: AI_PROVIDERS.groq,
        model: 'openai/gpt-oss-120b'
    };
}

// AI Completion & Chat Translation Layer (Google / REST / OpenAI -> Groq & Cerebras)
app.use(async (req, res, next) => {
    if (req.method === 'GET' || req.path === '/' || req.path.startsWith('/auth')) {
        return next();
    }

    try {
        console.log(`[Elvion-Auth] Intercepted: ${req.method} ${req.path}`);

        const isStream = req.path.includes('stream') || req.headers['accept']?.includes('text/event-stream');
        const body = req.body || {};

        const requestedModel = (req.path.match(/models\/([^:]+)/)?.[1] || body.model || '').toLowerCase();
        const { provider, model: actualModel } = resolveProviderAndModel(requestedModel);

        if (!provider.apiKey) {
            console.error(`[Elvion-Auth] API Key missing for provider`);
            return res.status(500).json({ error: 'AI Provider API Key is not set in Environment Variables.' });
        }

        const messages = [];
        messages.push({ role: 'system', content: SYSTEM_PROMPT });

        if (body.contents && Array.isArray(body.contents)) {
            for (const item of body.contents) {
                const role = item.role === 'model' ? 'assistant' : 'user';
                const text = item.parts ? item.parts.map(p => p.text || '').join('\n') : '';
                if (text) messages.push({ role, content: text });
            }
        } else if (body.messages && Array.isArray(body.messages)) {
            messages.push(...body.messages);
        } else if (typeof body === 'string') {
            messages.push({ role: 'user', content: body });
        } else {
            messages.push({ role: 'user', content: JSON.stringify(body) });
        }

        const openAIPayload = {
            model: actualModel,
            messages: messages,
            stream: isStream,
            temperature: 0.3
        };

        const upstreamResponse = await fetch(`${provider.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${provider.apiKey}`
            },
            body: JSON.stringify(openAIPayload)
        });

        if (!upstreamResponse.ok) {
            const errText = await upstreamResponse.text();
            console.error(`[Elvion-Auth] Upstream error from ${provider.baseUrl}:`, errText);
            return res.status(upstreamResponse.status).json({ error: errText });
        }

        if (isStream) {
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');

            const reader = upstreamResponse.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ') && line.trim() !== 'data: [DONE]') {
                        try {
                            const data = JSON.parse(line.slice(6));
                            const text = data.choices?.[0]?.delta?.content || '';
                            if (text) {
                                const googleChunk = {
                                    candidates: [{
                                        content: { parts: [{ text }] },
                                        finishReason: null
                                    }]
                                };
                                res.write(`data: ${JSON.stringify(googleChunk)}\n\n`);
                            }
                        } catch (e) {}
                    }
                }
            }
            res.write('data: [DONE]\n\n');
            res.end();
        } else {
            const data = await upstreamResponse.json();
            const textContent = data.choices?.[0]?.message?.content || '';

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
    console.log(`Elvion-Auth Multi-Model Server running on port ${PORT}`);
});
