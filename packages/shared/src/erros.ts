/**
 * Erros de regra de negócio. Os códigos são estáveis: a API os converte em respostas HTTP
 * e a interface em mensagens. Novos códigos entram aqui junto com a regra que os lança.
 */
export type CodigoDeErro =
  | 'PERMISSAO_DESCONHECIDA'
  | 'PERMISSOES_INCOERENTES'
  | 'ESCALADA_DE_PRIVILEGIO'
  | 'COR_INVALIDA';

export class ErroDeDominio extends Error {
  readonly codigo: CodigoDeErro;
  readonly detalhes: Readonly<Record<string, unknown>>;

  constructor(codigo: CodigoDeErro, mensagem: string, detalhes: Record<string, unknown> = {}) {
    super(mensagem);
    this.name = 'ErroDeDominio';
    this.codigo = codigo;
    this.detalhes = detalhes;
  }
}
