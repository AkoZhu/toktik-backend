const express = require("express");
const multer = require('multer');
const multerS3 = require('multer-s3')
const path = require("path");
const {SaveFileError} = require("../errors/saveError");
const {S3Client} = require('@aws-sdk/client-s3');
const fs = require('fs');

require('dotenv').config();

const router = express.Router();

let storage;
const LOCAL_PUBLIC_URL = "http://localhost:8080";

if (process.env.R2_ACCOUNT_ID && process.env.R2_ACCOUNT_KEY && process.env.R2_ACCOUNT_SECRET && process.env.R2_BUCKET_NAME && process.env.R2_PUBLIC_URL) {
    const r2 = new S3Client(
        {
            region: 'auto',
            endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
            credentials: {
                accessKeyId: process.env.R2_ACCOUNT_KEY,
                secretAccessKey: process.env.R2_ACCOUNT_SECRET,
            },
            signatureVersion: 'v4',
        }
    )
    storage = multerS3({
        s3: r2,
        bucket: process.env.R2_BUCKET_NAME,
        metadata: function (req, file, cb) {
            cb(null, {fieldName: file.fieldname});
        },
        acl: 'public-read',
        key: function (req, file, cb) {
            cb(null, Date.now().toString() + '.' + file.originalname.split('.').pop())
        },
        contentType: multerS3.AUTO_CONTENT_TYPE,
    })
} else {
    const uploadDirectory = 'uploads/';

    if (!fs.existsSync(uploadDirectory)) {
        fs.mkdirSync(uploadDirectory);
    }
    storage = multer.diskStorage({
        destination: function (req, file, cb) {
            cb(null, 'uploads/') // 'uploads/' is the directory where files will be stored locally
        },
        filename: function (req, file, cb) {
            cb(null, Date.now() + path.extname(file.originalname)); // set the file name to current timestamp + file extension
        }
    });
}

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 1000000000 // 1000000 Bytes = 1 MB
    },
    fileFilter(req, file, cb) {
        if (!file.originalname.match(/\.(png|jpg|jpeg|webp|mp4)$/)) {
            return cb(new Error('Please upload a Image or Video'))
        }
        cb(undefined, true)
    }
});

router.post('/one', upload.single('file'), async (req, res, next) => {
    try {
        const file = req.file;
        if (!file) {
            next(new SaveFileError("File not found"));
            return;
        }

        const baseUrl = file.key ? process.env.R2_PUBLIC_URL : LOCAL_PUBLIC_URL;
        const filePath = file.key ? file.key : file.path;
        const resp = {
            url: baseUrl + "/" + filePath,
            type: file.mimetype.startsWith('image/') ? 0 : 1,
        }

        res.status(200).json({
            success: true,
            data: {
                file: resp
            }
        });
    } catch (e) {
        next(e);
    }
});

router.post('/multiple', upload.array('file[]'), async (req, res, next) => {
    try {
        let files = [];
        for (let file of req.files) {
            const baseUrl = file.key ? process.env.R2_PUBLIC_URL : LOCAL_PUBLIC_URL;
            const filePath = file.key ? file.key : file.path;
            files.push({
                url: baseUrl + "/" + filePath,
                type: file.mimetype.startsWith('image/') ? 0 : 1,
            });
        }

        res.status(200).json({
            success: true,
            data: {
                file: files
            }
        })
    } catch {
        next(new SaveFileError('Error saving file'));
    }

});

router.get('/serve/:filename', (req, res, next) => {
    try {
        res.sendFile(path.join(__dirname, '../storage/images/' + req.params.filename));
    } catch {
        next(new SaveFileError('Error serving file'));
    }
});

module.exports = router;
