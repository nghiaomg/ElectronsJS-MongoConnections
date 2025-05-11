import { Modal } from "./components/Modal.js";
import { DocumentView } from "./views/DocumentView.js";
import { parseCustomJSON, formatJSON } from "./utils/jsonUtils.js";
import * as mongoService from "./services/mongoService.js";
import { Toast } from "./utils/Toast.js";

let currentDbName = null;
let currentCollectionName = null;
let currentEditingDoc = null;
const modal = new Modal();
const documentView = new DocumentView();
const toast = new Toast();

// Connection history management
const CONNECTION_HISTORY_KEY = "connection_history";
const MAX_HISTORY_ITEMS = 5;

// Store the full lists
let fullDatabaseList = [];
let fullCollectionList = [];

function loadConnectionHistory() {
  try {
    const history = JSON.parse(
      localStorage.getItem(CONNECTION_HISTORY_KEY) || "[]"
    );
    if (!history.includes("mongodb://localhost:27017/")) {
      history.unshift("mongodb://localhost:27017/");
      saveConnectionHistory(history);
    }
    return history;
  } catch (error) {
    console.error("Error loading connection history:", error);
    return ["mongodb://localhost:27017/"];
  }
}

function saveConnectionHistory(history) {
  try {
    localStorage.setItem(CONNECTION_HISTORY_KEY, JSON.stringify(history));
  } catch (error) {
    console.error("Error saving connection history:", error);
  }
}

function addToHistory(connectionString) {
  const history = loadConnectionHistory();
  const index = history.indexOf(connectionString);

  // Remove if exists
  if (index > -1) {
    history.splice(index, 1);
  }

  // Add to beginning
  history.unshift(connectionString);

  // Keep only MAX_HISTORY_ITEMS
  if (history.length > MAX_HISTORY_ITEMS) {
    history.pop();
  }

  saveConnectionHistory(history);
  updateHistoryDropdown();
}

function updateHistoryDropdown() {
  const historyContainer = document.getElementById("connection-history");
  const history = loadConnectionHistory();

  historyContainer.innerHTML = history
    .map(
      (item) => `
    <div class="history-item">
      <span class="history-item-text">${item}</span>
      <span class="delete-history" data-connection="${item}">
        <i class="fas fa-times"></i>
      </span>
    </div>
  `
    )
    .join("");

  // Add click handlers
  historyContainer.querySelectorAll(".history-item").forEach((item) => {
    // Click on item to select
    item.addEventListener("click", (e) => {
      if (!e.target.closest(".delete-history")) {
        const connectionString = item.querySelector(".history-item-text")
          .textContent;
        document.getElementById("connection-string").value = connectionString;
        historyContainer.classList.remove("show");
      }
    });
  });

  // Add separate handlers for delete buttons
  historyContainer.querySelectorAll(".delete-history").forEach((deleteBtn) => {
    deleteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const connectionString = deleteBtn.dataset.connection;
      console.log("Deleting connection:", connectionString);
      removeFromHistory(connectionString);
    });
  });
}

function removeFromHistory(connectionString) {
  console.log("Removing from history:", connectionString);
  const history = loadConnectionHistory();
  const index = history.indexOf(connectionString);

  if (index > -1) {
    // Don't remove if it's the last item and it's localhost
    if (
      history.length === 1 &&
      connectionString === "mongodb://localhost:27017/"
    ) {
      return;
    }

    history.splice(index, 1);

    // Ensure localhost is always present
    if (!history.includes("mongodb://localhost:27017/")) {
      history.unshift("mongodb://localhost:27017/");
    }

    console.log("Updated history:", history);
    saveConnectionHistory(history);
    updateHistoryDropdown();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM đã sẵn sàng");

  if (!window.electronAPI) {
    console.error("electronAPI không được định nghĩa. Kiểm tra preload.js");
    return;
  }

  // Initialize connection history
  updateHistoryDropdown();

  // Setup connection string input events
  const connectionStringInput = document.getElementById("connection-string");
  const historyContainer = document.getElementById("connection-history");

  connectionStringInput.addEventListener("focus", () => {
    historyContainer.classList.add("show");
  });

  // Hide dropdown when clicking outside
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".connection-wrapper")) {
      historyContainer.classList.remove("show");
    }
  });

  // Initialize query textarea auto-resize
  const queryInput = document.getElementById("query-input");
  if (queryInput) {
    // Điều chỉnh chiều cao ban đầu
    adjustTextareaHeight(queryInput);

    // Lắng nghe sự kiện input
    queryInput.addEventListener("input", function () {
      adjustTextareaHeight(this);
    });

    // Trigger resize khi focus
    queryInput.addEventListener("focus", function () {
      setTimeout(() => adjustTextareaHeight(this), 0);
    });

    // Đặt lại chiều cao khi blur nếu trống
    queryInput.addEventListener("blur", function () {
      if (
        this.value.trim() === "" &&
        !document
          .querySelector(".query-bar")
          .classList.contains("fullscreen-query")
      ) {
        this.style.height = "60px";
      }
    });
  }

  initializeEventListeners();
});

function initializeEventListeners() {
  const connectButton = document.getElementById("connect-button");
  const connectionStringInput = document.getElementById("connection-string");
  const loadingSpinner = document.getElementById("loading-spinner");
  const connectionError = document.getElementById("connection-error");

  if (!connectButton || !connectionStringInput) {
    console.error("Không tìm thấy các phần tử cần thiết");
    return;
  }

  const connectButtonText = connectButton.querySelector("span");
  if (!connectButtonText) {
    console.error("Không tìm thấy phần tử span trong connect-button");
    return;
  }

  connectButton.addEventListener("click", () =>
    handleConnect(
      connectionStringInput,
      loadingSpinner,
      connectButtonText,
      connectionError,
      connectButton
    )
  );

  const addEventListenerSafely = (id, event, handler) => {
    const element = document.getElementById(id);
    if (element) {
      element.addEventListener(event, handler);
      console.log(`Event listener added for ${id}`);
    } else {
      console.warn(`Element with id '${id}' not found`);
    }
  };

  addEventListenerSafely("save-edit", "click", saveEdit);
  addEventListenerSafely("cancel-edit", "click", () => modal.close());
  addEventListenerSafely("format-json", "click", () =>
    formatJSON(modal.getEditor())
  );
  addEventListenerSafely("reload-btn", "click", reload);
  addEventListenerSafely("new-document-btn", "click", showNewDocumentModal);

  const tableViewBtn = document.getElementById("table-view-btn");
  const jsonViewBtn = document.getElementById("json-view-btn");

  tableViewBtn.addEventListener("click", () =>
    documentView.switchView("table")
  );
  jsonViewBtn.addEventListener("click", () => documentView.switchView("json"));

  // Add event listeners for new query bar components
  addEventListenerSafely("fullscreen-btn", "click", toggleFullscreen);
  addEventListenerSafely("gemini-btn", "click", openGeminiAI);
  addEventListenerSafely("query-input", "keypress", handleQueryInput);
  addEventListenerSafely("run-query-btn", "click", handleRunQuery);

  window.onclick = (event) => {
    if (event.target === modal.modal) {
      modal.close();
    }
  };

  const closeModalButton = document.querySelector(".close-modal");
  if (closeModalButton) {
    closeModalButton.addEventListener("click", () => modal.close());
  }
}

