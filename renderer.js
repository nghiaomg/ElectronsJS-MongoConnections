function parseCustomJSON(jsonString) {
  return JSON.parse(jsonString, (key, value) => {
    if (typeof value === 'string' && value.startsWith('new ObjectId(')) {
      return value;
    }
    return value;
  });
}

document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM đã sẵn sàng');

  console.log('electronAPI:', window.electronAPI);

  if (!window.electronAPI) {
    console.error('electronAPI không được định nghĩa. Kiểm tra preload.js');
    return;
  }

  const connectButton = document.getElementById('connect-button');
  const connectionStringInput = document.getElementById('connection-string');
  const loadingSpinner = document.getElementById('loading-spinner');
  const connectionError = document.getElementById('connection-error');

  if (!connectButton) {
    console.error('Không tìm thấy phần tử có id "connect-button"');
    return;
  }

  if (!connectionStringInput) {
    console.error('Không tìm thấy phần tử có id "connection-string"');
    return;
  }

  const connectButtonText = connectButton.querySelector('span');

  if (!connectButtonText) {
    console.error('Không tìm thấy phần tử span trong connect-button');
    return;
  }

  connectButton.addEventListener('click', async () => {
    console.log('Nút kết nối được nhấn');
    const connectionString = connectionStringInput.value;
    console.log('Connection string:', connectionString);
  
    if (loadingSpinner) loadingSpinner.style.display = 'block';
    if (connectButtonText) connectButtonText.style.display = 'none';
    if (connectionError) connectionError.style.display = 'none';
    connectButton.disabled = true;
  
    try {
      console.log('Đang thử kết nối...');
      if (!window.electronAPI) {
        throw new Error('electronAPI không được định nghĩa');
      }
      const databases = await window.electronAPI.connectToMongoDB(connectionString);
      console.log('Kết nối thành công:', databases);
      displayDatabases(databases);
      showElementsAfterConnect();
    } catch (error) {
      console.error('Connection error:', error);
      if (connectionError) {
        connectionError.textContent = `Connection error: ${error.message}`;
        connectionError.style.display = 'block';
      }
    } finally {
      if (loadingSpinner) loadingSpinner.style.display = 'none';
      if (connectButtonText) connectButtonText.style.display = 'flex';
      connectButton.disabled = false;
    }
  });

  function showElementsAfterConnect() {
    const hiddenElements = document.querySelectorAll('.hidden-before-connect');
    hiddenElements.forEach(element => {
      element.classList.remove('hidden-before-connect');
    });
  }


  const addEventListenerSafely = (id, event, handler) => {
    const element = document.getElementById(id);
    if (element) {
      element.addEventListener(event, handler);
      console.log(`Event listener added for ${id}`);
    } else {
      console.warn(`Element with id '${id}' not found`);
    }
  };

  addEventListenerSafely('save-edit', 'click', saveEdit);
  addEventListenerSafely('cancel-edit', 'click', closeModal);
  addEventListenerSafely('format-json', 'click', formatJSON);
  addEventListenerSafely('reload-btn', 'click', reload);
  addEventListenerSafely('new-document-btn', 'click', showNewDocumentModal);

  const tableViewBtn = document.getElementById('table-view-btn');
  const jsonViewBtn = document.getElementById('json-view-btn');

  tableViewBtn.addEventListener('click', () => switchView('table'));
  jsonViewBtn.addEventListener('click', () => switchView('json'));


  window.onclick = function(event) {
    const modal = document.getElementById('modal-container');
    if (event.target == modal) {
      closeModal();
    }
  }

  const closeModalButton = document.querySelector('.close-modal');
  if (closeModalButton) {
    closeModalButton.addEventListener('click', closeModal);
    console.log('Event listener added for close-modal');
  } else {
    console.warn("Element with class 'close-modal' not found");
  }

  const modal = document.getElementById('modal-container');
  if (modal) {
    modal.style.display = 'none';
  }
});

