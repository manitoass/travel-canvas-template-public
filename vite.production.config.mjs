import {defineConfig} from 'vite';
export default defineConfig({
 root:'.', publicDir:false,
 build:{outDir:'site',emptyOutDir:true,target:'es2022',minify:true,rollupOptions:{input:'index.html'}},
 define:{'process.env.NODE_ENV':'"production"'}
});
