const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const fs = require("fs");
// coludinary -----> image uploading

cloudinary.config({
  cloud_name: "dvtehcmko",
  api_key: "987935592395515",
  api_secret: "ECwqHXhXaNiNKauisHdMts3LThc",
});

const sendImageToCloudinary = async (imageName, path) => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload(
      path,
      { public_id: imageName },
      function (error, result) {
        if (error) {
          reject(error);
        }
        resolve(result);
        fs.unlink(path, (err) => {
          if (err) {
            reject(err);
          } else {
            resolve("Successfully deleted by the file Async");
          }
        });
      }
    );
  });
};
// multer ---image uploding process
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, process.cwd() + "/uploads/");
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + "-" + uniqueSuffix);
  },
});
const upload = multer({ storage: storage });

module.exports = {
  upload,
  sendImageToCloudinary,
};
