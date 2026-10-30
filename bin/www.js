const dotenv = require('dotenv');
dotenv.config();

// ZONA HORARIA: la base guarda las fechas como hora local de Bolivia (columnas "timestamp without time zone",
// igual que la app antigua) y Bolivia está en UTC-4 todo el año. El proceso debe correr en esa zona para que
// las fechas se LEAN igual que se ESCRIBEN; junto con "timezone": "-04:00" en server/config/config.json
// (que fija cómo Sequelize ESCRIBE las fechas), evita que se vean con horas de diferencia. No lo quite ni
// dependa de la zona del servidor.
process.env.TZ = 'America/La_Paz';
const port = process.env.PORT;
const app = require('../app');

const cloudinary = require('cloudinary').v2;          
cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET 
});

// Limpieza del registro de errores (system_events): al arrancar y luego una vez al día.
const { purgeOldEvents } = require('../server/services/systemEventService');
purgeOldEvents();
setInterval(purgeOldEvents, 24 * 60 * 60 * 1000).unref();
const { purgeOldNotifications } = require('../server/services/notificationService');
purgeOldNotifications();
setInterval(purgeOldNotifications, 24 * 60 * 60 * 1000).unref();

app.listen(port, () => {
    console.log(`SMIDBI v2 backend is running on port ${port}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});