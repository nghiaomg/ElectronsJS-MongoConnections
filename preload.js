const { contextBridge, ipcRenderer } = require("electron");

console.log("Preload: Đang expose electronAPI");

contextBridge.exposeInMainWorld("electronAPI", {
  connectToMongoDB: (connectionString) =>
    ipcRenderer.invoke("connect-to-mongodb", connectionString),
  getCollections: (data) => ipcRenderer.invoke("get-collections", data),
  getDocuments: (data) => ipcRenderer.invoke("get-documents", data),
  updateDocument: (data) => ipcRenderer.invoke("update-document", data),
  createDatabase: (data) => ipcRenderer.invoke("create-database", data),
  renameDatabase: (data) => ipcRenderer.invoke("rename-database", data),
  deleteDatabase: (data) => ipcRenderer.invoke("delete-database", data),
  renameCollection: (data) => ipcRenderer.invoke("rename-collection", data),
  deleteCollection: (data) => ipcRenderer.invoke("delete-collection", data),
  createCollection: (data) => ipcRenderer.invoke("create-collection", data),
  createDocument: (data) => ipcRenderer.invoke("create-document", data),
  deleteDocument: (data) => ipcRenderer.invoke("delete-document", data),
  minimizeWindow: () => ipcRenderer.send("minimize-window"),
  maximizeWindow: () => ipcRenderer.send("maximize-window"),
  closeWindow: () => ipcRenderer.send("close-window"),
  onMaximize: (callback) => ipcRenderer.on("window-maximized", callback),
  onUnmaximize: (callback) => ipcRenderer.on("window-unmaximized", callback),
  // Memory management APIs (only available in development)
  forceGC: () => ipcRenderer.invoke("gc"),
  getMemoryStats: () => ipcRenderer.invoke("get-memory-stats"),
  // Gemini API key management
  getGeminiApiKey: () => ipcRenderer.invoke("get-gemini-api-key"),
  saveGeminiApiKey: (apiKey) =>
    ipcRenderer.invoke("save-gemini-api-key", apiKey),
  generateGeminiResponse: (prompt, dbContext) =>
    ipcRenderer.invoke("generate-gemini-response", prompt, dbContext),
  // New API handlers for collection fields and query execution
  getCollectionFields: (data) =>
    ipcRenderer.invoke("get-collection-fields", data),
  executeQuery: (data) => ipcRenderer.invoke("execute-query", data),
});

console.log("Preload: electronAPI đã được expose");
