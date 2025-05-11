const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const { MongoClient, ObjectId } = require("mongodb");

let mainWindow;
let globalConnectionString = "";

// Memory monitoring setup
let memoryInterval;
const startMemoryMonitoring = () => {
  // Clear previous interval if it exists
  if (memoryInterval) {
    clearInterval(memoryInterval);
  }

  // Log memory usage every 30 seconds
  memoryInterval = setInterval(() => {
    const memoryUsage = process.memoryUsage();
    console.log("Memory Usage:");
    console.log(`- RSS: ${Math.round(memoryUsage.rss / 1024 / 1024)} MB`);
    console.log(
      `- Heap Total: ${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`
    );
    console.log(
      `- Heap Used: ${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`
    );
    console.log(
      `- External: ${Math.round(memoryUsage.external / 1024 / 1024)} MB`
    );

    // Check if memory usage is too high and perform garbage collection
    if (memoryUsage.heapUsed > 100 * 1024 * 1024) {
      // 100 MB threshold
      try {
        if (global.gc) {
          console.log("Forcing garbage collection...");
          global.gc();
        }
      } catch (e) {
        console.error("Could not force garbage collection", e);
      }
    }
  }, 30000);
};

// Helper function to create MongoDB client with optimized settings
function createMongoClient(connectionString) {
  return new MongoClient(connectionString, {
    serverSelectionTimeoutMS: 5000, // 5 second timeout
    maxPoolSize: 10, // Limit connection pool size
    minPoolSize: 0, // Allow pool to scale down to 0 when not in use
    maxIdleTimeMS: 30000, // Close idle connections after 30 seconds
    connectTimeoutMS: 5000, // Connect timeout after 5 seconds
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      devTools: process.env.NODE_ENV === "development",
      backgroundThrottling: true,
      enableRemoteModule: false,
      sandbox: true,
      spellcheck: false,
      enableWebSQL: false,
      safeDialogs: true,
      navigateOnDragDrop: false,
      v8CacheOptions: "code",
      enableBlinkFeatures: "",
      disableBlinkFeatures: "AutomationControlled",
    },
    frame: false,
    autoHideMenuBar: true,
    icon: path.join(__dirname, "logo.ico"),
  });

  mainWindow.loadFile("index.html");

  // Add window state change handlers
  mainWindow.on("maximize", () => {
    mainWindow.webContents.send("window-maximized");
  });

  mainWindow.on("unmaximize", () => {
    mainWindow.webContents.send("window-unmaximized");
  });
}

app.whenReady().then(() => {
  createWindow();
  
  // Start memory monitoring
  startMemoryMonitoring();
  
  // Add garbage collection API if needed
  if (process.env.NODE_ENV === 'development') {
    ipcMain.handle('gc', () => {
      if (global.gc) {
        global.gc();
        return true;
      }
      return false;
    });
    
    // Add memory stats API
    ipcMain.handle('get-memory-stats', () => {
      return process.memoryUsage();
    });
  }
});

// Add window control handlers
ipcMain.on("minimize-window", () => {
  mainWindow.minimize();
});

ipcMain.on("maximize-window", () => {
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow.maximize();
  }
});

ipcMain.on("close-window", () => {
  mainWindow.close();
});

app.on("window-all-closed", () => {
  // Clear memory monitoring interval
  if (memoryInterval) {
    clearInterval(memoryInterval);
    memoryInterval = null;
  }
  
  if (process.platform !== "darwin") app.quit();
});

app.on('quit', () => {
  // Make sure to clear any remaining intervals
  if (memoryInterval) {
    clearInterval(memoryInterval);
  }
});

ipcMain.handle("connect-to-mongodb", async (event, connectionString) => {
  let client;
  try {
    client = createMongoClient(connectionString);

    await client.connect();
    const adminDb = client.db().admin();
    const databasesList = await adminDb.listDatabases();

    globalConnectionString = connectionString;

    return databasesList.databases.map((db) => db.name);
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
    if (error.name === "MongoServerSelectionError") {
      throw new Error(
        "Unable to connect to MongoDB server. Please check your connection string and network."
      );
    }
    throw error;
  } finally {
    if (client) {
      await client.close();
    }
  }
});

