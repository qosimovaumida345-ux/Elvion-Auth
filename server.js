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

// Serve static frontend files (Login UI)
app.use(express.static(path.join(__dirname, 'public')));

// Catch-all route for AI requests
app.use((req, res, next) => {
    if (req.path === '/' || req.path === '/index.html') {
        return next();
    }
    
    console.log('[Elvion-Auth] Intercepted AI Request: ' + req.method + ' ' + req.path);
    
    // Mock response for now to prevent IDE crashes
    res.json({
        candidates: [{
            content: { parts: [{ text: "[Elvion AI Bridge] This is a mock response from the cloud server. AI logic will be ported here soon." }] },
            finishReason: "STOP"
        }]
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log('=========================================');
    console.log('🚀 Elvion-Auth Server running on port ' + PORT);
    console.log('=========================================');
});
