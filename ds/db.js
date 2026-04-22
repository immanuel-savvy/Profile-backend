class DB {
  constructor() {
    this.db = null;
  }

  connect = async (url) => {
    const { MongoClient } = require("mongodb");
    const client = new MongoClient(url, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    await client.connect();
    this.db = client.db();
  };

  get = async (collection) => {
    if (!this.db) {
      throw new Error("Database not connected");
    }
    return this.db.collection(collection);
  };
}

export default DB;
