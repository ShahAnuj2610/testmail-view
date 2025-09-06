// server.mjs
import express from 'express';

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 8787;
const API_KEY = process.env.TESTMAIL_APIKEY;
const NAMESPACE = process.env.TESTMAIL_NAMESPACE;

if (!API_KEY || !NAMESPACE) {
    console.error('\n[CONFIG] Missing TESTMAIL_APIKEY or TESTMAIL_NAMESPACE\n');
    process.exit(1);
}

function buildUrl(params = {}) {
    const u = new URL('https://api.testmail.app/api/json');
    u.searchParams.set('apikey', API_KEY);
    u.searchParams.set('namespace', NAMESPACE);
    const pass = ['pretty','headers','spam_report','tag','tag_prefix','timestamp_from','timestamp_to','limit','offset','livequery'];
    for (const k of pass) {
        const v = params[k];
        if (v !== undefined && v !== '') u.searchParams.set(k, String(v));
    }
    return u;
}

// metadata for UI
app.get('/api/meta', (_req, res) => {
    res.json({ namespace: NAMESPACE });
});

// proxy (keeps key server-side)
app.get('/api/inbox', async (req, res) => {
    try {
        const url = buildUrl(req.query);
        const r = await fetch(url.toString());
        const text = await r.text();
        res.type('application/json').status(r.status).send(text);
    } catch (e) {
        res.status(500).json({ result: 'fail', message: (e && e.message) || 'proxy_error' });
    }
});

// serve static UI
app.use(express.static('public'));

app.listen(PORT, () => {
    console.log('Testmail Viewer listening on http://localhost:' + PORT);
});
