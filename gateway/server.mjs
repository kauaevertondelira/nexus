/* Ponte HTTP opcional para sensores. Node 22+, bibliotecas nativas, sem Firebase CLI.
   Execute em servidor confiável; nunca coloque credenciais dentro do site. */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {createSign,randomUUID,timingSafeEqual} from 'node:crypto';
import {pathToFileURL,fileURLToPath} from 'node:url';

class RequestError extends Error {constructor(status,message){super(message);this.status=status;}}
export function validateReading(input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw new RequestError(400,'Envie um objeto JSON.');
 if(typeof input.deviceId!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(input.deviceId))throw new RequestError(400,'deviceId inválido.');
 for(const [name,min,max]of [['temperature',-40,250],['vibration',0,100],['energyKwh',0,1e12]]){
  if(name==='energyKwh'&&input[name]===undefined)continue;
  if(typeof input[name]!=='number'||!Number.isFinite(input[name])||input[name]<min||input[name]>max)throw new RequestError(400,name+' fora do intervalo permitido.');
 }
 return {deviceId:input.deviceId,temperature:input.temperature,vibration:input.vibration,...(input.energyKwh!==undefined?{energyKwh:input.energyKwh}:{})};
}
export function databaseURL(raw){const url=new URL(raw);if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||!/(^|\.)(firebaseio\.com|firebasedatabase\.app)$/.test(url.hostname)||url.pathname!=='/')throw new Error('Use a URL HTTPS da raiz do Realtime Database.');return url.origin;}
export function credentialPath(file,projectRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')){const resolved=fs.realpathSync(file),relative=path.relative(fs.realpathSync(projectRoot),resolved);if(relative===''||(!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative)))throw new Error('A credencial de serviço deve ficar fora do repositório publicado.');return resolved;}
export function readingSeverity(reading,config){return reading.temperature>=config.tempCritical||reading.vibration>=config.vibrationCritical?'critical':reading.temperature>=config.tempWarning||reading.vibration>=config.vibrationWarning?'warning':'ok';}
export function buildUpdates(reading,config,previous={},now=Date.now(),id=randomUUID()){
 if(!config?.active||typeof config.assetId!=='string'||!config.assetId)throw new RequestError(403,'Dispositivo inativo ou sem vínculo a um ativo.');
 for(const field of ['tempWarning','tempCritical','vibrationWarning','vibrationCritical'])if(typeof config[field]!=='number'||!Number.isFinite(config[field]))throw new RequestError(422,'Limites do dispositivo inválidos.');
 if(config.tempWarning>=config.tempCritical||config.vibrationWarning>=config.vibrationCritical)throw new RequestError(422,'Limites do dispositivo fora de ordem.');
 const severity=readingSeverity(reading,config),record={...reading,assetId:config.assetId,receivedAt:now,severity,readingId:id};
 const updates={['telemetry/latest/'+reading.deviceId]:record,['telemetry/history/'+reading.deviceId+'/'+now+'-'+id]:record};
 if(severity!=='ok'&&severity!==previous.severity){const descriptions=[];if(reading.temperature>=config.tempWarning)descriptions.push('temperatura '+reading.temperature+' °C');if(reading.vibration>=config.vibrationWarning)descriptions.push('vibração '+reading.vibration+' mm/s');updates['iot_alerts/'+reading.deviceId+'-'+now+'-'+id]={deviceId:reading.deviceId,assetId:config.assetId,severity,message:descriptions.join(' · ').slice(0,300),acknowledged:false,createdAt:now};}
 return updates;
}
function oauth(account){let cached,pending;return async()=>{if(cached&&cached.expires>Date.now()+60000)return cached.token;if(pending)return pending;pending=(async()=>{const now=Math.floor(Date.now()/1000),encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url'),payload=encode({alg:'RS256',typ:'JWT'})+'.'+encode({iss:account.client_email,scope:'https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/userinfo.email',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600});const signature=createSign('RSA-SHA256').update(payload).sign(account.private_key,'base64url');const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:payload+'.'+signature}),signal:AbortSignal.timeout(10000)});if(!response.ok)throw new RequestError(503,'A autenticação do gateway está indisponível.');const data=await response.json();if(!data.access_token)throw new RequestError(503,'A autenticação não retornou um token.');cached={token:data.access_token,expires:Date.now()+Number(data.expires_in||3600)*1000};return cached.token;})().finally(()=>{pending=null;});return pending;};}
export function createGateway({database,account,secret,fetchImpl=fetch,getAccessToken}){
 if(typeof secret!=='string'||Buffer.byteLength(secret)<32)throw new Error('NEXUS_GATEWAY_KEY precisa ter pelo menos 32 caracteres.');
 const db=databaseURL(database),token=getAccessToken||oauth(account),busy=new Set(),lastReading=new Map(),key=Buffer.from(secret);
 const request=async(relative,method='GET',body)=>{const response=await fetchImpl(db+'/'+relative+'.json',{method,headers:{Authorization:'Bearer '+await token(),'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(10000)});if(!response.ok)throw new RequestError(503,'O banco recusou a operação do gateway.');return response.json();};
 return http.createServer(async(req,res)=>{
  const respond=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value));};
  if(req.url==='/health'&&req.method==='GET'){respond(200,{status:'online',service:'nexus-sensor-gateway'});return;}
  if(req.url!=='/readings'||req.method!=='POST'){respond(404,{error:'Rota não encontrada.'});return;}
  const supplied=Buffer.from(String(req.headers['x-nexus-key']||''));if(supplied.length!==key.length||!timingSafeEqual(supplied,key)){respond(401,{error:'Credencial do dispositivo inválida.'});req.resume();return;}
  if(!String(req.headers['content-type']||'').startsWith('application/json')){respond(415,{error:'Use application/json.'});req.resume();return;}
  let deviceId,ownsLock=false;
  try{
   let size=0,body='';for await(const chunk of req){size+=chunk.length;if(size>8192)throw new RequestError(413,'Envie até 8 KB por leitura.');body+=chunk.toString('utf8');}
   let parsed;try{parsed=JSON.parse(body);}catch{throw new RequestError(400,'JSON inválido.');}
   const reading=validateReading(parsed);deviceId=reading.deviceId;
   if(busy.has(deviceId)||(lastReading.get(deviceId)||0)>Date.now()-1000)throw new RequestError(429,'Aguarde antes de enviar outra leitura do dispositivo.');busy.add(deviceId);ownsLock=true;
   const config=await request('iot_device_config/'+deviceId);if(!config)throw new RequestError(404,'Cadastre o dispositivo na Central IoT.');
   if(!config.assetId||!await request('assets/'+encodeURIComponent(config.assetId)))throw new RequestError(422,'O equipamento vinculado não existe.');
   const previous=await request('telemetry/latest/'+deviceId)||{},updates=buildUpdates(reading,config,previous);
   await request('','PATCH',updates);lastReading.set(deviceId,Date.now());respond(201,{accepted:true,deviceId});
  }catch(error){respond(error.status||503,{error:error.status?error.message:'O gateway não conseguiu processar a leitura.'});}
  finally{if(ownsLock)busy.delete(deviceId);}
 });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{const file=process.env.NEXUS_SERVICE_ACCOUNT_FILE;if(!file)throw new Error('Informe NEXUS_SERVICE_ACCOUNT_FILE com um arquivo privado fora do repositório.');const account=JSON.parse(fs.readFileSync(credentialPath(file),'utf8'));if(!account.client_email||!account.private_key)throw new Error('Credencial de serviço incompleta.');const server=createGateway({database:process.env.NEXUS_DATABASE_URL||'https://nexus-iot-senai-default-rtdb.firebaseio.com',account,secret:process.env.NEXUS_GATEWAY_KEY});server.requestTimeout=15000;server.headersTimeout=10000;server.listen(Number(process.env.NEXUS_GATEWAY_PORT||8787),'127.0.0.1',()=>console.log('Gateway Nexus em 127.0.0.1:'+Number(process.env.NEXUS_GATEWAY_PORT||8787)));}catch(error){console.error(error.message);process.exitCode=1;}
}
