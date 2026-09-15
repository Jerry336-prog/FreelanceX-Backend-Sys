import { config } from "dotenv";
config()
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import multer from 'multer';
import cloudinary from "../config/cloudinaryconfig.js";


const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'users_proficpic', 
    allowed_formats: ['jpeg', 'png', 'jpg', 'webp'],
    transformation: [{ width: 500, height: 500, crop: 'limit' }],
  },
});


const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, callback) => callback(null, /^image\/(jpeg|png|webp)$/.test(file.mimetype))
});

const documentStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    return {
      folder: 'freelancex_documents',
      resource_type: 'auto'
    };
  }
});

export const uploadDocuments = multer({ 
  storage: documentStorage, 
  limits: { fileSize: 15 * 1024 * 1024, files: 5 }
});

export default upload;
