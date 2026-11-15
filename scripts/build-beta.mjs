import {writeFile,mkdir,readdir} from 'node:fs/promises';
import {resolve,join,delimiter} from 'node:path';
import {spawnSync} from 'node:child_process';
const root=resolve(import.meta.dirname,'..'), upstream=join(root,'vendor/virtual_robot-master');
const build=join(root,'vendor/beta-build');
import {javaToolchain} from '../src/runtime-config.mjs';
const {java,javac}=await javaToolchain();
async function files(dir){const out=[];for(const e of await readdir(dir,{withFileTypes:true})){const path=join(dir,e.name);out.push(...(e.isDirectory()?await files(path):[path]));}return out;}
await mkdir(build,{recursive:true});
const jars=[...(await files(join(upstream,'lib'))).filter(p=>p.endsWith('.jar')&&!p.includes('sources')), ...(await files(join(root,'vendor/javafx'))).filter(p=>p.endsWith('.jar'))];
const sources=[...(await files(join(upstream,'Controller/src'))),...(await files(join(root,'beta-src')))].filter(p=>p.endsWith('.java'));
const args=['-encoding','UTF-8','-cp',jars.join(delimiter),'-d',join(build,'classes'),...sources];
await writeFile(join(build,'compile.args'),args.map(x=>'"'+x.replaceAll('\\','/')+'"').join('\n'));
const result=spawnSync(javac,['-J-Xmx768m','-J-Duser.language=en','-J-Duser.country=US','@'+join(build,'compile.args')],{cwd:root,windowsHide:true,encoding:'utf8',maxBuffer:5000000});
process.stdout.write(result.stdout||'');process.stderr.write(result.stderr||'');if(result.error)throw result.error;
if(result.status!==0)process.exit(result.status||1);
await writeFile(join(build,'runtime.json'),JSON.stringify({java,javac,classpath:[join(build,'classes'),join(upstream,'Controller/src'),...jars].join(delimiter),upstream,source:'https://github.com/Beta8397/virtual_robot',snapshot:'master downloaded 2026-09-13'},null,2));
console.log('Beta8397 compiled successfully');
