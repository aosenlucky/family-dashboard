import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
process.chdir(root);
// This launcher deliberately never reads production dotenv files or credentials.
for(const key of Object.keys(process.env))if(/^(SUPABASE_|JSONBIN_|OBS_|PUSHPLUS_|DEEPSEEK_|DEMO_|WEALTH_)/.test(key))delete process.env[key];
process.env.PERSONAL_PREVIEW_DIR=resolve(root,'.local/personal-preview');
process.env.SYSTEM_PASSWORD='local-family-preview';process.env.WEALTH_PASSWORD='local-wealth-preview';process.env.NODE_ENV='development';
const {seedPersonalPreview}=await import('./preview-seed.js');await seedPersonalPreview();
const {createServer}=await import('vite');
const server=await createServer({root,envDir:false,server:{host:'127.0.0.1',port:5199,strictPort:true},define:{'import.meta.env.VITE_PERSONAL_PREVIEW':JSON.stringify('1')}});
await server.listen();server.printUrls();
