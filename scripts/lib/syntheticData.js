// Gerador DETERMINÍSTICO de bens fictícios. Nenhum dado real do TJPA é usado:
// nomes, números de tombamento, séries e valores são inventados.

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const TEMPLATES = [
  ['Computador desktop Dell OptiPlex 7090', 'Informática', 'Dell', 4200],
  ['Monitor LED 24" LG 24MK430H', 'Informática', 'LG', 890],
  ['Notebook Lenovo ThinkPad E14', 'Informática', 'Lenovo', 5600],
  ['Impressora multifuncional HP LaserJet M428', 'Informática', 'HP', 3100],
  ['Scanner de mesa Fujitsu fi-7160', 'Informática', 'Fujitsu', 6800],
  ['Nobreak SMS Station II 1400VA', 'Informática', 'SMS', 950],
  ['Switch gerenciável 24 portas', 'Rede e Telecom', 'TP-Link', 2300],
  ['Telefone IP Grandstream GXP1625', 'Rede e Telecom', 'Grandstream', 420],
  ['Câmera de videoconferência Logitech Rally', 'Audiovisual', 'Logitech', 7900],
  ['Projetor multimídia Epson PowerLite', 'Audiovisual', 'Epson', 3600],
  ['Cadeira giratória ergonômica com braços', 'Mobiliário', '', 780],
  ['Mesa de escritório em L 1,60 m', 'Mobiliário', '', 1150],
  ['Armário de aço 2 portas', 'Mobiliário', '', 980],
  ['Arquivo de aço 4 gavetas', 'Mobiliário', '', 860],
  ['Gaveteiro volante 3 gavetas', 'Mobiliário', '', 430],
  ['Longarina 3 lugares', 'Mobiliário', '', 690],
  ['Ar-condicionado split 18.000 BTUs', 'Climatização', 'Midea', 3200],
  ['Bebedouro industrial inox', 'Eletrodomésticos', 'IBBL', 1250],
  ['Frigobar 80 L', 'Eletrodomésticos', 'Electrolux', 1390],
];

const PEOPLE = [
  'Marcos Vinícius Rocha', 'Luciana Farias Cardoso', 'Antônio Carlos Brito', 'Fernanda Quaresma Lima',
  'Rodrigo Alves Monteiro', 'Elaine Cristina Barata', 'José Ribamar Teixeira', 'Cláudia Regina Souza',
  'Paulo Sérgio Amaral', 'Mariana Batista Correa', 'Edilson Pantoja Reis', 'Tatiane Moura Leão',
];

const CONSERVATION_PT = ['Ótimo', 'Bom', 'Bom', 'Bom', 'Regular', 'Regular', 'Ruim'];

const UNITS = [
  {
    code: 'FCB', name: 'Fórum Cível de Belém', city: 'Belém', region: 'capital', count: 70, start: 102000,
    rooms: ['Gabinete da 1ª Vara Cível', 'Secretaria da 1ª Vara Cível', 'Sala de Audiências 01', 'Sala de Audiências 02', 'Protocolo Geral', 'CPD - Sala de Servidores', 'Arquivo Setorial', 'Recepção'],
  },
  {
    code: 'SEDE', name: 'Prédio-Sede do TJPA', city: 'Belém', region: 'capital', count: 40, start: 100500,
    rooms: ['Secretaria de Administração', 'Coordenadoria de Patrimônio', 'Almoxarifado Central', 'Auditório', 'Sala de Reuniões 3º andar'],
  },
  {
    code: 'STM', name: 'Comarca de Santarém', city: 'Santarém', region: 'interior', count: 45, start: 230100,
    rooms: ['Gabinete da 2ª Vara', 'Secretaria Judicial', 'Sala de Audiências', 'Central de Mandados', 'Atendimento ao Público'],
  },
  {
    code: 'MAB', name: 'Comarca de Marabá', city: 'Marabá', region: 'interior', count: 35, start: 310400,
    rooms: ['Gabinete da Vara Criminal', 'Secretaria Unificada', 'Sala de Audiências', 'Plantão Judicial'],
  },
];

// Unidade que NÃO existe no seed — a planilha dela serve para demonstrar ao vivo
// a importação criando a unidade automaticamente.
const DEMO_IMPORT_UNIT = {
  code: 'SOU', name: 'Comarca de Soure (Marajó)', city: 'Soure', region: 'interior', count: 24, start: 410200,
  rooms: ['Secretaria Judicial', 'Gabinete', 'Sala de Audiências', 'Atendimento ao Público'],
};

