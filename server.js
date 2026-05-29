require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const pool = require('./db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const Joi = require('joi');
const rateLimit = require('express-rate-limit');

// Startup checks for environment variables
if (!process.env.ADMIN_PASSWORD) {
  console.error('CRITICAL: ADMIN_PASSWORD environment variable is not defined!');
  process.exit(1);
}
if (!process.env.JWT_SECRET) {
  console.error('CRITICAL: JWT_SECRET environment variable is not defined!');
  process.exit(1);
}

const app = express();
const server = http.createServer(app);

// Constants
const AUTO_BUY_PRICE = parseFloat(process.env.AUTO_BUY_PRICE) || 1000000;
const MIN_INCREASE = parseFloat(process.env.MIN_INCREASE) || 20000;

const rawFrontend = process.env.FRONTEND_URL || 'http://localhost:5173';
const FRONTEND_URL = rawFrontend.endsWith('/') ? rawFrontend.slice(0, -1) : rawFrontend;

// Setup Socket.io with wildcard CORS
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Configure Express CORS
const corsOptions = {
  origin: '*',
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET;
const ADMIN_PASS_HASH = bcrypt.hashSync(process.env.ADMIN_PASSWORD, 10);

// --- RATE LIMITERS ---
const bidLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 15, // limit each IP to 15 bids per windowMs
  message: { error: 'Spam bid quá nhanh! Vui lòng thử lại sau 1 phút.' }
});

// --- MIDDLEWARES ---
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    req.admin = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(403).json({ error: 'Invalid token' });
  }
};

// [FIX #1] Middleware xác thực bidder token — thay vì tin raw bidderId từ client
const bidderAuthMiddleware = (req, res, next) => {
  const token = req.headers['x-bidder-token'];
  if (!token) return res.status(401).json({ error: 'Bidder token missing' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.bidderId = decoded.bidderId;
    next();
  } catch {
    res.status(403).json({ error: 'Invalid bidder token' });
  }
};

const notifyAll = () => io.emit('global-update');

// --- JOI VALIDATION SCHEMAS ---
const commissionSchema = Joi.object({
  title: Joi.string().max(255).required(),
  phase: Joi.string().max(50).required(),
  startPrice: Joi.number().min(0).required(),
  startTime: Joi.string().isoDate().required(),
  endTime: Joi.string().isoDate().required(),
  imageUrl: Joi.string().max(1000).allow('', null).optional(),
});

const bidderSchema = Joi.object({
  fullName: Joi.string().max(100).required(),
  contactInfo: Joi.string().max(255).required(),
});

const statusSchema = Joi.object({
  status: Joi.string().valid('upcoming', 'active', 'closed').required()
});

// --- API ADMIN ---
app.get('/api/commissions', authMiddleware, async (req, res, next) => {
  let client;
  try {
    client = await pool.connect();
    const ans = await client.query(`
      SELECT c.*, b.full_name as winner_name, b.contact_info as winner_contact
      FROM commissions c
      LEFT JOIN LATERAL (
        SELECT bidder_id FROM bids WHERE commission_id = c.id ORDER BY created_at DESC LIMIT 1
      ) last_bid ON TRUE
      LEFT JOIN bidders b ON last_bid.bidder_id = b.id
      ORDER BY c.id DESC
    `);
    res.json(ans.rows);
  } catch (e) {
    next(e);
  } finally {
    if (client) client.release();
  }
});

app.post('/api/commissions', authMiddleware, async (req, res, next) => {
  const { error } = commissionSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.details[0].message });

  const { title, phase, startPrice, startTime, endTime, imageUrl } = req.body;
  let client;
  try {
    client = await pool.connect();
    await client.query(
      'INSERT INTO commissions (title, phase, start_price, current_price, start_time, end_time, status, image_url) VALUES ($1, $2, $3, $3, $4, $5, \'upcoming\', $6)',
      [title, phase, startPrice, startTime, endTime, imageUrl || null]
    );
    notifyAll();
    res.json({ success: true });
  } catch (e) {
    next(e);
  } finally {
    if (client) client.release();
  }
});

app.put('/api/commissions/:id/status', authMiddleware, async (req, res, next) => {
  const { error } = statusSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.details[0].message });

  const { id } = req.params;
  const { status } = req.body;
  let client;
  try {
    client = await pool.connect();
    await client.query('UPDATE commissions SET status = $1 WHERE id = $2', [status, id]);
    io.emit(`commission-${id}-update`, { status });
    notifyAll();
    res.json({ success: true });
  } catch (e) {
    next(e);
  } finally {
    if (client) client.release();
  }
});

