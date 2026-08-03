const Database = require('better-sqlite3');
const BaseRepository = require('../repositories/BaseRepository');

describe('BaseRepository.create', () => {
  test('coerces unsupported values to SQLite-safe primitives', () => {
    const db = new Database(':memory:');
    db.exec(`
      CREATE TABLE test_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        quantity INTEGER,
        note TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const repo = new BaseRepository(db, 'test_items');

    expect(() => repo.create({ name: 'demo', quantity: undefined, note: { nested: true } })).not.toThrow();

    const row = db.prepare('SELECT name, quantity, note FROM test_items WHERE id = 1').get();
    expect(row).toMatchObject({
      name: 'demo',
      quantity: null,
      note: JSON.stringify({ nested: true }),
    });

    db.close();
  });
});
