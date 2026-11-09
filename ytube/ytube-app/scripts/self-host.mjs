import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const args=process.argv.slice(2);
function option(name,fallback){const at=args.indexOf(name);return at<0?fallback:args[at+1];}
const host=option("--host","127.0.0.1"),port=Number(option("--port","8080"));
const state=resolve(option("--state",".wrangler/state"));
if(!/^(?:127\.0\.0\.1|0\.0\.0\.0)$/.test(host)||!Number.isInteger(port)||port<1||port>65535)throw new Error("Invalid host or port.");
if(!existsSync("dist/server/wrangler.json"))throw new Error("Build ytube first: npm run build");
mkdirSync(state,{recursive:true});

const wrangler=["--import","./scripts/sites-env.mjs","./node_modules/wrangler/bin/wrangler.js"];
const common=["--local","--config","dist/server/wrangler.json","--persist-to",state];
function execute(command){
  const result=spawnSync(process.execPath,[...wrangler,"d1","execute","DB",...common,...command,"--json"],{encoding:"utf8",maxBuffer:10*1024*1024});
  if(result.status!==0)throw new Error(`Local database command failed: ${result.stderr||result.stdout}`);
  try{return JSON.parse(result.stdout);}catch{throw new Error(`Could not read D1 result: ${result.stdout}`);}
}
const journal=JSON.parse(readFileSync("drizzle/meta/_journal.json","utf8"));
const probes={"0000_glossy_masked_marvel":"users","0001_living_thunderbolts":"local_accounts"};
for(const entry of journal.entries){
  const table=probes[entry.tag];
  if(!table)throw new Error(`Add a local migration probe for ${entry.tag} in scripts/self-host.mjs.`);
  const rows=execute(["--command",`SELECT name FROM sqlite_master WHERE type='table' AND name='${table}'`]);
  if(rows[0]?.results?.some(row=>row.name===table))continue;
  const file=`drizzle/${entry.tag}.sql`;
  if(!existsSync(file))throw new Error(`Missing migration: ${file}`);
  process.stdout.write(`Applying ${file}…\n`);
  execute(["--file",file]);
}

const registration=process.env.YTUBE_REGISTRATION_OPEN==="0"?"0":"1";
process.stdout.write(`ytube ready at http://${host==="0.0.0.0"?"localhost":host}:${port} (registration ${registration==="1"?"open":"closed"})\n`);
const child=spawn(process.execPath,[...wrangler,"dev",...common,"--ip",host,"--port",String(port),"--inspector-port","0","--var","YTUBE_SELF_HOSTED:1","--var",`YTUBE_REGISTRATION_OPEN:${registration}`],{stdio:"inherit",env:{...process.env,WRANGLER_SEND_METRICS:"false"}});
for(const signal of ["SIGINT","SIGTERM"])process.on(signal,()=>child.kill(signal));
child.on("exit",code=>process.exit(code??0));
