const dbLib = require('../db/dbFunction');
const {
    PostNotFoundError,
    PostFailedToDeleteError,
    PostFailedToCreateError,
    PostFailedToUpdateError
} = require('../errors/postError');
const {ObjectNotFoundError} = require("../errors/databaseError");
const express = require("express");
const {UsernameNotMatchError} = require("../errors/loginError");

const router = express.Router();

// Implement the GET /post/id endpoint
router.get('/:id', async (req, res, next) => {
    try {
        const db = await dbLib.getDb();
        const results = await dbLib.getObjectById(db, 'post', req.params.id);

        res.status(200).json({
            success: true,
            data: results
        });
    } catch {
        next(new PostNotFoundError("Post not found"));
    }
});

// Implement the GET /post/username/:username endpoint
router.get('/username/:username', async (req, res, next) => {
    try {
        // get the data from the db
        const db = await dbLib.getDb();

        let results;
        if (req.params.username) {
            results = await dbLib.getObjectsByFilter(db, 'post', {username: req.params.username});
            res.status(200).json({
                success: true,
                data: results.sort((a, b) => a.createdAt < b.createdAt).reverse()
            });
        } else {
            next(new PostNotFoundError("Missing username."))
        }
    } catch {
        next(new PostNotFoundError("Post not found"));
    }
});

// Implement the GET /post/page/:page endpoint
router.get('/page/:page', async (req, res, next) => {
    try {
        const db = await dbLib.getDb();
        if (req.params.page) {
            const limitNum = req.query["_limit"] === undefined ? 5 : req.query["_limit"];
            const order = req.query["_order"] === undefined ? -1 : req.query["_order"];
            const option = {
                sort: {'updatedAt': order === 'asc' ? 1 : -1},
            }
            const pageObj = {
                skipNum: (req.params.page - 1) * limitNum,
                limitNum: parseInt(limitNum)
            }

            const results = await dbLib.getObjectsByFilterOptionAndPage(db, 'post', {public: true}, option, pageObj);
            res.status(200).json({
                success: true,
                data: results
            });
        } else {
            next(new PostNotFoundError("Missing page number."));
        }
    } catch {
        next(new PostNotFoundError("Post not found"));
    }

});


// Implement the POST /post endpoint
router.post('/', async (req, res, next) => {
    try {
        const db = await dbLib.getDb();
        let results;
        if (req.body) {
            if (req.body instanceof Array) {
                const username = req.body[0].username;
                if (username !== req.decoded.username) {
                    return next(new UsernameNotMatchError("You can only create post for yourself."));
                }

                const userResp = await dbLib.getObjectByFilter(db, 'user', {username: username});
                if (!userResp) return next(new PostFailedToCreateError("Username not found"));

                for (let postItem of req.body) {
                    if (postItem.username !== username) return next(new PostFailedToCreateError("Username should be the same"));
                }

                results = await dbLib.addObjects(db, 'post', req.body);
            } else {
                if (Object.keys(req.body).length === 0) return next(new PostFailedToCreateError("Missing post body"));
                if (req.body.username !== req.decoded.username) {
                    return next(new UsernameNotMatchError("You can only create post for yourself."));
                }

                const userResp = await dbLib.getObjectByFilter(db, 'user', {username: req.body.username});
                if (!userResp) return next(new PostFailedToCreateError("Username not found"));

                results = await dbLib.addObject(db, 'post', req.body);
            }

            res.status(200).json({
                success: true,
                data: results
            });
        } else {
            next(new PostFailedToCreateError("Missing post body"));
        }
    } catch {
        next(new PostFailedToCreateError("Post failed to create."));
    }
});

// Implement the PUT /post/id endpoint
router.put('/:id', async (req, res, next) => {
    if (!req.body || Object.keys(req.body).length === 0) {
        return next(new PostFailedToUpdateError("Missing post body"));
    }

    if (req.body.username !== req.decoded.username) {
        return next(new UsernameNotMatchError("You can only update post for yourself."));
    }

    try {
        const db = await dbLib.getDb();
        const results = await dbLib.updateObjectById(db, 'post', req.params.id, req.body);
        res.status(200).json({
            success: true,
            data: results
        });
    } catch (err) {
        if (err instanceof ObjectNotFoundError) {
            next(new PostNotFoundError("Post not found"));
        } else {
            next(new PostFailedToUpdateError("Failed to update post."));
        }
    }
});


// Implement the DELETE /post/id endpoint
router.delete('/:id', async (req, res, next) => {
    try {
        const db = await dbLib.getDb();
        const post = await dbLib.getObjectById(db, 'post', req.params.id);
        if (post.username !== req.decoded.username) {
            return next(new UsernameNotMatchError("You can only delete post for yourself."));
        }

        const results = await dbLib.deleteObjectById(db, 'post', req.params.id);
        res.status(200).json({
            success: true,
            data: results
        });
    } catch (err) {
        if (err instanceof ObjectNotFoundError) {
            next(new PostFailedToDeleteError("Post to be deleted not found."))
        } else {
            next(new PostFailedToDeleteError("Post failed to delete."));
        }
    }
});

module.exports = router;
