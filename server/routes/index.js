const { sessionAuth } = require('../auth/middleware');
const usuarios = require('../controllers/usuarios');
const empresas = require('../controllers/empresas');
const reportes = require('../controllers/reportes');

module.exports=(app)=>{

    // USUARIOS
    app.get(process.env.PREFIX_API + '/users/all', sessionAuth, usuarios.getAll);

    // EMPRESAS
    app.post(process.env.PREFIX_API + '/companies/all/:page/:limit', sessionAuth, empresas.getAllByUser);
    app.post(process.env.PREFIX_API + '/companies/create', sessionAuth, empresas.create);
    app.put(process.env.PREFIX_API + '/companies/update/:id', sessionAuth, empresas.update);

    // REPORTES
    app.post(process.env.PREFIX_API + '/reports/all/:page/:limit', sessionAuth, reportes.getAllByUser);
    app.put(process.env.PREFIX_API + '/reports/day/update', reportes.updateReporteDia);
    app.post(process.env.PREFIX_API + '/reports/day/review/:page/:limit', reportes.reporteDiasReview);
    
}