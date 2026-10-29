const ExcelJS = require('exceljs');
const { parse } = require('csv-parse/sync');
const { normalize } = require('../../lib/text');
const { CONSERVATION_STATUS } = require('../../lib/constants');

// Apelidos de coluna comuns em planilhas patrimoniais. A comparação é feita sem
// acento/caixa, então "Nº Patrimônio" e "numero patrimonio" caem no mesmo campo.
const FIELD_ALIASES = {
  code: ['tombamento', 'n tombamento', 'numero tombamento', 'numero de tombamento', 'patrimonio', 'n patrimonio', 'no patrimonio', 'numero patrimonio', 'numero patrimonial', 'plaqueta', 'tombo', 'codigo', 'cod', 'rp', 'registro patrimonial'],
  description: ['descricao', 'descricao do bem', 'bem', 'item', 'denominacao', 'especificacao', 'nome'],
  category: ['categoria', 'classe', 'grupo', 'tipo', 'natureza'],
  brand: ['marca', 'fabricante', 'modelo', 'marca/modelo'],
  serial_number: ['serie', 'n serie', 'numero de serie', 'numero serie', 'serial'],
  unit: ['comarca', 'unidade', 'predio', 'unidade gestora', 'orgao', 'forum'],
  // Setor: vara, gabinete, secretaria… ("lotação" no jargão do Tribunal).
  location: ['setor', 'lotacao', 'vara', 'gabinete', 'secretaria', 'departamento', 'localizacao', 'local'],
  room: ['sala', 'ambiente', 'sala/ambiente'],
  responsible_name: ['responsavel', 'detentor', 'carga', 'responsavel pela carga', 'servidor responsavel'],
  conservation_status: ['estado', 'estado de conservacao', 'conservacao', 'situacao fisica', 'condicao'],
  acquisition_date: ['data aquisicao', 'data de aquisicao', 'aquisicao', 'data incorporacao', 'data de incorporacao'],
  value: ['valor', 'valor aquisicao', 'valor de aquisicao', 'valor contabil', 'valor (r$)'],
  notes: ['observacao', 'observacoes', 'obs'],
};

const FIELDS = Object.keys(FIELD_ALIASES);

const CONSERVATION_ALIASES = {
  novo: ['novo', 'otimo', 'excelente', 'n'],
  bom: ['bom', 'b', 'bom estado'],
  regular: ['regular', 'r', 'razoavel', 'medio'],
  ruim: ['ruim', 'precario', 'danificado', 'avariado', 'p'],
  inservivel: ['inservivel', 'irrecuperavel', 'sucata', 'i', 'antieconomico', 'ocioso'],
};

class ImportParserService {
  async parse(buffer, fileName = '') {
    const lower = fileName.toLowerCase();
    if (lower.endsWith('.xlsx')) return this.parseXlsx(buffer);
    if (lower.endsWith('.csv') || lower.endsWith('.txt')) return this.parseCsv(buffer);
    // Sem extensão confiável: o "PK" do zip denuncia um xlsx.
    if (buffer[0] === 0x50 && buffer[1] === 0x4b) return this.parseXlsx(buffer);
    return this.parseCsv(buffer);
  }

  parseCsv(buffer) {
    let text = buffer.toString('utf8');
    // Planilha salva pelo Excel em pt-BR costuma vir em Latin-1: o caractere de
    // substituição denuncia, e aí relemos com a codificação certa.
    if (text.includes('�')) text = buffer.toString('latin1');
    text = text.replace(/^﻿/, '');

    const firstLine = text.split(/\r?\n/)[0] || '';
    const delimiter = [';', ',', '\t'].reduce((best, d) =>
      (firstLine.split(d).length > firstLine.split(best).length ? d : best), ';');

    const records = parse(text, {
      delimiter,
      columns: false,
      skip_empty_lines: true,
      relax_column_count: true,
      trim: true,
    });
    const [headers = [], ...rows] = records;
    return { headers: headers.map(h => String(h).trim()), rows };
  }

  async parseXlsx(buffer) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const sheet = workbook.worksheets[0];
    if (!sheet) return { headers: [], rows: [] };

