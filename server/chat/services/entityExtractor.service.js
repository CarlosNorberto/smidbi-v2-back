const openai = require('./openai.service');

const entityExtractorPrompt = async (pregunta) => {
    const reponse = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
            {
                role: "system",
                content: `Del siguiente texto, extrae los nombres de campañas, empresas, plataformas y KPIs mencionados. 
                Nota: Un cliente es igual a una empresa. 
                Responde solo con un JSON con la siguiente estructura:
                - nombre_empresa: string o null
                - nombre_campana: string o null
                - plataforma: string o null
                - periodo: string o null (ejemplo: "último mes", "última semana", "hoy", etc.)
                - intencion: una de estas opciones:
                    "estado_campana"        → cómo va una campaña
                    "proyeccion"            → si llegará a la meta
                    "datos_diarios"         → valores día a día
                    "reporte_completo"      → generar un informe
                    "campanas_con_problemas"→ qué campañas van mal
                    "resumen_cliente"       → resumen general de un cliente

                Texto: "${pregunta}"
                Responde solo con el JSON, sin explicaciones ni texto adicional.Si no puedes extraer alguno de los campos, pon null.`
            },
            {
                role: "user",
                content: pregunta
            }
        ],
        max_tokens: 150
    });

    try {
        const raw = reponse.choices[0].message.content;
        const clean = raw
            .replace(/```json/g, '')
            .replace(/```/g, '')
            .trim();
        return JSON.parse(clean);
    } catch (error) {
        console.error('Error al parsear el JSON del extractor de entidades:', error);
        return {
            nombre_empresa: null,
            nombre_campana: null,
            plataforma: null,
            periodo: null,
            intencion: 'estado_campana'
        };
    }
}

module.exports = { entityExtractorPrompt };