import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
const base='/BLWT/';
export default defineConfig({
 root:path.resolve('github-pages'),base,publicDir:path.resolve('public'),
 plugins:[{name:'github-pages-media-paths',enforce:'pre',transform(code,id){if(id.includes('/node_modules/'))return;return code.replace(/(["'])\/(media\/[^"']+|interior\.jpg)\1/g,(_m,q,p)=>q+base+p+q)}},react()],
 build:{rollupOptions:{input:{home:path.resolve('github-pages/index.html'),care:path.resolve('github-pages/care-guide.html')}},outDir:path.resolve('pages-dist'),emptyOutDir:true},
 server:{host:'127.0.0.1',port:5174}
});