function displayDatabases(databases) {
  const dbList = document.getElementById('database-list');
  dbList.innerHTML = '';

  const createDbButton = document.createElement('div');
  createDbButton.className = 'create-db';
  createDbButton.innerHTML = `
    <i class="fas fa-plus"></i>
    <span>New Database</span>
  `;
  createDbButton.addEventListener('click', showCreateDatabaseModal);
  dbList.appendChild(createDbButton);

  databases.forEach(db => {
    const dbElement = document.createElement('div');
    dbElement.className = 'database-item';
    dbElement.innerHTML = `
      <i class="fas fa-database"></i>
      <span>${db}</span>
    `;
    dbElement.addEventListener('click', () => loadCollections(db));
    dbElement.addEventListener('contextmenu', (e) => showDatabaseContextMenu(e, db));
    dbList.appendChild(dbElement);
  });
}

function showDatabaseContextMenu(event, dbName) {
  event.preventDefault();
  
  removeContextMenu();

  const contextMenu = document.createElement('div');
  contextMenu.className = 'context-menu';
  contextMenu.innerHTML = `
    <div class="context-menu-item rename-db">
      <i class="fas fa-edit"></i> Rename
    </div>
    <div class="context-menu-item delete-db">
      <i class="fas fa-trash-alt"></i> Delete
    </div>
  `;
  
  contextMenu.style.left = `${event.clientX}px`;
  contextMenu.style.top = `${event.clientY}px`;
  
  document.body.appendChild(contextMenu);
  
  contextMenu.querySelector('.rename-db').addEventListener('click', () => {
    showRenameDatabaseModal(dbName);
    removeContextMenu();
  });
  
  contextMenu.querySelector('.delete-db').addEventListener('click', () => {
    showDeleteDatabaseConfirmation(dbName);
    removeContextMenu();
  });
  
  document.addEventListener('click', removeContextMenu);
  
  function removeContextMenu() {
    const existingMenu = document.querySelector('.context-menu');
    if (existingMenu) {
      existingMenu.remove();
    }
    document.removeEventListener('click', removeContextMenu);
  }
}

function showRenameDatabaseModal(dbName) {
  const modal = document.getElementById('modal-container');
  const modalContent = modal.querySelector('.modal-content');
  modalContent.innerHTML = `
    <h2><i class="fas fa-edit"></i> Rename Database</h2>
    <p>Current name: <strong>${dbName}</strong></p>
    <input type="text" id="new-db-name" value="${dbName}" placeholder="Enter new database name">
    <div class="modal-buttons">
      <button id="rename-db-btn" class="primary-btn">
        <i class="fas fa-check"></i> Rename
      </button>
      <button id="cancel-rename-db" class="secondary-btn">
        <i class="fas fa-times"></i> Cancel
      </button>
    </div>
    <div id="rename-db-error" class="error-message"></div>
  `;

  document.getElementById('rename-db-btn').addEventListener('click', () => renameDatabase(dbName));
  document.getElementById('cancel-rename-db').addEventListener('click', closeModal);

  modal.style.display = 'flex';
}

async function renameDatabase(oldDbName) {
  const newDbName = document.getElementById('new-db-name').value.trim();
  const errorElement = document.getElementById('rename-db-error');
  const renameButton = document.getElementById('rename-db-btn');

  if (!newDbName) {
    errorElement.textContent = 'New database name cannot be empty';
    errorElement.style.display = 'block';
    return;
  }

  try {
    renameButton.disabled = true;
    renameButton.textContent = 'Renaming...';
    const connectionString = document.getElementById('connection-string').value;
    const success = await window.electronAPI.renameDatabase({ connectionString, oldDbName, newDbName });
    reload();
    if (success) {
      closeModal();
    } else {
      throw new Error('Failed to rename database');
    }
  } catch (error) {
    errorElement.textContent = `Error renaming database: ${error.message}`;
    errorElement.style.display = 'block';
  } finally {
    renameButton.disabled = false;
    renameButton.textContent = 'Rename';
  }
}

