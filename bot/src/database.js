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
  await run(db, 'PRAGMA busy_timeout = 5000');
  await run(db, 'PRAGMA journal_mode = WAL');
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
  await run(db, `
    CREATE TABLE IF NOT EXISTS configuracoes (
      chave TEXT PRIMARY KEY,
      valor TEXT NOT NULL,
      atualizado_em TEXT NOT NULL
    )
  `);
  await run(db, `
    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nivel TEXT NOT NULL,
      origem TEXT NOT NULL,
      mensagem TEXT NOT NULL,
      dataHora TEXT NOT NULL
    )
  `);
  await run(db, `
    CREATE TABLE IF NOT EXISTS mensagens_processadas (
      message_id TEXT PRIMARY KEY,
      telefone TEXT,
      tipo TEXT,
      dataHora TEXT NOT NULL
    )
  `);
  await run(db, `
    CREATE TABLE IF NOT EXISTS clientes_fiados (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      valor REAL NOT NULL,
      observacao TEXT,
      status TEXT NOT NULL DEFAULT 'aberto',
      dataHora TEXT NOT NULL,
      pago_em TEXT
    )
  `);

  const columns = await all(db, 'PRAGMA table_info(pedidos)');
  const existing = new Set(columns.map(column => column.name));
  for (const [name, definition] of Object.entries(REQUIRED_COLUMNS)) {
    if (!existing.has(name)) await run(db, `ALTER TABLE pedidos ADD COLUMN ${name} ${definition}`);
  }
  await run(db, 'CREATE UNIQUE INDEX IF NOT EXISTS idx_pedidos_message_id ON pedidos(message_id)');
  await run(db, 'CREATE INDEX IF NOT EXISTS idx_pedidos_dataHora ON pedidos(dataHora)');
  await run(db, 'CREATE INDEX IF NOT EXISTS idx_logs_dataHora ON logs(dataHora)');
  await run(db, 'CREATE INDEX IF NOT EXISTS idx_mensagens_processadas_dataHora ON mensagens_processadas(dataHora)');
  await run(db, 'CREATE INDEX IF NOT EXISTS idx_clientes_fiados_dataHora ON clientes_fiados(dataHora)');
  await run(db, 'CREATE INDEX IF NOT EXISTS idx_clientes_fiados_status ON clientes_fiados(status)');
  await run(db, "DELETE FROM mensagens_processadas WHERE dataHora < datetime('now', '-30 days', 'localtime')");

  let claimedMessageCount = 0;

  return {
    async claimIncomingMessage(messageId, phone = '', type = '') {
      const normalizedId = String(messageId || '').trim();
      if (!normalizedId) return true;

      const result = await run(db, `
        INSERT OR IGNORE INTO mensagens_processadas (message_id, telefone, tipo, dataHora)
        VALUES (?, ?, ?, datetime('now', 'localtime'))
      `, [normalizedId, String(phone || ''), String(type || '')]);

      claimedMessageCount += 1;
      if (claimedMessageCount % 100 === 0) {
        await run(db, "DELETE FROM mensagens_processadas WHERE dataHora < datetime('now', '-30 days', 'localtime')");
      }

      return result.changes === 1;
    },

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

    async updateOrder(id, order) {
      const result = await run(db, `
        UPDATE pedidos SET
          whatsapp_cliente = ?,
          nome = ?,
          itens = ?,
          subtotal = ?,
          taxa_entrega = ?,
          total = ?,
          pagamento = ?,
          valor_pago = ?,
          troco = ?,
          endereco = ?,
          observacao = ?,
          dataHora = ?
        WHERE id = ?
      `, [
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
        order.dateTime,
        id
      ]);
      return result.changes === 1;
    },

    async deleteOrder(id) {
      const result = await run(db, 'DELETE FROM pedidos WHERE id = ?', [id]);
      return result.changes === 1;
    },

    async saveCreditSale(entry) {
      const result = await run(db, `
        INSERT INTO clientes_fiados (nome, valor, observacao, status, dataHora)
        VALUES (?, ?, ?, 'aberto', ?)
      `, [entry.name, entry.value, entry.observation, entry.dateTime]);
      return { id: result.id };
    },

    async setCreditPaid(id, paid) {
      const result = await run(db, `
        UPDATE clientes_fiados
        SET status = ?, pago_em = CASE WHEN ? = 1 THEN datetime('now', 'localtime') ELSE NULL END
        WHERE id = ?
      `, [paid ? 'pago' : 'aberto', paid ? 1 : 0, id]);
      return result.changes === 1;
    },

    async deleteCreditSale(id) {
      const result = await run(db, 'DELETE FROM clientes_fiados WHERE id = ?', [id]);
      return result.changes === 1;
    },

    async salesReport(day = 'today') {
      const modifier = day === 'yesterday' ? "'-1 day'" : "'0 day'";
      const total = await get(db, `
        SELECT IFNULL(SUM(total), 0) AS total
        FROM pedidos
        WHERE date(dataHora) = date('now', ${modifier}, 'localtime')
      `);
      const creditTotal = await get(db, `
        SELECT IFNULL(SUM(valor), 0) AS total
        FROM clientes_fiados
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
      return { total: Number(total.total || 0) + Number(creditTotal.total || 0), customers, sitios };
    },

    async dashboardStats() {
      const today = await get(db, `
        SELECT COUNT(*) AS pedidos, IFNULL(SUM(total), 0) AS total
        FROM pedidos
        WHERE date(dataHora) = date('now', 'localtime')
      `);
      const month = await get(db, `
        SELECT COUNT(*) AS pedidos, IFNULL(SUM(total), 0) AS total
        FROM pedidos
        WHERE strftime('%Y-%m', dataHora) = strftime('%Y-%m', 'now', 'localtime')
      `);
      const creditToday = await get(db, `
        SELECT COUNT(*) AS lancamentos, IFNULL(SUM(valor), 0) AS total
        FROM clientes_fiados
        WHERE date(dataHora) = date('now', 'localtime')
      `);
      const creditMonth = await get(db, `
        SELECT COUNT(*) AS lancamentos, IFNULL(SUM(valor), 0) AS total
        FROM clientes_fiados
        WHERE strftime('%Y-%m', dataHora) = strftime('%Y-%m', 'now', 'localtime')
      `);
      const creditOpen = await get(db, `
        SELECT COUNT(*) AS clientes, IFNULL(SUM(valor), 0) AS total
        FROM clientes_fiados
        WHERE status = 'aberto'
      `);
      const credits = await all(db, `
        SELECT id, nome, valor, observacao, status, dataHora, pago_em
        FROM clientes_fiados
        ORDER BY CASE WHEN status = 'aberto' THEN 0 ELSE 1 END, datetime(dataHora) DESC, id DESC
        LIMIT 200
      `);
      const topSite = await get(db, `
        SELECT json_extract(endereco, '$.sitio') AS sitio,
               COUNT(*) AS pedidos,
               IFNULL(SUM(total), 0) AS total
        FROM pedidos
        WHERE date(dataHora) = date('now', 'localtime')
          AND TRIM(IFNULL(json_extract(endereco, '$.sitio'), '')) <> ''
        GROUP BY sitio
        ORDER BY total DESC, pedidos DESC
        LIMIT 1
      `);
      const topCustomerWeek = await get(db, `
        SELECT nome, COUNT(*) AS pedidos, IFNULL(SUM(total), 0) AS total
        FROM pedidos
        WHERE date(dataHora) >= date('now', '-6 days', 'localtime')
          AND TRIM(IFNULL(nome, '')) <> ''
        GROUP BY nome
        ORDER BY total DESC, pedidos DESC
        LIMIT 1
      `);
      const topCustomerMonth = await get(db, `
        SELECT nome, COUNT(*) AS pedidos, IFNULL(SUM(total), 0) AS total
        FROM pedidos
        WHERE strftime('%Y-%m', dataHora) = strftime('%Y-%m', 'now', 'localtime')
          AND TRIM(IFNULL(nome, '')) <> ''
        GROUP BY nome
        ORDER BY total DESC, pedidos DESC
        LIMIT 1
      `);
      const orders = await all(db, `
        SELECT id, nome, whatsapp_cliente, itens, subtotal, taxa_entrega, total,
               pagamento, valor_pago, troco, endereco, observacao, dataHora
        FROM pedidos
        WHERE date(dataHora) = date('now', 'localtime')
        ORDER BY datetime(dataHora) DESC, id DESC
        LIMIT 100
      `);

      return {
        today: {
          orders: Number(today.pedidos || 0),
          creditSales: Number(creditToday.lancamentos || 0),
          total: Number(today.total || 0) + Number(creditToday.total || 0)
        },
        month: {
          orders: Number(month.pedidos || 0),
          creditSales: Number(creditMonth.lancamentos || 0),
          total: Number(month.total || 0) + Number(creditMonth.total || 0)
        },
        credit: {
          openCount: Number(creditOpen.clientes || 0),
          openTotal: Number(creditOpen.total || 0),
          entries: credits.map(entry => ({
            id: entry.id,
            name: entry.nome,
            value: Number(entry.valor || 0),
            observation: entry.observacao || '',
            status: entry.status,
            dateTime: entry.dataHora,
            paidAt: entry.pago_em || ''
          }))
        },
        topSite: topSite ? {
          name: topSite.sitio,
          orders: Number(topSite.pedidos || 0),
          total: Number(topSite.total || 0)
        } : null,
        topCustomerWeek: topCustomerWeek ? {
          name: topCustomerWeek.nome,
          orders: Number(topCustomerWeek.pedidos || 0),
          total: Number(topCustomerWeek.total || 0)
        } : null,
        topCustomerMonth: topCustomerMonth ? {
          name: topCustomerMonth.nome,
          orders: Number(topCustomerMonth.pedidos || 0),
          total: Number(topCustomerMonth.total || 0)
        } : null,
        orders: orders.map(order => {
          let address = {};
          try { address = JSON.parse(order.endereco || '{}'); } catch {}
          return {
            id: order.id,
            name: order.nome || 'Sem nome',
            whatsapp: order.whatsapp_cliente || '',
            items: (() => {
              try {
                const items = JSON.parse(order.itens || '[]');
                return Array.isArray(items) ? items : [];
              } catch { return []; }
            })(),
            subtotal: Number(order.subtotal || 0),
            deliveryFee: Number(order.taxa_entrega || 0),
            total: Number(order.total || 0),
            payment: order.pagamento || 'Não informado',
            paidAmount: Number(order.valor_pago || 0),
            change: Number(order.troco || 0),
            address,
            site: address.sitio || '',
            delivery: address.street || '',
            observation: order.observacao || address.observation || '',
            dateTime: order.dataHora
          };
        })
      };
    },

    async getSetting(key, fallback = '') {
      const row = await get(db, 'SELECT valor FROM configuracoes WHERE chave = ?', [key]);
      return row ? row.valor : fallback;
    },

    async setSetting(key, value) {
      await run(db, `
        INSERT INTO configuracoes (chave, valor, atualizado_em)
        VALUES (?, ?, datetime('now', 'localtime'))
        ON CONFLICT(chave) DO UPDATE SET
          valor = excluded.valor,
          atualizado_em = excluded.atualizado_em
      `, [key, String(value)]);
    },

    async addLog(level, source, message) {
      await run(db, `
        INSERT INTO logs (nivel, origem, mensagem, dataHora)
        VALUES (?, ?, ?, datetime('now', 'localtime'))
      `, [String(level || 'error'), String(source || 'bot'), String(message || '').slice(0, 10000)]);
      await run(db, `
        DELETE FROM logs
        WHERE id NOT IN (SELECT id FROM logs ORDER BY id DESC LIMIT 500)
      `);
    },

    async listLogs(limit = 100) {
      const safeLimit = Math.max(1, Math.min(200, Number(limit) || 100));
      return all(db, `
        SELECT id, nivel AS level, origem AS source, mensagem AS message, dataHora AS dateTime
        FROM logs
        ORDER BY id DESC
        LIMIT ?
      `, [safeLimit]);
    },

    async clearLogs() {
      await run(db, 'DELETE FROM logs');
    },

    close() {
      return new Promise((resolve, reject) => db.close(error => (error ? reject(error) : resolve())));
    }
  };
}

module.exports = { createDatabase };
