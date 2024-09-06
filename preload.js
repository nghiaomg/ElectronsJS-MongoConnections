const { contextBridge, ipcRenderer } = require('electron')

console.log('Preload: Đang expose electronAPI')

contextBridge.exposeInMainWorld('electronAPI', {
  connectToMongoDB: (connectionString) => ipcRenderer.invoke('connect-to-mongodb', connectionString),
  getCollections: (data) => ipcRenderer.invoke('get-collections', data),
  getDocuments: (data) => ipcRenderer.invoke('get-documents', data),
  updateDocument: (data) => ipcRenderer.invoke('update-document', data),
  createDatabase: (data) => ipcRenderer.invoke('create-database', data),
  renameDatabase: (data) => ipcRenderer.invoke('rename-database', data),
  deleteDatabase: (data) => ipcRenderer.invoke('delete-database', data),
  renameCollection: (data) => ipcRenderer.invoke('rename-collection', data),
  deleteCollection: (data) => ipcRenderer.invoke('delete-collection', data),
  createCollection: (data) => ipcRenderer.invoke('create-collection', data),
  createDocument: (data) => ipcRenderer.invoke('create-document', data),
  deleteDocument: (data) => ipcRenderer.invoke('delete-document', data),
})

console.log('Preload: electronAPI đã được expose')
