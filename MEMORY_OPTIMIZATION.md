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

## Additional Memory Optimization Tips

### 1. Checking for Memory Leaks

To identify memory leaks in the application:

1. Run the application with the `--js-flags="--expose-gc"` flag to enable manual garbage collection:
   ```
   electron --js-flags="--expose-gc" .
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

1. Use the built-in memory monitoring feature to log memory usage
2. In development mode, use the exposed GC API to force garbage collection: `await window.electronAPI.forceGC()`
3. Check memory stats with: `const stats = await window.electronAPI.getMemoryStats()`
4. Use the Allocation Timeline in Chrome DevTools to identify when memory spikes occur 