async function handleConnect(
  connectionStringInput,
  loadingSpinner,
  connectButtonText,
  connectionError,
  connectButton
) {
  const connectionString = connectionStringInput.value;
  console.log("Connection string:", connectionString);

  if (loadingSpinner) loadingSpinner.style.display = "block";
  if (connectButtonText) connectButtonText.style.display = "none";
  if (connectionError) connectionError.style.display = "none";
  connectButton.disabled = true;

  try {
    console.log("Đang thử kết nối...");
    const databases = await mongoService.connectToMongoDB(connectionString);
    console.log("Kết nối thành công:", databases);
    addToHistory(connectionString); // Add to history on successful connection
    displayDatabases(databases);
    showElementsAfterConnect();
  } catch (error) {
    console.error("Connection error:", error);
    if (connectionError) {
      connectionError.textContent = `Connection error: ${error.message}`;
      connectionError.style.display = "block";
    }
  } finally {
    if (loadingSpinner) loadingSpinner.style.display = "none";
    if (connectButtonText) connectButtonText.style.display = "flex";
    connectButton.disabled = false;
  }
}

function showElementsAfterConnect() {
  const hiddenElements = document.querySelectorAll(".hidden-before-connect");
  hiddenElements.forEach((element) => {
    element.classList.remove("hidden-before-connect");
  });
}

function displayDatabases(databases) {
  // Store the full list
  fullDatabaseList = databases;

  const dbListContainer = document.getElementById("database-list");
  let dbItemsContainer = document.getElementById("database-items");
  let searchInput = document.getElementById("database-search");

  // Check if we need to create the structure
  if (!dbItemsContainer || !searchInput) {
    // Clear container
    dbListContainer.innerHTML = "";

    // Add search input
    const searchContainer = document.createElement("div");
    searchContainer.className = "search-container";
    searchContainer.innerHTML = `
      <input type="text" id="database-search" placeholder="Search databases..." class="search-input">
      <i class="fas fa-search search-icon"></i>
    `;
    dbListContainer.appendChild(searchContainer);

    // Add items container
    dbItemsContainer = document.createElement("div");
    dbItemsContainer.id = "database-items";
    dbListContainer.appendChild(dbItemsContainer);

    // Get the newly created search input
    searchInput = document.getElementById("database-search");
  } else {
    // Just clear the items container, preserving the search input
    dbItemsContainer.innerHTML = "";
  }

  const createDbButton = document.createElement("div");
  createDbButton.className = "create-db";
  createDbButton.innerHTML = `
    <i class="fas fa-plus"></i>
    <span>New Database</span>
  `;
  createDbButton.addEventListener("click", showCreateDatabaseModal);
  dbItemsContainer.appendChild(createDbButton);

  // Apply current search filter
  const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : "";

  const filteredDatabases = searchTerm
    ? databases.filter((db) => db.toLowerCase().includes(searchTerm))
    : databases;

  if (filteredDatabases.length === 0 && searchTerm) {
    const noResults = document.createElement("div");
    noResults.className = "no-results";
    noResults.textContent = `No databases found matching "${searchTerm}"`;
    dbItemsContainer.appendChild(noResults);
  } else {
    filteredDatabases.forEach((db) => {
      const dbElement = document.createElement("div");
      dbElement.className = "database-item";

      // Highlight matching text if there's a search term
      let displayName = db;
      if (searchTerm) {
        const lowerDb = db.toLowerCase();
        const index = lowerDb.indexOf(searchTerm);
        if (index !== -1) {
          const before = db.substring(0, index);
          const match = db.substring(index, index + searchTerm.length);
          const after = db.substring(index + searchTerm.length);
          displayName = `${before}<span class="search-highlight">${match}</span>${after}`;
        }
      }

      dbElement.innerHTML = `
      <i class="fas fa-database"></i>
        <span>${displayName}</span>
    `;

      dbElement.addEventListener("click", () => loadCollections(db));
      dbElement.addEventListener("contextmenu", (e) =>
        showDatabaseContextMenu(e, db)
      );
      dbItemsContainer.appendChild(dbElement);
    });
  }

  // Add search input event listener if not already added
  if (searchInput && !searchInput.hasListenerAttached) {
    searchInput.addEventListener("input", () => {
      const searchTerm = searchInput.value.trim().toLowerCase();
      filterDatabases(searchTerm);
    });
    searchInput.hasListenerAttached = true;
  }
}

// Function to filter databases without fetching them again
function filterDatabases(searchTerm) {
  displayDatabases(fullDatabaseList);
}

