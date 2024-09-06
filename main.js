const {
  app, BrowserWindow, ipcMain
} = require('electron')
const path = require('path')
const {
  MongoClient, ObjectId
} = require('mongodb')

let mainWindow
let globalConnectionString = ''

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    },
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'logo.ico')
  })

  mainWindow.loadFile('index.html')
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

ipcMain.handle('connect-to-mongodb', async (event, connectionString) => {
  try {
    const client = new MongoClient(connectionString);
    await client.connect();
    const adminDb = client.db().admin();
    const databasesList = await adminDb.listDatabases();
    await client.close();
    
    globalConnectionString = connectionString; // Set the global connection string
    
    return databasesList.databases.map(db => db.name);
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
    if (error.name === 'MongoServerSelectionError') {
      throw new Error('Unable to connect to MongoDB server. Please check your connection string and network.');
    }
    throw error;
  }
});

ipcMain.handle('get-collections', async (event, { dbName }) => {
  if (!globalConnectionString) {
    throw new Error('No active connection');
  }

  try {
    const client = new MongoClient(globalConnectionString);
    await client.connect();
    const db = client.db(dbName);
    const collections = await db.listCollections().toArray();
    await client.close();
    return collections.map(col => col.name);
  } catch (error) {
    console.error('Error getting collections:', error);
    throw error;
  }
})

ipcMain.handle('get-documents', async(event, {
  connectionString, dbName, collectionName
}) => {
  try {
      const client = new MongoClient(connectionString)
      await client.connect()
      const db = client.db(dbName)
      const collection = db.collection(collectionName)
      const documents = await collection.find().limit(20).toArray()
      return customStringify(documents)
  } catch (error) {
      console.error('Lỗi lấy documents:', error)
      throw error
  }
})

ipcMain.handle('update-document', async (event, { connectionString, dbName, collectionName, documentId, updatedDoc }) => {
  let client;
  try {
    client = new MongoClient(connectionString);
    await client.connect();
    const db = client.db(dbName);
    const collection = db.collection(collectionName);

    const _id = new ObjectId(documentId);
    
    if (updatedDoc._id) {
      delete updatedDoc._id;
    }

    const result = await collection.updateOne({ _id }, { $set: updatedDoc });
    return result.modifiedCount === 1;
  } catch (error) {
    console.error('Error updating document:', error);
    throw error;
  } finally {
    if (client) {
      await client.close();
    }
  }
});

ipcMain.handle('create-database', async (event, { connectionString, dbName, collectionName }) => {
  try {
    const client = new MongoClient(connectionString);
    await client.connect();
    const db = client.db(dbName);
    await db.createCollection(collectionName);
    await client.close();
    return true;
  } catch (error) {
    console.error('Lỗi tạo database:', error);
    throw error;
  }
});

ipcMain.handle('rename-database', async (event, { connectionString, oldDbName, newDbName }) => {
  const client = new MongoClient(connectionString);
  try {
    await client.connect();
    const oldDb = client.db(oldDbName);
    const newDb = client.db(newDbName);

    const collections = await oldDb.listCollections().toArray();

    for (const collectionInfo of collections) {
      const oldCollection = oldDb.collection(collectionInfo.name);
      const newCollection = newDb.collection(collectionInfo.name);

      const documents = await oldCollection.find({}).toArray();
      if (documents.length > 0) {
        await newCollection.insertMany(documents);
      }

      const indexes = await oldCollection.indexes();
      for (const index of indexes) {
        if (index.name !== '_id_') { 
          await newCollection.createIndex(index.key, {
            name: index.name,
            ...index
          });
        }
      }
    }

    await oldDb.dropDatabase();

    return true;
  } catch (error) {
    console.error('Lỗi đổi tên database:', error);
    throw error;
  } finally {
    await client.close();
  }
});

ipcMain.handle('delete-database', async (event, { connectionString, dbName }) => {
  try {
    const client = new MongoClient(connectionString);
    await client.connect();
    await client.db(dbName).dropDatabase();
    await client.close();
    return true;
  } catch (error) {
    console.error('Lỗi xóa database:', error);
    throw error;
  }
});

ipcMain.handle('create-collection', async (event, { connectionString, dbName, collectionName }) => {
  try {
    const client = new MongoClient(connectionString);
    await client.connect();
    const db = client.db(dbName);
    await db.createCollection(collectionName);
    await client.close();
    return true;
  } catch (error) {
    console.error('Lỗi tạo collection:', error);
    throw error;
  }
});

ipcMain.handle('delete-collection', async (event, { connectionString, dbName, collectionName }) => {
  try {
    const client = new MongoClient(connectionString);
    await client.connect();
    const db = client.db(dbName);
    await db.collection(collectionName).drop();
    await client.close();
    return true;
  } catch (error) {
    console.error('Lỗi xóa collection:', error);
    throw error;
  }
});

ipcMain.handle('rename-collection', async (event, { connectionString, dbName, oldCollectionName, newCollectionName }) => {
  let client;
  try {
    client = new MongoClient(connectionString);
    await client.connect();
    const db = client.db(dbName);
    await db.collection(oldCollectionName).rename(newCollectionName);
    return true;
  } catch (error) {
    console.error('Lỗi đổi tên collection:', error);
    throw error;
  } finally {
    if (client) {
      await client.close();
    }
  }
});

ipcMain.handle('create-document', async (event, { connectionString, dbName, collectionName, document }) => {
  let client;
  try {
    if (typeof connectionString !== 'string' || connectionString.trim() === '') {
      throw new Error('Invalid connection string');
    }
    if (typeof dbName !== 'string' || dbName.trim() === '') {
      throw new Error('Invalid database name');
    }
    if (typeof collectionName !== 'string' || collectionName.trim() === '') {
      throw new Error('Invalid collection name');
    }
    if (typeof document !== 'object' || document === null) {
      throw new Error('Invalid document object');
    }

    client = new MongoClient(connectionString);
    await client.connect();
    const db = client.db(dbName);
    const collection = db.collection(collectionName);

    if (document._id) {
      delete document._id;
    }

    console.log('Document to be inserted:', document);

    const result = await collection.insertOne(document);
    console.log('Insert result:', result);

    return result.acknowledged;
  } catch (error) {
    console.error('Lỗi tạo document:', error);
    throw error;
  } finally {
    if (client) {
      await client.close();
    }
  }
});

ipcMain.handle('delete-document', async (event, { connectionString, dbName, collectionName, documentId }) => {
  let client;
  try {
    client = new MongoClient(connectionString);
    await client.connect();
    const db = client.db(dbName);
    const collection = db.collection(collectionName);
    const result = await collection.deleteOne({ _id: new ObjectId(documentId) });
    return result.deletedCount === 1;
  } catch (error) {
    console.error('Error deleting document:', error);
    throw error;
  } finally {
    if (client) {
      await client.close();
    }
  }
});

function customStringify(obj) {
  return JSON.stringify(obj, (key, value) => {
    if (value instanceof ObjectId) {
      return `new ObjectId("${value.toString()}")`;
    }
    if (value instanceof Date) {
      return value.toISOString();
    }
    return value;
  }, 2);
}