import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ErroDeDominio } from './erros.ts';
import {
  CATALOGO_DE_PERMISSOES,
  PAPEIS_DO_SISTEMA,
  TODAS_AS_PERMISSOES,
  ehPermissaoValida,
  exigirPodeConceder,
  permissoesDoPapel,
  permissoesExcedentes,
  permissoesSemLeitura,
  temPermissao,
  validarCoerencia,
  validarPermissoes,
} from './permissoes.ts';
import type { PapelDoSistema } from './permissoes.ts';

function comPrefixo(papel: PapelDoSistema, prefixo: string): string[] {
  return [...permissoesDoPapel(papel)].filter((permissao) => permissao.startsWith(prefixo));
}

function erroComCodigo(codigo: string) {
  return (erro: unknown) => erro instanceof ErroDeDominio && erro.codigo === codigo;
}

describe('catálogo de permissões', () => {
  it('usa o formato modulo:acao e não repete permissões', () => {
    const vistas = new Set<string>();
    for (const permissao of TODAS_AS_PERMISSOES) {
      assert.match(permissao, /^[a-z_]+:[a-z_]+$/);
      assert.ok(!vistas.has(permissao), `permissão repetida: ${permissao}`);
      vistas.add(permissao);
    }
  });

  it('cobre todos os módulos de controle de acesso pedidos no prompt', () => {
    const exigidos = [
      'dashboard', 'eventos', 'clientes', 'fornecedores', 'financeiro', 'orcamentos',
      'contratos', 'documentos', 'equipe', 'configuracoes', 'relatorios',
    ];
    for (const modulo of exigidos) {
      assert.ok(modulo in CATALOGO_DE_PERMISSOES, `faltou o módulo ${modulo}`);
    }
  });

  it('não oferece exclusão no financeiro: lançamentos são cancelados ou estornados', () => {
    assert.equal(ehPermissaoValida('financeiro:excluir'), false);
    assert.equal(ehPermissaoValida('financeiro:estornar'), true);
  });
});

describe('papéis do sistema', () => {
  it('só declaram permissões do catálogo, sem repetição', () => {
    for (const papel of PAPEIS_DO_SISTEMA) {
      const validadas = validarPermissoes(papel.permissoes);
      assert.equal(validadas.length, papel.permissoes.length, `${papel.chave} repete permissões`);
    }
  });

  it('proprietário tem tudo; administrador tem tudo, menos gerenciar a assinatura', () => {
    assert.equal(permissoesDoPapel('proprietario').size, TODAS_AS_PERMISSOES.length);
    const administrador = permissoesDoPapel('administrador');
    const faltantes = TODAS_AS_PERMISSOES.filter((permissao) => !administrador.has(permissao));
    assert.deepEqual(faltantes, ['assinatura:gerenciar']);
  });

  it('só o proprietário gerencia a assinatura', () => {
    for (const papel of PAPEIS_DO_SISTEMA) {
      const gerencia = permissoesDoPapel(papel.chave).has('assinatura:gerenciar');
      assert.equal(gerencia, papel.chave === 'proprietario', papel.chave);
    }
  });

  it('só proprietário e administrador convidam usuários', () => {
    const quemConvida = PAPEIS_DO_SISTEMA
      .filter((papel) => permissoesDoPapel(papel.chave).has('equipe:convidar'))
      .map((papel) => papel.chave);
    assert.deepEqual(quemConvida, ['proprietario', 'administrador']);
  });

  it('visualizador só consulta', () => {
    for (const permissao of permissoesDoPapel('visualizador')) {
      assert.ok(permissao.endsWith(':ver'), `visualizador não deveria ter ${permissao}`);
    }
  });

  it('operacional não acessa dados comerciais, financeiros nem administrativos', () => {
    const proibidos = [
      'clientes', 'orcamentos', 'contratos', 'financeiro', 'relatorios',
      'equipe', 'configuracoes', 'auditoria', 'assinatura',
    ];
    for (const modulo of proibidos) {
      assert.deepEqual(comPrefixo('operacional', `${modulo}:`), [], modulo);
    }
  });

  it('financeiro baixa e estorna, mas não cria eventos nem edita clientes', () => {
    const permissoes = permissoesDoPapel('financeiro');
    assert.ok(temPermissao(permissoes, 'financeiro:baixar'));
    assert.ok(temPermissao(permissoes, 'financeiro:estornar'));
    assert.ok(!temPermissao(permissoes, 'eventos:criar'));
    assert.ok(!temPermissao(permissoes, 'clientes:editar'));
  });

  it('gerente de eventos cancela eventos e consulta o financeiro, sem baixar pagamentos', () => {
    const permissoes = permissoesDoPapel('gerente_de_eventos');
    assert.ok(temPermissao(permissoes, 'eventos:cancelar'));
    assert.ok(!temPermissao(permissoes, 'eventos:excluir'));
    assert.ok(temPermissao(permissoes, 'financeiro:ver'));
    assert.ok(!temPermissao(permissoes, 'financeiro:baixar'));
  });

  it('comercial conduz propostas e contratos, sem acesso ao financeiro', () => {
    const permissoes = permissoesDoPapel('comercial');
    assert.ok(temPermissao(permissoes, 'orcamentos:decidir'));
    assert.ok(temPermissao(permissoes, 'contratos:criar'));
    assert.deepEqual(comPrefixo('comercial', 'financeiro:'), []);
  });

  it('todos os papéis são coerentes: quem escreve num módulo também pode lê-lo', () => {
    for (const papel of PAPEIS_DO_SISTEMA) {
      assert.deepEqual(permissoesSemLeitura(papel.permissoes), [], papel.chave);
    }
  });
});

