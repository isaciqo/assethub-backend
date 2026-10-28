// Comparação tolerante: "Sala 101 ", "sala 101" e "SALA 101" são o mesmo local.
// Sem isso, qualquer diferença de digitação na planilha vira uma divergência falsa.
function normalize(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function sameText(a, b) {
  return normalize(a) === normalize(b);
}

// Termos vindos do usuário vão pra dentro de $regex — escapa para evitar ReDoS,
// mesmo cuidado já aplicado nos repositórios do MEDagenda.
function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Plaquetas antigas às vezes são lidas com zeros à esquerda faltando ou com
// pontuação ("001.234" / "1234"). O código canônico guarda só o que foi importado,
// isto aqui serve para comparar.
function normalizeCode(code) {
  const compact = String(code ?? '').trim().toUpperCase().replace(/[\s.\-/]/g, '');
  return compact.replace(/^0+(?=.)/, '');
}

module.exports = { normalize, sameText, escapeRegex, normalizeCode };
