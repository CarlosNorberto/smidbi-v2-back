const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const md = require('../models');

const LoginLocalStrategy = (app) => {
    passport.use(new LocalStrategy({
        usernameField: 'user',
    }, async (user_name, password, done) => {        
        try {
            const user = await md.usuarios.findOne({ where: { usuario: user_name }, attributes: ['id', 'email', 'usuario', 'nombre', 'password', 'time_zone'] });
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
                    user_name: user.usuario,
                    name: user.nombre,
                    time_zone: user.time_zone,
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
        let user = await md.usuarios.findByPk(id, { attributes: ['id', 'email', 'nombre', 'time_zone'] });
        done(null, user);
    } catch (error) {
        done(error, null);
    }
});

module.exports = {
    LoginLocalStrategy
}