function displayCollections(collections, dbName) {
  // Store the full list
  fullCollectionList = collections;

  const collectionListContainer = document.getElementById("collection-list");
  let collectionItemsContainer = document.getElementById("collection-items");
  let searchInput = document.getElementById("collection-search");

  // Check if we need to create the structure
  if (!collectionItemsContainer || !searchInput) {
    // Clear container
    collectionListContainer.innerHTML = "";

    // Add search input
    const searchContainer = document.createElement("div");
    searchContainer.className = "search-container";
    searchContainer.innerHTML = `
      <input type="text" id="collection-search" placeholder="Search collections..." class="search-input">
      <i class="fas fa-search search-icon"></i>
    `;
    collectionListContainer.appendChild(searchContainer);

    // Add items container
    collectionItemsContainer = document.createElement("div");
    collectionItemsContainer.id = "collection-items";
    collectionListContainer.appendChild(collectionItemsContainer);

    // Get the newly created search input
    searchInput = document.getElementById("collection-search");
  } else {
    // Just clear the items container, preserving the search input
    collectionItemsContainer.innerHTML = "";
  }

  const createCollectionButton = document.createElement("div");
  createCollectionButton.className = "create-collection";
  createCollectionButton.innerHTML = `
    <i class="fas fa-plus"></i>
    <span>New Collection</span>
  `;
  createCollectionButton.addEventListener("click", () =>
    showCreateCollectionModal(dbName)
  );
  collectionItemsContainer.appendChild(createCollectionButton);

  // Apply current search filter
  const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : "";

  const filteredCollections = searchTerm
    ? collections.filter((collection) =>
        collection.toLowerCase().includes(searchTerm)
      )
    : collections;

  if (filteredCollections.length === 0 && searchTerm) {
    const noResults = document.createElement("div");
    noResults.className = "no-results";
    noResults.textContent = `No collections found matching "${searchTerm}"`;
    collectionItemsContainer.appendChild(noResults);
  } else {
    filteredCollections.forEach((collection) => {
      const collectionElement = document.createElement("div");
      collectionElement.className = "collection-item";

      // Highlight matching text if there's a search term
      let displayName = collection;
      if (searchTerm) {
        const lowerCollection = collection.toLowerCase();
        const index = lowerCollection.indexOf(searchTerm);
        if (index !== -1) {
          const before = collection.substring(0, index);
          const match = collection.substring(index, index + searchTerm.length);
          const after = collection.substring(index + searchTerm.length);
          displayName = `${before}<span class="search-highlight">${match}</span>${after}`;
        }
      }

      collectionElement.innerHTML = `
      <i class="fas fa-folder"></i>
        <span>${displayName}</span>
    `;

      collectionElement.addEventListener("click", () =>
        loadDocuments(dbName, collection)
      );
      collectionElement.addEventListener("contextmenu", (e) =>
        showCollectionContextMenu(e, dbName, collection)
      );
      collectionItemsContainer.appendChild(collectionElement);
    });
  }

  // Add search input event listener if not already added
  if (searchInput && !searchInput.hasListenerAttached) {
    searchInput.addEventListener("input", () => {
      const searchTerm = searchInput.value.trim().toLowerCase();
      filterCollections(searchTerm, dbName);
    });
    searchInput.hasListenerAttached = true;
  }
}

// Function to filter collections without fetching them again
function filterCollections(searchTerm, dbName) {
  displayCollections(fullCollectionList, dbName);
}

async function loadCollections(dbName) {
  currentDbName = dbName;
  currentCollectionName = null;
  hideElementsBeforeCollection();
  const connectionString = document.getElementById("connection-string").value;
  try {
    console.log(`Loading collections for ${dbName}...`);
    const collections = await mongoService.getCollections({
      connectionString,
      dbName,
    });
    console.log(`Displaying collections for ${dbName}...`);
    displayCollections(collections, dbName);
  } catch (error) {
    console.error("Error loading collections:", error);
    alert("Error loading collections: " + error.message);
  }
}

function hideElementsBeforeCollection() {
  const hiddenElements = document.querySelectorAll(".hidden-before-collection");
  hiddenElements.forEach((element) => {
    element.classList.add("hidden-before-collection");
  });
}

async function loadDocuments(dbName, collectionName) {
  currentDbName = dbName;
  currentCollectionName = collectionName;
  document.getElementById(
    "current-collection-name"
  ).textContent = `Collection: ${collectionName}`;
  showElementsAfterCollectionSelect();
  showLoader();
  try {
    console.log(`Loading documents for ${dbName}.${collectionName}...`);
    const connectionString = document.getElementById("connection-string").value;
    const documentsString = await mongoService.getDocuments({
      connectionString,
      dbName,
      collectionName,
    });
    const documents = parseCustomJSON(documentsString);
    console.log("Displaying documents...");
    documentView.displayDocuments(documents);
    setupDocumentEventListeners(documents);
  } catch (error) {
    console.error("Error loading documents:", error);
    alert("Error loading documents: " + error.message);
  } finally {
    hideLoader();
  }
}

function setupDocumentEventListeners(documents) {
  const editButtons = document.querySelectorAll(".edit-btn");
  editButtons.forEach((button, index) => {
    button.addEventListener("click", () =>
      editDocument(documents[index], index)
    );
  });

  const deleteButtons = document.querySelectorAll(".delete-btn");
  deleteButtons.forEach((button) => {
    button.addEventListener("click", (e) => {
      const id = e.currentTarget.getAttribute("data-id");
      showDeleteConfirmationModal(id);
    });
  });
}

function showElementsAfterCollectionSelect() {
  const hiddenElements = document.querySelectorAll(".hidden-before-collection");
  hiddenElements.forEach((element) => {
    element.classList.remove("hidden-before-collection");
  });
}

function showLoader() {
  const loader = document.createElement("div");
  loader.className = "loader";
  document.body.appendChild(loader);
}

function hideLoader() {
  const loader = document.querySelector(".loader");
  if (loader) {
    loader.remove();
  }
}

async function reload() {
  console.log("Reloading...");
  const connectionString = document.getElementById("connection-string").value;
  const reloadBtn = document.getElementById("reload-btn");

  if (!connectionString) {
    console.error("Connection string is empty");
    return;
  }

  // Add clicked animation class
  reloadBtn.classList.add("clicked");
  // Remove clicked class after animation completes
  setTimeout(() => {
    reloadBtn.classList.remove("clicked");
  }, 500);

  try {
    // Add loading state
    reloadBtn.classList.add("loading");
    reloadBtn.disabled = true;

    console.log("Fetching databases...");
    const databases = await mongoService.connectToMongoDB(connectionString);
    console.log("Displaying databases...");
    displayDatabases(databases);

    if (currentDbName) {
      console.log(`Loading collections for ${currentDbName}...`);
      await loadCollections(currentDbName);
      if (currentCollectionName) {
        console.log(
          `Loading documents for ${currentDbName}.${currentCollectionName}...`
        );
        await loadDocuments(currentDbName, currentCollectionName);
      }
    }
    console.log("Reload completed");
  } catch (error) {
    console.error("Error reloading data:", error);
    alert("Failed to reload data: " + error.message);
  } finally {
    // Remove loading state
    reloadBtn.classList.remove("loading");
    reloadBtn.disabled = false;
  }
}

function showNewDocumentModal() {
  modal.setContent(`
    <h2 id="modal-title">Create New Document</h2>
    <div id="code-editor"></div>
    <div id="error-message" class="error-message"></div>
    <div class="modal-buttons">
      <button id="save-edit" class="primary-btn">Create</button>
      <button id="cancel-edit" class="secondary-btn">Cancel</button>
      <button id="format-json" class="secondary-btn">Format JSON</button>
    </div>
  `);

  modal.initializeCodeMirror("{\n  \n}");

  document.getElementById("save-edit").onclick = createNewDocument;
  document.getElementById("cancel-edit").onclick = () => modal.close();
  document.getElementById("format-json").onclick = () =>
    formatJSON(modal.getEditor());

  modal.show();
}

