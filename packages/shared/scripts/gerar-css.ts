import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { gerarCss } from '../src/tokens-visuais.ts';

const pasta = new URL('../css/', import.meta.url);
const arquivo = new URL('tokens.css', pasta);

mkdirSync(pasta, { recursive: true });
writeFileSync(arquivo, gerarCss(), 'utf8');
console.log(`Gerado: ${fileURLToPath(arquivo)}`);