app.put('/api/commissions/:id/confirm-payment', authMiddleware, async (req, res, next) => {
  const { id } = req.params;
  let client;
  try {
    client = await pool.connect();
    await client.query('UPDATE commissions SET is_paid = TRUE WHERE id = $1', [id]);
    
    // Log action to audit_logs
    await client.query('INSERT INTO audit_logs (action, details) VALUES ($1, $2)', [
      'CONFIRM_PAYMENT',
      JSON.stringify({ commission_id: id, message: `Xác nhận thanh toán cho Commission #${id}` })
    ]);

    io.emit(`commission-${id}-update`, { is_paid: true });
    notifyAll();
    res.json({ success: true });
  } catch (e) {
    next(e);
  } finally {
    if (client) client.release();
  }
});

app.put('/api/commissions/:id/disqualify', authMiddleware, async (req, res, next) => {
  const { id } = req.params;
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    
    // Fetch top bid information to get bidder name before deletion
    const topBid = await client.query(`
      SELECT b.id, bi.full_name 
      FROM bids b 
      JOIN bidders bi ON b.bidder_id = bi.id 
      WHERE b.commission_id = $1 
      ORDER BY b.created_at DESC LIMIT 1 FOR UPDATE
    `, [id]);
    
    let bidderName = 'Unknown';
    if (topBid.rows.length > 0) {
      bidderName = topBid.rows[0].full_name;
      await client.query('DELETE FROM bids WHERE id = $1', [topBid.rows[0].id]);
    }
    
    const nextBid = await client.query('SELECT bid_amount FROM bids WHERE commission_id = $1 ORDER BY created_at DESC LIMIT 1', [id]);
    let newPrice, newStatus;
    if (nextBid.rows.length > 0) {
      newPrice = nextBid.rows[0].bid_amount;
      newStatus = 'closed';
    } else {
      // [FIX #3] Khi hết bid, kiểm tra end_time — nếu đã qua thì set 'upcoming' thay vì 'active'
      const com = await client.query('SELECT start_price, end_time FROM commissions WHERE id = $1', [id]);
      newPrice = com.rows[0].start_price;
      const endTimeAlreadyPassed = new Date(com.rows[0].end_time) < new Date();
      newStatus = endTimeAlreadyPassed ? 'upcoming' : 'active';
    }
    
    await client.query('UPDATE commissions SET current_price = $1, status = $2, is_paid = FALSE WHERE id = $3', [newPrice, newStatus, id]);
    
    // Log audit event
    await client.query('INSERT INTO audit_logs (action, details) VALUES ($1, $2)', [
      'DISQUALIFY',
      JSON.stringify({ commission_id: id, winner_name: bidderName, message: `Hủy lượt đấu giá của bidder ${bidderName} tại Commission #${id}` })
    ]);
    
    await client.query('COMMIT');
    io.emit(`commission-${id}-update`, { currentPrice: newPrice, status: newStatus, refreshHistory: true });
    notifyAll();
    res.json({ success: true });
  } catch (e) {
    if (client) await client.query('ROLLBACK');
    next(e);
  } finally {
    if (client) client.release();
  }
});

app.get('/api/admin/logs', authMiddleware, async (req, res, next) => {
  let client;
  try {
    client = await pool.connect();
    const ans = await client.query('SELECT * FROM audit_logs ORDER BY id DESC');
    res.json(ans.rows);
  } catch (e) {
    next(e);
  } finally {
    if (client) client.release();
  }
});

// --- API CLIENT ---
app.get('/api/commissions/active', async (req, res, next) => {
  let client;
  try {
    client = await pool.connect();
    const ans = await client.query(`
      SELECT
        c.id, c.title, c.phase, c.status, c.current_price,
        c.start_price, c.start_time, c.end_time, c.is_paid, c.image_url,
        (
          SELECT bidder_id FROM bids WHERE commission_id = c.id ORDER BY created_at DESC LIMIT 1
        ) as winner_bidder_id
      FROM commissions c
      WHERE (status = 'active') OR (status = 'closed' AND is_paid = FALSE)
      ORDER BY (CASE WHEN status = 'active' THEN 1 ELSE 2 END) ASC, end_time ASC LIMIT 1
    `);
    if (ans.rows.length === 0) return res.status(404).json({ message: 'Trống' });
    res.json({ ...ans.rows[0], server_now: new Date().toISOString() });
  } catch (e) {
    next(e);
  } finally {
    if (client) client.release();
  }
});

