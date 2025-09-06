/**
 * Testmail Viewer — single-file Express proxy + static UI (no build)
 * ------------------------------------------------------------
 * Fix for esbuild/tsx error: moved inline <script> to /ui.js and
 * removed all template literals there (no nested backticks).
 *
 * Run:
 *   npm i -D tsx && npm i express cross-fetch
 *   TESTMAIL_APIKEY=sk_xxx TESTMAIL_NAMESPACE=your_ns npx tsx testmail-viewer.ts
 */

import express from 'express';
import fetch from 'cross-fetch';

const app = express();
const PORT = Number(process.env.PORT || 8787);
const API_KEY = process.env.TESTMAIL_APIKEY;
const NAMESPACE = process.env.TESTMAIL_NAMESPACE;

if (!API_KEY || !NAMESPACE) {
    console.error('
        [CONFIG] Missing TESTMAIL_APIKEY or TESTMAIL_NAMESPACE in env.');
    console.error('Example:
    TESTMAIL_APIKEY=sk_xxx TESTMAIL_NAMESPACE=acme npx tsx testmail-viewer.ts
    ');
    process.exit(1);
}

function buildTestmailUrl(params: Record<string, string | number | boolean | undefined>) {
    const u = new URL('https://api.testmail.app/api/json');
    u.searchParams.set('apikey', API_KEY!);
    u.searchParams.set('namespace', NAMESPACE!);
    const pass = [
        'pretty','headers','spam_report','tag','tag_prefix','timestamp_from','timestamp_to','limit','offset','livequery'
    ] as const;
    for (const key of pass) {
        const v = params[key];
        if (v !== undefined && v !== '') u.searchParams.set(key, String(v));
    }
    return u;
}

// API proxy (keeps your key server-side)
app.get('/api/inbox', async (req, res) => {
    try {
        const url = buildTestmailUrl(req.query as any);
        const r = await fetch(url.toString());
        const text = await r.text();
        res.type('application/json').status(r.status).send(text);
    } catch (e: any) {
        res.status(500).json({ result: 'fail', message: e?.message || 'proxy_error' });
    }
});

// Static HTML shell (no backticks in client JS)
app.get('/', (_req, res) => {
    res.type('html').send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Testmail Viewer</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="icon" href="data:,">
  <style>
    .scroll-y { overflow-y: auto; }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; }
    .card { border-radius: 1rem; box-shadow: 0 1px 2px rgb(0 0 0 / 6%), 0 1px 3px rgb(0 0 0 / 10%); padding: 1rem; background: #fff; }
    .badge { display:inline-block; font-size:.75rem; padding:.125rem .5rem; border-radius:.5rem; background:#e5e7eb; }
    .btn { padding:.5rem .75rem; border-radius:.75rem; box-shadow:0 1px 2px rgba(0,0,0,.06); }
    .btn-ghost { }
    .btn-primary { background:#000; color:#fff; }
    .btn-outline { border:1px solid #e5e7eb; }
    .pill { font-size:.75rem; padding:.25rem .5rem; border-radius:9999px; background:#f3f4f6; border:1px solid #e5e7eb; }
    .split { display:grid; grid-template-columns:380px 1fr; height:calc(100vh - 20px); gap:16px; }
    iframe.mail { width:100%; height:60vh; border:1px solid #e5e7eb; border-radius:12px; background:white; }
  </style>
</head>
<body class="bg-gray-50 text-gray-900">
  <div class="max-w-[1400px] mx-auto p-4">
    <header class="flex items-center justify-between mb-3">
      <h1 class="text-2xl font-semibold">Testmail Viewer</h1>
      <div class="flex items-center gap-2 text-sm">
        <span class="pill">namespace: <strong id="ns"></strong></span>
        <button id="refresh" class="btn btn-outline">Refresh</button>
        <label class="pill"><input id="auto" type="checkbox" class="mr-1">Auto-refresh</label>
      </div>
    </header>

    <div class="split">
      <aside class="scroll-y">
        <div class="card mb-3">
          <div class="text-sm font-medium mb-2">Filters</div>
          <div class="grid grid-cols-2 gap-2">
            <label class="col-span-2 text-sm">Tag
              <input id="f_tag" class="w-full mt-1 border rounded-lg px-3 py-2" placeholder="e.g. signup-123" />
            </label>
            <label class="col-span-2 text-sm">Tag prefix
              <input id="f_tag_prefix" class="w-full mt-1 border rounded-lg px-3 py-2" placeholder="e.g. signup-" />
            </label>
            <label class="text-sm">From (ts)
              <input id="f_from" type="number" class="w-full mt-1 border rounded-lg px-3 py-2" placeholder="unix ms" />
            </label>
            <label class="text-sm">To (ts)
              <input id="f_to" type="number" class="w-full mt-1 border rounded-lg px-3 py-2" placeholder="unix ms" />
            </label>
            <label class="text-sm">Limit
              <input id="f_limit" type="number" value="50" class="w-full mt-1 border rounded-lg px-3 py-2"/>
            </label>
            <label class="text-sm">Offset
              <input id="f_offset" type="number" value="0" class="w-full mt-1 border rounded-lg px-3 py-2"/>
            </label>
            <label class="col-span-2 text-sm"><input id="f_headers" type="checkbox" class="mr-2">Include headers</label>
            <label class="col-span-2 text-sm"><input id="f_spam" type="checkbox" class="mr-2">Include SpamAssassin report</label>
          </div>
          <div class="mt-3 flex gap-2">
            <button id="apply" class="btn btn-primary">Apply</button>
            <button id="clear" class="btn btn-ghost">Clear</button>
          </div>
        </div>

        <div class="card h-[calc(100vh-320px)] overflow-auto" id="list"></div>
      </aside>

      <main class="scroll-y">
        <div class="card" id="details">
          <div class="text-gray-500">Select an email on the left.</div>
        </div>
      </main>
    </div>
  </div>

  <script src="/ui.js" type="module"></script>
</body>
</html>`);
});

// Client JS served separately (no template literals inside the JS string)
app.get('/ui.js', (_req, res) => {
    const js =
        'const NAMESPACE = ' + JSON.stringify(NAMESPACE) + ';
    ' +
    // helpers
    "function qs(id){return document.querySelector(id);}
    " +
    "function humanTs(ts){ if(!ts) return ''; var n=Number(ts); if(n<1e12) n*=1000; var d=new Date(n); return d.toLocaleString(); }
    " +
    "function escapeHtml(s){s=s||''; return s.replace(/[&<>]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c];});}
    " +
    "function extractLinks(html,text){var out=new Set(); if(html){var div=document.createElement('div'); div.innerHTML=html; div.querySelectorAll('a[href]').forEach(function(a){out.add(a.href);});} if(text){var re=/(https?:\/\/[^\s]+)/g,m; while((m=re.exec(text))!==null) out.add(m[1]); } return Array.from(out); }
    " +

    // state & init
    "const state={params:{limit:50,offset:0},autoTimer:null,inbox:null,selected:null};
    " +
    "document.querySelector('#ns').textContent=NAMESPACE;
    " +

    // render list
    "function renderList(){ var inbox=state.inbox; var listEl=qs('#list'); if(!inbox){ listEl.innerHTML='<div class=\"text-sm text-gray-500\">No data yet.</div>'; return;} if(!inbox.emails||!inbox.emails.length){ listEl.innerHTML='<div class=\"text-sm text-gray-500\">No emails matched.</div>'; return;} var html=''; inbox.emails.forEach(function(m,idx){ var tag=(m.tag||'').split('.').slice(1).join('.')||m.tag||''; var preview=((m.subject||m.text||'')+'').replace(/\s+/g,' ').slice(0,100); html+= '<button data-idx=\"'+idx+'\" class=\"w-full text-left mb-2 p-3 rounded-xl border hover:bg-gray-50\">' + '<div class=\"flex items-center justify-between gap-2\">' + '<div class=\"font-medium truncate\">'+escapeHtml(m.subject||'(no subject)')+'</div>' + '<div class=\"text-xs text-gray-500 whitespace-nowrap\">'+humanTs(m.timestamp)+'</div>' + '</div>' + '<div class=\"text-xs text-gray-600 truncate\">'+escapeHtml(m.from||'')+'</div>' + '<div class=\"text-xs text-gray-500 mt-1 truncate\">'+escapeHtml(preview)+'</div>' + '<div class=\"mt-1 flex gap-1\">'+(tag?'<span class=\"badge\">'+escapeHtml(tag)+'</span>':'')+(m.spam_score!==undefined?'<span class=\"badge\">spam '+m.spam_score+'</span>':'')+'</div>' + '</button>'; }); listEl.innerHTML=html; listEl.querySelectorAll('button[data-idx]').forEach(function(btn){ btn.addEventListener('click', function(){ showDetails(state.inbox.emails[Number(btn.dataset.idx)]); }); }); }
    " +

    // details
    "function showDetails(m){ state.selected=m; var detailsEl=qs('#details'); var links=extractLinks(m.html,m.text); var hdrs=m.headers? ('<details class=\"mt-3\"><summary class=\"cursor-pointer text-sm text-gray-700\">Headers</summary><pre class=\"mono text-xs bg-gray-50 p-3 rounded-xl overflow-auto\">'+escapeHtml(JSON.stringify(m.headers,null,2))+'</pre></details>') : ''; var spam=(m.spam_score!==undefined||m.spam_report)? ('<details class=\"mt-3\"><summary class=\"cursor-pointer text-sm text-gray-700\">SpamAssassin</summary><pre class=\"mono text-xs bg-gray-50 p-3 rounded-xl overflow-auto\">'+escapeHtml(m.spam_report||String(m.spam_score))+'</pre></details>') : ''; var atts=(Array.isArray(m.attachments)&&m.attachments.length)? ('<details class=\"mt-3\"><summary class=\"cursor-pointer text-sm text-gray-700\">Attachments ('+m.attachments.length+')</summary><ul class=\"list-disc pl-6 text-sm\">'+ m.attachments.map(function(a,i){ return '<li>'+escapeHtml(a.filename||("attachment-"+(i+1)))+' <span class=\"text-xs text-gray-500\">'+escapeHtml(a.content_type||'')+'</span>'+(a.data?' — <button class=\"underline text-blue-700\" data-dl=\"'+i+'\">download</button>':'')+'</li>'; }).join('') + '</ul></details>') : ''; var html=''; html+= '<div class=\"flex items-start justify-between gap-4\">' + '<div>' + '<div class=\"text-xl font-semibold\">'+escapeHtml(m.subject||'(no subject)')+'</div>' + '<div class=\"text-sm text-gray-600 mt-1\">From: '+escapeHtml(m.from||'')+'</div>' + '<div class=\"text-sm text-gray-600\">To: '+escapeHtml(m.to||'')+'</div>' + '<div class=\"text-sm text-gray-600\">Date: '+humanTs(m.timestamp)+'</div>' + '<div class=\"mt-2 flex gap-2\">'+(m.tag?'<span class=\"badge\">'+escapeHtml(m.tag)+'</span>':'')+(m.spam_score!==undefined?'<span class=\"badge\">spam '+m.spam_score+'</span>':'')+'</div>' + '</div>' + '<div class=\"flex gap-2\">' + '<button id=\"openWin\" class=\"btn btn-outline\">Open HTML</button>' + '<button id=\"copyText\" class=\"btn btn-outline\">Copy text</button>' + '</div>' + '</div>'; var sanitized=(m.html||'').replace(/\"/g,'&quot;'); html+= '<div class=\"mt-4\">' + '<div class=\"text-sm text-gray-700 mb-2\">HTML body</div>' + '<iframe class=\"mail\" sandbox=\"allow-same-origin allow-popups\" srcdoc=\"'+sanitized+'\"></iframe>' + (m.text?'<details class=\"mt-3\"><summary class=\"cursor-pointer text-sm text-gray-700\">Plain text</summary><pre class=\"mono text-sm bg-gray-50 p-3 rounded-xl whitespace-pre-wrap\">'+escapeHtml(m.text)+'</pre></details>':'') + (links.length?'<div class=\"mt-3\">Links: '+links.map(function(h){ return '<a class=\"underline text-blue-700 mr-2 break-all\" href=\"'+h+'\" target=\"_blank\" rel=\"noreferrer noopener\">'+h+'</a>'; }).join('')+'</div>':'') + hdrs + spam + atts + '</div>'; detailsEl.innerHTML=html; var openWin=document.querySelector('#openWin'); if(openWin) openWin.addEventListener('click', function(){ var w=window.open('about:blank','_blank'); if(w){ w.document.write(m.html || '<pre>'+escapeHtml(m.text||'')+'</pre>'); }}); var copyText=document.querySelector('#copyText'); if(copyText) copyText.addEventListener('click', function(){ navigator.clipboard.writeText(m.text||m.html||'').then(function(){ copyText.textContent='Copied'; setTimeout(function(){ copyText.textContent='Copy text'; },1000); }); }); detailsEl.querySelectorAll('[data-dl]').forEach(function(btn){ btn.addEventListener('click', function(){ var idx=Number(btn.getAttribute('data-dl')); var a=m.attachments[idx]; var bstr=atob(a.data||''); var bytes=new Uint8Array(bstr.length); for(var i=0;i<bstr.length;i++) bytes[i]=bstr.charCodeAt(i); var blob=new Blob([bytes],{type:a.content_type||'application/octet-stream'}); var url=URL.createObjectURL(blob); var link=document.createElement('a'); link.href=url; link.download=a.filename||'attachment'; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url); }); }); }
    " +

    // query + events
    "async function queryInbox(){ var p=new URLSearchParams(); var pr=state.params; if(pr.tag) p.set('tag',pr.tag); if(pr.tag_prefix) p.set('tag_prefix',pr.tag_prefix); if(pr.timestamp_from) p.set('timestamp_from',String(pr.timestamp_from)); if(pr.timestamp_to) p.set('timestamp_to',String(pr.timestamp_to)); if(pr.limit) p.set('limit',String(pr.limit)); if(pr.offset) p.set('offset',String(pr.offset)); if(pr.headers) p.set('headers','true'); if(pr.spam_report) p.set('spam_report','true'); var r=await fetch('/api/inbox?'+p.toString()); var json=await r.json(); state.inbox=json; renderList(); if(json.emails&&json.emails.length) showDetails(json.emails[0]); }
    " +

    "qs('#apply').addEventListener('click', function(){ state.params={ tag:(qs('#f_tag').value||'').trim()||undefined, tag_prefix:(qs('#f_tag_prefix').value||'').trim()||undefined, timestamp_from:Number(qs('#f_from').value)||undefined, timestamp_to:Number(qs('#f_to').value)||undefined, limit:Number(qs('#f_limit').value)||50, offset:Number(qs('#f_offset').value)||0, headers:qs('#f_headers').checked||undefined, spam_report:qs('#f_spam').checked||undefined }; queryInbox(); });
    " +
    "qs('#clear').addEventListener('click', function(){ ['#f_tag','#f_tag_prefix','#f_from','#f_to'].forEach(function(id){ qs(id).value=''; }); qs('#f_limit').value='50'; qs('#f_offset').value='0'; qs('#f_headers').checked=false; qs('#f_spam').checked=false; state.params={limit:50,offset:0}; queryInbox(); });
    " +
    "qs('#refresh').addEventListener('click', queryInbox);
    " +
    "(function(){ var auto=qs('#auto'); auto.addEventListener('change', function(){ if(auto.checked){ state.autoTimer=setInterval(queryInbox,5000); } else { clearInterval(state.autoTimer); state.autoTimer=null; } }); })();
    " +
    "queryInbox();
    ";

    res.type('application/javascript').send(js);
});

app.listen(PORT, () => {
    console.log(`[Testmail Viewer] http://localhost:${PORT}`);
});
