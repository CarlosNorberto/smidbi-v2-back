const express = require('express');
const session = require('express-session');
const cors = require('cors');
const passport = require('passport');
const { sessionStore } = require('./server/auth/sessions');
const { LoginLocalStrategy } = require('./server/auth/login_strategy');
const path = require('path');

// EXPRESS APP
const app = express();

// CORS
app.use(cors(
    {
        origin: 'http://localhost:5173', // Allow all origins
        credentials: true, // Allow credentials (cookies, authorization headers, etc.)
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE', // Allowed HTTP methods
        allowedHeaders: 'Content-Type,Authorization', // Allowed headers
    }
));
// app.options('*', cors());

// BODY PARSER
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// SESSION
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: {
        // secure: process.env.NODE_ENV === 'production',
        secure: false,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        sameSite: 'strict'
    }
}));

// PASSPORT
app.use(passport.initialize());
app.use(passport.session());

// LOGIN STRATEGY
LoginLocalStrategy(app);

// UTILS
app.use((req, res, next) => {
    req.toDBTime = (dateStr, fromTz) => {
        return moment.tz(dateStr, fromTz || req.user.timezone || 'UTC')
            .tz('America/La_Paz')
            .format('YYYY-MM-DD HH:mm:ss');
    };
    req.fromDBTime = (dateObj, toTz) => {
        return moment.tz(dateObj, 'America/La_Paz')
            .tz(toTz || req.user.timezone || 'UTC')
            .format('YYYY-MM-DD HH:mm:ss');
    };
    next();
});

// ROUTES
require('./server/routes')(app);
require('./server/routes/campaign_manager')(app);
require('./server/routes/lead_manager')(app);
require('./server/routes/tasks')(app);
require('./server/routes/contract manager')(app);
require('./server/assistant_ai/router/assistant_ai.router')(app);

// MIDDLEWARE uploads
// Carpeta compartida con el backend antiguo (server/uploads/view-ads) donde viven
// las imágenes de anuncios (legacy y nuevas). Se monta ANTES del estático genérico
// de abajo para que tenga prioridad; si el archivo no está ahí, cae al estático
// genérico (uploads/ads local, copia vieja) como respaldo.
// Si la variable de entorno no está seteada (ej. en un entorno de desarrollo sin
// acceso a esa carpeta) simplemente no se monta, no rompe el arranque.
if (process.env.LEGACY_ADS_UPLOADS_PATH) {
    app.use('/uploads/ads', express.static(process.env.LEGACY_ADS_UPLOADS_PATH));
}
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// WELCOME ROUTE
app.get('/', (req, res) => {
    res.send('Welcome to the SMIDBI v2 backend!!');
});
app.get('/api/v2', (req, res) => {
    res.send('Welcome to the SMIDBI v2 API!!');
});

module.exports = app;