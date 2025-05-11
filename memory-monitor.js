/**
 * Utility functions for monitoring memory usage in the application
 */

// Format memory size to readable format
function formatMemorySize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  const kb = bytes / 1024;
  if (kb < 1024) return kb.toFixed(2) + ' KB';
  const mb = kb / 1024;
  if (mb < 1024) return mb.toFixed(2) + ' MB';
  const gb = mb / 1024;
  return gb.toFixed(2) + ' GB';
}

// Get memory stats from main process
async function getMemoryStats() {
  try {
    // Check if API is available
    if (!window.electronAPI || !window.electronAPI.getMemoryStats) {
      console.warn('Memory stats API not available');
      return null;
    }
    
    const stats = await window.electronAPI.getMemoryStats();
    return {
      rss: formatMemorySize(stats.rss),
      heapTotal: formatMemorySize(stats.heapTotal),
      heapUsed: formatMemorySize(stats.heapUsed),
      external: formatMemorySize(stats.external),
      arrayBuffers: stats.arrayBuffers ? formatMemorySize(stats.arrayBuffers) : 'N/A'
    };
  } catch (error) {
    console.error('Error getting memory stats:', error);
    return null;
  }
}

// Force garbage collection (only works in dev mode with --expose-gc flag)
async function forceGarbageCollection() {
  try {
    // Check if API is available
    if (!window.electronAPI || !window.electronAPI.forceGC) {
      console.warn('GC API not available');
      return false;
    }
    
    const result = await window.electronAPI.forceGC();
    return result;
  } catch (error) {
    console.error('Error forcing garbage collection:', error);
    return false;
  }
}

// Monitor memory usage periodically and log to console
function startMemoryMonitor(intervalMs = 30000, logToConsole = true) {
  let intervalId;
  
  const checkMemory = async () => {
    const stats = await getMemoryStats();
    if (stats && logToConsole) {
      console.log('🧠 Memory Usage:');
      console.log(`- RSS: ${stats.rss}`);
      console.log(`- Heap Total: ${stats.heapTotal}`);
      console.log(`- Heap Used: ${stats.heapUsed}`);
      console.log(`- External: ${stats.external}`);
      console.log(`- Array Buffers: ${stats.arrayBuffers}`);
    }
    return stats;
  };
  
  // Initial check
  checkMemory();
  
  // Setup interval
  intervalId = setInterval(checkMemory, intervalMs);
  
  // Return function to stop monitoring
  return () => {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };
}

// Export functions
window.memoryMonitor = {
  getMemoryStats,
  forceGarbageCollection,
  startMemoryMonitor,
  formatMemorySize
}; 