function showDeleteDatabaseConfirmation(dbName) {
  const modal = document.getElementById('modal-container');
  const modalContent = modal.querySelector('.modal-content');
  modalContent.innerHTML = `
    <h2><i class="fas fa-exclamation-triangle"></i> Delete Database</h2>
    <p>Are you sure you want to delete the database "<strong>${dbName}</strong>"?</p>
    <p class="warning-text">This action cannot be undone.</p>
    <div class="modal-buttons">
      <button id="confirm-delete-db" class="danger-btn">
        <i class="fas fa-trash-alt"></i> Delete
      </button>
      <button id="cancel-delete-db" class="secondary-btn">
        <i class="fas fa-times"></i> Cancel
      </button>
    </div>
    <div id="delete-db-error" class="error-message"></div>
  `;

  document.getElementById('confirm-delete-db').addEventListener('click', () => deleteDatabase(dbName));
  document.getElementById('cancel-delete-db').addEventListener('click', closeModal);

  modal.style.display = 'flex';
}

async function deleteDatabase(dbName) {
  try {
    const connectionString = document.getElementById('connection-string').value;
    const success = await window.electronAPI.deleteDatabase({ connectionString, dbName });
    reload();
    if (success) {
      closeModal();
    } else {
      throw new Error('Failed to delete database');
    }
  } catch (error) {
    const errorElement = document.getElementById('delete-db-error');
    errorElement.textContent = `Error deleting database: ${error.message}`;
    errorElement.style.display = 'block';
  }
}

function showCreateDatabaseModal() {
  const modal = document.getElementById('modal-container');
  const modalContent = modal.querySelector('.modal-content');
  modalContent.innerHTML = `
    <h2>Create New Database</h2>
    <input type="text" id="new-db-name" placeholder="Enter database name">
    <input type="text" id="new-collection-name" placeholder="Enter first collection name">
    <div class="modal-buttons">
      <button id="create-db-btn" class="primary-btn">Create</button>
      <button id="cancel-create-db" class="secondary-btn">Cancel</button>
    </div>
    <div id="create-db-error" class="error-message"></div>
  `;

  document.getElementById('create-db-btn').addEventListener('click', createNewDatabase);
  document.getElementById('cancel-create-db').addEventListener('click', closeModal);

  modal.style.display = 'flex';
}

async function createNewDatabase() {
  const dbName = document.getElementById('new-db-name').value.trim();
  const collectionName = document.getElementById('new-collection-name').value.trim();
  const errorElement = document.getElementById('create-db-error');

  if (!dbName || !collectionName) {
    errorElement.textContent = 'Database name and collection name cannot be empty';
    errorElement.style.display = 'block';
    return;
  }

  try {
    const connectionString = document.getElementById('connection-string').value;
    const success = await window.electronAPI.createDatabase({ connectionString, dbName, collectionName });
    reload();
    if (success) {
      closeModal();
    } else {
      throw new Error('Failed to create database');
    }
  } catch (error) {
    errorElement.textContent = `Error creating database: ${error.message}`;
    errorElement.style.display = 'block';
  }
}

async function reload() {
  console.log('Reloading...');
  return new Promise(async (resolve) => {
      const connectionString = document.getElementById('connection-string').value;
      if (!connectionString) {
        console.error('Connection string is empty');
        resolve();
        return;
      }
      try {
        console.log('Fetching databases...');
        const databases = await window.electronAPI.connectToMongoDB(connectionString);
        console.log('Displaying databases...');
        displayDatabases(databases);
        if (currentDbName) {
          console.log(`Loading collections for ${currentDbName}...`);
          await loadCollections(currentDbName);
          if (currentCollectionName) {
            console.log(`Loading documents for ${currentDbName}.${currentCollectionName}...`);
            await loadDocuments(currentDbName, currentCollectionName);
          }
        }
        console.log('Reload completed');
        resolve();
      } catch (error) {
        console.error('Error reloading data:', error);
        alert('Failed to reload data: ' + error.message);
        resolve();
      }
  });
}

async function loadCollections(dbName) {
  currentDbName = dbName;
  currentCollectionName = null;
  hideElementsBeforeCollection();
  const connectionString = document.getElementById('connection-string').value;
  try {
    console.log(`Loading collections for ${dbName}...`);
    const collections = await window.electronAPI.getCollections({ connectionString, dbName });
    console.log(`Displaying collections for ${dbName}...`);
    displayCollections(collections, dbName);
  } catch (error) {
    console.error('Error loading collections:', error);
    alert('Error loading collections: ' + error.message);
  }
}

