const md = require('../models');
const { Op } = require('sequelize');

// Grupos de "RATE CARD" (grupo > 3) disponibles para sobreescribir la
// calificación de un brief, en vez del promedio de las 4 preguntas.
const getRateCardGroups = async (req, res) => {
    try {
        const groups = await md.costo_por.findAll({
            where: { grupo: { [Op.gt]: 3 } },
            attributes: ['grupo'],
            group: ['grupo'],
            order: [['grupo', 'ASC']],
        });
        res.status(200).json(groups.map((g) => g.grupo));
    } catch (error) {
        res.status(500).json({ message: `Error al obtener los grupos de rate card: ${error.message}` });
    }
};

// Costos activos de un grupo/tipo, agrupados por plataforma — el catálogo de
// opciones seleccionables en la grilla del Planificador.
const getCostosByPlataforma = async (req, res) => {
    try {
        const { grupo, tipo } = req.params;
        const costos = await md.costo_por.findAll({
            where: { grupo, tipo, activo: true },
            include: [{ model: md.plataformas, as: 'plataforma', attributes: ['id', 'plataforma', 'icono'] }],
            order: [[{ model: md.plataformas, as: 'plataforma' }, 'plataforma', 'ASC'], ['nombre', 'ASC']],
        });
        res.status(200).json(costos);
    } catch (error) {
        res.status(500).json({ message: `Error al obtener los costos: ${error.message}` });
    }
};

// Administración del Rate Card (superadmin): lista completa (activos e
// inactivos) filtrable por grupo/tipo, con la plataforma asociada.
const getAllAdmin = async (req, res) => {
    try {
        const { grupo, tipo } = req.query;
        const where = {};
        if (grupo) where.grupo = grupo;
        if (tipo) where.tipo = tipo;

        const costos = await md.costo_por.findAll({
            where,
            include: [{ model: md.plataformas, as: 'plataforma', attributes: ['id', 'plataforma'] }],
            order: [['grupo', 'ASC'], ['tipo', 'ASC'], ['nombre', 'ASC']],
        });
        res.status(200).json(costos);
    } catch (error) {
        res.status(500).json({ message: `Error al obtener los costos: ${error.message}` });
    }
};

const create = async (req, res) => {
    try {
        const { id_plataforma, tipo, nombre, grupo, costo } = req.body;
        if (!id_plataforma || !tipo || !nombre || !grupo || costo === undefined) {
            return res.status(400).json({ message: 'id_plataforma, tipo, nombre, grupo y costo son obligatorios.' });
        }
        const nuevo = await md.costo_por.create({
            id_plataforma,
            tipo,
            nombre,
            grupo,
            costo,
            activo: true,
            usuario_creacion: req.user.id,
            fecha_creacion: new Date(),
        });
        res.status(201).json(nuevo);
    } catch (error) {
        res.status(500).json({ message: `Error al crear el costo: ${error.message}` });
    }
};

// No hay `remove`/delete a propósito: los costos no se borran, solo se
// activan/desactivan (mismo criterio que plataformas).
const update = async (req, res) => {
    try {
        const { id } = req.params;
        const existing = await md.costo_por.findByPk(id);
        if (!existing) {
            return res.status(404).json({ message: 'Costo no encontrado' });
        }
        const data = { ...req.body, usuario_modificacion: req.user.id, fecha_modificacion: new Date() };
        const updated = await existing.update(data);
        res.status(200).json(updated);
    } catch (error) {
        res.status(500).json({ message: `Error al actualizar el costo: ${error.message}` });
    }
};

module.exports = {
    getRateCardGroups,
    getCostosByPlataforma,
    getAllAdmin,
    create,
    update,
};
