const dotenv = require('dotenv');
dotenv.config();
const port = process.env.PORT;
const app = require('../app');

app.listen(port, () => {
    console.log(`SMIDBI v2 backend is running on port ${port}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});