async function createNewDocument() {
  const editor = modal.getEditor();
  const newDocumentContent = editor.getValue().trim();
  const errorElement = document.getElementById("error-message");

  try {
    if (!newDocumentContent) {
      throw new Error("Document content cannot be empty");
    }

    let parsedJSON;
    try {
      parsedJSON = JSON.parse(newDocumentContent);
    } catch (jsonError) {
      console.error("JSON parsing error:", jsonError);
      throw new Error(
        `Invalid JSON: ${jsonError.message}. Please check your input.`
      );
    }

    if (
      typeof parsedJSON !== "object" ||
      parsedJSON === null ||
      Array.isArray(parsedJSON)
    ) {
      throw new Error("Invalid JSON: Root element must be an object");
    }

    console.log("Parsed JSON:", parsedJSON);

    const connectionString = document.getElementById("connection-string").value;
    const success = await mongoService.createDocument({
      connectionString,
      dbName: currentDbName,
      collectionName: currentCollectionName,
      document: parsedJSON,
    });

    if (success) {
      modal.close();
      await loadDocuments(currentDbName, currentCollectionName);
    } else {
      throw new Error("Failed to create document");
    }
  } catch (error) {
    console.error("Error creating document:", error);
    errorElement.textContent = `Error: ${error.message}`;
    errorElement.style.display = "block";
  }
}

function editDocument(doc, index) {
  currentEditingDoc = { doc, index };
  modal.setContent(`
    <h2 id="modal-title">Edit Document</h2>
    <div id="code-editor"></div>
    <div id="error-message" class="error-message"></div>
    <div class="modal-buttons">
      <button id="save-edit" class="primary-btn">Save</button>
      <button id="cancel-edit" class="secondary-btn">Cancel</button>
      <button id="format-json" class="secondary-btn">Format JSON</button>
    </div>
  `);

  modal.initializeCodeMirror(JSON.stringify(doc, null, 2));

  document.getElementById("save-edit").onclick = saveEdit;
  document.getElementById("cancel-edit").onclick = () => modal.close();
  document.getElementById("format-json").onclick = () =>
    formatJSON(modal.getEditor());

  modal.show();
}

async function saveEdit() {
  const editor = modal.getEditor();
  const editedContent = editor.getValue().trim();
  const errorMessageElement = document.getElementById("error-message");
  const saveButton = document.getElementById("save-edit");

  try {
    // Clear previous error
    errorMessageElement.style.display = "none";

    // Validate JSON
    let editedDoc;
    try {
      editedDoc = JSON.parse(editedContent);
    } catch (jsonError) {
      throw new Error(`Invalid JSON format: ${jsonError.message}`);
    }

    // Validate document
    if (!editedDoc || typeof editedDoc !== "object") {
      throw new Error("Document must be a valid JSON object");
    }

    if (
      !currentEditingDoc ||
      !currentEditingDoc.doc ||
      !currentEditingDoc.doc._id
    ) {
      throw new Error("Original document reference is missing");
    }

    const documentId = currentEditingDoc.doc._id;
    console.log("Updating document with ID:", documentId);

    // Remove _id from edited document if present
    if (editedDoc._id) {
      console.log("Removing _id from edited document");
      delete editedDoc._id;
    }

    if (!currentDbName || !currentCollectionName) {
      throw new Error("Database or Collection not selected");
    }

    // Disable save button and show loading state
    saveButton.disabled = true;
    saveButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    const success = await mongoService.updateDocument({
      connectionString: document.getElementById("connection-string").value,
      dbName: currentDbName,
      collectionName: currentCollectionName,
      documentId: documentId,
      updatedDoc: editedDoc,
    });

    if (!success) {
      throw new Error("Failed to update document. Please try again.");
    }

    modal.close();
    await loadDocuments(currentDbName, currentCollectionName);
  } catch (error) {
    console.error("Error in saveEdit:", error);
    errorMessageElement.textContent = `Error: ${error.message}`;
    errorMessageElement.style.display = "block";
  } finally {
    // Reset save button state
    if (saveButton) {
      saveButton.disabled = false;
      saveButton.innerHTML = '<i class="fas fa-save"></i> Save';
    }
  }
}

function showDeleteConfirmationModal(documentId) {
  modal.setContent(`
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
  `);

  document.getElementById("confirm-delete").onclick = () =>
    deleteDocument(documentId);
  document.getElementById("cancel-delete").onclick = () => modal.close();

  modal.show();
}

async function deleteDocument(documentId) {
  try {
    const connectionString = document.getElementById("connection-string").value;
    const success = await mongoService.deleteDocument({
      connectionString,
      dbName: currentDbName,
      collectionName: currentCollectionName,
      documentId,
    });

    if (success) {
      modal.close();
      await loadDocuments(currentDbName, currentCollectionName);
    } else {
      throw new Error("Failed to delete document");
    }
  } catch (error) {
    const errorElement = document.getElementById("delete-error");
    errorElement.textContent = `Error deleting document: ${error.message}`;
    errorElement.style.display = "block";
  }
}

function showDatabaseContextMenu(event, dbName) {
  event.preventDefault();
  showContextMenu(event, [
    {
      label: "Rename",
      icon: "fa-edit",
      action: () => showRenameDatabaseModal(dbName),
    },
    {
      label: "Delete",
      icon: "fa-trash-alt",
      action: () => showDeleteDatabaseConfirmation(dbName),
    },
  ]);
}

function showCollectionContextMenu(event, dbName, collectionName) {
  event.preventDefault();
  showContextMenu(event, [
    {
      label: "Rename",
      icon: "fa-edit",
      action: () => showRenameCollectionModal(dbName, collectionName),
    },
    {
      label: "Delete",
      icon: "fa-trash-alt",
      action: () => showDeleteCollectionConfirmation(dbName, collectionName),
    },
  ]);
}

function showContextMenu(event, items) {
  removeContextMenu();

  const contextMenu = document.createElement("div");
  contextMenu.className = "context-menu";
  contextMenu.innerHTML = items
    .map(
      (item) => `
    <div class="context-menu-item">
      <i class="fas ${item.icon}"></i> ${item.label}
    </div>
  `
    )
    .join("");

  contextMenu.style.left = `${event.clientX}px`;
  contextMenu.style.top = `${event.clientY}px`;

  document.body.appendChild(contextMenu);

  const menuItems = contextMenu.querySelectorAll(".context-menu-item");
  items.forEach((item, index) => {
    menuItems[index].addEventListener("click", () => {
      item.action();
      removeContextMenu();
    });
  });

  document.addEventListener("click", removeContextMenu);
}

function removeContextMenu() {
  const existingMenu = document.querySelector(".context-menu");
  if (existingMenu) {
    existingMenu.remove();
  }
  document.removeEventListener("click", removeContextMenu);
}

