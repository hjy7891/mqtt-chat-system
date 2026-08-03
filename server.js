const http = require('http');
const fs = require('fs');

const PORT = process.env.PORT || 8080;

const messages = [];
let clientId = 0;
const clients = {};

function broadcast(msg) {
  messages.push(msg);
  if (messages.length > 200) messages.shift();
  
  for (const id in clients) {
    const client = clients[id];
    if (client.callback) {
      client.callback(msg);
      client.callback = null;
    }
  }
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  const url = new URL(req.url, `http://${req.headers.host}`);
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  if (url.pathname === '/' || url.pathname === '/chat.html') {
    fs.readFile('./chat.html', (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end('Not found');
      } else {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(data);
      }
    });
    return;
  }
  
  if (url.pathname === '/send') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const msg = JSON.parse(body);
        msg.time = new Date().toLocaleTimeString();
        broadcast(msg);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (e) {
        res.writeHead(400);
        res.end('Bad request');
      }
    });
    return;
  }
  
  if (url.pathname === '/poll') {
    const lastId = parseInt(url.searchParams.get('id') || '-1');
    const newMsgs = messages.filter((_, i) => i > lastId);
    
    if (newMsgs.length > 0) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ id: messages.length - 1, messages: newMsgs, online: Object.keys(clients).length + 1 }));
    } else {
      const id = ++clientId;
      clients[id] = { callback: null };
      
      const timeout = setTimeout(() => {
        delete clients[id];
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ id: messages.length - 1, messages: [], online: Object.keys(clients).length + 1 }));
      }, 30000);
      
      clients[id].callback = (msg) => {
        clearTimeout(timeout);
        delete clients[id];
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ id: messages.length - 1, messages: [msg], online: Object.keys(clients).length + 1 }));
      };
    }
    return;
  }
  
  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});