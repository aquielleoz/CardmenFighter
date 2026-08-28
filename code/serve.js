/* A STATIC SERVER FOR THE TUNNEL EXPERIMENT — zero dependencies, like everything else here.
 *
 * `cloudflared tunnel --url http://localhost:PORT` needs something listening on a port. That is all this is.
 * It exists because the interesting question ("does this origin get the camera?") can only be answered by
 * opening the SAME file over https on a real phone, and a quick tunnel is the cheapest way to get an https
 * origin without hosting anything permanently or making a lasting public link.
 *
 *   node serve.js                 # serves this directory on 8080
 *   node serve.js 9000            # ...on 9000
 *
 * Then, in another terminal:
 *   cloudflared tunnel --url http://localhost:8080
 *
 * That prints a https://<random>.trycloudflare.com URL. No account, no config, and it dies with the process.
 * Open <that URL>/origin-probe.html on the phone, and open the SAME probe from Downloads, and compare.
 *
 * NOTE it binds 0.0.0.0 so the LAN case (http://192.168.x.x:8080) is testable too — that is the third cell of
 * the comparison, and the one that shows an insecure-but-not-opaque origin behaves differently from both.
 * Anything in this directory is readable by anyone who can reach the port while it runs. */
var http=require('http'), fs=require('fs'), path=require('path');
var PORT=parseInt(process.argv[2],10)||8080, ROOT=__dirname;
var TYPES={ '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8',
            '.css':'text/css; charset=utf-8', '.json':'application/json', '.md':'text/plain; charset=utf-8',
            '.png':'image/png', '.svg':'image/svg+xml', '.y4m':'video/x-yuv4mpeg2' };

http.createServer(function (req, res) {
  var rel=decodeURIComponent((req.url||'/').split('?')[0]);
  if (rel === '/') rel = '/origin-probe.html';                 // the probe is the point of this server
  var file=path.join(ROOT, rel);
  /* Refuse to serve outside the directory — a tunnel makes this reachable by strangers. */
  if (file.indexOf(ROOT) !== 0) { res.writeHead(403); return res.end('outside the served directory'); }
  fs.readFile(file, function (err, buf) {
    if (err) { res.writeHead(404, {'Content-Type':'text/plain'}); return res.end('not found: '+rel); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
                         'Cache-Control': 'no-store' });        // no-store: re-testing must not hit a cache
    res.end(buf);
  });
}).listen(PORT, '0.0.0.0', function () {
  console.log('serving ' + ROOT + '\n');
  console.log('  local     http://localhost:' + PORT + '/origin-probe.html');
  console.log('  the game  http://localhost:' + PORT + '/CardmenFighter.html');
  console.log('\n  LAN       http://<this machine\'s IP>:' + PORT + '/origin-probe.html   (insecure origin)');
  console.log('  tunnel    cloudflared tunnel --url http://localhost:' + PORT + '   (https origin)\n');
});
