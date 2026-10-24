import { ErroDeDominio } from './erros.ts';

/**
 * Catálogo de permissões no formato "modulo:acao".
 *
 * - "excluir" em eventos, clientes, fornecedores etc. significa arquivar (exclusão lógica).
 * - O financeiro não tem "excluir" de propósito: lançamentos são cancelados ou estornados, nunca apagados.
 * - Relatórios financeiros devem exigir também "financeiro:ver" (regra aplicada na API).
 */
export const CATALOGO_DE_PERMISSOES = {
  dashboard: ['ver'],
  eventos: ['ver', 'criar', 'editar', 'cancelar', 'excluir'],
  tarefas: ['ver', 'criar', 'editar', 'excluir'],
  clientes: ['ver', 'criar', 'editar', 'excluir'],
  fornecedores: ['ver', 'criar', 'editar', 'excluir'],
  financeiro: ['ver', 'criar', 'editar', 'baixar', 'estornar', 'cancelar', 'gerenciar_contas'],
  orcamentos: ['ver', 'criar', 'editar', 'excluir', 'decidir'],
  contratos: ['ver', 'criar', 'editar', 'excluir', 'baixar'],
  documentos: ['ver', 'criar', 'editar', 'excluir', 'baixar'],
  equipe: ['ver', 'convidar', 'editar_papel', 'desativar', 'gerenciar_papeis'],
  configuracoes: ['ver', 'editar'],
  relatorios: ['ver', 'exportar'],
  auditoria: ['ver'],
  assinatura: ['ver', 'gerenciar'],
} as const;

type Catalogo = typeof CATALOGO_DE_PERMISSOES;

export type Modulo = keyof Catalogo;
export type Permissao = { [M in Modulo]: `${M}:${Catalogo[M][number]}` }[Modulo];

const MODULOS = Object.keys(CATALOGO_DE_PERMISSOES) as Modulo[];

function acoesDe(modulo: Modulo): readonly string[] {
  return CATALOGO_DE_PERMISSOES[modulo];
}

export const TODAS_AS_PERMISSOES: readonly Permissao[] = MODULOS.flatMap((modulo) =>
  acoesDe(modulo).map((acao) => `${modulo}:${acao}` as Permissao),
);

function acoes<M extends Modulo>(modulo: M, ...lista: Catalogo[M][number][]): Permissao[] {
  return lista.map((acao) => `${modulo}:${acao}` as Permissao);
}

function moduloInteiro(modulo: Modulo): Permissao[] {
  return acoesDe(modulo).map((acao) => `${modulo}:${acao}` as Permissao);
}

export type PapelDoSistema =
  | 'proprietario'
  | 'administrador'
  | 'gerente_de_eventos'
  | 'financeiro'
  | 'comercial'
  | 'operacional'
  | 'visualizador';

export interface DefinicaoDePapel {
  readonly chave: PapelDoSistema;
  readonly rotulo: string;
  readonly descricao: string;
  readonly permissoes: readonly Permissao[];
}

/**
 * Modelos de papel. Cada empresa recebe uma cópia editável; a API sempre confere as permissões
 * gravadas da empresa, nunca esta lista. Os valores abaixo são uma proposta a ser revisada.
 */