    const all = [];
    sheet.eachRow({ includeEmpty: false }, row => {
      const values = [];
      for (let i = 1; i <= sheet.columnCount; i += 1) {
        values.push(this.cellToString(row.getCell(i).value));
      }
      all.push(values);
    });
    const [headers = [], ...rows] = all;
    return { headers: headers.map(h => String(h).trim()), rows };
  }

  cellToString(value) {
    if (value === null || value === undefined) return '';
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    if (typeof value === 'object') {
      if (value.richText) return value.richText.map(t => t.text).join('');
      if (value.text) return String(value.text);
      if (value.result !== undefined) return String(value.result);
    }
    return String(value).trim();
  }

  suggestMapping(headers) {
    const mapping = {};
    const used = new Set();
    FIELDS.forEach(field => {
      const aliases = FIELD_ALIASES[field];
      // Primeiro match exato, depois "contém" — "Descrição do Bem" acha description
      // sem que "Bem" sozinho roube a coluna de outro campo.
      let idx = headers.findIndex((h, i) => !used.has(i) && aliases.includes(normalize(h)));
      if (idx === -1) {
        idx = headers.findIndex((h, i) => !used.has(i) && aliases.some(a => a.length > 3 && normalize(h).includes(a)));
      }
      if (idx !== -1) {
        mapping[field] = headers[idx];
        used.add(idx);
      }
    });
    return mapping;
  }

  normalizeConservation(value) {
    const v = normalize(value);
    if (!v) return null;
    const hit = Object.entries(CONSERVATION_ALIASES).find(([, aliases]) => aliases.includes(v));
    if (hit) return hit[0];
    return CONSERVATION_STATUS.find(s => v.startsWith(s)) || null;
  }

  parseNumber(value) {
    if (value === undefined || value === null || value === '') return null;
    // Aceita "1.234,56" (pt-BR) e "1234.56".
    const raw = String(value).replace(/[R$\s]/g, '');
    const n = raw.includes(',') ? Number(raw.replace(/\./g, '').replace(',', '.')) : Number(raw);
    return Number.isFinite(n) ? n : null;
  }

  parseDate(value) {
    if (!value) return null;
    const s = String(value).trim();
    const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    const d = br ? new Date(Number(br[3]), Number(br[2]) - 1, Number(br[1])) : new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  // Converte as linhas cruas em registros do domínio + lista de erros por linha
  // (linha da planilha, contando o cabeçalho, para a pessoa achar fácil no Excel).
  mapRows({ headers, rows }, mapping) {
    const index = {};
    Object.entries(mapping).forEach(([field, header]) => {
      const i = headers.indexOf(header);
      if (i !== -1) index[field] = i;
    });

    const records = [];
    const errors = [];
    const seenCodes = new Map();

    rows.forEach((row, i) => {
      const line = i + 2;
      const get = field => (index[field] !== undefined ? String(row[index[field]] ?? '').trim() : '');
      if (row.every(cell => !String(cell ?? '').trim())) return;

      const code = get('code');
      const description = get('description');
      if (!code) { errors.push({ line, message: 'Número de tombamento vazio' }); return; }
      if (!description) { errors.push({ line, code, message: 'Descrição vazia' }); return; }

      const dupKey = code.toUpperCase();
      if (seenCodes.has(dupKey)) {
        errors.push({ line, code, message: `Tombamento repetido na planilha (já aparece na linha ${seenCodes.get(dupKey)})` });
        return;
      }
      seenCodes.set(dupKey, line);

      const rawConservation = get('conservation_status');
      const conservation = this.normalizeConservation(rawConservation);

      records.push({
        line,
        code,
        description,
        category: get('category') || 'Outros',
        brand: get('brand'),
        serial_number: get('serial_number'),
        unit: get('unit'),
        location: get('location'),
        room: get('room'),
        responsible_name: get('responsible_name'),
        conservation_status: conservation || 'bom',
        conservation_warning: rawConservation && !conservation ? rawConservation : null,
        acquisition_date: this.parseDate(get('acquisition_date')),
        value: this.parseNumber(get('value')),
        notes: get('notes'),
      });
    });

    return { records, errors };
  }
}

ImportParserService.FIELDS = FIELDS;

module.exports = ImportParserService;
