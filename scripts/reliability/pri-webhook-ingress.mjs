#!/usr/bin/env node
// Independent, inert webhook ingress. Accepts ONLY GitHub-signed PR opened /
// synchronize events and writes durable replay-proof metadata. This service
// DOES NOT publish green checks, sign grants, or merge; it is not activation.
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {recordVerifiedWebhook} from './pri-trusted-check-publisher.mjs';
import {createPostgresControlStore} from './pri-postgres-control-store.mjs';

const createRequireHere=createRequire(new URL('../../server/package.json',import.meta.url));
const {Pool}=createRequireHere('pg');
const fail=(message)=>{throw Error('PRI_WEBHOOK_DENIED_'+message)};
const header= (value)=>typeof value==='string'?value:'';
const sha=/^[a-f0-9]{40}$/i;
const MAX_BODY=1024*1024-1;

async function bodyLimit(request){
  const advertised=request.headers['content-length'];
  if(advertised!==undefined && (!/^\d+$/.test(advertised) || Number(advertised)>MAX_BODY))
    fail('BODY_TOO_LARGE');
  const chunks=[];let bytes=0;
  for await (const chunk of request){
    bytes+=chunk.length;
    if(bytes>MAX_BODY)fail('BODY_TOO_LARGE');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

// Trust only HMAC-validated content, not sender-supplied request headers.
export function createWebhookIngress({store,secret}){
  if(!store || typeof store.recordDeliveryOnce!=='function' ||
    typeof secret!=='string' || secret.length<32)fail('TRUSTED_STORE_OR_SECRET_REQUIRED');
  return createServer(async(req,res)=>{
    const write=(status,code)=>{
      res.writeHead(status,{'content-type':'application/json; charset=utf-8',
        'cache-control':'no-store','x-content-type-options':'nosniff'});
      res.end(JSON.stringify({accepted:status===202,code}));
    };
    if(req.method==='GET' && req.url==='/healthz')return write(200,'WEBHOOK_INGRESS_ALIVE_NOT_ACTIVATED');
    if(req.method!=='POST' || req.url!=='/webhooks/github')return write(404,'UNKNOWN_ROUTE');
    try{
      if(header(req.headers['content-type']).split(';')[0].trim()!=='application/json')
        fail('EXPECTED_JSON');
      const eventName=header(req.headers['x-github-event']);
      const deliveryId=header(req.headers['x-github-delivery']);
      const signature=header(req.headers['x-hub-signature-256']);
      const raw=await bodyLimit(req);
      // The event contents are NOT authoritative until HMAC verification in
      // recordVerifiedWebhook. Derive expected PR number/head from the signed
      // payload only as input to its exact-identity consistency check.
      let event;
      try{event=JSON.parse(raw)}catch{fail('BAD_JSON')}
      const number=event?.pull_request?.number;
      const head=event?.pull_request?.head?.sha;
      if(!Number.isSafeInteger(number) || number<1 || !sha.test(head||''))fail('INVALID_SOURCE_ID');
      const persisted=await recordVerifiedWebhook({raw,signature,secret,
        deliveryId,eventName,prNumber:number,head,store});
      // Do not expose sender identities, SHA, payload, or secrets in response.
      void persisted;
      return write(202,'VERIFIED_DELIVERY_RECORDED_NOT_AUTHORIZED');
    }catch(error){
      const code=String(error.message||'DENIED');
      if(code==='WEBHOOK_DELIVERY_REPLAY_DETECTED')return write(409,'DUPLICATE_DELIVERY');
      if(/BODY_TOO_LARGE/.test(code))return write(413,'BODY_TOO_LARGE');
      // Auth, payload, and database errors intentionally have no details.
      return write(400,'NOT_ACCEPTED');
    }
  });
}

async function run(){
  const env=process.env;
  // No runtime may be started from this repo's PR or ordinary GitHub workflow.
  if(env.PRI_INGRESS_RUNTIME_ISOLATED!=='true' ||
    env.PRI_INGRESS_ALLOW_WRITES!=='durable-metadata-only' ||
    !env.PRI_CONTROL_DATABASE_URL || !env.PRI_GITHUB_WEBHOOK_SECRET ||
    env.RAILWAY_ENVIRONMENT_ID || env.RAILWAY_PROJECT_ID)fail('INDEPENDENT_RUNTIME_NOT_CONFIGURED');
  const host='127.0.0.1',port=Number(env.PRI_INGRESS_LOCAL_PORT);
  if(!Number.isSafeInteger(port)||port<1024||port>65535)fail('LOCAL_PORT_INVALID');
  const pool=new Pool({connectionString:env.PRI_CONTROL_DATABASE_URL,max:4});
  const server=createWebhookIngress({store:createPostgresControlStore(pool),
    secret:env.PRI_GITHUB_WEBHOOK_SECRET});
  server.listen(port,host);
  for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>{
    server.close(()=>{pool.end().then(()=>process.exit(0)).catch(()=>process.exit(1))});
  });
}
if(process.argv[1]?.endsWith('/pri-webhook-ingress.mjs'))
  run().catch(err=>{console.error(String(err.message||'WEBHOOK_INGRESS_DENIED'));process.exitCode=1});
