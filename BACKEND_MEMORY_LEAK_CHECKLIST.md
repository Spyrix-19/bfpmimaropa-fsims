# BFPR4Bv3.API - Backend Memory Leak Checklist

## 🔴 IMMEDIATE ACTIONS

### 1. Check Render Logs for Patterns
```
Render Dashboard → BFPR4Bv3.API → Logs
Look for:
- "Memory usage: 490MB" before crash
- Specific endpoint patterns (e.g., /reports, /compliance always before crash?)
- Database error patterns ("Too many connections", "Connection timeout")
- Same request being called repeatedly
```

### 2. Add Memory Logging (Deploy This Today)
Add to your main `app.js` or `index.js`:

```javascript
// Add to the TOP of your file
setInterval(() => {
  const used = process.memoryUsage();
  const heapPercent = Math.round((used.heapUsed / used.heapTotal) * 100);
  console.log(`[MEMORY] ${heapPercent}% | Heap: ${Math.round(used.heapUsed / 1024 / 1024)}MB / ${Math.round(used.heapTotal / 1024 / 1024)}MB | RSS: ${Math.round(used.rss / 1024 / 1024)}MB`);
  
  // Alert if critical
  if (heapPercent > 80) {
    console.error('🚨 CRITICAL: Memory usage >80%');
  }
}, 10000); // Every 10 seconds
```

### 3. Common Memory Leaks in FSIMS Context

#### Leak Pattern 1: Compliance/Monitoring Queries Store Large Data
```javascript
// ❌ BAD: Compliance GET storing all records in memory
app.get('/api/compliance', async (req, res) => {
  try {
    // This query might return 10,000+ rows
    const records = await db.query(
      'SELECT * FROM Compliance WHERE stationno = ? AND year = ?',
      [req.query.stationno, req.query.year]
    );
    // If no connection released, memory holds this + previous requests
    res.json(records); // 🔴 MEMORY LEAK: Rows stay in pool memory
  } catch (err) {
    res.status(500).json(err);
  }
});

// ✅ FIXED: Paginate large queries
app.get('/api/compliance', async (req, res) => {
  try {
    const page = req.query.page || 1;
    const limit = 100;
    const offset = (page - 1) * limit;
    
    const records = await db.query(
      'SELECT * FROM Compliance WHERE stationno = ? AND year = ? LIMIT ? OFFSET ?',
      [req.query.stationno, req.query.year, limit, offset]
    );
    const total = await db.query(
      'SELECT COUNT(*) as total FROM Compliance WHERE stationno = ? AND year = ?',
      [req.query.stationno, req.query.year]
    );
    
    res.json({
      data: records,
      page,
      total: total[0].total,
      hasMore: offset + limit < total[0].total
    });
  } catch (err) {
    res.status(500).json(err);
  }
});
```

#### Leak Pattern 2: Report Generation Holding Data
```javascript
// ❌ BAD: Building entire report in memory
app.get('/api/reports/matrix', async (req, res) => {
  try {
    // Loads ALL data for year into memory
    const allStations = await db.query('SELECT * FROM Station');
    const allCompliance = await db.query('SELECT * FROM Compliance WHERE year = ?', [req.query.year]);
    
    // Build massive matrix in memory
    const matrix = {};
    for (const station of allStations) {
      for (const record of allCompliance) {
        matrix[station.id] = matrix[station.id] || [];
        matrix[station.id].push(record);
      }
    }
    // 🔴 MEMORY LEAK: Matrix object held in response stream
    res.json(matrix);
  } catch (err) {
    res.status(500).json(err);
  }
});

// ✅ FIXED: Paginate and stream
app.get('/api/reports/matrix', async (req, res) => {
  try {
    const stationNo = req.query.stationno;
    const page = req.query.page || 1;
    const limit = 50;
    
    // Only fetch one station's data
    const compliance = await db.query(
      'SELECT * FROM Compliance WHERE stationno = ? AND year = ? LIMIT ? OFFSET ?',
      [stationNo, req.query.year, limit, (page - 1) * limit]
    );
    
    res.json({
      data: compliance,
      page,
      stationNo,
      hasMore: compliance.length === limit
    });
  } catch (err) {
    res.status(500).json(err);
  }
});
```

#### Leak Pattern 3: Caching Without Limits
```javascript
// ❌ BAD: User cache grows forever
const userCache = {};
app.get('/api/users/:memberno', async (req, res) => {
  if (!userCache[req.params.memberno]) {
    userCache[req.params.memberno] = await db.query(
      'SELECT * FROM Personnel WHERE memberno = ?',
      [req.params.memberno]
    );
  }
  // 🔴 MEMORY LEAK: 10,000 users cached = millions of objects
  res.json(userCache[req.params.memberno]);
});

// ✅ FIXED: Use LRU cache with TTL
const NodeCache = require('node-cache');
const userCache = new NodeCache({ stdTTL: 3600 }); // 1 hour TTL

app.get('/api/users/:memberno', async (req, res) => {
  let user = userCache.get(req.params.memberno);
  if (!user) {
    user = await db.query(
      'SELECT * FROM Personnel WHERE memberno = ?',
      [req.params.memberno]
    );
    userCache.set(req.params.memberno, user); // 👈 Auto-expires after 1 hour
  }
  res.json(user);
});
```

