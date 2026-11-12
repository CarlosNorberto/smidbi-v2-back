// Roles por módulo. El sistema tiene UN rol por usuario (tabla `roles`, columna `usuarios.role_id`) y la regla general
// es "admin y superadmin ven y hacen todo; el resto de roles queda restringido a lo suyo". Un rol por módulo (como
// `contracts`) se comporta como un usuario normal en todo lo demás y, además, abre su módulo; admin y superadmin
// siempre tienen acceso. Para otro módulo con acceso propio: agregar el rol con una migración (se busca por nombre,
// los ids cambian entre entornos), listarlo aquí y en `ROLE_ORDER`/`ROLE_LABELS` de la pantalla de usuarios.

// `contracts_leads` abre los dos módulos (para quien necesita ambos): va en las dos listas.

// Gestor de Contratos: ver y administrar contratos (crear, editar, asignar, subir firmados, generar el documento y eliminar).
const CONTRACT_MANAGER_ROLES = ['admin', 'superadmin', 'contracts', 'contracts_leads'];

// CRM / Gestor de Prospectos (`lead_manager`): ver y administrar todo (tratos, seguimientos, prospectos, rubros, etapas y
// temperaturas). Un `user` normal ya no entra.
const LEAD_MANAGER_ROLES = ['admin', 'superadmin', 'leads', 'contracts_leads'];

module.exports = { CONTRACT_MANAGER_ROLES, LEAD_MANAGER_ROLES };
