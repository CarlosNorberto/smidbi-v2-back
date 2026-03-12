const dotenv = require('dotenv');
dotenv.config();
const port = process.env.PORT;
const app = require('../app');

const cloudinary = require('cloudinary').v2;          
cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET 
});

app.listen(port, () => {
    console.log(`SMIDBI v2 backend is running on port ${port}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});