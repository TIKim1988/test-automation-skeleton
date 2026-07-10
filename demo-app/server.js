// 데모용 정적 서버. 실제로는 이 자리에 "실제 앱"이 떠 있다고 생각하면 됩니다.
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 4173;
const ROOT = __dirname;

const server = http.createServer((req, res) => {
  let filePath = req.url === '/' || req.url === '/login' ? '/login.html' : req.url;
  filePath = path.join(ROOT, filePath.split('?')[0]);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(data);
  });
});

server.listen(PORT, () => console.log(`Demo app running at http://localhost:${PORT}`));
