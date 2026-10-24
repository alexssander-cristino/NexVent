import { ErroDeDominio } from './erros.ts';

/** WCAG 2.x AA: 4,5:1 para texto comum e 3:1 para componentes e elementos gráficos. */
export const CONTRASTE_MINIMO_TEXTO = 4.5;
export const CONTRASTE_MINIMO_COMPONENTE = 3;

export type NomeDoTema = 'claro' | 'escuro';

export interface TokensDoTema {
  /** Fundo da página. */
  fundo: string;
  /** Cards, tabelas, menus, modais. */
  superficie: string;
  /** Divisórias decorativas (não identifica componente). */
  borda: string;
  /** Borda de campos e controles: precisa de 3:1 contra o fundo. */
  bordaCampo: string;
  texto: string;
  textoSecundario: string;
  /** Marca: preenchimento de botões e indicadores. */
  primaria: string;
  /** Hover e estado ativo do preenchimento primário. */
  primariaHover: string;
  textoSobrePrimaria: string;
  /** Links e textos na cor da marca (4,5:1 sobre fundo e superfície). */
  primariaTexto: string;
  /** Linhas de gráfico e indicadores; só elemento gráfico (3:1), não use como texto. */
  destaque: string;
  sucesso: string;
  sucessoFundo: string;
  perigo: string;
  perigoFundo: string;
  alerta: string;
  alertaFundo: string;
}

/**
 * Fonte única das cores. Parte da paleta sugerida no prompt, com ajustes de acessibilidade
 * documentados em docs/ARQUITETURA.md (texto secundário claro, ciano no tema claro, links no tema escuro).
 */
export const TEMAS: Readonly<Record<NomeDoTema, Readonly<TokensDoTema>>> = {
  claro: {
    fundo: '#F7F7FC',
    superficie: '#FFFFFF',
    borda: '#E4E4F0',
    bordaCampo: '#8A8AA3',
    texto: '#202033',
    textoSecundario: '#6E6E88',
    primaria: '#7965D8',
    primariaHover: '#5B46B8',
    textoSobrePrimaria: '#FFFFFF',
    primariaTexto: '#5B46B8',
    destaque: '#0891B2',
    sucesso: '#15803D',
    sucessoFundo: '#DCFCE7',
    perigo: '#B91C1C',
    perigoFundo: '#FEE2E2',
    alerta: '#B45309',
    alertaFundo: '#FEF3C7',
  },
  escuro: {
    fundo: '#11111B',
    superficie: '#1A1A29',
    borda: '#2E2E45',
    bordaCampo: '#6B6B8A',
    texto: '#ECECF6',
    textoSecundario: '#A6A6C0',
    primaria: '#7965D8',
    primariaHover: '#6A55CC',
    textoSobrePrimaria: '#FFFFFF',
    primariaTexto: '#A99CF0',
    destaque: '#22D3EE',
    sucesso: '#4ADE80',
    sucessoFundo: '#14301F',
    perigo: '#F87171',
    perigoFundo: '#3B1A22',
    alerta: '#FBBF24',
    alertaFundo: '#3A2E10',
  },
};

export type Rgb = readonly [number, number, number];

/** Aceita #RGB e #RRGGBB. */
export function lerHex(cor: string): Rgb {
  const encontrado = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(cor.trim());
  const hex = encontrado?.[1];
  if (!hex) {
    throw new ErroDeDominio('COR_INVALIDA', `Cor inválida: "${cor}". Use #RGB ou #RRGGBB.`, { cor });
  }
  const completo = hex.length === 3 ? [...hex].map((digito) => digito + digito).join('') : hex;
  const valor = Number.parseInt(completo, 16);
  return [(valor >> 16) & 255, (valor >> 8) & 255, valor & 255];
}

function canalLinear(canal: number): number {
  const s = canal / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function luminancia(cor: string): number {
  const [r, g, b] = lerHex(cor);
  return 0.2126 * canalLinear(r) + 0.7152 * canalLinear(g) + 0.0722 * canalLinear(b);
}

export function razaoDeContraste(corA: string, corB: string): number {
  const a = luminancia(corA);
  const b = luminancia(corB);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

export interface TextoSobreFundo {
  cor: string;
  razao: number;
  atendeAA: boolean;
}

/**
 * Escolhe, entre duas cores de texto, a de maior contraste sobre o fundo (útil para a cor da marca
 * que cada empresa configura). `atendeAA` é falso quando nenhuma das duas chega a 4,5:1.
 */
export function corDeTextoSobre(
  fundo: string,
  candidatas: readonly [string, string] = ['#FFFFFF', '#202033'],
): TextoSobreFundo {
  const [primeira, segunda] = candidatas;
  const razaoPrimeira = razaoDeContraste(primeira, fundo);
  const razaoSegunda = razaoDeContraste(segunda, fundo);
  const usarPrimeira = razaoPrimeira >= razaoSegunda;
  const razao = usarPrimeira ? razaoPrimeira : razaoSegunda;
  return {
    cor: usarPrimeira ? primeira : segunda,
    razao,
    atendeAA: razao >= CONTRASTE_MINIMO_TEXTO,
  };
}

function emKebab(nome: string): string {
  return nome.replace(/[A-Z]/g, (letra) => `-${letra.toLowerCase()}`);
}

function variaveis(tema: NomeDoTema, recuo: string): string {
  return Object.entries(TEMAS[tema])
    .map(([nome, valor]) => `${recuo}--nx-${emKebab(nome)}: ${valor};`)
    .join('\n');
}

/**
 * CSS com variáveis `--nx-*`. Tema claro por padrão; escuro por `data-tema="escuro"` ou, sem o
 * atributo, pela preferência do sistema. A escolha do usuário (atributo) sempre vence.
 */
export function gerarCss(): string {
  return [
    '/* Gerado por scripts/gerar-css.ts a partir de src/tokens-visuais.ts. Não edite à mão. */',
    ':root,',
    ':root[data-tema="claro"] {',
    '  color-scheme: light;',
    variaveis('claro', '  '),
    '}',
    '',
    '@media (prefers-color-scheme: dark) {',
    '  :root:not([data-tema]) {',
    '    color-scheme: dark;',
    variaveis('escuro', '    '),
    '  }',
    '}',
    '',
    ':root[data-tema="escuro"] {',
    '  color-scheme: dark;',
    variaveis('escuro', '  '),
    '}',
    '',
  ].join('\n');
}