app.get('/api/commissions/:id/history', async (req, res, next) => {
  let client;
  try {
    client = await pool.connect();
    const ans = await client.query('SELECT b.bid_amount, b.created_at, bi.full_name, bi.id as bidder_id FROM bids b JOIN bidders bi ON b.bidder_id = bi.id WHERE b.commission_id = $1 ORDER BY b.created_at DESC LIMIT 5', [req.params.id]);
    res.json(ans.rows);
  } catch (e) {
    next(e);
  } finally {
    if (client) client.release();
  }
});

app.post('/api/bidders', async (req, res, next) => {
  const { error } = bidderSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.details[0].message });

  let client;
  try {
    client = await pool.connect();
    const ans = await client.query('INSERT INTO bidders (full_name, contact_info) VALUES ($1, $2) RETURNING *', [req.body.fullName, req.body.contactInfo]);
    const bidder = ans.rows[0];
    // [FIX #1] Tạo short-lived JWT token cho bidder — client dùng token này thay vì raw bidderId
    const bidderToken = jwt.sign({ bidderId: bidder.id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ ...bidder, bidderToken });
  } catch (e) {
    next(e);
  } finally {
    if (client) client.release();
  }
});

// [FIX #1 + #2] Dùng bidderAuthMiddleware để lấy bidderId thật từ JWT, không tin client
app.post('/api/bid', bidLimiter, bidderAuthMiddleware, async (req, res, next) => {
  const bidderId = req.bidderId; // Lấy từ token, không từ body
  const { commissionId, bidAmount, isAutoBuy } = req.body;
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    // [FIX #2] Verify bidder tồn tại trong DB
    const bidderCheck = await client.query('SELECT id FROM bidders WHERE id = $1', [bidderId]);
    if (bidderCheck.rows.length === 0) throw new Error('Bidder not found');

    const com = (await client.query('SELECT * FROM commissions WHERE id = $1 FOR UPDATE', [commissionId])).rows[0];
    if (!com) throw new Error('Commission not found');
    if (com.status !== 'active') throw new Error('Auction not active');
    
    let amount = isAutoBuy ? AUTO_BUY_PRICE : bidAmount;
    let newStatus = 'active';
    
    if (isAutoBuy) {
      if (parseFloat(com.current_price) >= AUTO_BUY_PRICE) throw new Error('Auto-buy unavailable');
      newStatus = 'closed';
    } else {
      if (amount < parseFloat(com.current_price) + MIN_INCREASE) {
        throw new Error(`Bid tối thiểu phải cao hơn giá hiện tại ${MIN_INCREASE.toLocaleString('vi-VN')} đ!`);
      }
      if (amount >= AUTO_BUY_PRICE) newStatus = 'closed';
    }
    
    await client.query('UPDATE commissions SET current_price = $1, status = $2 WHERE id = $3', [amount, newStatus, commissionId]);
    await client.query('INSERT INTO bids (commission_id, bidder_id, bid_amount) VALUES ($1, $2, $3)', [commissionId, bidderId, amount]);
    await client.query('COMMIT');
    
    io.emit(`commission-${commissionId}-update`, { currentPrice: amount, status: newStatus, refreshHistory: true });
    notifyAll();
    res.json({ success: true });
  } catch (e) {
    if (client) await client.query('ROLLBACK');
    const clientErrors = ['Bidder not found', 'Commission not found', 'Auction not active', 'Auto-buy unavailable'];
    if (clientErrors.includes(e.message) || e.message.startsWith('Bid tối thiểu')) {
      res.status(400).json({ error: e.message });
    } else {
      next(e);
    }
  } finally {
    if (client) client.release();
  }
});

app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (bcrypt.compareSync(password, ADMIN_PASS_HASH)) {
    const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '24h' });
    return res.json({ token });
  }
  res.status(401).json({ error: 'Wrong password' });
});

// --- DIAGNOSTIC ENDPOINT ---
app.get('/api/diag', (req, res) => {
  res.json({
    hasDbUrl: !!process.env.DATABASE_URL,
    hasJwtSecret: !!process.env.JWT_SECRET,
    jwtSecretLength: process.env.JWT_SECRET?.length || 0,
    hasAdminPass: !!process.env.ADMIN_PASSWORD,
    adminPassLength: process.env.ADMIN_PASSWORD?.length || 0,
    frontendUrl: process.env.FRONTEND_URL,
    nodeEnv: process.env.NODE_ENV
  });
});

// --- GLOBAL ERROR HANDLER ---
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error: ' + err.message });
});

server.listen(5000, () => console.log('Server on 5000'));