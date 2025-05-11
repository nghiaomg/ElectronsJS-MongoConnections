# Memory Optimization Guidelines

This document provides guidelines for optimizing memory usage in the ElectronJS MongoDB application.

## Current Optimizations

The application has been optimized to reduce memory usage from 150MB to approximately 50MB by implementing the following strategies:

### 1. Browser Window Optimization

- Using only a single BrowserWindow to minimize memory usage (each BrowserWindow uses 40MB+ of RAM)
- Configured proper webPreferences to disable unnecessary features:
  - Disabled DevTools in production
  - Enabled backgroundThrottling
  - Disabled spellcheck
  - Disabled WebSQL
  - Other optimized settings

### 2. MongoDB Connection Management

- Properly closing MongoDB connections after use with try/finally blocks
- Optimized connection settings with:
  - Limited connection pool size
  - Connection timeouts
  - Idle connection management
- Using batched operations for large data transfers
- Using projection and limits in queries to retrieve only necessary data

### 3. Memory Monitoring

- Added memory usage monitoring that logs memory stats every 30 seconds
- Implemented optional garbage collection triggering when heap usage exceeds threshold
- Created visual memory monitoring panel in development mode (see Development Tools section)

## Development Tools

### Memory Monitoring Panel

In development mode, a memory monitoring panel is available:

1. Click the 🧠 button in the top-right corner to open the panel
2. The panel shows:
   - Live memory usage stats (RSS, Heap Total, Heap Used, External)
   - Memory usage graph over time
   - GC button to manually trigger garbage collection

This panel helps:
- Identify memory leaks and usage patterns
- Monitor the effects of operations on memory usage
- Trigger garbage collection to see if memory issues are related to GC

### Console Memory Monitoring

In addition to the visual panel, detailed memory stats are logged to the console at regular intervals.

## Additional Memory Optimization Tips

### 1. Checking for Memory Leaks

To identify memory leaks in the application:

1. Run the application with the `--js-flags="--expose-gc"` flag to enable manual garbage collection:
   ```
   npm run dev
   ```

2. Use Chrome DevTools to take heap snapshots:
   - Open DevTools in development mode
   - Go to Memory tab
   - Take a heap snapshot
   - Perform operations in the app
   - Take another snapshot
   - Compare snapshots to find growing objects

### 2. Library-Specific Optimizations

- **MongoDB**: Already using the native driver instead of Mongoose, which is more memory-efficient
- **Date handling**: If you need to add date manipulation, use dayjs instead of moment.js
- **Utility libraries**: Use specific imports from lodash instead of importing the entire library

### 3. General Electron Memory Tips

- Use a single process model when possible
- Limit the number of remote objects being passed between main and renderer
- Free resources like file handles, network connections, and event listeners when not needed
- Be cautious with using timers and intervals
- Consider using workers for heavy computational tasks

## Debugging Memory Issues

If you encounter memory issues:

1. Use the built-in memory monitoring panel in development mode
2. In development mode, use the exposed GC API: `await window.electronAPI.forceGC()`
3. Check memory stats with: `const stats = await window.electronAPI.getMemoryStats()`
4. Use the Allocation Timeline in Chrome DevTools to identify when memory spikes occur
5. Look for common patterns in memory leaks:
   - Event listeners not being removed
   - Unused connections remaining open
   - Large data being cached unnecessarily
   - Circular references preventing garbage collection 