const sqlite3 = require('sqlite3').verbose();

const REQUIRED_COLUMNS = {
  telefone: 'TEXT',
  whatsapp_cliente: 'TEXT',
  nome: 'TEXT',
  itens: 'TEXT',
  subtotal: 'REAL DEFAULT 0',
  taxa_entrega: 'REAL DEFAULT 0',
  total: 'REAL',
  pagamento: 'TEXT',
  valor_pago: 'REAL DEFAULT 0',
  troco: 'REAL DEFAULT 0',
  endereco: 'TEXT',
  observacao: 'TEXT',
  message_id: 'TEXT',
  dataHora: 'TEXT'
};

function run(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function callback(error) {
      if (error) reject(error);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

function get(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => (error ? reject(error) : resolve(row)));
  });
}

function all(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (error, rows) => (error ? reject(error) : resolve(rows)));
  });
}

async function createDatabase(dbPath) {
  const db = new sqlite3.Database(dbPath);
  await run(db, `
    CREATE TABLE IF NOT EXISTS pedidos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telefone TEXT,
      whatsapp_cliente TEXT,
      nome TEXT,
      itens TEXT,
      subtotal REAL DEFAULT 0,
      taxa_entrega REAL DEFAULT 0,
      total REAL,
      pagamento TEXT,
      valor_pago REAL DEFAULT 0,
      troco REAL DEFAULT 0,
      endereco TEXT,
      observacao TEXT,
      message_id TEXT,
      dataHora TEXT
    )
  `);

  const columns = await all(db, 'PRAGMA table_info(pedidos)');
  const existing = new Set(columns.map(column => column.name));
  for (const [name, definition] of Object.entries(REQUIRED_COLUMNS)) {
    if (!existing.has(name)) await run(db, `ALTER TABLE pedidos ADD COLUMN ${name} ${definition}`);
  }
  await run(db, 'CREATE UNIQUE INDEX IF NOT EXISTS idx_pedidos_message_id ON pedidos(message_id)');

  return {
    async saveOrder(phone, order, messageId) {
      try {
        const result = await run(db, `
          INSERT INTO pedidos (
            telefone, whatsapp_cliente, nome, itens, subtotal, taxa_entrega,
            total, pagamento, valor_pago, troco, endereco, observacao,
            message_id, dataHora
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now','localtime'))
        `, [
          phone,
          order.customerWhatsapp,
          order.name,
          JSON.stringify(order.items),
          order.subtotal,
          order.deliveryFee,
          order.total,
          order.payment,
          order.paidAmount,
          order.change,
          JSON.stringify(order.address),
          order.address?.observation || '',
          messageId
        ]);
        return { duplicate: false, id: result.id };
      } catch (error) {
        if (error.code === 'SQLITE_CONSTRAINT') return { duplicate: true, id: null };
        throw error;
      }
    },

    async salesReport(day = 'today') {
      const modifier = day === 'yesterday' ? "'-1 day'" : "'0 day'";
      const total = await get(db, `
        SELECT IFNULL(SUM(total), 0) AS total
        FROM pedidos
        WHERE date(dataHora) = date('now', ${modifier}, 'localtime')
      `);
      const customers = await all(db, `
        SELECT nome, SUM(total) AS total
        FROM pedidos
        WHERE date(dataHora) = date('now', ${modifier}, 'localtime')
        GROUP BY nome ORDER BY total DESC LIMIT 3
      `);
      const sitios = await all(db, `
        SELECT json_extract(endereco, '$.sitio') AS sitio, COUNT(*) AS quantidade
        FROM pedidos
        WHERE date(dataHora) = date('now', ${modifier}, 'localtime')
        GROUP BY sitio ORDER BY quantidade DESC LIMIT 3
      `);
      return { total: Number(total.total || 0), customers, sitios };
    },

    close() {
      return new Promise((resolve, reject) => db.close(error => (error ? reject(error) : resolve())));
    }
  };
}

module.exports = { createDatabase };
