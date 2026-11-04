import {readFile,mkdir,stat} from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root=path.resolve(import.meta.dirname,'..');
const source=await readFile(path.join(root,'lib/cleaning-visuals.ts'),'utf8');
const extras=await readFile(path.join(root,'lib/extra-photos.ts'),'utf8');
const photos=[...new Set([
 ...[...source.matchAll(/after:'(\/media\/[^']+)'/g)].map(match=>match[1]),
 ...[...extras.matchAll(/:'(\/media\/[^']+)'/g)].map(match=>match[1]),
])];
let originalBytes=0,thumbBytes=0;
for(const photo of photos){
 const input=path.join(root,'public',photo);
 const output=input.replace(/\.[^.]+$/,'-thumb.webp');
 await mkdir(path.dirname(output),{recursive:true});
 await sharp(input).resize({width:480,withoutEnlargement:true}).webp({quality:68,effort:4}).toFile(output);
 originalBytes+=(await stat(input)).size;
 thumbBytes+=(await stat(output)).size;
}
console.log(`${photos.length} thumbnails: ${(originalBytes/1048576).toFixed(2)} MB → ${(thumbBytes/1048576).toFixed(2)} MB`);