function hideElementsBeforeCollection() {
  const hiddenElements = document.querySelectorAll('.hidden-before-collection');
  hiddenElements.forEach(element => {
    element.classList.add('hidden-before-collection');
  });
}

function displayCollections(collections, dbName) {
  const collectionList = document.getElementById('collection-list');
  collectionList.innerHTML = '';

  const createCollectionButton = document.createElement('div');
  createCollectionButton.className = 'create-collection';
  createCollectionButton.innerHTML = `
    <i class="fas fa-plus"></i>
    <span>New Collection</span>
  `;
  createCollectionButton.addEventListener('click', () => showCreateCollectionModal(dbName));
  collectionList.appendChild(createCollectionButton);

  collections.forEach(collection => {
    const collectionElement = document.createElement('div');
    collectionElement.className = 'collection-item';
    collectionElement.innerHTML = `
      <i class="fas fa-folder"></i>
      <span>${collection}</span>
    `;
    collectionElement.addEventListener('click', () => loadDocuments(dbName, collection));
    collectionElement.addEventListener('contextmenu', (e) => showCollectionContextMenu(e, dbName, collection));
    collectionList.appendChild(collectionElement);
  });
}

function showCreateCollectionModal(dbName) {
  const modal = document.getElementById('modal-container');
  const modalContent = modal.querySelector('.modal-content');
  modalContent.innerHTML = `
    <h2><i class="fas fa-folder-plus"></i> Create New Collection</h2>
    <p>Database: <strong>${dbName}</strong></p>
    <input type="text" id="new-collection-name" placeholder="Enter collection name">
    <div class="modal-buttons">
      <button id="create-collection-btn" class="primary-btn">
        <i class="fas fa-plus"></i> Create
      </button>
      <button id="cancel-create-collection" class="secondary-btn">
        <i class="fas fa-times"></i> Cancel
      </button>
    </div>
    <div id="create-collection-error" class="error-message"></div>
  `;

  document.getElementById('create-collection-btn').addEventListener('click', () => createNewCollection(dbName));
  document.getElementById('cancel-create-collection').addEventListener('click', closeModal);

  modal.style.display = 'flex';
}

async function createNewCollection(dbName) {
  const collectionName = document.getElementById('new-collection-name').value.trim();
  const errorElement = document.getElementById('create-collection-error');

  if (!collectionName) {
    errorElement.textContent = 'Collection name cannot be empty';
    errorElement.style.display = 'block';
    return;
  }

  try {
    const connectionString = document.getElementById('connection-string').value;
    const success = await window.electronAPI.createCollection({ connectionString, dbName, collectionName });
    reload();
    if (success) {
      closeModal();
    } else {
      throw new Error('Failed to create collection');
    }
  } catch (error) {
    errorElement.textContent = `Error creating collection: ${error.message}`;
    errorElement.style.display = 'block';
  }
}

function showCollectionContextMenu(event, dbName, collectionName) {
  event.preventDefault();
  
  removeContextMenu();

  const contextMenu = document.createElement('div');
  contextMenu.className = 'context-menu';
  contextMenu.innerHTML = `
    <div class="context-menu-item rename-collection">
      <i class="fas fa-edit"></i> Rename
    </div>
    <div class="context-menu-item delete-collection">
      <i class="fas fa-trash-alt"></i> Delete
    </div>
  `;
  
  contextMenu.style.left = `${event.clientX}px`;
  contextMenu.style.top = `${event.clientY}px`;
  
  document.body.appendChild(contextMenu);
  
  contextMenu.querySelector('.rename-collection').addEventListener('click', () => {
    showRenameCollectionModal(dbName, collectionName);
    removeContextMenu();
  });
  
  contextMenu.querySelector('.delete-collection').addEventListener('click', () => {
    showDeleteCollectionConfirmation(dbName, collectionName);
    removeContextMenu();
  });
  
  document.addEventListener('click', removeContextMenu);
}