function showCreateDatabaseModal() {
  modal.setContent(`
    <h2>
      <i class="fas fa-database"></i>
      Create New Database
    </h2>
    <p class="modal-description">Create a new database with an initial collection.</p>
    
    <div class="form-group">
      <label for="new-db-name">Database Name</label>
      <input 
        type="text" 
        id="new-db-name" 
        class="form-control" 
        placeholder="Enter database name"
        autocomplete="off"
        autofocus
      >
    </div>

    <div class="form-group">
      <label for="new-collection-name">Initial Collection Name</label>
      <input 
        type="text" 
        id="new-collection-name" 
        class="form-control" 
        placeholder="Enter collection name"
        autocomplete="off"
      >
    </div>

    <div id="create-db-error" class="error-message"></div>

    <div class="modal-buttons">
      <button id="create-db-btn" class="primary-btn" disabled>
        <i class="fas fa-plus"></i>
        Create Database
      </button>
      <button id="cancel-create-db" class="secondary-btn">
        <i class="fas fa-times"></i>
        Cancel
      </button>
    </div>
  `);

  const dbNameInput = document.getElementById("new-db-name");
  const collectionNameInput = document.getElementById("new-collection-name");
  const createButton = document.getElementById("create-db-btn");
  const errorElement = document.getElementById("create-db-error");

  // Add input validation
  function validateInputs() {
    const dbName = dbNameInput.value.trim();
    const collectionName = collectionNameInput.value.trim();

    if (dbName && collectionName) {
      createButton.disabled = false;
      errorElement.style.display = "none";
    } else {
      createButton.disabled = true;
    }
  }

  dbNameInput.addEventListener("input", validateInputs);
  collectionNameInput.addEventListener("input", validateInputs);

  // Add enter key support
  const handleEnterKey = (e) => {
    if (e.key === "Enter" && !createButton.disabled) {
      createNewDatabase();
    }
  };

  dbNameInput.addEventListener("keypress", handleEnterKey);
  collectionNameInput.addEventListener("keypress", handleEnterKey);

  document.getElementById("create-db-btn").onclick = createNewDatabase;
  document.getElementById("cancel-create-db").onclick = () => modal.close();

  modal.show();
}

async function createNewDatabase() {
  const dbName = document.getElementById("new-db-name").value.trim();
  const collectionName = document
    .getElementById("new-collection-name")
    .value.trim();
  const errorElement = document.getElementById("create-db-error");
  const createButton = document.getElementById("create-db-btn");

  if (!dbName || !collectionName) {
    errorElement.textContent = "Database name and collection name are required";
    errorElement.style.display = "block";
    return;
  }

  try {
    createButton.disabled = true;
    createButton.innerHTML =
      '<i class="fas fa-spinner fa-spin"></i> Creating...';

    const connectionString = document.getElementById("connection-string").value;
    const success = await mongoService.createDatabase({
      connectionString,
      dbName,
      collectionName,
    });

    if (success) {
      modal.close();
      await reload();
    } else {
      throw new Error("Failed to create database");
    }
  } catch (error) {
    errorElement.textContent = `Error creating database: ${error.message}`;
    errorElement.style.display = "block";
    createButton.disabled = false;
    createButton.innerHTML = '<i class="fas fa-plus"></i> Create Database';
  }
}

function showRenameDatabaseModal(dbName) {
  modal.setContent(`
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
  `);

  document.getElementById("rename-db-btn").onclick = () =>
    renameDatabase(dbName);
  document.getElementById("cancel-rename-db").onclick = () => modal.close();

  modal.show();
}

async function renameDatabase(oldDbName) {
  const newDbName = document.getElementById("new-db-name").value.trim();
  const errorElement = document.getElementById("rename-db-error");
  const renameButton = document.getElementById("rename-db-btn");

  if (!newDbName) {
    errorElement.textContent = "New database name cannot be empty";
    errorElement.style.display = "block";
    return;
  }

  try {
    renameButton.disabled = true;
    renameButton.textContent = "Renaming...";
    const connectionString = document.getElementById("connection-string").value;
    const success = await mongoService.renameDatabase({
      connectionString,
      oldDbName,
      newDbName,
    });

    if (success) {
      modal.close();
      await reload();
    } else {
      throw new Error("Failed to rename database");
    }
  } catch (error) {
    errorElement.textContent = `Error renaming database: ${error.message}`;
    errorElement.style.display = "block";
  } finally {
    renameButton.disabled = false;
    renameButton.textContent = "Rename";
  }
}

function showDeleteDatabaseConfirmation(dbName) {
  modal.setContent(`
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
  `);

  document.getElementById("confirm-delete-db").onclick = () =>
    deleteDatabase(dbName);
  document.getElementById("cancel-delete-db").onclick = () => modal.close();

  modal.show();
}

async function deleteDatabase(dbName) {
  try {
    const connectionString = document.getElementById("connection-string").value;
    const success = await mongoService.deleteDatabase({
      connectionString,
      dbName,
    });

    if (success) {
      modal.close();
      await reload();
    } else {
      throw new Error("Failed to delete database");
    }
  } catch (error) {
    const errorElement = document.getElementById("delete-db-error");
    errorElement.textContent = `Error deleting database: ${error.message}`;
    errorElement.style.display = "block";
  }
}

function showCreateCollectionModal(dbName) {
  modal.setContent(`
    <h2>
      <i class="fas fa-folder-plus"></i>
      Create New Collection
    </h2>
    <p>Database: <strong>${dbName}</strong></p>
    
    <div class="form-group">
      <label for="new-collection-name">Collection Name</label>
      <input 
        type="text" 
        id="new-collection-name" 
        class="form-control" 
        placeholder="Enter collection name"
        autocomplete="off"
        autofocus
      >
    </div>

    <div id="create-collection-error" class="error-message"></div>

    <div class="modal-buttons">
      <button id="create-collection-btn" class="primary-btn">
        <i class="fas fa-plus"></i>
        Create
      </button>
      <button id="cancel-create-collection" class="secondary-btn">
        <i class="fas fa-times"></i>
        Cancel
      </button>
    </div>
  `);

  const input = document.getElementById("new-collection-name");
  const createButton = document.getElementById("create-collection-btn");
  const errorElement = document.getElementById("create-collection-error");

  // Add input validation
  input.addEventListener("input", () => {
    const value = input.value.trim();
    if (value) {
      createButton.disabled = false;
      errorElement.textContent = "";
    } else {
      createButton.disabled = true;
    }
  });

  // Add enter key support
  input.addEventListener("keypress", (e) => {
    if (e.key === "Enter" && !createButton.disabled) {
      createNewCollection(dbName);
    }
  });

  createButton.disabled = true;
  document.getElementById("create-collection-btn").onclick = () =>
    createNewCollection(dbName);
  document.getElementById("cancel-create-collection").onclick = () =>
    modal.close();

  modal.show();
}

