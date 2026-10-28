const ExcelJS = require('exceljs');

// Exportação em formatos simples, como pede o edital (CSV ou planilha).
// columns: [{ key, header, width? }]
class ExportService {
  toCsv(columns, rows) {
    const escape = v => {
      const s = v === null || v === undefined ? '' : String(v);
      return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [
      columns.map(c => escape(c.header)).join(';'),
      ...rows.map(r => columns.map(c => escape(r[c.key])).join(';')),
    ];
    // BOM + ";" — o Excel em pt-BR abre direto, com acentos e colunas certas.
    return Buffer.from(`﻿${lines.join('\r\n')}`, 'utf8');
  }

  // sheets: [{ name, columns, rows }]
  async toXlsx(sheets, { title = 'Patrimônio Ágil' } = {}) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = title;
    workbook.created = new Date();

    sheets.forEach(({ name, columns, rows }) => {
      const sheet = workbook.addWorksheet(name.slice(0, 31));
      sheet.columns = columns.map(c => ({ header: c.header, key: c.key, width: c.width || 18 }));
      rows.forEach(r => sheet.addRow(r));
      const header = sheet.getRow(1);
      header.font = { bold: true, color: { argb: 'FFF6EEE1' } };
      header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF8E3B22' } };
      sheet.views = [{ state: 'frozen', ySplit: 1 }];
      if (rows.length) sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
    });

    return Buffer.from(await workbook.xlsx.writeBuffer());
  }
}

module.exports = ExportService;