function showRenameCollectionModal(dbName, collectionName) {
  const modal = document.getElementById('modal-container');
  const modalContent = modal.querySelector('.modal-content');
  modalContent.innerHTML = `
    <h2><i class="fas fa-edit"></i> Rename Collection</h2>
    <p>Current name: <strong>${collectionName}</strong></p>
    <input type="text" id="new-collection-name" value="${collectionName}" placeholder="Enter new collection name">
    <div class="modal-buttons">
      <button id="rename-collection-btn" class="primary-btn">
        <i class="fas fa-check"></i> Rename
      </button>
      <button id="cancel-rename-collection" class="secondary-btn">
        <i class="fas fa-times"></i> Cancel
      </button>
    </div>
    <div id="rename-collection-error" class="error-message"></div>
  `;

  document.getElementById('rename-collection-btn').addEventListener('click', () => renameCollection(dbName, collectionName));
  document.getElementById('cancel-rename-collection').addEventListener('click', closeModal);

  modal.style.display = 'flex';
}

async function renameCollection(dbName, oldCollectionName) {
  const newCollectionName = document.getElementById('new-collection-name').value.trim();
  const errorElement = document.getElementById('rename-collection-error');
  const renameButton = document.getElementById('rename-collection-btn');

  if (!newCollectionName) {
    errorElement.textContent = 'New collection name cannot be empty';
    errorElement.style.display = 'block';
    return;
  }

  try {
    renameButton.disabled = true;
    renameButton.textContent = 'Renaming...';
    const connectionString = document.getElementById('connection-string').value;
    const success = await window.electronAPI.renameCollection({ connectionString, dbName, oldCollectionName, newCollectionName });
    reload();
    if (success) {
      closeModal();
    } else {
      throw new Error('Failed to rename collection');
    }
  } catch (error) {
    errorElement.textContent = `Error renaming collection: ${error.message}`;
    errorElement.style.display = 'block';
  } finally {
    renameButton.disabled = false;
    renameButton.textContent = 'Rename';
  }
}

function showDeleteCollectionConfirmation(dbName, collectionName) {
  const modal = document.getElementById('modal-container');
  const modalContent = modal.querySelector('.modal-content');
  modalContent.innerHTML = `
    <h2><i class="fas fa-exclamation-triangle"></i> Delete Collection</h2>
    <p>Are you sure you want to delete the collection "<strong>${collectionName}</strong>"?</p>
    <p class="warning-text">This action cannot be undone.</p>
    <div class="modal-buttons">
      <button id="confirm-delete-collection" class="danger-btn">
        <i class="fas fa-trash-alt"></i> Delete
      </button>
      <button id="cancel-delete-collection" class="secondary-btn">
        <i class="fas fa-times"></i> Cancel
      </button>
    </div>
    <div id="delete-collection-error" class="error-message"></div>
  `;

  document.getElementById('confirm-delete-collection').addEventListener('click', () => deleteCollection(dbName, collectionName));
  document.getElementById('cancel-delete-collection').addEventListener('click', closeModal);

  modal.style.display = 'flex';
}

async function deleteCollection(dbName, collectionName) {
  try {
    const connectionString = document.getElementById('connection-string').value;
    const success = await window.electronAPI.deleteCollection({ connectionString, dbName, collectionName });
    reload();
    if (success) {
      closeModal();
      await loadCollections(dbName);
    } else {
      throw new Error('Failed to delete collection');
    }
  } catch (error) {
    const errorElement = document.getElementById('delete-collection-error');
    errorElement.textContent = `Error deleting collection: ${error.message}`;
    errorElement.style.display = 'block';
  }
}

async function loadDocuments(dbName, collectionName) {
  currentDbName = dbName;
  currentCollectionName = collectionName;
  document.getElementById('current-collection-name').textContent = `Collection: ${collectionName}`;
  showElementsAfterCollectionSelect();
  showLoader();
  try {
    console.log(`Loading documents for ${dbName}.${collectionName}...`);
    const connectionString = document.getElementById('connection-string').value;
    const documentsString = await window.electronAPI.getDocuments({ connectionString, dbName, collectionName });
    const documents = parseCustomJSON(documentsString);
    console.log('Displaying documents...');
    displayDocuments(documents);
  } catch (error) {
    console.error('Error loading documents:', error);
    alert('Error loading documents: ' + error.message);
  } finally {
    hideLoader();
  }
}