async function createNewCollection(dbName) {
  const collectionName = document
    .getElementById("new-collection-name")
    .value.trim();
  const errorElement = document.getElementById("create-collection-error");

  if (!collectionName) {
    errorElement.textContent = "Collection name cannot be empty";
    errorElement.style.display = "block";
    return;
  }

  try {
    const connectionString = document.getElementById("connection-string").value;
    const success = await mongoService.createCollection({
      connectionString,
      dbName,
      collectionName,
    });

    if (success) {
      modal.close();
      await loadCollections(dbName);
    } else {
      throw new Error("Failed to create collection");
    }
  } catch (error) {
    errorElement.textContent = `Error creating collection: ${error.message}`;
    errorElement.style.display = "block";
  }
}

function showRenameCollectionModal(dbName, collectionName) {
  modal.setContent(`
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
  `);

  document.getElementById("rename-collection-btn").onclick = () =>
    renameCollection(dbName, collectionName);
  document.getElementById("cancel-rename-collection").onclick = () =>
    modal.close();

  modal.show();
}

async function renameCollection(dbName, oldCollectionName) {
  const newCollectionName = document
    .getElementById("new-collection-name")
    .value.trim();
  const errorElement = document.getElementById("rename-collection-error");
  const renameButton = document.getElementById("rename-collection-btn");

  if (!newCollectionName) {
    errorElement.textContent = "New collection name cannot be empty";
    errorElement.style.display = "block";
    return;
  }

  try {
    renameButton.disabled = true;
    renameButton.textContent = "Renaming...";
    const connectionString = document.getElementById("connection-string").value;
    const success = await mongoService.renameCollection({
      connectionString,
      dbName,
      oldCollectionName,
      newCollectionName,
    });

    if (success) {
      modal.close();
      await loadCollections(dbName);
    } else {
      throw new Error("Failed to rename collection");
    }
  } catch (error) {
    errorElement.textContent = `Error renaming collection: ${error.message}`;
    errorElement.style.display = "block";
  } finally {
    renameButton.disabled = false;
    renameButton.textContent = "Rename";
  }
}

function showDeleteCollectionConfirmation(dbName, collectionName) {
  modal.setContent(`
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
  `);

  document.getElementById("confirm-delete-collection").onclick = () =>
    deleteCollection(dbName, collectionName);
  document.getElementById("cancel-delete-collection").onclick = () =>
    modal.close();

  modal.show();
}

async function deleteCollection(dbName, collectionName) {
  try {
    const connectionString = document.getElementById("connection-string").value;
    const success = await mongoService.deleteCollection({
      connectionString,
      dbName,
      collectionName,
    });

    if (success) {
      modal.close();
      await loadCollections(dbName);
    } else {
      throw new Error("Failed to delete collection");
    }
  } catch (error) {
    const errorElement = document.getElementById("delete-collection-error");
    errorElement.textContent = `Error deleting collection: ${error.message}`;
    errorElement.style.display = "block";
  }
}

// Fullscreen functionality for query input
function toggleFullscreen() {
  const fullscreenBtn = document.getElementById("fullscreen-btn");
  const icon = fullscreenBtn.querySelector("i");
  const queryBar = document.querySelector(".query-bar");
  const queryInput = document.getElementById("query-input");
  const documentView = document.getElementById("document-view");

  if (!queryBar.classList.contains("fullscreen-query")) {
    // Expand query input
    queryBar.classList.add("fullscreen-query");
    queryInput.classList.add("fullscreen-input");
    documentView.classList.add("reduced-height");
    icon.classList.remove("fa-expand-arrows-alt");
    icon.classList.add("fa-compress-arrows-alt");
  } else {
    // Collapse query input
    queryBar.classList.remove("fullscreen-query");
    queryInput.classList.remove("fullscreen-input");
    documentView.classList.remove("reduced-height");
    icon.classList.remove("fa-compress-arrows-alt");
    icon.classList.add("fa-expand-arrows-alt");
  }
}

// Open GEMINI AI assistant
async function openGeminiAI() {
  const queryInput = document.getElementById("query-input");
  const currentQuery = queryInput.value.trim();

  // Check if we have a saved API key
  try {
    const apiKey = await window.electronAPI.getGeminiApiKey();

    if (!apiKey) {
      // Show API key input form
      showGeminiApiKeyForm();
    } else {
      // Show regular Gemini assistant with the query
      showGeminiAssistant(currentQuery);
    }
  } catch (error) {
    console.error("Error checking Gemini API key:", error);
    showGeminiApiKeyForm();
  }
}

// Show form to input Gemini API key
function showGeminiApiKeyForm() {
  modal.setContent(`
    <h2>
      <i class="fas fa-robot"></i>
      GEMINI AI Assistant Setup
    </h2>
    <p class="modal-description">Enter your Gemini API key to use the AI Assistant. The key will be securely stored on your device.</p>
    
    <div class="form-group">
      <label for="gemini-api-key">Gemini API Key</label>
      <input 
        type="password" 
        id="gemini-api-key" 
        class="form-control" 
        placeholder="Enter your Gemini API key here"
        autocomplete="off"
      >
      <small style="display: block; margin-top: 8px; color: #aaa;">
        <a href="https://ai.google.dev/" target="_blank" style="color: #00ed64; text-decoration: none;">
          <i class="fas fa-external-link-alt"></i> Get an API key from Google AI Studio
        </a>
      </small>
    </div>

    <div id="gemini-api-error" class="error-message" style="display: none;"></div>

    <div class="modal-buttons">
      <button id="save-api-key-btn" class="primary-btn">
        <i class="fas fa-save"></i>
        Save API Key
      </button>
      <button id="cancel-api-key-btn" class="secondary-btn">
        <i class="fas fa-times"></i>
        Cancel
      </button>
    </div>
  `);

  document.getElementById("save-api-key-btn").onclick = saveGeminiApiKey;
  document.getElementById("cancel-api-key-btn").onclick = () => modal.close();

  // Add enter key support for quick saving
  document
    .getElementById("gemini-api-key")
    .addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        saveGeminiApiKey();
      }
    });

  modal.show();
}

