const { normalize } = require('./text');

// Estrutura do Tribunal: Comarca (unidade) → Setor (vara, gabinete, secretaria…)
// → Sala (opcional). O tipo do setor sai do próprio nome — a planilha oficial só
// traz o nome, e assim não há cadastro extra nem migração para manter.
const SECTOR_KINDS = ['vara', 'gabinete', 'juizado', 'secretaria', 'coordenadoria', 'almoxarifado', 'outro'];

const KIND_PATTERNS = [
  ['vara', /\bvara\b/],
  ['gabinete', /\bgabinete\b/],
  ['juizado', /\bjuizado\b/],
  ['secretaria', /\bsecretaria\b/],
  ['coordenadoria', /\bcoordenadoria\b|\bcoordenacao\b|\bdivisao\b|\bdepartamento\b|\bservico\b/],
  ['almoxarifado', /\balmoxarifado\b|\bdeposito\b/],
];

function sectorKind(name) {
  const n = normalize(name);
  const hit = KIND_PATTERNS.find(([, rx]) => rx.test(n));
  return hit ? hit[0] : 'outro';
}

module.exports = { SECTOR_KINDS, sectorKind };