ipcMain.handle("get-collections", async (event, { dbName }) => {
  if (!globalConnectionString) {
    throw new Error("No active connection");
  }

  let client;
  try {
    client = createMongoClient(globalConnectionString);

    await client.connect();
    const db = client.db(dbName);
    const collections = await db.listCollections().toArray();
    return collections.map((col) => col.name);
  } catch (error) {
    console.error("Error getting collections:", error);
    throw error;
  } finally {
    if (client) {
      await client.close();
    }
  }
});

ipcMain.handle(
  "get-documents",
  async (
    event,
    { connectionString, dbName, collectionName, page = 1, limit = 20 }
  ) => {
    let client;
    try {
      client = createMongoClient(connectionString);

      await client.connect();
      const db = client.db(dbName);
      const collection = db.collection(collectionName);

      // Get total count for pagination info
      const totalCount = await collection.countDocuments({});

      // Use skip/limit for pagination and projection to limit returned fields
      const skip = (page - 1) * limit;
      const documents = await collection
        .find({})
        .skip(skip)
        .limit(limit)
        .project({}) // By default return all fields, but this could be customized
        .toArray();

      return {
        documents: customStringify(documents),
        pagination: {
          total: totalCount,
          page,
          limit,
          pages: Math.ceil(totalCount / limit),
        },
      };
    } catch (error) {
      console.error("Error getting documents:", error);
      throw error;
    } finally {
      if (client) {
        await client.close();
      }
    }
  }
);

ipcMain.handle(
  "update-document",
  async (
    event,
    { connectionString, dbName, collectionName, documentId, updatedDoc }
  ) => {
    let client;
    try {
      // Validate input parameters
      if (
        !connectionString ||
        !dbName ||
        !collectionName ||
        !documentId ||
        !updatedDoc
      ) {
        throw new Error("Missing required parameters");
      }

      // Validate ObjectId
      let _id;
      try {
        _id = new ObjectId(documentId);
      } catch (error) {
        throw new Error("Invalid document ID format");
      }

      client = createMongoClient(connectionString);
      await client.connect();
      const db = client.db(dbName);
      const collection = db.collection(collectionName);

      // Ensure updatedDoc is a valid object
      if (
        typeof updatedDoc !== "object" ||
        updatedDoc === null ||
        Array.isArray(updatedDoc)
      ) {
        throw new Error("Updated document must be a valid object");
      }

      // Remove _id if present in updatedDoc
      if (updatedDoc._id) {
        delete updatedDoc._id;
      }

      console.log("Updating document:", {
        filter: { _id },
        update: updatedDoc,
      });

      const result = await collection.updateOne({ _id }, { $set: updatedDoc });

      if (result.matchedCount === 0) {
        throw new Error("Document not found");
      }

      if (result.modifiedCount === 0) {
        throw new Error("No changes were made to the document");
      }

      console.log("Update result:", result);
      return result.modifiedCount === 1;
    } catch (error) {
      console.error("Error updating document:", error);
      throw error;
    } finally {
      if (client) {
        await client.close();
      }
    }
  }
);

ipcMain.handle(
  "create-database",
  async (event, { connectionString, dbName, collectionName }) => {
    let client;
    try {
      client = createMongoClient(connectionString);
      await client.connect();
      const db = client.db(dbName);
      await db.createCollection(collectionName);
      return true;
    } catch (error) {
      console.error("Error creating database:", error);
      throw error;
    } finally {
      if (client) {
        await client.close();
      }
    }
  }
);

ipcMain.handle(
  "rename-database",
  async (event, { connectionString, oldDbName, newDbName }) => {
    let client;
    try {
      client = createMongoClient(connectionString);
      await client.connect();
      const oldDb = client.db(oldDbName);
      const newDb = client.db(newDbName);

      const collections = await oldDb.listCollections().toArray();

      // Use a limited batch size for large collections
      for (const collectionInfo of collections) {
        const oldCollection = oldDb.collection(collectionInfo.name);
        const newCollection = newDb.collection(collectionInfo.name);

        // Process documents in batches to reduce memory usage
        const batchSize = 100;
        let processed = 0;
        let batch;

        do {
          batch = await oldCollection
            .find({})
            .skip(processed)
            .limit(batchSize)
            .toArray();
          if (batch.length > 0) {
            await newCollection.insertMany(batch);
            processed += batch.length;
          }
        } while (batch.length === batchSize);

        const indexes = await oldCollection.indexes();
        for (const index of indexes) {
          if (index.name !== "_id_") {
            await newCollection.createIndex(index.key, {
              name: index.name,
              ...index,
            });
          }
        }
      }

      await oldDb.dropDatabase();
      return true;
    } catch (error) {
      console.error("Error renaming database:", error);
      throw error;
    } finally {
      if (client) {
        await client.close();
      }
    }
  }
);

