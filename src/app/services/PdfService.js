const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');

// Paleta da marca (cerâmica marajoara): argila, caulim, jenipapo, ocre.
const C = {
  clay: '#8E3B22',
  urucum: '#C4532D',
  kaolin: '#F6EEE1',
  ink: '#1F2230',
  ochre: '#C99A3B',
  muted: '#6B5E55',
  line: '#D9C8B0',
};

const LABELS = {
  conservation: { novo: 'Novo', bom: 'Bom', regular: 'Regular', ruim: 'Ruim', inservivel: 'Inservível' },
  status: {
    aguardando_aprovacao: 'Aguardando aprovação',
    aprovada: 'Aprovada',
    em_transito: 'Em trânsito',
    com_pendencia: 'Com pendência',
    concluida: 'Concluída',
    rejeitada: 'Rejeitada',
    cancelada: 'Cancelada',
  },
  approval: { pendente: 'Pendente', aprovada: 'Aprovada', rejeitada: 'Rejeitada' },
};

const fmtDate = d => (d ? new Date(d).toLocaleString('pt-BR', { timeZone: 'America/Belem' }) : '—');

function collect(doc) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
}

// Faixa geométrica inspirada nos frisos escalonados da cerâmica marajoara.
function band(doc, y, width) {
  const step = 12;
  doc.save();
  doc.rect(0, y, width, 18).fill(C.clay);
  doc.fillColor(C.kaolin);
  for (let x = 0; x < width; x += step * 2) {
    doc.polygon([x, y + 18], [x, y + 9], [x + step / 2, y + 9], [x + step / 2, y + 4], [x + step, y + 4], [x + step, y + 18]).fill();
  }
  doc.restore();
}

function header(doc, title, subtitle) {
  const W = doc.page.width;
  band(doc, 0, W);
  doc.fillColor(C.ink).font('Helvetica-Bold').fontSize(9)
    .text('TRIBUNAL DE JUSTIÇA DO ESTADO DO PARÁ · PATRIMÔNIO ÁGIL', 40, 32, { characterSpacing: 1 });
  doc.fillColor(C.clay).font('Helvetica-Bold').fontSize(16).text(title, 40, 48);
  if (subtitle) doc.fillColor(C.muted).font('Helvetica').fontSize(9).text(subtitle, 40, 70);
  doc.moveTo(40, 86).lineTo(W - 40, 86).strokeColor(C.line).lineWidth(1).stroke();
  doc.y = 96;
}

function sectionTitle(doc, text) {
  ensureSpace(doc, 40);
  doc.moveDown(0.6);
  const y = doc.y;
  doc.rect(40, y, 4, 12).fill(C.urucum);
  doc.fillColor(C.ink).font('Helvetica-Bold').fontSize(10.5).text(text.toUpperCase(), 50, y + 1, { characterSpacing: 0.6 });
  doc.moveDown(0.4);
}

function ensureSpace(doc, needed) {
  if (doc.y + needed > doc.page.height - 60) doc.addPage();
}

function keyValue(doc, pairs, cols = 2) {
  const W = doc.page.width - 80;
  const colW = W / cols;
  for (let i = 0; i < pairs.length; i += cols) {
    ensureSpace(doc, 30);
    const y = doc.y;
    let maxH = 0;
    pairs.slice(i, i + cols).forEach(([k, v], j) => {
      const x = 40 + j * colW;
      doc.fillColor(C.muted).font('Helvetica').fontSize(7.5).text(k.toUpperCase(), x, y, { width: colW - 10 });
      doc.fillColor(C.ink).font('Helvetica-Bold').fontSize(9.5).text(v || '—', x, y + 10, { width: colW - 10 });
      maxH = Math.max(maxH, doc.y - y);
    });
    doc.y = y + maxH + 6;
  }
}