function showElementsAfterCollectionSelect() {
  const hiddenElements = document.querySelectorAll('.hidden-before-collection');
  hiddenElements.forEach(element => {
    element.classList.remove('hidden-before-collection');
  });
}

let currentEditingDoc = null;

function displayDocuments(documents) {
  currentDocuments = documents;
  const documentView = document.getElementById('document-view');
  documentView.innerHTML = '';

  if (Array.isArray(documents) && documents.length > 0) {
    if (currentView === 'table') {
      displayTableView(documents);
    } else {
      displayJSONView(documents);
    }

    const editButtons = document.querySelectorAll('.edit-btn');
    editButtons.forEach((button, index) => {
      button.addEventListener('click', () => editDocument(documents[index], index));
    });

    const deleteButtons = document.querySelectorAll('.delete-btn');
    deleteButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        showDeleteConfirmationModal(id);
      });
    });
  } else {
    documentView.innerHTML = '<p>No documents found or invalid data received.</p>';
    console.log('Documents data:', documents);
  }
}

function showDeleteConfirmationModal(documentId) {
  const modal = document.getElementById('modal-container');
  const modalContent = modal.querySelector('.modal-content');
  modalContent.innerHTML = `
    <h2><i class="fas fa-exclamation-triangle"></i> Delete Document</h2>
    <p>Are you sure you want to delete this document?</p>
    <p class="warning-text">This action cannot be undone.</p>
    <div class="modal-buttons">
      <button id="confirm-delete" class="danger-btn">
        <i class="fas fa-trash-alt"></i> Delete
      </button>
      <button id="cancel-delete" class="secondary-btn">
        <i class="fas fa-times"></i> Cancel
      </button>
    </div>
    <div id="delete-error" class="error-message"></div>
  `;

  document.getElementById('confirm-delete').addEventListener('click', () => deleteDocument(documentId));
  document.getElementById('cancel-delete').addEventListener('click', closeModal);

  modal.style.display = 'flex';
}
async function deleteDocument(documentId) {
  try {
    const connectionString = document.getElementById('connection-string').value;
    const success = await window.electronAPI.deleteDocument({
      connectionString,
      dbName: currentDbName,
      collectionName: currentCollectionName,
      documentId
    });
    if (success) {
      closeModal();
      await loadDocuments(currentDbName, currentCollectionName);
    } else {
      throw new Error('Failed to delete document');
    }
  } catch (error) {
    const errorElement = document.getElementById('delete-error');
    errorElement.textContent = `Error deleting document: ${error.message}`;
    errorElement.style.display = 'block';
  }
}
let editor;

function initializeCodeMirror(content) {
  if (editor) {
    editor.toTextArea();
  }
  const codeEditorElement = document.getElementById('code-editor');
  if (!codeEditorElement) {
    console.error('Code editor element not found');
    return;
  }

  codeEditorElement.innerHTML = '<textarea id="code-textarea"></textarea>';
  const textarea = document.getElementById('code-textarea');
  if (!textarea) {
    console.error('Textarea not found');
    return;
  }

  textarea.value = content;

  editor = CodeMirror.fromTextArea(textarea, {
    mode: "application/json",
    theme: "dracula",
    lineNumbers: false,
    matchBrackets: true,
    autoCloseBrackets: true,
    indentUnit: 2,
    tabSize: 2,
    indentWithTabs: false,
    foldGutter: true,
    gutters: ["CodeMirror-foldgutter"] 
  });

  editor.setSize(null, 300);
}

