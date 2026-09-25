import { build } from 'vite';
import { mkdir, readdir, readFile, rm, writeFile, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const root=fileURLToPath(new URL('../',import.meta.url));
const output=join(root,'ios/TumbleGrove/Web');
await build({configFile:join(root,'vite.config.ts'),build:{outDir:output,target:'safari17'}});
execFileSync(process.execPath,['scripts/build-legal.mjs','ios/TumbleGrove/Web'],{cwd:root,stdio:'inherit'});
// Native releases use only bundled code. No service worker or remote update path.
for(const name of ['sw.js','.nojekyll','manifest.webmanifest','ios-app-icon.png','ios-app-icon-prompt.txt'])await rm(join(output,name),{force:true});
const indexPath=join(output,'index.html');
const index=(await readFile(indexPath,'utf8')).replace(/<link rel="manifest"[^>]*>/,'');
await writeFile(indexPath,index);
const files=(await readdir(output,{recursive:true,withFileTypes:true})).filter(f=>f.isFile()).map(f=>relative(output,join(f.parentPath,f.name))).sort();
const hashes=[];
for(const name of files){const bytes=await readFile(join(output,name));hashes.push({file:name,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});}
await writeFile(join(output,'bundle-manifest.json'),JSON.stringify({files:hashes},null,2)+'\n');
const iconDir=join(root,'ios/TumbleGrove/Assets.xcassets/AppIcon.appiconset');
try{
  await readFile(join(root,'public/ios-app-icon.png'));
  await mkdir(iconDir,{recursive:true});
  await copyFile(join(root,'public/ios-app-icon.png'),join(iconDir,'AppIcon.png'));
  await writeFile(join(iconDir,'Contents.json'),JSON.stringify({images:[{filename:'AppIcon.png',idiom:'universal',platform:'ios',size:'1024x1024'}],info:{author:'xcode',version:1}},null,2)+'\n');
}catch(error){if(error.code!=='ENOENT')throw error;console.warn('App icon is not ready yet; required before archiving for distribution.');}
console.log(`Bundled ${files.length} files for native offline play in ${output}`);
