# 🎯 MEMORY OPTIMIZATION ACTION PLAN
**Status:** Two-tier memory issues detected
- ✅ **Frontend (Cloudflare):** FIXED - QueryClient cache optimization deployed
- 🚨 **Backend (Render API):** CRITICAL - Memory leak causing restarts

---

## 📌 IMMEDIATE ACTIONS (TODAY)

### Backend (BFPR4Bv3.API)
1. **Login to Render** → BFPR4Bv3.API → Logs
2. **Look for pattern** before the last crash:
   ```
   - Which endpoint was hit most? (/compliance, /reports, /users?)
   - Memory usage line showing continuous climb?
   - Database connection errors?
   ```
3. **Deploy memory logging** (see [BACKEND_MEMORY_LEAK_CHECKLIST.md](BACKEND_MEMORY_LEAK_CHECKLIST.md))
   - Add to your `app.js` main file
   - Redeploy to Render
   - Monitor logs for next 30 minutes

### Frontend (Already Done ✅)
1. ✅ QueryClient cache configured
2. ✅ Window focus refetch disabled
3. ✅ Polling already throttled (120s intervals)

---

## 🔍 DIAGNOSIS (NEXT 24-48 HOURS)

### Most Likely Culprit: Database Connections
Your FSIMS API likely has **no connection pooling** or **connections not being released**.

**Test this:**
1. Go to your API code
2. Search for: `db.query()` or `connection.execute()`
3. Look for: Missing `.release()` or `conn.close()`

**Find and fix pattern:**
```javascript
// Search your code for this BAD pattern:
const result = await db.query('SELECT...');
res.json(result);
// ❌ Connection not released

// Fix to this:
const conn = await pool.getConnection();
try {
  const result = await conn.query('SELECT...');
  res.json(result);
} finally {
  conn.release(); // ✅ RELEASE
}
```

### Second Most Likely: Large Queries Not Paginated
Check if `/compliance`, `/reports`, `/matrix-reports` endpoints:
- [ ] Fetch 10,000+ rows at once?
- [ ] No LIMIT/OFFSET in queries?
- [ ] Store results in memory cache?

**If YES:** Add pagination (see BACKEND checklist)

---

## 📊 MONITORING (24/7 After Fix)

### Set Up Alerting on Render
1. Go to Render dashboard
2. Service → Notifications
3. Set alert for: Memory usage >80% or CPU >75%
4. Get email/Slack notification before crash

### Weekly Check
- Render → Metrics → Memory graph
- Should see sawtooth pattern (stable with GC spikes)
- NOT continuous climb

---

## 🔧 IMPLEMENTATION CHECKLIST

### IF Database Connection Leak (Most Likely):
```javascript
// In each API endpoint:
app.get('/api/data', async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();      // ✅ Get from pool
    const result = await conn.query('...'); // ✅ Execute
    res.json(result);
  } catch (err) {
    res.status(500).json(err);
  } finally {
    if (conn) conn.release();               // ✅ ALWAYS release
  }
});
```

### IF Large Queries Not Paginated (Second Most Likely):
```javascript
// Before:
const allRecords = await db.query('SELECT * FROM Compliance WHERE year = 2024');

// After:
const page = req.query.page || 1;
const limit = 100;
const records = await db.query(
  'SELECT * FROM Compliance WHERE year = 2024 LIMIT ? OFFSET ?',
  [limit, (page - 1) * limit]
);
```

### IF No Connection Pool:
```javascript
// Set up pool with limits:
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,      // Max connections
  queueLimit: 0,            // Queue if all busy
  idleTimeout: 60000,       // Close idle after 1 min
});
```

---

## ⏱️ TIMELINE

| When | Action | Impact |
|------|--------|--------|
| **Today** | Add memory logging | Can see spike patterns in logs |
| **Tomorrow** | Find leak source (connection/query/cache) | Pinpoint exact issue |
| **2-3 days** | Deploy fix (release connections/paginate) | Memory usage stabilizes |
| **1 week** | Verify no reoccurrence | Service runs 7+ days without crash |

---

## 🚨 IF STILL CRASHING AFTER FIXES

1. **Upgrade Render plan immediately:**
   - 512MB → 1GB ($7/month → $12/month)
   - Won't fix root cause but buys time
   
2. **Enable slow query logging:**
   ```mysql
   SET GLOBAL slow_query_log = 'ON';
   SET GLOBAL long_query_time = 2;
   ```
   
3. **Use clinic.js profiler:**
   ```bash
   npm install -g clinic
   clinic doctor -- npm start
   ```

---

## 📚 REFERENCE DOCUMENTS

1. **[API_MEMORY_LEAK_FIX.md](API_MEMORY_LEAK_FIX.md)** ← Read this first
   - Detailed leak patterns
   - Code examples
   - Debugging steps

2. **[BACKEND_MEMORY_LEAK_CHECKLIST.md](BACKEND_MEMORY_LEAK_CHECKLIST.md)** ← Implementation guide
   - FSIMS-specific patterns
   - Connection pool setup
   - Endpoint monitoring

3. **[MEMORY_OPTIMIZATION_GUIDE.md](MEMORY_OPTIMIZATION_GUIDE.md)** ← Frontend reference
   - QueryClient setup ✅ Done
   - Pagination patterns
   - Lazy loading

4. **[MEMORY_OPTIMIZATION_PATTERNS.ts](MEMORY_OPTIMIZATION_PATTERNS.ts)** ← Code templates
   - Copy-paste ready code
   - Frontend best practices

---

## 🎯 SUCCESS CRITERIA

After implementing fixes:
- ✅ No Render restarts for 7 days
- ✅ Memory usage stays 20-40% on Render metrics
- ✅ Response time <400ms average
- ✅ API logs show stable memory (not climbing)
- ✅ Users report no slowdowns/timeouts

---

## 💡 PREVENTION GOING FORWARD

1. **Code review checklist:**
   - [ ] All DB queries have connection released?
   - [ ] All large results paginated?
   - [ ] All caches have TTL?
   - [ ] All event listeners cleaned up?

2. **Testing before deploy:**
   - [ ] Run `clinic.js` for memory profile
   - [ ] Load test with 10+ concurrent users
   - [ ] Check memory stays <50% during test

3. **Monitoring:**
   - [ ] Set Render memory alert at 80%
   - [ ] Weekly review of API metrics
   - [ ] Monitor slow query log