ipcMain.handle(
  "delete-database",
  async (event, { connectionString, dbName }) => {
    let client;
    try {
      client = createMongoClient(connectionString);
      await client.connect();
      await client.db(dbName).dropDatabase();
      return true;
    } catch (error) {
      console.error("Error deleting database:", error);
      throw error;
    } finally {
      if (client) {
        await client.close();
      }
    }
  }
);

ipcMain.handle(
  "create-collection",
  async (event, { connectionString, dbName, collectionName }) => {
    let client;
    try {
      client = createMongoClient(connectionString);
      await client.connect();
      const db = client.db(dbName);
      await db.createCollection(collectionName);
      return true;
    } catch (error) {
      console.error("Error creating collection:", error);
      throw error;
    } finally {
      if (client) {
        await client.close();
      }
    }
  }
);

ipcMain.handle(
  "delete-collection",
  async (event, { connectionString, dbName, collectionName }) => {
    let client;
    try {
      client = createMongoClient(connectionString);
      await client.connect();
      const db = client.db(dbName);
      await db.collection(collectionName).drop();
      return true;
    } catch (error) {
      console.error("Error deleting collection:", error);
      throw error;
    } finally {
      if (client) {
        await client.close();
      }
    }
  }
);

ipcMain.handle(
  "rename-collection",
  async (
    event,
    { connectionString, dbName, oldCollectionName, newCollectionName }
  ) => {
    let client;
    try {
      client = new MongoClient(connectionString);
      await client.connect();
      const db = client.db(dbName);
      await db.collection(oldCollectionName).rename(newCollectionName);
      return true;
    } catch (error) {
      console.error("Lỗi đổi tên collection:", error);
      throw error;
    } finally {
      if (client) {
        await client.close();
      }
    }
  }
);

ipcMain.handle(
  "create-document",
  async (event, { connectionString, dbName, collectionName, document }) => {
    let client;
    try {
      if (
        typeof connectionString !== "string" ||
        connectionString.trim() === ""
      ) {
        throw new Error("Invalid connection string");
      }
      if (typeof dbName !== "string" || dbName.trim() === "") {
        throw new Error("Invalid database name");
      }
      if (typeof collectionName !== "string" || collectionName.trim() === "") {
        throw new Error("Invalid collection name");
      }
      if (typeof document !== "object" || document === null) {
        throw new Error("Invalid document object");
      }

      client = createMongoClient(connectionString);
      await client.connect();
      const db = client.db(dbName);
      const collection = db.collection(collectionName);

      if (document._id) {
        delete document._id;
      }

      console.log("Document to be inserted:", document);

      const result = await collection.insertOne(document);
      console.log("Insert result:", result);

      return result.acknowledged;
    } catch (error) {
      console.error("Error creating document:", error);
      throw error;
    } finally {
      if (client) {
        await client.close();
      }
    }
  }
);

ipcMain.handle(
  "delete-document",
  async (event, { connectionString, dbName, collectionName, documentId }) => {
    let client;
    try {
      client = createMongoClient(connectionString);
      await client.connect();
      const db = client.db(dbName);
      const collection = db.collection(collectionName);
      const result = await collection.deleteOne({
        _id: new ObjectId(documentId),
      });
      return result.deletedCount === 1;
    } catch (error) {
      console.error("Error deleting document:", error);
      throw error;
    } finally {
      if (client) {
        await client.close();
      }
    }
  }
);

function customStringify(obj) {
  return JSON.stringify(
    obj,
    (key, value) => {
      if (value instanceof ObjectId) {
        return `new ObjectId("${value.toString()}")`;
      }
      if (value instanceof Date) {
        return value.toISOString();
      }
      return value;
    },
    2
  );
}
