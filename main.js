const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const { MongoClient, ObjectId } = require("mongodb");
// Google AI client
let genAI = null;

// Will be initialized in initializeStore()
let store;
let mainWindow;
let globalConnectionString = "";
// Fallback storage if electron-store fails
let memoryStore = {
  "gemini-api-key": "",
};

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

app.whenReady().then(async () => {
  // Initialize electron-store before anything else
  await initializeStore();

  createWindow();

  // Start memory monitoring
  startMemoryMonitoring();

  // Add garbage collection API if needed
  if (process.env.NODE_ENV === "development") {
    ipcMain.handle("gc", () => {
      if (global.gc) {
        global.gc();
        return true;
      }
      return false;
    });

    // Add memory stats API
    ipcMain.handle("get-memory-stats", () => {
      return process.memoryUsage();
    });
  }

  // Set up Gemini API key handlers
  setupGeminiHandlers();
});

// Set up Gemini API key handlers
function setupGeminiHandlers() {
  console.log("Setting up Gemini API handlers...");

  // Get the Gemini API key
  ipcMain.handle("get-gemini-api-key", async () => {
    console.log("Handler called: get-gemini-api-key");
    if (store) {
      return store.get("gemini-api-key", "");
    } else {
      console.log("Using memory fallback for get-gemini-api-key");
      return memoryStore["gemini-api-key"];
    }
  });

  // Save the Gemini API key
  ipcMain.handle("save-gemini-api-key", async (event, apiKey) => {
    console.log(
      "Handler called: save-gemini-api-key",
      apiKey ? apiKey.substring(0, 3) + "..." : "empty"
    );
    if (store) {
      store.set("gemini-api-key", apiKey);
    } else {
      console.log("Using memory fallback for save-gemini-api-key");
      memoryStore["gemini-api-key"] = apiKey;
    }
    return true;
  });

  // Generate a response from Gemini API
  ipcMain.handle(
    "generate-gemini-response",
    async (event, prompt, dbContext) => {
      console.log("Handler called: generate-gemini-response");
      const apiKey = store
        ? store.get("gemini-api-key", "")
        : memoryStore["gemini-api-key"];

      if (!apiKey) {
        console.error("No API key found");
        throw new Error("API_KEY_MISSING");
      }

      try {
        // Basic validation of API key format
        if (!apiKey.startsWith("AI") || apiKey.length < 20) {
          console.error("Invalid API key format");
          throw new Error("INVALID_API_KEY");
        }

        console.log("Setting up Google AI client...");

        try {
          // Import the Google AI library if not already done
          const { GoogleGenAI } = await import("@google/genai");

          // Initialize the genAI client with the API key
          const ai = new GoogleGenAI({ apiKey });

          console.log("Sending request to Google Gemini API...");

          // Create the prompt with database context
          let promptText = `You are a MongoDB expert. `;

          // Add database context if available
          if (dbContext) {
            const { dbName, collectionName, fields } = dbContext;
            promptText += `\nCurrent database context:`;

            if (dbName) promptText += `\n- Database: ${dbName}`;
            if (collectionName)
              promptText += `\n- Collection: ${collectionName}`;
            if (fields && fields.length > 0) {
              promptText += `\n- Available fields: ${fields.join(", ")}`;
            }

            promptText += `\n\n`;
          }

          promptText += `Generate a MongoDB query based on this request: "${prompt}".
If the request includes a collection name, use it. Otherwise, use the current collection from context.
Respond with ONLY the MongoDB query code without any explanation.`;

          // Generate content using the correct model and method
          const response = await ai.models.generateContent({
            model: "gemini-2.0-flash",
            contents: promptText,
          });

          console.log("Received response from Gemini API");

          // Extract response text
          const responseText = response.text;
          console.log("Response preview:", responseText?.substring(0, 100));

          if (!responseText) {
            console.error("Empty response from Gemini API");
            throw new Error("EMPTY_RESPONSE");
          }

          return {
            success: true,
            response: responseText,
          };
        } catch (error) {
          console.error("Error in Google AI call:", error);

          // Check for specific Google AI errors
          if (error.message?.includes("API key not valid")) {
            throw new Error("INVALID_API_KEY");
          } else if (error.message?.includes("quota")) {
            throw new Error("API_KEY_QUOTA_EXCEEDED");
          } else if (error.message?.includes("rate limit")) {
            throw new Error("RATE_LIMIT_EXCEEDED");
          } else if (
            error.message?.includes("not found") ||
            error.message?.includes("model")
          ) {
            throw new Error(
              "MODEL_NOT_FOUND: Please check if the model is available in your region or try a different model"
            );
          } else {
            throw error;
          }
        }
      } catch (error) {
        console.error("Error generating Gemini response:", error);
        throw error;
      }
    }
  );

  console.log("Gemini API handlers set up successfully");
}

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