function showNewDocumentModal() {
  const modal = document.getElementById('modal-container');
  if (!modal) {
    console.error('Modal container not found');
    return;
  }

  const modalContent = modal.querySelector('.modal-content');
  if (!modalContent) {
    console.error('Modal content not found');
    return;
  }

  modalContent.innerHTML = `
    <h2 id="modal-title">Create New Document</h2>
    <div id="code-editor"></div>
    <div id="error-message" class="error-message"></div>
    <div class="modal-buttons">
      <button id="save-edit" class="primary-btn">Create</button>
      <button id="cancel-edit" class="secondary-btn">Cancel</button>
      <button id="format-json" class="secondary-btn">Format JSON</button>
    </div>
  `;
  
  initializeCodeMirror('{\n  \n}');

  const saveButton = document.getElementById('save-edit');
  const cancelButton = document.getElementById('cancel-edit');
  const formatButton = document.getElementById('format-json');

  if (saveButton) {
    saveButton.onclick = createNewDocument;
  } else {
    console.error('Save button not found');
  }

  if (cancelButton) {
    cancelButton.onclick = closeModal;
  } else {
    console.error('Cancel button not found');
  }

  if (formatButton) {
    formatButton.onclick = formatJSON;
  } else {
    console.error('Format JSON button not found');
  }

  modal.style.display = 'flex';
}

function editDocument(doc, index) {
  currentEditingDoc = { doc, index }; 
  const modal = document.getElementById('modal-container');
  if (!modal) {
    console.error('Modal container not found');
    return;
  }

  const modalContent = modal.querySelector('.modal-content');
  if (!modalContent) {
    console.error('Modal content not found');
    return;
  }

  modalContent.innerHTML = `
    <h2 id="modal-title">Edit Document</h2>
    <div id="code-editor"></div>
    <div id="error-message" class="error-message"></div>
    <div class="modal-buttons">
      <button id="save-edit" class="primary-btn">Save</button>
      <button id="cancel-edit" class="secondary-btn">Cancel</button>
      <button id="format-json" class="secondary-btn">Format JSON</button>
    </div>
  `;

  initializeCodeMirror(JSON.stringify(doc, null, 2));

  const saveButton = document.getElementById('save-edit');
  const cancelButton = document.getElementById('cancel-edit');
  const formatButton = document.getElementById('format-json');

  if (saveButton) {
    saveButton.onclick = saveEdit;
  } else {
    console.error('Save button not found');
  }

  if (cancelButton) {
    cancelButton.onclick = closeModal;
  } else {
    console.error('Cancel button not found');
  }

  if (formatButton) {
    formatButton.onclick = formatJSON;
  } else {
    console.error('Format JSON button not found');
  }

  modal.style.display = 'flex';
}

function formatJSON() {
  try {
    const currentValue = editor.getValue();
    const formattedJSON = JSON.stringify(JSON.parse(currentValue), null, 2);
    editor.setValue(formattedJSON);
  } catch (error) {
    console.error('Error formatting JSON:', error);
    alert('Invalid JSON: ' + error.message);
  }
}

async function createNewDocument() {
  const newDocumentContent = editor.getValue().trim();
  const errorElement = document.getElementById('error-message');

  try {
    if (!newDocumentContent) {
      throw new Error('Document content cannot be empty');
    }

    let parsedJSON;
    try {
      parsedJSON = JSON.parse(newDocumentContent);
    } catch (jsonError) {
      console.error('JSON parsing error:', jsonError);
      throw new Error(`Invalid JSON: ${jsonError.message}. Please check your input.`);
    }

    if (typeof parsedJSON !== 'object' || parsedJSON === null || Array.isArray(parsedJSON)) {
      throw new Error('Invalid JSON: Root element must be an object');
    }

    console.log('Parsed JSON:', parsedJSON);

    const connectionString = document.getElementById('connection-string').value;
    const success = await window.electronAPI.createDocument({
      connectionString,
      dbName: currentDbName,
      collectionName: currentCollectionName,
      document: parsedJSON
    });

    loadDocuments(currentDbName, currentCollectionName);
    if (success) {
      closeModal();
    } else {
      throw new Error('Failed to create document');
    }
  } catch (error) {
    console.error('Error creating document:', error);
    errorElement.textContent = `Error: ${error.message}`;
    errorElement.style.display = 'block';
  }
}

