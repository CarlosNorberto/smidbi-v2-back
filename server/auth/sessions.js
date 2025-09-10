const session = require('express-session');
const SequelizeStore = require('connect-session-sequelize')(session.Store);
const { Sequelize } = require('sequelize');
const env = process.env.NODE_ENV || 'development';
const config = require('../config/config.json')[env];

const sequelize = new Sequelize(
    config.database,
    config.username,
    config.password,
    {
        host: config.host,
        port: config.port,
        dialect: config.dialect,
        logging: false
    }  
);

const sessionStore = new SequelizeStore({ db: sequelize });

sequelize.sync()
    .then(() => sessionStore.sync())
    .then(() => console.log('Database and session table synced'))
    .catch(err => console.error('Unable to sync database:', err));

module.exports = {
    sessionStore,
    sequelize
}