function table(doc, columns, rows) {
  const W = doc.page.width - 80;
  const totalWeight = columns.reduce((s, c) => s + (c.weight || 1), 0);
  const widths = columns.map(c => (W * (c.weight || 1)) / totalWeight);

  const drawHeader = () => {
    const y = doc.y;
    doc.rect(40, y, W, 16).fill(C.ink);
    let x = 40;
    columns.forEach((c, i) => {
      doc.fillColor(C.kaolin).font('Helvetica-Bold').fontSize(7.5).text(c.header, x + 4, y + 4, { width: widths[i] - 8 });
      x += widths[i];
    });
    doc.y = y + 16;
  };

  drawHeader();
  rows.forEach((row, r) => {
    const heights = columns.map((c, i) => doc.font('Helvetica').fontSize(8).heightOfString(String(row[c.key] ?? '—'), { width: widths[i] - 8 }));
    const h = Math.max(...heights) + 8;
    if (doc.y + h > doc.page.height - 60) { doc.addPage(); drawHeader(); }
    const y = doc.y;
    if (r % 2 === 0) doc.rect(40, y, W, h).fill(C.kaolin);
    let x = 40;
    columns.forEach((c, i) => {
      doc.fillColor(C.ink).font('Helvetica').fontSize(8).text(String(row[c.key] ?? '—'), x + 4, y + 4, { width: widths[i] - 8 });
      x += widths[i];
    });
    doc.y = y + h;
  });
  doc.moveDown(0.3);
}

function footer(doc, text) {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i += 1) {
    doc.switchToPage(i);
    // Sem zerar a margem, escrever abaixo dela faz o pdfkit abrir uma página em branco.
    doc.page.margins.bottom = 0;
    const y = doc.page.height - 36;
    doc.moveTo(40, y - 6).lineTo(doc.page.width - 40, y - 6).strokeColor(C.line).lineWidth(0.5).stroke();
    doc.fillColor(C.muted).font('Helvetica').fontSize(7)
      .text(text, 40, y, { width: doc.page.width - 160, lineBreak: false })
      .text(`Página ${i + 1} de ${range.count}`, doc.page.width - 120, y, { width: 80, align: 'right', lineBreak: false });
  }
}

