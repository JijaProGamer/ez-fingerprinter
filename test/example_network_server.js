const { readFileSync } = require('fs');
const http = require('http');

const { ServeHTTP } = require('../fingerprint_server')

const server = http.createServer((req, res) => {
    const url = req.url;

    if (url === '/') {
        res.setHeader('Content-Type', 'text/html');
        return res.end(readFileSync("./test.html", "utf-8"))
    }
    else if (url === '/index.js') {
        res.setHeader('Content-Type', 'text/javascript');
        return res.end(readFileSync("../index.js", "utf-8"))
    } else if (url === '/fingerprint') {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(ServeHTTP(req)))
    }
});

const port = 3000;

server.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});