function saveEdit() {
  const editedContent = editor.getValue();
  const errorMessageElement = document.getElementById('error-message');
  
  try {
    let editedDoc = JSON.parse(editedContent);
    console.log('Document edited:', editedDoc);
    
    if (!currentEditingDoc || !currentEditingDoc.doc || !currentEditingDoc.doc._id) {
      throw new Error('Original document ID is missing');
    }
    
    const documentId = currentEditingDoc.doc._id;
    
    if (editedDoc._id) {
      delete editedDoc._id;
    }
    
    if (!currentDbName || !currentCollectionName) {
      throw new Error('Database or Collection not selected');
    }
    
    window.electronAPI.updateDocument({
      connectionString: document.getElementById('connection-string').value,
      dbName: currentDbName,
      collectionName: currentCollectionName,
      documentId: documentId,
      updatedDoc: editedDoc
    })
    .then((success) => {
      if (success) {
        closeModal();
        loadDocuments(currentDbName, currentCollectionName);
      } else {
        throw new Error('Failed to update document');
      }
    })
    .catch(error => {
      errorMessageElement.textContent = `Error updating document: ${error.message}`;
      errorMessageElement.style.display = 'block';
    });
    
  } catch (error) {
    console.error('Error in saveEdit:', error);
    errorMessageElement.textContent = `Error: ${error.message}`;
    errorMessageElement.style.display = 'block';
  }
}

function closeModal() {
  const modal = document.getElementById('modal-container');
  if (modal) {
    modal.style.display = 'none';
    const modalContent = modal.querySelector('.modal-content');
    if (modalContent) {
      modalContent.innerHTML = '';
    }
  }
  if (editor) {
    editor.toTextArea();
    editor = null;
  }
}

function removeContextMenu() {
  const existingMenu = document.querySelector('.context-menu');
  if (existingMenu) {
    existingMenu.remove();
  }
  document.removeEventListener('click', removeContextMenu);
}

function showLoader() {
  const loader = document.createElement('div');
  loader.className = 'loader';
  document.body.appendChild(loader);
}

function hideLoader() {
  const loader = document.querySelector('.loader');
  if (loader) {
    loader.remove();
  }
}

let currentView = 'table';
let currentDocuments = [];

function switchView(view) {
  currentView = view;
  const tableViewBtn = document.getElementById('table-view-btn');
  const jsonViewBtn = document.getElementById('json-view-btn');

  if (view === 'table') {
    tableViewBtn.classList.add('active');
    jsonViewBtn.classList.remove('active');
  } else {
    tableViewBtn.classList.remove('active');
    jsonViewBtn.classList.add('active');
  }

  if (currentDocuments) {
    displayDocuments(currentDocuments);
  }
}

function displayTableView(documents) {
  const documentView = document.getElementById('document-view');
  documentView.innerHTML = '<table id="documents-table"></table>';
  const table = document.getElementById('documents-table');

  const headers = ['_id', ...new Set(documents.flatMap(doc => Object.keys(doc)).filter(key => key !== '_id'))];
  const headerRow = table.insertRow();
  headers.forEach(header => {
    const th = document.createElement('th');
    th.textContent = header;
    headerRow.appendChild(th);
  });

  documents.forEach(doc => {
    const row = table.insertRow();
    headers.forEach(header => {
      const cell = row.insertCell();
      const value = doc[header];
      cell.textContent = typeof value === 'object' ? JSON.stringify(value) : String(value);
    });
    
    const actionsCell = row.insertCell();
    actionsCell.innerHTML = `
      <button class="edit-btn" data-id="${doc._id}"><i class="fas fa-edit"></i></button>
      <button class="delete-btn" data-id="${doc._id}"><i class="fas fa-trash-alt"></i></button>
    `;
  });
}

function displayJSONView(documents) {
  const documentView = document.getElementById('document-view');
  documentView.innerHTML = documents.map(doc => `
    <div class="document-item">
      <pre>${JSON.stringify(doc, null, 2)}</pre>
      <div class="document-actions">
        <button class="edit-btn" data-id="${doc._id}"><i class="fas fa-edit"></i> Edit</button>
        <button class="delete-btn" data-id="${doc._id}"><i class="fas fa-trash-alt"></i> Delete</button>
      </div>
    </div>
  `).join('');
}