class PdfService {
  async movementTerm({ movement, assets, units, users, events, signatures, photos, chain, verifyUrl }) {
    const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true, info: { Title: `Termo ${movement.number}` } });
    const done = collect(doc);
    const unitName = id => units[id]?.name || id;
    const userName = id => (users[id] ? `${users[id].name}${users[id].registration ? ` (mat. ${users[id].registration})` : ''}` : '—');
    const isFinal = movement.status === 'concluida';

    header(
      doc,
      isFinal ? 'Termo de Entrega e Recebimento de Bens' : 'Espelho de Movimentação Patrimonial',
      `${movement.number} · ${movement.typeLabel} · Situação: ${LABELS.status[movement.status] || movement.status}`,
    );

    sectionTitle(doc, 'Movimentação');
    keyValue(doc, [
      ['Número', movement.number],
      ['Tipo', movement.typeLabel],
      ['Origem', `${unitName(movement.origin.unit_id)}${movement.origin.location ? ` — ${movement.origin.location}` : ''}`],
      ['Destino', `${unitName(movement.destination.unit_id)}${movement.destination.location ? ` — ${movement.destination.location}` : ''}`],
      ['Responsável na origem', movement.origin.responsible_name],
      ['Responsável no destino', movement.destination.responsible_name],
      ['Solicitada por', userName(movement.requested_by)],
      ['Aberta em', fmtDate(movement.createdAt)],
    ]);
    keyValue(doc, [['Motivo', movement.reason]], 1);

    sectionTitle(doc, `Bens movimentados (${assets.length})`);
    const deliveryCond = Object.fromEntries((movement.delivery?.conditions || []).map(c => [c.asset_id, c.condition]));
    const receiptCond = Object.fromEntries((movement.receipt?.conditions || []).map(c => [c.asset_id, c.condition]));
    table(doc, [
      { key: 'code', header: 'TOMBAMENTO', weight: 1.1 },
      { key: 'description', header: 'DESCRIÇÃO', weight: 3 },
      { key: 'delivery', header: 'NA ENTREGA', weight: 1 },
      { key: 'receipt', header: 'NO RECEBIMENTO', weight: 1.2 },
    ], assets.map(a => ({
      code: a.code,
      description: `${a.description}${a.serial_number ? ` · S/N ${a.serial_number}` : ''}`,
      delivery: LABELS.conservation[deliveryCond[a.asset_id]] || '—',
      receipt: LABELS.conservation[receiptCond[a.asset_id]] || '—',
    })));

    if (movement.carrier?.company) {
      sectionTitle(doc, 'Transporte');
      keyValue(doc, [
        ['Empresa', movement.carrier.company],
        ['Motorista', movement.carrier.driver_name],
        ['Documento', movement.carrier.driver_document],
        ['Placa', movement.carrier.vehicle_plate],
      ]);
    }

    if (movement.approvals?.length) {
      sectionTitle(doc, 'Aprovações');
      table(doc, [
        { key: 'who', header: 'APROVADOR(A)', weight: 2.2 },
        { key: 'status', header: 'DECISÃO', weight: 1 },
        { key: 'at', header: 'DATA', weight: 1.3 },
        { key: 'note', header: 'OBSERVAÇÃO', weight: 2 },
      ], movement.approvals.map(a => ({
        who: userName(a.user_id),
        status: LABELS.approval[a.status],
        at: fmtDate(a.decided_at),
        note: a.note || '—',
      })));
    }

    sectionTitle(doc, 'Entrega e recebimento');
    const sigBox = (title, handover, personId, sig) => {
      const x = title === 'Entrega' ? 40 : doc.page.width / 2 + 5;
      const w = doc.page.width / 2 - 45;
      const y = doc.y;
      doc.roundedRect(x, y, w, 128, 6).strokeColor(C.line).lineWidth(1).stroke();
      doc.fillColor(C.clay).font('Helvetica-Bold').fontSize(9).text(title.toUpperCase(), x + 10, y + 8);
      doc.fillColor(C.ink).font('Helvetica').fontSize(8)
        .text(`Designado(a): ${userName(personId)}`, x + 10, y + 22, { width: w - 20 })
        .text(`Confirmado em: ${fmtDate(handover?.at)}`, x + 10, y + 34, { width: w - 20 });
      if (sig?.data) {
        try {
          doc.image(sig.data, x + 10, y + 48, { fit: [w - 20, 52], align: 'center' });
        } catch { /* assinatura em formato que o pdfkit não lê — segue sem a imagem */ }
      } else {
        doc.fillColor(C.muted).fontSize(8).text('Sem assinatura registrada', x + 10, y + 70, { width: w - 20, align: 'center' });
      }
      doc.moveTo(x + 10, y + 104).lineTo(x + w - 10, y + 104).strokeColor(C.muted).lineWidth(0.5).stroke();
      doc.fillColor(C.muted).fontSize(7).text(
        handover?.signer_name ? `${handover.signer_name}${sig ? ` · sha256 ${sig.sha256.slice(0, 16)}…` : ''}` : ' ',
        x + 10, y + 108, { width: w - 20, align: 'center' },
      );
    };
    ensureSpace(doc, 140);
    const yBoxes = doc.y;
    sigBox('Entrega', movement.delivery, movement.deliverer_id, signatures.delivery);
    doc.y = yBoxes;
    sigBox('Recebimento', movement.receipt, movement.receiver_id, signatures.receipt);
    doc.y = yBoxes + 136;

    const notes = [
      movement.delivery?.notes && `Entrega: ${movement.delivery.notes}`,
      movement.receipt?.notes && `Recebimento: ${movement.receipt.notes}`,
      movement.receipt?.has_issue && `OCORRÊNCIA no recebimento: ${movement.receipt.issue_description}`,
      movement.issue_resolution?.resolved_at && `Ocorrência tratada: ${movement.issue_resolution.note}`,
    ].filter(Boolean);
    if (notes.length) {
      doc.fillColor(C.ink).font('Helvetica').fontSize(8.5);
      notes.forEach(n => doc.text(`• ${n}`, 40, doc.y, { width: doc.page.width - 80 }));
    }

    if (photos.length) {
      sectionTitle(doc, `Evidências fotográficas (${photos.length})`);
      table(doc, [
        { key: 'stage', header: 'ETAPA', weight: 1 },
        { key: 'by', header: 'REGISTRADA POR', weight: 2 },
        { key: 'at', header: 'DATA', weight: 1.3 },
        { key: 'hash', header: 'SHA-256 DO ARQUIVO', weight: 3 },
      ], photos.map(p => ({ stage: p.stage, by: p.created_by_name, at: fmtDate(p.createdAt), hash: p.sha256 })));
    }

    sectionTitle(doc, 'Histórico auditável');
    table(doc, [
      { key: 'seq', header: '#', weight: 0.4 },
      { key: 'at', header: 'DATA', weight: 1.4 },
      { key: 'summary', header: 'EVENTO', weight: 3.4 },
      { key: 'hash', header: 'HASH', weight: 1.4 },
    ], events.map(e => ({ seq: e.seq, at: fmtDate(e.occurred_at), summary: `${e.summary} — ${e.performed_by_name}${e.acted_as === 'admin' ? ' (como administrador)' : ''}`, hash: `${e.hash.slice(0, 12)}…` })));

    // Bloco de integridade com QR de verificação pública.
    ensureSpace(doc, 120);
    const y = doc.y + 6;
    doc.roundedRect(40, y, doc.page.width - 80, 104, 8).fill(C.kaolin);
    const qr = await QRCode.toBuffer(verifyUrl, { margin: 1, width: 180, color: { dark: C.ink, light: C.kaolin } });
    doc.image(qr, 50, y + 8, { width: 88 });
    doc.fillColor(C.clay).font('Helvetica-Bold').fontSize(10).text('Verificação de integridade', 150, y + 12);
    doc.fillColor(C.ink).font('Helvetica').fontSize(8)
      .text(`Cadeia de eventos: ${chain.valid ? 'ÍNTEGRA' : `QUEBRADA no evento #${chain.brokenAt}`}`, 150, y + 28)
      .text('Hash da cadeia (SHA-256):', 150, y + 40)
      .font('Courier').fontSize(7.5).text(chain.head || '—', 150, y + 51, { width: doc.page.width - 200 })
      .font('Helvetica').fontSize(7.5)
      .text(`Aponte a câmera para o QR Code ou acesse: ${verifyUrl}`, 150, y + 72, { width: doc.page.width - 200 });

    footer(doc, 'A assinatura desenhada em tela registra a confirmação da etapa; a validade jurídica depende do método de assinatura adotado pelo TJPA.');
    doc.end();
    return done;
  }

  async inventoryReport({ inventory, unit, summary, discrepancies, byLocation }) {
    const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true, info: { Title: `Relatório ${inventory.number}` } });
    const done = collect(doc);

    header(doc, 'Relatório de Inventário Patrimonial', `${inventory.number} · ${inventory.name} · ${unit?.name || ''}`);

    sectionTitle(doc, 'Resumo');
    keyValue(doc, [
      ['Bens previstos', String(summary.expected)],
      ['Conferidos', `${summary.checked} (${summary.progress}%)`],
      ['Sem divergência', String(summary.ok)],
      ['Com divergência', String(summary.divergent)],
      ['Não localizados', String(summary.notFound)],
      ['Não cadastrados / outra unidade', `${summary.notRegistered} / ${summary.otherUnit}`],
      ['Tempo médio por bem', summary.avgSeconds ? `${summary.avgSeconds.toFixed(1)} s` : '—'],
      ['Conferências feitas offline', String(summary.offline)],
      ['Início', fmtDate(inventory.started_at)],
      ['Encerramento', fmtDate(inventory.completed_at)],
    ]);

    if (byLocation.length) {
      sectionTitle(doc, 'Progresso por sala/setor');
      table(doc, [
        { key: 'location', header: 'LOCAL', weight: 3 },
        { key: 'expected', header: 'PREVISTOS', weight: 1 },
        { key: 'checked', header: 'CONFERIDOS', weight: 1 },
        { key: 'pct', header: '%', weight: 0.7 },
      ], byLocation.map(l => ({ ...l, pct: `${l.expected ? Math.round((l.checked / l.expected) * 100) : 0}%` })));
    }

    sectionTitle(doc, `Pendências (${discrepancies.length})`);
    if (!discrepancies.length) {
      doc.fillColor(C.muted).font('Helvetica').fontSize(9).text('Nenhuma pendência registrada.');
    } else {
      table(doc, [
        { key: 'code', header: 'TOMBAMENTO', weight: 1.1 },
        { key: 'type', header: 'TIPO', weight: 1.6 },
        { key: 'detail', header: 'CADASTRO × CAMPO', weight: 3 },
        { key: 'status', header: 'SITUAÇÃO', weight: 1.4 },
      ], discrepancies);
    }

    footer(doc, `Gerado em ${fmtDate(new Date())} pelo Patrimônio Ágil.`);
    doc.end();
    return done;
  }
}

PdfService.LABELS = LABELS;

module.exports = PdfService;