// Save Gemini API key
async function saveGeminiApiKey() {
  const apiKeyInput = document.getElementById("gemini-api-key");
  const apiKey = apiKeyInput.value.trim();
  const errorElement = document.getElementById("gemini-api-error");
  const saveButton = document.getElementById("save-api-key-btn");

  if (!apiKey) {
    errorElement.textContent = "Please enter an API key";
    errorElement.style.display = "block";
    return;
  }

  // Simple validation
  if (!apiKey.startsWith("AI") || apiKey.length < 20) {
    errorElement.textContent =
      'Invalid API key format. Gemini API keys usually start with "AI" and are longer.';
    errorElement.style.display = "block";
    return;
  }

  try {
    // Disable save button and show loading state
    saveButton.disabled = true;
    saveButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    // Save API key to Electron Store
    await window.electronAPI.saveGeminiApiKey(apiKey);

    // Close modal and open Gemini assistant
    modal.close();

    // Get the current query input and show the Gemini assistant
    const queryInput = document.getElementById("query-input");
    showGeminiAssistant(queryInput.value.trim());
  } catch (error) {
    console.error("Error saving API key:", error);
    errorElement.textContent = `Error saving API key: ${error.message}`;
    errorElement.style.display = "block";
  } finally {
    saveButton.disabled = false;
    saveButton.innerHTML = '<i class="fas fa-save"></i> Save API Key';
  }
}

// Show the main Gemini assistant UI
function showGeminiAssistant(currentQuery) {
  modal.setContent(`
    <h2>
      <i class="fas fa-robot"></i>
      GEMINI AI Assistant
    </h2>
    <p class="modal-description">Ask GEMINI AI to help you with MongoDB queries.</p>
    
    <div class="form-group">
      <label for="gemini-input">What would you like to do?</label>
      <textarea 
        id="gemini-input" 
        class="form-control" 
        placeholder="Example: Generate a query to find all users who signed up in the last month"
        rows="4"
      >${currentQuery}</textarea>
    </div>

    <div id="gemini-response" style="display: none;">
      <label>GEMINI Response:</label>
      <div id="gemini-output" class="code-output"></div>
      <button id="use-query-btn" class="primary-btn" style="margin-top: 10px;">
        <i class="fas fa-code"></i> Use This Query
      </button>
    </div>

    <div id="gemini-loading" style="display: none; text-align: center; padding: 20px;">
      <i class="fas fa-spinner fa-spin" style="font-size: 2em; color: #4285F4;"></i>
      <p>Asking GEMINI...</p>
    </div>

    <div id="gemini-error" class="error-message" style="display: none;"></div>

    <div class="modal-buttons">
      <button id="submit-gemini-btn" class="primary-btn">
        <i class="fas fa-paper-plane"></i>
        Ask GEMINI
      </button>
      <button id="reset-api-key-btn" class="secondary-btn" title="Change API Key">
        <i class="fas fa-key"></i>
        Change API Key
      </button>
      <button id="cancel-gemini-btn" class="secondary-btn">
        <i class="fas fa-times"></i>
        Close
      </button>
    </div>
  `);

  document.getElementById("submit-gemini-btn").onclick = generateGeminiResponse;
  document.getElementById("reset-api-key-btn").onclick = showGeminiApiKeyForm;
  document.getElementById("cancel-gemini-btn").onclick = () => modal.close();

  modal.show();
}

// Generate a response from the Gemini API
async function generateGeminiResponse() {
  const input = document.getElementById("gemini-input").value.trim();
  const loadingElement = document.getElementById("gemini-loading");
  const responseElement = document.getElementById("gemini-response");
  const outputElement = document.getElementById("gemini-output");
  const errorElement = document.getElementById("gemini-error");
  const submitButton = document.getElementById("submit-gemini-btn");

  if (!input) {
    errorElement.textContent = "Please enter a question or request";
    errorElement.style.display = "block";
    return;
  }

  // Hide previous content and show loading
  responseElement.style.display = "none";
  errorElement.style.display = "none";
  loadingElement.style.display = "block";
  submitButton.disabled = true;

  try {
    // Get field information for the current collection
    let dbContext = null;

    if (currentDbName && currentCollectionName) {
      try {
        // Get collection fields
        const connectionString = document.getElementById("connection-string")
          .value;
        const fields = await window.electronAPI.getCollectionFields({
          connectionString,
          dbName: currentDbName,
          collectionName: currentCollectionName,
        });

        // Create database context
        dbContext = {
          dbName: currentDbName,
          collectionName: currentCollectionName,
          fields: fields,
        };

        console.log("DB Context for AI:", dbContext);
      } catch (e) {
        console.error("Error getting collection fields:", e);
        // Continue without fields if there's an error
      }
    }

    // Call the Gemini API with database context
    const response = await window.electronAPI.generateGeminiResponse(
      input,
      dbContext
    );

    // Process the successful response
    if (response.success && response.response) {
      // Parse and format the query
      let formattedQuery = response.response;

      // Clean up the response to ensure it's proper MongoDB code
      formattedQuery = formattedQuery
        .replace(/```javascript/g, "")
        .replace(/```js/g, "")
        .replace(/```mongodb/g, "")
        .replace(/```/g, "")
        .trim();

      // Display the formatted query
      outputElement.innerHTML = `<pre>${formattedQuery}</pre>`;
      responseElement.style.display = "block";

      // Add click handler for the "Use This Query" button
      document.getElementById("use-query-btn").onclick = () => {
        document.getElementById("query-input").value = formattedQuery;
        modal.close();
      };
    } else {
      throw new Error("Invalid response from Gemini API");
    }
  } catch (error) {
    console.error("Error generating response:", error);

    // Handle specific error types
    if (error.message === "API_KEY_MISSING") {
      errorElement.textContent =
        "No API key found. Please add your Gemini API key.";
      showGeminiApiKeyForm();
      return;
    } else if (error.message === "INVALID_API_KEY") {
      errorElement.textContent =
        "Invalid API key. Please update your Gemini API key.";
      showGeminiApiKeyForm();
      return;
    } else if (error.message === "API_KEY_QUOTA_EXCEEDED") {
      errorElement.textContent =
        "API key quota exceeded. Please try again later or use a different API key.";
    } else if (error.message === "RATE_LIMIT_EXCEEDED") {
      errorElement.textContent =
        "Rate limit exceeded. Please try again in a few minutes.";
    } else if (
      error.message === "FETCH_NOT_AVAILABLE" ||
      error.message === "GOOGLE_AI_NOT_AVAILABLE"
    ) {
      errorElement.textContent =
        "Network request failed. The application is missing required dependencies.";
    } else if (error.message.startsWith("MODEL_NOT_FOUND")) {
      errorElement.textContent =
        "Error: " + error.message.replace("MODEL_NOT_FOUND: ", "");
    } else if (error.message.startsWith("BAD_REQUEST")) {
      errorElement.textContent =
        "Error: " + error.message.replace("BAD_REQUEST: ", "");
    } else {
      errorElement.textContent = `Error: ${error.message}`;
    }

    errorElement.style.display = "block";
  } finally {
    loadingElement.style.display = "none";
    submitButton.disabled = false;
  }
}