describe('validação de permissões e escalada de privilégio', () => {
  it('rejeita permissões desconhecidas', () => {
    assert.throws(
      () => validarPermissoes(['eventos:ver', 'financeiro:apagar_tudo']),
      erroComCodigo('PERMISSAO_DESCONHECIDA'),
    );
  });

  it('remove duplicatas ao validar', () => {
    assert.deepEqual(validarPermissoes(['eventos:ver', 'eventos:ver']), ['eventos:ver']);
  });

  it('administrador não concede o papel de proprietário', () => {
    const administrador = permissoesDoPapel('administrador');
    const proprietario = permissoesDoPapel('proprietario');
    assert.deepEqual(permissoesExcedentes(administrador, proprietario), ['assinatura:gerenciar']);
    assert.throws(
      () => exigirPodeConceder(administrador, proprietario),
      erroComCodigo('ESCALADA_DE_PRIVILEGIO'),
    );
  });

  it('gerente de eventos não concede permissões financeiras que não possui', () => {
    assert.throws(
      () => exigirPodeConceder(permissoesDoPapel('gerente_de_eventos'), permissoesDoPapel('financeiro')),
      erroComCodigo('ESCALADA_DE_PRIVILEGIO'),
    );
  });

  it('proprietário concede qualquer papel; administrador concede todos os demais', () => {
    for (const papel of PAPEIS_DO_SISTEMA) {
      exigirPodeConceder(permissoesDoPapel('proprietario'), permissoesDoPapel(papel.chave));
      if (papel.chave !== 'proprietario') {
        exigirPodeConceder(permissoesDoPapel('administrador'), permissoesDoPapel(papel.chave));
      }
    }
  });

  it('rejeita papel personalizado que escreve sem poder ler', () => {
    assert.deepEqual(permissoesSemLeitura(['financeiro:baixar', 'eventos:ver']), ['financeiro:baixar']);
    assert.throws(() => validarCoerencia(['financeiro:baixar']), erroComCodigo('PERMISSOES_INCOERENTES'));
    validarCoerencia(['financeiro:ver', 'financeiro:baixar']);
  });
});
