import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, 'public')));

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
            res.redirect('elvion-ide://auth?token=' + tokenData.access_token);
        } else {
            res.redirect('/?error=token_failed');
        }
    } catch (err) {
        console.error('Google Auth Error:', err);
        res.redirect('/?error=server_error');
    }
});

app.use((req, res, next) => {
    if (req.path === '/' || req.path === '/index.html' || req.path.startsWith('/auth')) return next();
    console.log('[Elvion-Auth] AI Request: ' + req.method + ' ' + req.path);
    res.json({
        candidates: [{ content: { parts: [{ text: '[Elvion AI Bridge] AI backend active.' }] }, finishReason: 'STOP' }]
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log('Elvion-Auth Server running on port ' + PORT);
});