// Handle query input
function handleQueryInput(event) {
  // Execute query on Enter (but only with Ctrl+Enter)
  if (event.key === "Enter" && event.ctrlKey) {
    event.preventDefault();

    const queryInput = document.getElementById("query-input");
    const queryString = queryInput.value.trim();

    if (queryString && currentDbName && currentCollectionName) {
      executeQuery(queryString);
    }
    return;
  }

  // Allow normal Enter key for line breaks
  if (event.key === "Enter" && !event.ctrlKey) {
    // Let the default behavior happen (add a new line)
    return;
  }

  // Auto adjust textarea height for single-line mode
  const textarea = event.target;
  const queryBar = document.querySelector(".query-bar");

  if (!queryBar.classList.contains("fullscreen-query")) {
    // Reset height to auto to get the correct new height
    textarea.style.height = "auto";

    // Set the height to the scrollHeight with a max height
    const newHeight = Math.min(Math.max(textarea.scrollHeight, 40), 150);
    textarea.style.height = `${newHeight}px`;
  }
}

// Execute MongoDB query
async function executeQuery(queryString) {
  if (!queryString) return;
  
  try {
    // Show loading indicator
    showLoader();
    
    console.log(
      `Executing query on ${currentDbName}.${currentCollectionName}: ${queryString}`
    );
    
    const connectionString = document.getElementById("connection-string").value;
    
    try {
      // Xóa các thông báo lỗi trước đó
      const previousErrors = document.querySelectorAll(".document-header .error-message");
      previousErrors.forEach((el) => el.remove());
      
      // Execute the query using our new IPC handler
      const result = await window.electronAPI.executeQuery({
        connectionString,
        dbName: currentDbName,
        collectionName: currentCollectionName,
        queryCode: queryString,
      });
      
      // Parse and display the results
      const documents = parseCustomJSON(result);
      documentView.displayDocuments(documents);
      setupDocumentEventListeners(documents);
      
    } catch (error) {
      console.error("Error executing query:", error);
      
      // Show beautiful error message instead of alert
      const errorContainer = document.createElement("div");
      errorContainer.className = "error-message";
      
      // Kiểm tra nếu document-header đã tồn tại
      const headerElement = document.querySelector(".document-header");
      if (headerElement) {
        headerElement.appendChild(errorContainer);
      } else {
        // Thêm vào document-view nếu không tìm thấy document-header
        document.getElementById("document-view").prepend(errorContainer);
      }
      
      // Parse and format error message
      let errorMessage = error.message || "Lỗi không xác định";
      let errorDetails = null;
      
      // Extract operation error from message if it exists
      if (errorMessage.includes("execute-query")) {
        const match = errorMessage.match(/Error: (.+)$/);
        if (match && match[1]) {
          errorDetails = errorMessage;
          errorMessage = match[1];
        }
      }
      
      // Show error in container with proper formatting
      toast.showErrorInContainer(
        errorContainer,
        "Lỗi khi thực thi truy vấn",
        errorMessage,
        errorDetails
      );
      
      // Also show toast notification
      toast.showError("Lỗi truy vấn", errorMessage, "thực thi truy vấn");
      
      // Fallback to regular document loading
      try {
        const documentsString = await mongoService.getDocuments({
          connectionString,
          dbName: currentDbName,
          collectionName: currentCollectionName,
        });
        
        const documents = parseCustomJSON(documentsString);
        documentView.displayDocuments(documents);
        setupDocumentEventListeners(documents);
      } catch (fallbackError) {
        console.error("Fallback error:", fallbackError);
      }
    }
    
  } catch (error) {
    console.error("Error executing query:", error);
    
    // Show toast error
    toast.showError("Lỗi truy vấn", error.message, "thực thi truy vấn");
  } finally {
    hideLoader();
  }
}

// Handle Run Query button click
function handleRunQuery() {
  const queryInput = document.getElementById("query-input");
  const queryString = queryInput.value.trim();

  // Remove any previous error messages
  const previousErrors = document.querySelectorAll(
    ".document-header .error-message"
  );
  previousErrors.forEach((el) => el.remove());

  if (queryString && currentDbName && currentCollectionName) {
    try {
      const connectionString = document.getElementById("connection-string")
        .value;
      // Use our executeQuery function instead of calling directly
      mongoService
        .executeQuery({
          connectionString,
          dbName: currentDbName,
          collectionName: currentCollectionName,
          queryCode: queryString,
        })
        .then((result) => {
          const documents = parseCustomJSON(result);
          documentView.displayDocuments(documents);
          setupDocumentEventListeners(documents);
        })
        .catch((error) => {
          console.error("Error executing query:", error);

          // Show beautiful error message
          const errorContainer = document.createElement("div");
          errorContainer.className = "error-message";
          document
            .querySelector(".document-header")
            .appendChild(errorContainer);

          // Parse error message
          let errorMessage = error.message || "Lỗi không xác định";
          let errorDetails = null;

          if (errorMessage.includes("execute-query")) {
            const match = errorMessage.match(/Error: (.+)$/);
            if (match && match[1]) {
              errorDetails = errorMessage;
              errorMessage = match[1];
            }
          }

          // Show formatted error
          toast.showErrorInContainer(
            errorContainer,
            "Lỗi khi thực thi truy vấn",
            errorMessage,
            errorDetails
          );

          // Also show toast
          toast.showError("Lỗi truy vấn", errorMessage, "thực thi truy vấn");
        });
    } catch (error) {
      console.error("Error preparing query execution:", error);

      // Show toast error
      toast.showError("Lỗi truy vấn", error.message, "chuẩn bị truy vấn");
    }
  } else if (!queryString) {
    // Show warning toast
    toast.showError("Truy vấn trống", "Vui lòng nhập nội dung truy vấn");
  } else if (!currentDbName || !currentCollectionName) {
    // Show warning toast
    toast.showError(
      "Chưa chọn collection",
      "Vui lòng chọn database và collection trước"
    );
  }
}

// Hàm điều chỉnh chiều cao textarea
function adjustTextareaHeight(textarea) {
  if (
    !document.querySelector(".query-bar").classList.contains("fullscreen-query")
  ) {
    // Lưu vị trí cuộn
    const scrollTop = textarea.scrollTop;

    // Reset chiều cao để đo lại
    textarea.style.height = "auto";

    // Lấy chiều cao mới dựa trên nội dung, với min và max
    const newHeight = Math.min(Math.max(textarea.scrollHeight, 60), 200);
    textarea.style.height = `${newHeight}px`;

    // Khôi phục vị trí cuộn
    textarea.scrollTop = scrollTop;
  }
}
