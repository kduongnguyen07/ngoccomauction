const pool = require('./db');

async function initDb() {
  let client;
  try {
    client = await pool.connect();
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
        start_time TIMESTAMPTZ NOT NULL,
        end_time TIMESTAMPTZ NOT NULL,
        is_paid BOOLEAN DEFAULT FALSE,
        image_url VARCHAR(1000),
        min_increase NUMERIC(10, 2) DEFAULT 20000,
        max_increase NUMERIC(10, 2) DEFAULT NULL,
        auto_buy_price NUMERIC(10, 2) DEFAULT 1000000,
        rule_payment VARCHAR(500) DEFAULT 'Trong vòng 24h kể từ khi phiên đấu kết thúc',
        rule_disqualify VARCHAR(500) DEFAULT 'Nghiêm cấm tự ý huỷ lượt đấu giá / bùng cọc',
        rule_usage VARCHAR(500) DEFAULT 'Mục đích cá nhân (Thương mại sẽ tính phí riêng)',
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
  } catch (e) { 
    console.error('Lỗi khi kết nối hoặc khởi tạo Database:', e); 
  } finally { 
    if (client) client.release(); 
    process.exit(0); 
  }
}
initDb();