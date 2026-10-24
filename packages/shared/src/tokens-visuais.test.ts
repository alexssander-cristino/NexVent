import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ErroDeDominio } from './erros.ts';
import {
  CONTRASTE_MINIMO_COMPONENTE,
  CONTRASTE_MINIMO_TEXTO,
  TEMAS,
  corDeTextoSobre,
  gerarCss,
  lerHex,
  razaoDeContraste,
} from './tokens-visuais.ts';
import type { NomeDoTema, TokensDoTema } from './tokens-visuais.ts';

const temas: NomeDoTema[] = ['claro', 'escuro'];

function exigir(tema: NomeDoTema, frente: keyof TokensDoTema, fundo: keyof TokensDoTema, minimo: number) {
  const cores = TEMAS[tema];
  const razao = razaoDeContraste(cores[frente], cores[fundo]);
  assert.ok(
    razao >= minimo,
    `tema ${tema}: ${frente} (${cores[frente]}) sobre ${fundo} (${cores[fundo]}) = ${razao.toFixed(2)}:1, mínimo ${minimo}:1`,
  );
}

describe('contraste WCAG AA dos temas', () => {
  for (const tema of temas) {
    it(`textos são legíveis sobre fundo e superfície (${tema})`, () => {
      for (const fundo of ['fundo', 'superficie'] as const) {
        exigir(tema, 'texto', fundo, CONTRASTE_MINIMO_TEXTO);
        exigir(tema, 'textoSecundario', fundo, CONTRASTE_MINIMO_TEXTO);
        exigir(tema, 'primariaTexto', fundo, CONTRASTE_MINIMO_TEXTO);
      }
    });

    it(`texto do botão primário é legível, inclusive no hover (${tema})`, () => {
      exigir(tema, 'textoSobrePrimaria', 'primaria', CONTRASTE_MINIMO_TEXTO);
      exigir(tema, 'textoSobrePrimaria', 'primariaHover', CONTRASTE_MINIMO_TEXTO);
    });

    it(`sucesso, perigo e alerta são legíveis na superfície e nos próprios selos (${tema})`, () => {
      const pares = [
        ['sucesso', 'sucessoFundo'],
        ['perigo', 'perigoFundo'],
        ['alerta', 'alertaFundo'],
      ] as const;
      for (const [cor, fundoDoSelo] of pares) {
        exigir(tema, cor, 'superficie', CONTRASTE_MINIMO_TEXTO);
        exigir(tema, cor, fundoDoSelo, CONTRASTE_MINIMO_TEXTO);
      }
    });

    it(`bordas de campos, destaque e marca têm 3:1 contra o fundo (${tema})`, () => {
      for (const fundo of ['fundo', 'superficie'] as const) {
        exigir(tema, 'bordaCampo', fundo, CONTRASTE_MINIMO_COMPONENTE);
        exigir(tema, 'destaque', fundo, CONTRASTE_MINIMO_COMPONENTE);
        exigir(tema, 'primaria', fundo, CONTRASTE_MINIMO_COMPONENTE);
      }
    });
  }
});

describe('ajustes sobre a paleta sugerida no prompt', () => {
  it('o texto secundário original (#77778F) não chega a 4,5:1 e foi substituído', () => {
    assert.ok(razaoDeContraste('#77778F', '#FFFFFF') < CONTRASTE_MINIMO_TEXTO);
    assert.ok(razaoDeContraste('#77778F', '#F7F7FC') < CONTRASTE_MINIMO_TEXTO);
    assert.notEqual(TEMAS.claro.textoSecundario, '#77778F');
  });

  it('o ciano original (#22D3EE) é fraco sobre fundo claro e fica só no tema escuro', () => {
    assert.ok(razaoDeContraste('#22D3EE', '#FFFFFF') < CONTRASTE_MINIMO_COMPONENTE);
    assert.equal(TEMAS.escuro.destaque, '#22D3EE');
    assert.notEqual(TEMAS.claro.destaque, '#22D3EE');
  });

  it('mantém as demais cores sugeridas', () => {
    assert.equal(TEMAS.claro.primaria, '#7965D8');
    assert.equal(TEMAS.claro.primariaHover, '#5B46B8');
    assert.equal(TEMAS.claro.fundo, '#F7F7FC');
    assert.equal(TEMAS.claro.superficie, '#FFFFFF');
    assert.equal(TEMAS.claro.texto, '#202033');
    assert.equal(TEMAS.escuro.fundo, '#11111B');
    assert.equal(TEMAS.escuro.superficie, '#1A1A29');
  });
});

describe('funções de cor', () => {
  it('calcula razões de contraste conhecidas', () => {
    assert.ok(Math.abs(razaoDeContraste('#000000', '#FFFFFF') - 21) < 0.001);
    assert.ok(Math.abs(razaoDeContraste('#777777', '#FFFFFF') - 4.48) < 0.01);
  });

  it('aceita #RGB e #RRGGBB e rejeita o resto', () => {
    assert.deepEqual(lerHex('#fff'), [255, 255, 255]);
    assert.deepEqual(lerHex('#7965D8'), [121, 101, 216]);
    for (const invalida of ['azul', '#12345', '#GGGGGG', '7965D8', '']) {
      assert.throws(
        () => lerHex(invalida),
        (erro: unknown) => erro instanceof ErroDeDominio && erro.codigo === 'COR_INVALIDA',
        invalida,
      );
    }
  });

  it('escolhe o texto de melhor contraste para a cor da marca de uma empresa', () => {
    const roxo = corDeTextoSobre('#7965D8');
    assert.equal(roxo.cor, '#FFFFFF');
    assert.equal(roxo.atendeAA, true);
    assert.equal(corDeTextoSobre('#FFE066').cor, '#202033');
  });

  it('avisa quando nenhuma opção atinge 4,5:1 (tom médio)', () => {
    assert.equal(corDeTextoSobre('#808080').atendeAA, false);
  });
});

describe('CSS gerado', () => {
  it('css/tokens.css está em sincronia com tokens-visuais.ts (rode: npm run tokens -w @nexvent/shared)', () => {
    const emDisco = readFileSync(new URL('../css/tokens.css', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
    assert.equal(emDisco, gerarCss());
  });

  it('define as mesmas variáveis nos dois temas e respeita a escolha explícita do usuário', () => {
    assert.deepEqual(Object.keys(TEMAS.claro).sort(), Object.keys(TEMAS.escuro).sort());
    const css = gerarCss();
    assert.match(css, /--nx-texto-secundario: #6E6E88;/);
    assert.match(css, /:root\[data-tema="escuro"\]/);
    assert.match(css, /@media \(prefers-color-scheme: dark\)[\s\S]*:root:not\(\[data-tema\]\)/);
  });
});
