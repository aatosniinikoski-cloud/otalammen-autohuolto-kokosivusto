import {createServer} from 'node:http'
// Local manual test only. Never logs payloads, filenames, contact details or URLs.
createServer(async (request,response)=>{
  let bytes=0
  for await (const chunk of request) {bytes+=chunk.length;if(bytes>32768){response.writeHead(413).end();return}}
  if(request.url==='/timeout'){setTimeout(()=>response.writeHead(200).end('{}'),15000);return}
  response.writeHead(request.url==='/error'?500:200,{'Content-Type':'application/json'}).end('{}')
}).listen(8788,'127.0.0.1',()=>console.log('Local GHL mock ready on port 8788; no payload logging.'))
