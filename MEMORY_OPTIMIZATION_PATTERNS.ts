// MEMORY OPTIMIZATION PATTERNS
// Copy these patterns to your data-heavy components

// ============================================================================
// PATTERN 1: Lazy Load Data Based on Tab Selection (NO unnecessary refetch)
// ============================================================================

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

export function OptimizedDashboard() {
  const [activeTab, setActiveTab] = useState<'summary' | 'details' | 'reports'>('summary');

  // Load summary immediately (lightweight)
  const summaryQuery = useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: () => api.get('/dashboard/summary'),
    staleTime: 5 * 60 * 1000, // 5 min
  });

  // Load details ONLY when tab is clicked (saves API call on page load)
  const detailsQuery = useQuery({
    queryKey: ['dashboard', 'details'],
    queryFn: () => api.get('/dashboard/details'),
    enabled: activeTab === 'details', // 👈 KEY: Don't fetch unless needed
    staleTime: 5 * 60 * 1000,
  });

  // Load reports ONLY when tab is clicked
  const reportsQuery = useQuery({
    queryKey: ['dashboard', 'reports'],
    queryFn: () => api.get('/dashboard/reports'),
    enabled: activeTab === 'reports', // 👈 KEY: Don't fetch unless needed
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div>
      <tabs value={activeTab} onValueChange={setActiveTab}>
        {/* Tab 1: Summary (loaded immediately) */}
        <tab value="summary">
          {summaryQuery.isLoading ? <Skeleton /> : <SummaryView data={summaryQuery.data} />}
        </tab>

        {/* Tab 2: Details (loaded on demand) */}
        <tab value="details">
          {detailsQuery.isLoading ? <Skeleton /> : <DetailsView data={detailsQuery.data} />}
        </tab>

        {/* Tab 3: Reports (loaded on demand) */}
        <tab value="reports">
          {reportsQuery.isLoading ? <Skeleton /> : <ReportsView data={reportsQuery.data} />}
        </tab>
      </tabs>
    </div>
  );
}

// ============================================================================
// PATTERN 2: Smart Pagination (Only Keep Current Page in Memory)
// ============================================================================

export function OptimizedTable() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Only fetch current page, previous queries are garbage collected
  const { data, isLoading } = useQuery({
    queryKey: ['table-data', page, pageSize],
    queryFn: () => api.get('/table-data', {
      params: { page, pagesize: pageSize }
    }),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000, // Old pages auto-deleted after 10 min
  });

  return (
    <div>
      <table>
        {/* Render only current page data (50 rows max) */}
        {data?.data?.map(row => <TableRow key={row.id} {...row} />)}
      </table>
      
      <Pagination
        currentPage={page}
        onPageChange={setPage}
        totalPages={data?.totalPages}
      />
    </div>
  );
}

// ============================================================================
// PATTERN 3: Virtualized List (Render Only Visible Rows)
// ============================================================================

import { FixedSizeList as List } from 'react-window';

export function OptimizedLargeList() {
  const { data } = useQuery({
    queryKey: ['large-list'],
    queryFn: () => api.get('/large-dataset', { params: { pagesize: 1000 } }),
    staleTime: 5 * 60 * 1000,
  });

  const items = data?.data ?? [];

  // Only renders visible rows + buffer (not all 1000!)
  return (
    <List
      height={600}
      itemCount={items.length}
      itemSize={35}
      width="100%"
    >
      {({ index, style }) => (
        <div style={style} className="row">
          {/* Render item at index */}
          <TableRow {...items[index]} />
        </div>
      )}
    </List>
  );
}

// ============================================================================
// PATTERN 4: Stop Polling When Tab is Inactive
// ============================================================================

import { useEffect, useRef } from 'react';

export function OptimizedPolling() {
  const isActiveTab = useRef(true);

  // Track if tab is visible
  useEffect(() => {
    const handleVisibility = () => {
      isActiveTab.current = document.visibilityState === 'visible';
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  // Polling: 30s if active, disabled if inactive
  const { data } = useQuery({
    queryKey: ['real-time-data'],
    queryFn: () => api.get('/real-time-data'),
    refetchInterval: isActiveTab.current ? 30000 : false, // 👈 KEY: Stop when inactive
  });

  return <div>{JSON.stringify(data)}</div>;
}

// ============================================================================
// PATTERN 5: Cancel Request on Component Unmount
// ============================================================================

export function OptimizedComponent() {
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    abortControllerRef.current = new AbortController();

    return () => {
      // Cancel the request if component unmounts before response arrives
      abortControllerRef.current?.abort();
    };
  }, []);

  const { data } = useQuery({
    queryKey: ['data'],
    queryFn: () => api.get('/data', {
      signal: abortControllerRef.current?.signal,
    }),
  });

  return <div>{JSON.stringify(data)}</div>;
}

// ============================================================================
// PATTERN 6: Memoize Expensive Computations
// ============================================================================

import { useMemo } from 'react';

export function OptimizedComputation() {
  const { data } = useQuery({
    queryKey: ['raw-data'],
    queryFn: () => api.get('/data'),
  });

  // Expensive calculation only runs if data changes
  const processedData = useMemo(() => {
    if (!data) return null;
    
    // Complex transformation (e.g., sorting, filtering, grouping)
    return transformData(data);
  }, [data]); // 👈 KEY: Only recompute if data changes

  return <ChartComponent data={processedData} />;
}

// ============================================================================
// PATTERN 7: Cleanup Listeners Properly
// ============================================================================

export function OptimizedWithListener() {
  useEffect(() => {
    const handleResize = () => {
      // Handle resize
    };

    const handleKeyPress = (e: KeyboardEvent) => {
      // Handle key
    };

    // Register listeners
    window.addEventListener('resize', handleResize);
    window.addEventListener('keydown', handleKeyPress);

    // 👈 CRITICAL: Cleanup or memory leaks!
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, []);

  return <div>Component</div>;
}

// ============================================================================
// Render API Optimization Checklist
// ============================================================================

/*
Add this to your Render API responses (Node.js/Express example):

app.use((req, res, next) => {
  // Cache GET requests for 5 minutes
  if (req.method === 'GET') {
    res.setHeader('Cache-Control', 'public, max-age=300');
  } else {
    res.setHeader('Cache-Control', 'no-cache, no-store');
  }
  next();
});

// Enable response compression
import compression from 'compression';
app.use(compression());

// Add query timeout (prevent hanging requests)
app.use((req, res, next) => {
  res.setTimeout(30000, () => {
    res.status(408).json({ error: 'Request timeout' });
  });
  next();
});

// Implement request deduplication (simple version)
const inFlightRequests = new Map();
app.get('/data', (req, res) => {
  const cacheKey = req.originalUrl;
  
  if (inFlightRequests.has(cacheKey)) {
    // Request already in flight, wait for it
    inFlightRequests.get(cacheKey).push(res);
    return;
  }

  const requestPromises: Response[] = [res];
  inFlightRequests.set(cacheKey, requestPromises);

  fetchData().then(data => {
    for (const r of requestPromises) {
      r.json(data);
    }
    inFlightRequests.delete(cacheKey);
  });
});
*/
