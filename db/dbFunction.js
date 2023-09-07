const {MongoClient, ObjectId} = require('mongodb');
const {ObjectNotFoundError, ObjectInvalidError} = require("../errors/databaseError");

require('dotenv').config();

// the mongodb server URL
const dbURL = process.env.DB_URL ? process.env.DB_URL : 'mongodb://localhost:27017';

let con;
let db;

// connection to the db
const connect = async (database) => {
    // always use try/catch to handle any exception
    database = database || (process.env.DEBUG ? 'toktik-dev' : 'toktik');
    try {
        con = (await MongoClient.connect(dbURL, {useNewUrlParser: true, useUnifiedTopology: true}));
        db = con.db(database);
        // check that we are connected to the db
        console.log(`connecting to db: ${db.databaseName}`);
    } catch (err) {
        console.log(err.message);
    }
}

const close = async () => {
    try {
        console.log('closing connection');
        await con.close();
    } catch (err) {
        console.log(`error: ${err.message}`);
    }
}

const getDb = async () => {
    return db;
}


const handleFilter = (filter) => {
    const needToHandle = ['_id', 'postId'];
    for (let key in filter) {
        if (needToHandle.includes(key) && !(filter[key] instanceof ObjectId)) {
            filter[key] = ObjectId(filter[key]);
        }
    }

    return filter;
}

const getObjectById = async (db, collectionName, id) => {
    return await db.collection(collectionName).findOne({_id: ObjectId(id)});
}

const getObjects = async (db, collectionName) => {
    return await db.collection(collectionName).find().toArray();
}

const getObjectByFilter = async (db, collectionName, filter) => {
    return await db.collection(collectionName).findOne(handleFilter(filter));
}

const getObjectsByFilter = async (db, collectionName, filter) => {
    return await db.collection(collectionName).find(handleFilter(filter)).toArray();
}

const getObjectsByFilterOptionAndPage = async (db, collectionName, filter, option, pageObj) => {
    const res = await db.collection(collectionName).find(
        handleFilter(filter), option
    ).skip(pageObj.skipNum).limit(pageObj.limitNum).toArray();

    if (!res || res.length === 0) {
        throw new ObjectNotFoundError();
    }
    return res;
}

const addObject = async (db, collectionName, object) => {
    if (!object) {
        throw new ObjectInvalidError('object is null');
    }

    if (object._id) {
        delete object._id;
    }

    let now = new Date();
    object.createdAt = now;
    object.updatedAt = now;
    let res = await db.collection(collectionName).insertOne(handleFilter(object));
    object._id = res.insertedId;
    return object;
}

const addObjects = async (db, collectionName, objects) => {
    if (!objects || objects.length === 0) {
        throw new ObjectInvalidError('objects is null');
    }

    let newObjects = [];
    for (let object of objects) {
        if (object._id) {
            delete object._id;
        }

        let now = new Date();
        object.createdAt = now;
        object.updatedAt = now;
        newObjects.push(handleFilter(object));
    }

    let res = await db.collection(collectionName).insertMany(newObjects);
    for (let i = 0; i < res.insertedIds.length; i++) {
        newObjects[i]._id = res.insertedIds[i];
    }
    return newObjects;
}

const updateObjectById = async (db, collectionName, id, object) => {
    if (!object) {
        throw new ObjectInvalidError('object is null');
    }

    if (object._id) {
        delete object._id;
    }
    object.updatedAt = new Date();
    object._id = ObjectId(id);
    let res = await db.collection(collectionName).findOneAndUpdate({_id: ObjectId(id)}, {$set: handleFilter(object)}, {returnDocument: 'after'});
    if (res.ok === 1) {
        return res.value;
    } else {
        throw new ObjectNotFoundError();
    }
}

const updateObjectByFilter = async (db, collectionName, filter, object) => {
    if (!object) {
        throw new ObjectInvalidError('object is null');
    }

    if (object._id) {
        delete object._id;
    }

    object.updatedAt = new Date();
    let res = await db.collection(collectionName).findOneAndUpdate(
        handleFilter(filter),
        {$set: handleFilter(object)}, {returnDocument: 'after'}
    );

    if (res.ok === 1) {
        return res.value;
    } else {
        throw new ObjectNotFoundError();
    }

}

const replaceObjectById = async (db, collectionName, id, object) => {
    if (!object) {
        throw new ObjectInvalidError('object is null');
    }

    object._id = ObjectId(id);
    object.updatedAt = new Date();
    let res = await db.collection(collectionName).replaceOne({_id: ObjectId(id)}, handleFilter(object));
    if (res.matchedCount === 1) {
        return object;
    } else {
        throw new ObjectNotFoundError();
    }
}

const deleteObjectById = async (db, collectionName, id) => {
    const res = await db.collection(collectionName).findOneAndDelete({_id: ObjectId(id)});

    if (res.ok === 1) {
        if (res.lastErrorObject.n === 1) {
            return res.value;
        } else {
            throw new ObjectNotFoundError();
        }
    } else {
        throw new Error('delete failed');
    }
}

const deleteObjectByFilter = async (db, collectionName, filter) => {
    const res = await db.collection(collectionName).findOneAndDelete(handleFilter(filter));
    if (res.ok === 1) {
        if (res.lastErrorObject.n === 1) {
            return res.value;
        } else {
            throw new ObjectNotFoundError();
        }
    } else {
        throw new Error('delete failed');
    }
}

module.exports = {
    connect,
    close,
    getDb,
    getObjects,
    getObjectById,
    getObjectByFilter,
    getObjectsByFilter,
    getObjectsByFilterOptionAndPage,
    addObject,
    addObjects,
    updateObjectById,
    updateObjectByFilter,
    replaceObjectById,
    deleteObjectById,
    deleteObjectByFilter
};