function buildRows(unit, seed) {
  const r = rng(seed);
  const pick = list => list[Math.floor(r() * list.length)];
  const rows = [];
  for (let i = 0; i < unit.count; i += 1) {
    const [description, category, brand, baseValue] = pick(TEMPLATES);
    const year = 2016 + Math.floor(r() * 9);
    const month = 1 + Math.floor(r() * 12);
    rows.push({
      code: String(unit.start + i * 7 + Math.floor(r() * 5)).padStart(7, '0'),
      description,
      category,
      brand,
      serial: brand ? `${brand.slice(0, 3).toUpperCase()}${Math.floor(r() * 9e6 + 1e6)}` : '',
      unit: unit.name,
      location: pick(unit.rooms),
      responsible: pick(PEOPLE),
      conservation: pick(CONSERVATION_PT),
      acquisition: `${String(1 + Math.floor(r() * 27)).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`,
      value: (baseValue * (0.85 + r() * 0.3)).toFixed(2).replace('.', ','),
    });
  }
  return rows;
}

// Bens fixos usados nos roteiros de simulação (guia publicado). Entram no seed
// junto com os gerados, com tombamentos fora das faixas aleatórias.
const SCENARIO_ROWS = [
  { code: '0102990', description: 'Mouse óptico USB Logitech M90', category: 'Informática', brand: 'Logitech', serial: 'LOG1180032', unit: 'Fórum Cível de Belém', location: 'Gabinete da 1ª Vara Cível', responsible: 'Marcos Vinícius Rocha', conservation: 'Ruim', acquisition: '12/03/2021', value: '39,90' },
  { code: '0102991', description: 'Monitor LED 24" LG 24MK430H', category: 'Informática', brand: 'LG', serial: 'LG7730215', unit: 'Fórum Cível de Belém', location: 'Gabinete da 1ª Vara Cível', responsible: 'Antônio Carlos Brito', conservation: 'Bom', acquisition: '05/08/2022', value: '899,00' },
  { code: '0102992', description: 'Cadeira giratória ergonômica com braços', category: 'Mobiliário', brand: '', serial: '', unit: 'Fórum Cível de Belém', location: 'Sala de Audiências 01', responsible: 'Paulo Sérgio Amaral', conservation: 'Bom', acquisition: '17/02/2020', value: '780,00' },
  { code: '0102993', description: 'Impressora multifuncional HP LaserJet M428', category: 'Informática', brand: 'HP', serial: 'HPB4410987', unit: 'Fórum Cível de Belém', location: 'Protocolo Geral', responsible: 'Cláudia Regina Souza', conservation: 'Inservível', acquisition: '22/09/2017', value: '3.050,00' },
];

// "Chegada" de itens novos no almoxarifado — planilha para importar ao vivo.
const NEW_ARRIVAL_ROWS = [
  { code: '0100901', description: 'Monitor LED 27" Dell P2723D', category: 'Informática', brand: 'Dell', serial: 'DEL5512093', unit: 'Prédio-Sede do TJPA', location: 'Almoxarifado Central', responsible: 'Coordenadoria de Patrimônio', conservation: 'Novo', acquisition: '20/10/2026', value: '1.890,00' },
  { code: '0100902', description: 'Mouse óptico USB Logitech M90', category: 'Informática', brand: 'Logitech', serial: 'LOG2207741', unit: 'Prédio-Sede do TJPA', location: 'Almoxarifado Central', responsible: 'Coordenadoria de Patrimônio', conservation: 'Novo', acquisition: '20/10/2026', value: '45,00' },
  { code: '0100903', description: 'Cadeira giratória ergonômica com braços', category: 'Mobiliário', brand: '', serial: '', unit: 'Prédio-Sede do TJPA', location: 'Almoxarifado Central', responsible: 'Coordenadoria de Patrimônio', conservation: 'Novo', acquisition: '20/10/2026', value: '820,00' },
];

const SCENARIO_CODES = SCENARIO_ROWS.map(r => r.code);

// Cabeçalhos "do jeito que vem do sistema": acento, maiúscula, "Nº" — a
// importação reconhece sozinha.
const HEADERS = ['Nº Tombamento', 'Descrição do Bem', 'Categoria', 'Marca/Modelo', 'Nº de Série', 'Unidade', 'Localização', 'Responsável', 'Estado de Conservação', 'Data de Aquisição', 'Valor (R$)'];

function toCsv(rows) {
  const esc = v => (/[;"\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  const lines = rows.map(x => [x.code, x.description, x.category, x.brand, x.serial, x.unit, x.location, x.responsible, x.conservation, x.acquisition, x.value].map(esc).join(';'));
  return `﻿${[HEADERS.join(';'), ...lines].join('\r\n')}`;
}

module.exports = { UNITS, DEMO_IMPORT_UNIT, PEOPLE, SCENARIO_ROWS, NEW_ARRIVAL_ROWS, SCENARIO_CODES, buildRows, toCsv, rng };