#### Leak Pattern 4: Database Connection Pool Not Configured
```javascript
// ❌ BAD: No pool configuration
const mysql = require('mysql2/promise');
const connection = await mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});
// 🔴 MEMORY LEAK: Single connection, requests queue forever

// ✅ FIXED: Proper pool setup
const mysql = require('mysql2/promise');
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,      // 👈 Limit max connections
  queueLimit: 0,            // 👈 Queue requests if all busy
  idleTimeout: 60000,       // 👈 Close idle connections
});

// And ALWAYS release connections:
app.get('/api/data', async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const [rows] = await conn.query('SELECT * FROM table');
    res.json(rows);
  } finally {
    if (conn) conn.release(); // 👈 CRITICAL
  }
});
```

#### Leak Pattern 5: Event Listeners in Stream Endpoints
```javascript
// ❌ BAD: Listeners not cleaned up
app.get('/api/stream', (req, res) => {
  const handler = (data) => {
    res.write(JSON.stringify(data) + '\n');
  };
  
  eventEmitter.on('compliance-update', handler);
  // 🔴 MEMORY LEAK: Listeners accumulate, client disconnect not handled
});

// ✅ FIXED: Clean up on disconnect
app.get('/api/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  
  const handler = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };
  
  eventEmitter.on('compliance-update', handler);
  
  // 👈 CLEANUP on disconnect
  req.on('close', () => {
    eventEmitter.removeListener('compliance-update', handler);
  });
  
  res.on('close', () => {
    eventEmitter.removeListener('compliance-update', handler);
  });
});
```

---

## 📋 DEBUGGING STEPS

### Step 1: Identify Spike Trigger
```javascript
// Add request logging to find which endpoint spikes memory
app.use((req, res, next) => {
  const before = process.memoryUsage().heapUsed;
  
  res.on('finish', () => {
    const after = process.memoryUsage().heapUsed;
    const delta = Math.round((after - before) / 1024 / 1024);
    
    if (Math.abs(delta) > 10) { // Log if >10MB change
      console.log(`[API] ${req.method} ${req.path} | Memory delta: ${delta}MB`);
    }
  });
  
  next();
});
```

### Step 2: Check Database Connections
```javascript
// Add connection pool monitoring
setInterval(() => {
  console.log(`[DB] Active connections: ${pool._connectionQueue.length}`);
  console.log(`[DB] Waiting for connection: ${pool._waitingCallbacks.length}`);
}, 30000);
```

### Step 3: Monitor Specific Endpoints
```javascript
// If you know the problematic endpoint, add this:
app.get('/api/compliance', (req, res, next) => {
  const start = process.memoryUsage().heapUsed;
  console.log(`[COMPLIANCE] Request started`);
  
  res.on('finish', () => {
    const end = process.memoryUsage().heapUsed;
    console.log(`[COMPLIANCE] Completed | Memory used: ${Math.round((end - start) / 1024 / 1024)}MB`);
  });
  
  next();
});
```

---

## 🚀 PRIORITY FIXES (by likelihood)

1. **[MOST LIKELY]** Database connection pool not releasing connections
   - Fix: Add `conn.release()` in all endpoints
   
2. **[LIKELY]** Large queries not paginated (Compliance, Reports endpoints)
   - Fix: Add LIMIT/OFFSET to all SELECT queries
   
3. **[LIKELY]** Global cache growing without bounds
   - Fix: Replace with `node-cache` that auto-expires
   
4. **[POSSIBLE]** Event listeners/streams not cleaned up on client disconnect
   - Fix: Add `req.on('close')` cleanup handlers
   
5. **[LESS LIKELY]** Circular object references in stored data
   - Fix: Review data structures for circular refs

---

## 📊 EXPECTED RESULT

**Before fix:**
```
Render logs show continuous climb:
[MEMORY] 30% | Heap: 150MB / 512MB
[MEMORY] 45% | Heap: 230MB / 512MB
[MEMORY] 60% | Heap: 310MB / 512MB
[MEMORY] 85% | Heap: 435MB / 512MB
🚨 CRASH - Instance restarted
```

**After fix:**
```
Render logs show stable pattern:
[MEMORY] 20% | Heap: 100MB / 512MB
[MEMORY] 22% | Heap: 115MB / 512MB
[MEMORY] 19% | Heap: 95MB / 512MB
[MEMORY] 21% | Heap: 108MB / 512MB
✅ STABLE - No crashes
```

---

## 🆘 ESCALATION PATH

If after fixes it still crashes:
1. Upgrade Render plan: 512MB → 1GB
2. Enable slow query logging to identify expensive queries
3. Use `clinic.js` for detailed memory profiling
4. Contact Render support with memory logs