export const PAPEIS_DO_SISTEMA: readonly DefinicaoDePapel[] = [
  {
    chave: 'proprietario',
    rotulo: 'Proprietário',
    descricao: 'Controle total da empresa, inclusive assinatura e plano.',
    permissoes: TODAS_AS_PERMISSOES,
  },
  {
    chave: 'administrador',
    rotulo: 'Administrador',
    descricao: 'Gerencia tudo, exceto a assinatura e o plano.',
    permissoes: TODAS_AS_PERMISSOES.filter((permissao) => permissao !== 'assinatura:gerenciar'),
  },
  {
    chave: 'gerente_de_eventos',
    rotulo: 'Gerente de eventos',
    descricao: 'Conduz eventos, tarefas, fornecedores e contratos; consulta o financeiro sem lançar.',
    permissoes: [
      ...acoes('dashboard', 'ver'),
      ...acoes('eventos', 'ver', 'criar', 'editar', 'cancelar'),
      ...moduloInteiro('tarefas'),
      ...acoes('clientes', 'ver', 'criar', 'editar'),
      ...acoes('fornecedores', 'ver', 'criar', 'editar'),
      ...acoes('financeiro', 'ver'),
      ...acoes('orcamentos', 'ver', 'criar', 'editar'),
      ...acoes('contratos', 'ver', 'criar', 'editar', 'baixar'),
      ...acoes('documentos', 'ver', 'criar', 'editar', 'baixar'),
      ...acoes('equipe', 'ver'),
      ...acoes('relatorios', 'ver'),
    ],
  },
  {
    chave: 'financeiro',
    rotulo: 'Financeiro',
    descricao: 'Controla lançamentos, baixas, contas e relatórios financeiros.',
    permissoes: [
      ...acoes('dashboard', 'ver'),
      ...acoes('eventos', 'ver'),
      ...acoes('clientes', 'ver'),
      ...acoes('fornecedores', 'ver'),
      ...moduloInteiro('financeiro'),
      ...acoes('orcamentos', 'ver'),
      ...acoes('contratos', 'ver'),
      ...acoes('documentos', 'ver', 'baixar'),
      ...acoes('relatorios', 'ver', 'exportar'),
    ],
  },
  {
    chave: 'comercial',
    rotulo: 'Comercial',
    descricao: 'Cuida de clientes, propostas e contratos; cria eventos a partir de oportunidades fechadas.',
    permissoes: [
      ...acoes('dashboard', 'ver'),
      ...acoes('eventos', 'ver', 'criar'),
      ...acoes('clientes', 'ver', 'criar', 'editar'),
      ...acoes('orcamentos', 'ver', 'criar', 'editar', 'decidir'),
      ...acoes('contratos', 'ver', 'criar', 'editar', 'baixar'),
      ...acoes('documentos', 'ver', 'criar', 'baixar'),
      ...acoes('relatorios', 'ver'),
    ],
  },
  {
    chave: 'operacional',
    rotulo: 'Operacional',
    descricao: 'Executa tarefas dos eventos; não acessa dados de clientes nem financeiros.',
    permissoes: [
      ...acoes('dashboard', 'ver'),
      ...acoes('eventos', 'ver'),
      ...acoes('tarefas', 'ver', 'criar', 'editar'),
      ...acoes('fornecedores', 'ver'),
      ...acoes('documentos', 'ver'),
    ],
  },
  {
    chave: 'visualizador',
    rotulo: 'Visualizador',
    descricao: 'Consulta eventos, tarefas, clientes e fornecedores, sem alterar nada.',
    permissoes: [
      ...acoes('dashboard', 'ver'),
      ...acoes('eventos', 'ver'),
      ...acoes('tarefas', 'ver'),
      ...acoes('clientes', 'ver'),
      ...acoes('fornecedores', 'ver'),
    ],
  },
];

const PAPEIS_POR_CHAVE: ReadonlyMap<PapelDoSistema, DefinicaoDePapel> = new Map(
  PAPEIS_DO_SISTEMA.map((papel) => [papel.chave, papel] as const),
);

const PERMISSOES_VALIDAS: ReadonlySet<string> = new Set(TODAS_AS_PERMISSOES);

export function permissoesDoPapel(chave: PapelDoSistema): ReadonlySet<Permissao> {
  const papel = PAPEIS_POR_CHAVE.get(chave);
  if (!papel) throw new Error(`Papel do sistema inexistente: ${chave}`);
  return new Set(papel.permissoes);
}

export function ehPermissaoValida(valor: string): valor is Permissao {
  return PERMISSOES_VALIDAS.has(valor);
}

/** Valida e remove duplicatas. Use em qualquer entrada que defina permissões (papéis personalizados). */
export function validarPermissoes(valores: readonly string[]): Permissao[] {
  const desconhecidas = valores.filter((valor) => !ehPermissaoValida(valor));
  if (desconhecidas.length > 0) {
    throw new ErroDeDominio(
      'PERMISSAO_DESCONHECIDA',
      `Permissões desconhecidas: ${desconhecidas.join(', ')}`,
      { desconhecidas },
    );
  }
  return [...new Set(valores)] as Permissao[];
}

export function temPermissao(concedidas: ReadonlySet<Permissao>, exigida: Permissao): boolean {
  return concedidas.has(exigida);
}

/** Permissões de escrita ou de ação sem a permissão de leitura ("ver") do mesmo módulo. */
export function permissoesSemLeitura(permissoes: Iterable<Permissao>): Permissao[] {
  const lista = [...permissoes];
  const conjunto = new Set<string>(lista);
  return lista.filter((permissao) => {
    const [modulo, acao] = permissao.split(':');
    return acao !== 'ver' && !conjunto.has(`${modulo}:ver`);
  });
}

/** Papéis personalizados não podem escrever onde não podem ler. */
export function validarCoerencia(permissoes: Iterable<Permissao>): void {
  const semLeitura = permissoesSemLeitura(permissoes);
  if (semLeitura.length > 0) {
    throw new ErroDeDominio(
      'PERMISSOES_INCOERENTES',
      `Estas permissões exigem também a leitura do módulo: ${semLeitura.join(', ')}`,
      { semLeitura },
    );
  }
}

/** Permissões de `alvo` que `ator` não possui. */
export function permissoesExcedentes(ator: ReadonlySet<Permissao>, alvo: Iterable<Permissao>): Permissao[] {
  return [...alvo].filter((permissao) => !ator.has(permissao));
}

/** Impede escalada de privilégio: ninguém concede (ou atribui um papel com) permissões que não tem. */
export function exigirPodeConceder(ator: ReadonlySet<Permissao>, alvo: Iterable<Permissao>): void {
  const excedentes = permissoesExcedentes(ator, alvo);
  if (excedentes.length > 0) {
    throw new ErroDeDominio(
      'ESCALADA_DE_PRIVILEGIO',
      'Não é possível conceder permissões que você não possui.',
      { excedentes },
    );
  }
}
