import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

function copyRuntimeFiles() {
    const files = ['data.json', 'sw.js'];

    return {
        name: 'copy-runtime-files',
        generateBundle() {
            files.forEach(fileName => {
                this.emitFile({
                    type: 'asset',
                    fileName,
                    source: fs.readFileSync(path.join(projectRoot, fileName))
                });
            });
        }
    };
}

export default defineConfig({
    plugins: [copyRuntimeFiles()],
    build: {
        rollupOptions: {
            input: {
                index: path.join(projectRoot, 'index.html'),
                admin: path.join(projectRoot, 'admin.html')
            }
        }
    }
});
