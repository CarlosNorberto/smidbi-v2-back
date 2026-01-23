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
require('./server/routes/lead_manager')(app);

// MIDDLEWARE uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// WELCOME ROUTE
app.get('/', (req, res) => {
    res.send('Welcome to the SMIDBI v2 backend!!');
});
app.get('/api/v2', (req, res) => {
    res.send('Welcome to the SMIDBI v2 API!!');
});

module.exports = app;