app.on("quit", () => {
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

      // Return just the documents string for compatibility with existing code
      return customStringify(documents);

      /* Keeping pagination code commented for future enhancement
      return {
        documents: customStringify(documents),
        pagination: {
          total: totalCount,
          page,
          limit,
          pages: Math.ceil(totalCount / limit),
        },
      };
      */
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

// Get collection fields for AI context
ipcMain.handle(
  "get-collection-fields",
  async (event, { connectionString, dbName, collectionName }) => {
    let client;
    try {
      client = createMongoClient(connectionString);
      await client.connect();
      const db = client.db(dbName);
      const collection = db.collection(collectionName);

      // Get sample documents to infer schema
      const sampleDocs = await collection.find({}).limit(10).toArray();

      // Extract unique field names from all sample documents
      const fieldsSet = new Set();
      sampleDocs.forEach((doc) => {
        Object.keys(doc).forEach((field) => {
          fieldsSet.add(field);
        });
      });

      return Array.from(fieldsSet);
    } catch (error) {
      console.error("Error getting collection fields:", error);
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

// Execute MongoDB query from AI-generated code
ipcMain.handle(
  "execute-query",
  async (event, { connectionString, dbName, collectionName, queryCode }) => {
    let client;
    try {
      client = createMongoClient(connectionString);
      await client.connect();
      const db = client.db(dbName);
      const collection = db.collection(collectionName);
      
      // Replace collection placeholders with actual reference
      // This allows the AI to generate code with "db.collection" pattern
      const safeQueryCode = queryCode
        .replace(/db\.collection\(['"](.*?)['"]\)/g, 'collection')
        .replace(new RegExp(`db\\.${collectionName}`, 'g'), 'collection')
        // Fix ObjectId calls to always use 'new' keyword
        .replace(/ObjectId\(/g, 'new ObjectId(')
        // Remove duplicate 'new new' if it already had 'new'
        .replace(/new new ObjectId\(/g, 'new ObjectId(');
      
      // Define allowed MongoDB operations (expanded to include write operations)
      const allowedPatterns = [
        // Read operations
        /collection\.find\(/,
        /collection\.findOne\(/,
        /collection\.aggregate\(/,
        /collection\.countDocuments\(/,
        /collection\.estimatedDocumentCount\(/,
        /collection\.distinct\(/,
        
        // Write operations
        /collection\.insertOne\(/,
        /collection\.insertMany\(/,
        /collection\.updateOne\(/,
        /collection\.updateMany\(/,
        /collection\.replaceOne\(/,
        /collection\.deleteOne\(/,
        /collection\.deleteMany\(/,
        /collection\.findOneAndUpdate\(/,
        /collection\.findOneAndReplace\(/,
        /collection\.findOneAndDelete\(/,
        /collection\.bulkWrite\(/,
        
        // Index operations
        /collection\.createIndex\(/,
        /collection\.createIndexes\(/,
        /collection\.dropIndex\(/,
        /collection\.dropIndexes\(/,
        /collection\.listIndexes\(/
      ];
      
      // Verify the query contains allowed operations
      const isAllowedOperation = allowedPatterns.some(pattern => 
        pattern.test(safeQueryCode)
      );
      
      // Block dangerous operations that could affect the database structure
      const dangerousPatterns = [
        /\.drop\(\)/,
        /\.dropDatabase\(\)/,
        /db\.dropDatabase\(/,
        /db\.drop\(/,
        /client\./,
        /process\./,
        /require\(/,
        /import\(/,
        /eval\(/,
        /Function\(/,
        /setTimeout\(/,
        /setInterval\(/
      ];
      
      const hasDangerousOperation = dangerousPatterns.some(pattern => 
        pattern.test(safeQueryCode)
      );
      
      if (hasDangerousOperation) {
        throw new Error("Dangerous operations (drop, require, eval, etc.) are not allowed for security reasons");
      }
      
      if (!isAllowedOperation) {
        throw new Error("Only MongoDB collection operations are allowed. Please use valid MongoDB collection methods.");
      }
      
      console.log("Original query code:", queryCode);
      console.log("Processed query code:", safeQueryCode);
      
      // Create the executable function with the query code
      const executeQuery = new Function('collection', 'ObjectIdClass', `
        return (async () => {
          try {
            // Make ObjectId available in the function scope
            const ObjectId = ObjectIdClass;
            
            console.log("Executing query code:", \`${safeQueryCode}\`);
            
            const result = await ${safeQueryCode};
            
            console.log("Query execution result:", result);
            
            // Handle different types of results
            if (result && typeof result.toArray === 'function') {
              // For cursors (find, aggregate)
              return await result.toArray();
            } else if (result && (result.acknowledged !== undefined || result.insertedId || result.modifiedCount !== undefined || result.deletedCount !== undefined)) {
              // For write operation results
              return result;
            } else if (Array.isArray(result)) {
              // For arrays
              return result;
            } else {
              // For other results (count, distinct, etc.)
              return result;
            }
          } catch (e) {
            console.error("Error in query execution:", e);
            throw e;
          }
        })();
      `);
      
      // Execute the query with ObjectId available
      const result = await executeQuery(collection, ObjectId);
      return customStringify(result);
    } catch (error) {
      console.error("Error executing query:", error);
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

// Initialize electron-store
async function initializeStore() {
  try {
    // Import electron-store
    const Store = await import("electron-store");
    store = new Store.default({
      name: "app-settings",
      encryptionKey: "AzlF7XzudUsp2CXgvD1Rw", // Basic encryption for API keys
      clearInvalidConfig: true,
    });
    console.log("Electron Store initialized successfully");

    // Import Google AI library
    const { GoogleGenAI } = await import("@google/genai");
    // We'll initialize the genAI client when we have an API key
    console.log("Google AI library imported successfully");
  } catch (error) {
    console.error("Failed to initialize dependencies:", error);
    store = null;
  }
}
