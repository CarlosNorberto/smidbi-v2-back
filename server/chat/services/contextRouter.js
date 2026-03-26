// Define qué contexto necesita cada intención
// Si necesita = [] significa que no necesita buscar empresa ni campaña
const contextRouter = {
    'estado_campana': ['empresa', 'campana'],
    'datos_diarios': ['empresa', 'campana'],
    'proyeccion': ['empresa', 'campana'],
    'reporte_completo': ['empresa', 'campana'],
    'resumen_cliente': ['empresa'],
    'campanas_activas': ['empresa'],
    'campanas_con_problemas': [],
    'campanas_por_vencer': [],
    'listado_usuarios': [],
    'presupuesto_global': []
};

function getNecesita(intencion) {
    return contextRouter[intencion] || [];
}

module.exports = { getNecesita };