/**
 * Development memory monitoring UI
 * This file adds a floating panel to monitor memory usage in development mode
 */

// Create and append the memory monitoring panel
function createMemoryPanel() {
  // Create panel container
  const panel = document.createElement('div');
  panel.id = 'memory-panel';
  panel.style.cssText = `
    position: fixed;
    right: 10px;
    top: 40px;
    background-color: rgba(0, 0, 0, 0.8);
    border: 1px solid #00ed64;
    border-radius: 4px;
    padding: 10px;
    font-family: monospace;
    font-size: 12px;
    color: #fff;
    z-index: 9999;
    width: 280px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    display: none;
  `;

  // Create header with toggle button
  const header = document.createElement('div');
  header.style.cssText = `
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
    user-select: none;
    cursor: move;
  `;
  
  // Add title
  const title = document.createElement('div');
  title.innerHTML = '🧠 Memory Monitor';
  title.style.cssText = `
    font-weight: bold;
    color: #00ed64;
  `;
  
  // Add controls
  const controls = document.createElement('div');
  controls.style.cssText = `
    display: flex;
    gap: 8px;
  `;
  
  // Create GC button
  const gcButton = document.createElement('button');
  gcButton.innerHTML = 'GC';
  gcButton.title = 'Force garbage collection';
  gcButton.style.cssText = `
    background: #333;
    color: #fff;
    border: 1px solid #555;
    border-radius: 3px;
    padding: 2px 5px;
    font-size: 10px;
    cursor: pointer;
  `;
  
  // Add minimize button
  const minimizeButton = document.createElement('button');
  minimizeButton.innerHTML = '-';
  minimizeButton.title = 'Minimize panel';
  minimizeButton.style.cssText = `
    background: #333;
    color: #fff;
    border: 1px solid #555;
    border-radius: 3px;
    padding: 2px 5px;
    font-size: 10px;
    cursor: pointer;
  `;
  
  // Add content container
  const content = document.createElement('div');
  content.id = 'memory-panel-content';
  content.style.cssText = `
    line-height: 1.5;
  `;
  
  // Assemble header
  header.appendChild(title);
  controls.appendChild(gcButton);
  controls.appendChild(minimizeButton);
  header.appendChild(controls);
  
  // Create memory stats container
  const statsContainer = document.createElement('div');
  statsContainer.id = 'memory-stats';
  
  // Create chart container
  const chartContainer = document.createElement('div');
  chartContainer.id = 'memory-chart';
  chartContainer.style.cssText = `
    height: 60px;
    margin-top: 8px;
    background-color: #111;
    border-radius: 3px;
    position: relative;
    overflow: hidden;
  `;
  
  // Add floating toggle button
  const toggleButton = document.createElement('button');
  toggleButton.id = 'memory-panel-toggle';
  toggleButton.innerHTML = '🧠';
  toggleButton.title = 'Toggle memory monitor';
  toggleButton.style.cssText = `
    position: fixed;
    top: 40px;
    right: 10px;
    background-color: #00ed64;
    color: #000;
    border: none;
    border-radius: 50%;
    width: 32px;
    height: 32px;
    font-size: 16px;
    display: flex;
    justify-content: center;
    align-items: center;
    cursor: pointer;
    z-index: 10000;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.3);
  `;
  
  // Add all elements to panel
  panel.appendChild(header);
  panel.appendChild(statsContainer);
  panel.appendChild(chartContainer);
  content.appendChild(statsContainer);
  content.appendChild(chartContainer);
  panel.appendChild(content);
  
  // Add to document
  document.body.appendChild(toggleButton);
  document.body.appendChild(panel);
  
  // Panel state
  let isPanelVisible = false;
  let isMinimized = false;
  let memoryData = {
    labels: [],
    heapUsed: [],
    heapTotal: [],
    external: []
  };
  
  // Make panel draggable
  makeDraggable(panel, header);
  
  // Toggle panel visibility
  toggleButton.addEventListener('click', () => {
    isPanelVisible = !isPanelVisible;
    panel.style.display = isPanelVisible ? 'block' : 'none';
    if (isPanelVisible && !isMinimized) {
      updateMemoryStats();
    }
  });
  
  // Minimize panel
  minimizeButton.addEventListener('click', () => {
    isMinimized = !isMinimized;
    content.style.display = isMinimized ? 'none' : 'block';
    minimizeButton.innerHTML = isMinimized ? '+' : '-';
    minimizeButton.title = isMinimized ? 'Expand panel' : 'Minimize panel';
    panel.style.height = isMinimized ? 'auto' : '';
  });
  
  // Trigger GC
  gcButton.addEventListener('click', async () => {
    gcButton.disabled = true;
    gcButton.innerHTML = '...';
    
    try {
      const result = await window.memoryMonitor.forceGarbageCollection();
      gcButton.innerHTML = result ? '✓' : '✗';
      setTimeout(() => {
        gcButton.innerHTML = 'GC';
        gcButton.disabled = false;
        updateMemoryStats();
      }, 1000);
    } catch (error) {
      console.error('Error forcing GC:', error);
      gcButton.innerHTML = '✗';
      setTimeout(() => {
        gcButton.innerHTML = 'GC';
        gcButton.disabled = false;
      }, 1000);
    }
  });
  
  // Get memory stats in bytes
  async function getRawMemoryStats() {
    const stats = await window.electronAPI.getMemoryStats();
    return stats;
  }
  
  // Update memory stats display
  async function updateMemoryStats() {
    if (!isPanelVisible || isMinimized) return;
    
    try {
      const stats = await window.memoryMonitor.getMemoryStats();
      if (!stats) return;
      
      // Get raw stats for chart
      const rawStats = await getRawMemoryStats();
      
      // Update displayed stats
      const statsContainer = document.getElementById('memory-stats');
      statsContainer.innerHTML = `
        <div>RSS: <span style="color:#00ed64">${stats.rss}</span></div>
        <div>Heap Total: <span style="color:#79b8ff">${stats.heapTotal}</span></div>
        <div>Heap Used: <span style="color:#f97583">${stats.heapUsed}</span></div>
        <div>External: <span style="color:#ff9800">${stats.external}</span></div>
      `;
      
      // Update chart data
      const now = new Date();
      const timeStr = `${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}`;
      
      // Limit data points
      const MAX_POINTS = 20;
      if (memoryData.labels.length >= MAX_POINTS) {
        memoryData.labels.shift();
        memoryData.heapUsed.shift();
        memoryData.heapTotal.shift();
        memoryData.external.shift();
      }
      
      // Add new data point
      memoryData.labels.push(timeStr);
      memoryData.heapUsed.push(rawStats.heapUsed);
      memoryData.heapTotal.push(rawStats.heapTotal);
      memoryData.external.push(rawStats.external);
      
      // Draw chart
      drawMemoryChart();
    } catch (error) {
      console.error('Error updating memory stats:', error);
    }
  }
  
  // Draw memory usage chart
  function drawMemoryChart() {
    const chartContainer = document.getElementById('memory-chart');
    chartContainer.innerHTML = '';
    
    if (memoryData.heapUsed.length < 2) return;
    
    // Calculate max value for scaling
    const maxValue = Math.max(
      ...memoryData.heapTotal,
      ...memoryData.heapUsed,
      ...memoryData.external
    );
    
    // Create canvas for drawing
    const canvas = document.createElement('canvas');
    canvas.width = chartContainer.clientWidth;
    canvas.height = chartContainer.clientHeight;
    chartContainer.appendChild(canvas);
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    // Draw background grid
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 0.5;
    
    // Draw horizontal grid lines
    for (let i = 0; i < 4; i++) {
      const y = height - (i * height / 3);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    
    // Function to draw line
    function drawLine(data, color) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      
      for (let i = 0; i < data.length; i++) {
        const x = (i / (data.length - 1)) * width;
        const y = height - ((data[i] / maxValue) * height);
        
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      
      ctx.stroke();
    }
    
    // Draw memory usage lines
    drawLine(memoryData.heapTotal, '#79b8ff');
    drawLine(memoryData.heapUsed, '#f97583');
    drawLine(memoryData.external, '#ff9800');
    
    // Add legend
    const legend = document.createElement('div');
    legend.style.cssText = `
      position: absolute;
      top: 2px;
      right: 5px;
      font-size: 9px;
      display: flex;
      gap: 5px;
    `;
    
    const legendItems = [
      { label: 'Total', color: '#79b8ff' },
      { label: 'Used', color: '#f97583' },
      { label: 'Ext', color: '#ff9800' }
    ];
    
    legendItems.forEach(item => {
      const legendItem = document.createElement('div');
      legendItem.style.cssText = `
        display: flex;
        align-items: center;
        gap: 3px;
      `;
      
      const colorBox = document.createElement('div');
      colorBox.style.cssText = `
        width: 8px;
        height: 8px;
        background-color: ${item.color};
      `;
      
      const label = document.createElement('span');
      label.innerText = item.label;
      
      legendItem.appendChild(colorBox);
      legendItem.appendChild(label);
      legend.appendChild(legendItem);
    });
    
    chartContainer.appendChild(legend);
  }
  
  // Update memory stats periodically
  const memoryInterval = setInterval(updateMemoryStats, 2000);
  
  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    clearInterval(memoryInterval);
  });
  
  // Initial update
  updateMemoryStats();
  
  return {
    toggle: () => {
      isPanelVisible = !isPanelVisible;
      panel.style.display = isPanelVisible ? 'block' : 'none';
    },
    forceUpdate: updateMemoryStats
  };
}

// Make an element draggable
function makeDraggable(element, handle) {
  let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
  
  if (handle) {
    handle.style.cursor = 'move';
    handle.onmousedown = dragMouseDown;
  } else {
    element.onmousedown = dragMouseDown;
  }
  
  function dragMouseDown(e) {
    e = e || window.event;
    e.preventDefault();
    pos3 = e.clientX;
    pos4 = e.clientY;
    document.onmouseup = closeDragElement;
    document.onmousemove = elementDrag;
  }
  
  function elementDrag(e) {
    e = e || window.event;
    e.preventDefault();
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;
    
    // Set new position
    element.style.top = (element.offsetTop - pos2) + "px";
    element.style.left = (element.offsetLeft - pos1) + "px";
    element.style.right = 'auto';
    element.style.bottom = 'auto';
  }
  
  function closeDragElement() {
    document.onmouseup = null;
    document.onmousemove = null;
  }
}

// Initialize memory panel if in development
if (process.env.NODE_ENV === 'development') {
  window.addEventListener('DOMContentLoaded', () => {
    const memoryPanel = createMemoryPanel();
    window.memoryDebugPanel = memoryPanel;
  });
} 