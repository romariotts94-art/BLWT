import {registerHooks} from 'node:module';
import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';

// Match the app's bundler resolution when running its TS domain modules in Node.
registerHooks({
  resolve(specifier,context,next){
    if(specifier.startsWith('.')){
      const url=new URL(specifier,context.parentURL);
      for(const extension of ['.ts','.tsx']){
        if(existsSync(fileURLToPath(url)+extension))return next(url.href+extension,context);
      }
      if(url.pathname.endsWith('.json'))return next(specifier,{...context,importAttributes:{type:'json'}});
    }
    return next(specifier,context);
  },
  load(url,context,next){
    if(url.endsWith('.json'))return {format:'module',shortCircuit:true,source:`export default ${readFileSync(fileURLToPath(url),'utf8')};`};
    if(/\.tsx?$/.test(url))return {format:'module',shortCircuit:true,source:ts.transpileModule(readFileSync(fileURLToPath(url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText};
    return next(url,context);
  },
});
