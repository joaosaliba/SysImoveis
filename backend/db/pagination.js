/**
 * Utilitário de paginação para consultas PostgreSQL
 * @param {number} page - Número da página (1-based)
 * @param {number} limit - Quantidade de itens por página
 * @returns {object} - Objeto com offset e limit para query SQL
 */
function getPaginationParams(page, limit) {
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit) || 10)); // Max 100 itens
    const offset = (pageNum - 1) * limitNum;

    return {
        offset,
        limit: limitNum,
        page: pageNum
    };
}

/**
 * Formata resposta paginada com metadata
 * @param {Array} rows - Dados retornados da query
 * @param {number} total - Total de registros (COUNT)
 * @param {number} page - Página atual
 * @param {number} limit - Limite por página
 * @returns {object} - Resposta padronizada
 */
function formatPaginatedResponse(rows, total, page, limit) {
    const totalPages = Math.ceil(total / limit);

    return {
        data: rows,
        pagination: {
            total,
            page,
            limit,
            totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1
        }
    };
}

module.exports = {
    getPaginationParams,
    formatPaginatedResponse
};
