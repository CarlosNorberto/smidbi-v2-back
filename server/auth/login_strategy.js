const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const md = require('../models');
const { Op } = require('sequelize');
const Sequelize = require('sequelize');

const LoginLocalStrategy = (app) => {
    passport.use(new LocalStrategy({
        usernameField: 'user',
    }, async (user_name, password, done) => {        
        try {
            // Solo usuarios ACTIVOS: un usuario desactivado no puede entrar y, si quedó otro con el mismo nombre de
            // usuario (datos anteriores a la validación de unicidad), no tapa al activo ni se compara su contraseña.
            // Sin distinguir mayúsculas ni espacios al inicio/fin (el teclado del celular suele agregar ambos).
            const user = await md.usuarios.scope('withRole').findOne({
                where: {
                    [Op.and]: [
                        Sequelize.where(Sequelize.fn('lower', Sequelize.col('usuario')), String(user_name ?? '').trim().toLowerCase()),
                        { activo: true },
                    ],
                },
                attributes: ['id', 'email', 'usuario', 'nombre', 'password', 'time_zone'],
                order: [['id', 'DESC']],
            });
            if (!user) {
                return done(null, false, { message: 'Acceso denegado' });
            }
            if (!user.validPassword(password)) {
                return done(null, false, { message: 'Acceso denegado' });
            }
            return done(null, user);
        } catch (error) {
            return done(error);
        }
    }
    ));
    app.post(process.env.PREFIX_API + '/auth/login', (req, res, next) => {        
        passport.authenticate('local', (err, user, info) => {
            if (err) {
                return next(err);
            }
            if (!user) {
                console.log("INFO",info);
                return res.status(401).send(info);
            }
            req.login(user, (err) => {
                if (err) {
                    return res.status(500).send(err);
                }
                if(req.body.remember) {                    
                    req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
                }else {
                    req.session.cookie.expires = false;
                    req.session.cookie.maxAge = null;
                }
                res.status(200).send({
                    id: user.id,
                    user_name: user.usuario,
                    name: user.nombre,
                    time_zone: user.time_zone,
                    role: user.role?.rol || null,
                });
            });
        })(req, res, next);
    });
    app.post(process.env.PREFIX_API + '/auth/logout', (req, res, next) => {
        req.logout(err => {
            if (err) return next(err);
            req.session.destroy(() => { 
                res.clearCookie('connect.sid');
                res.status(200).send({ message: 'Sesión cerrada correctamente' });
            });
        });
    });       
}

// SERIALIZE & DESERIALIZE USER
passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {        
        let user = await md.usuarios.scope('withRole').findByPk(id, { attributes: ['id', 'email', 'nombre', 'time_zone', 'activo'] });
        // Si el usuario se desactivó (o ya no existe) la sesión abierta deja de valer.
        done(null, user?.activo ? user : false);
    } catch (error) {
        done(error, null);
    }
});

module.exports = {
    LoginLocalStrategy
}