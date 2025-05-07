import { Toast } from '../utils/Toast.js';

const toast = new Toast();

export async function connectToMongoDB(connectionString) {
  try {
    return await window.electronAPI.connectToMongoDB(connectionString);
  } catch (error) {
    console.error("Connection error:", error);
    throw error;
  }
}

export async function getCollections({ connectionString, dbName }) {
  try {
    return await window.electronAPI.getCollections({ connectionString, dbName });
  } catch (error) {
    console.error("Error loading collections:", error);
    throw error;
  }
}

export async function getDocuments({ connectionString, dbName, collectionName }) {
  try {
    return await window.electronAPI.getDocuments({ connectionString, dbName, collectionName });
  } catch (error) {
    console.error("Error loading documents:", error);
    throw error;
  }
}

export async function createDocument({ connectionString, dbName, collectionName, document }) {
  try {
    const result = await window.electronAPI.createDocument({ connectionString, dbName, collectionName, document });
    toast.show('Document created successfully');
    return result;
  } catch (error) {
    console.error("Error creating document:", error);
    throw error;
  }
}

export async function updateDocument({ connectionString, dbName, collectionName, documentId, updatedDoc }) {
  if (!connectionString || !dbName || !collectionName || !documentId || !updatedDoc) {
    throw new Error('Missing required parameters for updating document');
  }

  console.log('Updating document:', {
    dbName,
    collectionName,
    documentId,
    updatedDoc
  });

  try {
    const result = await window.electronAPI.updateDocument({
      connectionString,
      dbName,
      collectionName,
      documentId,
      updatedDoc
    });

    if (!result) {
      throw new Error('Update operation failed');
    }

    toast.show('Document updated successfully');
    console.log('Document updated successfully');
    return true;
  } catch (error) {
    console.error('Error in updateDocument:', error);
    throw new Error(`Failed to update document: ${error.message}`);
  }
}

export async function deleteDocument({ connectionString, dbName, collectionName, documentId }) {
  try {
    return await window.electronAPI.deleteDocument({ connectionString, dbName, collectionName, documentId });
  } catch (error) {
    console.error("Error deleting document:", error);
    throw error;
  }
}

export async function createDatabase({ connectionString, dbName, collectionName }) {
  try {
    return await window.electronAPI.createDatabase({ connectionString, dbName, collectionName });
  } catch (error) {
    console.error("Error creating database:", error);
    throw error;
  }
}

export async function deleteDatabase({ connectionString, dbName }) {
  try {
    return await window.electronAPI.deleteDatabase({ connectionString, dbName });
  } catch (error) {
    console.error("Error deleting database:", error);
    throw error;
  }
}

export async function renameDatabase({ connectionString, oldDbName, newDbName }) {
  try {
    return await window.electronAPI.renameDatabase({ connectionString, oldDbName, newDbName });
  } catch (error) {
    console.error("Error renaming database:", error);
    throw error;
  }
}

export async function createCollection({ connectionString, dbName, collectionName }) {
  try {
    return await window.electronAPI.createCollection({ connectionString, dbName, collectionName });
  } catch (error) {
    console.error("Error creating collection:", error);
    throw error;
  }
}

export async function deleteCollection({ connectionString, dbName, collectionName }) {
  try {
    return await window.electronAPI.deleteCollection({ connectionString, dbName, collectionName });
  } catch (error) {
    console.error("Error deleting collection:", error);
    throw error;
  }
}

export async function renameCollection({ connectionString, dbName, oldCollectionName, newCollectionName }) {
  try {
    return await window.electronAPI.renameCollection({ connectionString, dbName, oldCollectionName, newCollectionName });
  } catch (error) {
    console.error("Error renaming collection:", error);
    throw error;
  }
} 