const request = require('supertest');
const dbLib = require('../../db/dbFunction');
const webapp = require('../../app');
const jwt = require("jsonwebtoken");
const {getJwtSecret} = require("../../util/tool");
const {addObject} = require("../../db/dbFunction");

const jwtSecret = getJwtSecret();
const endpoint = "/api/auth/";
let mongo;

// TEST login endpoints
describe("Test the login endpoints", () => {
    let db;

    beforeAll(async () => {
        try {
            mongo = await dbLib.connect('test');
            db = await dbLib.getDb();
        } catch (err) {

        }
    }, 10000);
    afterAll(async () => {
        try {
            await dbLib.close();
        } catch (err) {

        }
    }, 10000);

    beforeEach(async () => {
        try {
            await db.admin().ping();
        } catch (err) {
            await dbLib.connect('test');
            db = await dbLib.getDb();
        }

        const user1 = {
            username: "testUser1",
            password: 'testPassword1',
            email: 'testEmail1@gmail.com',
            firstName: 'testFirstName1',
            lastName: 'testLastName1',
            profilePicture: "https://ui-avatars.com/api/?rounded=true"
        };

        await addObject(db, 'user', user1);
        // await request(webapp)
        //     .post('/api/user')
        //     .send(user1)
        //     .set('Accept', 'application/json');
        // check database
        const user1Db = await dbLib.getObjectByFilter(db, 'user', {username: user1.username});
        expect(user1Db).not.toBeNull();
    }, 10000);

    afterEach(async () => {
        await db.collection('user').deleteMany({});
    }, 10000);

    test("Test /login endpoint", async () => {
        const loginInfo = {
            username: "testUser1", password: 'testPassword1'
        };

        const resp = await request(webapp)
            .post(endpoint + 'login')
            .send(loginInfo)
            .set('Accept', 'application/json');

        // type check
        expect(resp.status).toBe(200);

        // response body check
        expect(resp.body.success).toBe(true);
        expect(resp.body.data.profilePicture).toBe("https://ui-avatars.com/api/?rounded=true");

        jwt.verify(resp._body.data.token, jwtSecret);
    }, 10000);
});