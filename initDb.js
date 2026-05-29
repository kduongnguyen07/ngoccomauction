const pool = require('./db');

async function initDb() {
  const client = await pool.connect();
  try {
    console.log('--- Đang khởi tạo Database chuẩn công nghiệp ---');
    
    await client.query('DROP TABLE IF EXISTS audit_logs CASCADE;');
    await client.query('DROP TABLE IF EXISTS bids CASCADE;');
    await client.query('DROP TABLE IF EXISTS bidders CASCADE;');
    await client.query('DROP TABLE IF EXISTS commissions CASCADE;');

    // Bảng Commissions: Dùng NUMERIC, thêm CHECK constraint
    await client.query(`
      CREATE TABLE commissions (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        phase VARCHAR(50) NOT NULL,
        status VARCHAR(20) DEFAULT 'upcoming',
        start_price NUMERIC(10, 2) NOT NULL CHECK (start_price >= 0),
        current_price NUMERIC(10, 2) NOT NULL,
        start_time TIMESTAMP NOT NULL,
        end_time TIMESTAMP NOT NULL,
        is_paid BOOLEAN DEFAULT FALSE,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT price_check CHECK (current_price >= start_price)
      );
    `);

    await client.query(`
      CREATE TABLE bidders (
        id SERIAL PRIMARY KEY,
        full_name VARCHAR(100) NOT NULL,
        contact_info VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE bids (
        id SERIAL PRIMARY KEY,
        commission_id INT REFERENCES commissions(id) ON DELETE CASCADE,
        bidder_id INT REFERENCES bidders(id) ON DELETE CASCADE,
        bid_amount NUMERIC(10, 2) NOT NULL CHECK (bid_amount > 0),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX idx_bids_commission ON bids(commission_id);
    `);

    await client.query(`
      CREATE TABLE audit_logs (
        id SERIAL PRIMARY KEY,
        action VARCHAR(100) NOT NULL,
        details JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Trigger tự động cập nhật updated_at
    await client.query(`
      CREATE OR REPLACE FUNCTION update_modified_column()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = now();
          RETURN NEW;
      END;
      $$ language 'plpgsql';
      CREATE TRIGGER update_commissions_modtime BEFORE UPDATE ON commissions FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
    `);

    console.log('--- Khởi tạo thành công! ---');
  } catch (e) { console.error(e); }
  finally { client.release(); process.exit(0); }
}
initDb();