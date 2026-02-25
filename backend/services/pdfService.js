const pdfkit = require('pdfkit');
const path = require('path');

/**
 * Gera PDF de contrato de locação
 * @param {Object} contrato - Dados do contrato
 * @param {String} outputPath - Caminho para salvar o PDF
 * @returns {Promise<string>} - Caminho do arquivo gerado
 */
function generateContratoPDF(contrato, outputPath) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new pdfkit({ margin: 50 });
            const stream = require('fs').createWriteStream(outputPath);
            doc.pipe(stream);

            // Header
            doc.fontSize(18).text('CONTRATO DE LOCAÇÃO RESIDENCIAL', { align: 'center' });
            doc.moveDown(0.5);
            doc.fontSize(10).text(`Contrato nº ${contrato.id.slice(0, 8).toUpperCase()}`, { align: 'center' });
            doc.moveDown(1);

            // Partes
            doc.fontSize(12).text('PARTES CONTRATANTES', { underline: true });
            doc.moveDown(0.5);
            doc.fontSize(10);
            doc.text(`LOCADOR: Sistema SysImóveis`);
            doc.text(`LOCATÁRIO: ${contrato.inquilino_nome}`);
            doc.text(`CPF: ${contrato.inquilino_cpf}`);
            doc.moveDown(0.5);

            // Imóvel
            doc.fontSize(12).text('OBJETO DO CONTRATO', { underline: true });
            doc.moveDown(0.5);
            doc.fontSize(10);
            doc.text(`Imóvel: ${contrato.imovel_nome || contrato.imovel_endereco}`);
            doc.text(`Endereço: ${contrato.imovel_endereco}${contrato.imovel_numero ? ', ' + contrato.imovel_numero : ''} - ${contrato.imovel_cidade}`);
            doc.text(`Unidade: ${contrato.unidade_identificador} (${contrato.tipo_unidade})`);
            doc.moveDown(0.5);

            // Vigência
            doc.fontSize(12).text('VIGÊNCIA', { underline: true });
            doc.moveDown(0.5);
            doc.fontSize(10);
            const dataInicio = new Date(contrato.data_inicio).toLocaleDateString('pt-BR');
            const dataFim = new Date(contrato.data_fim).toLocaleDateString('pt-BR');
            doc.text(`Início: ${dataInicio}`);
            doc.text(`Término: ${dataFim}`);
            doc.text(`Ocupantes: ${contrato.qtd_ocupantes}`);
            doc.moveDown(0.5);

            // Valores
            doc.fontSize(12).text('VALORES E CONDIÇÕES', { underline: true });
            doc.moveDown(0.5);
            doc.fontSize(10);
            doc.text(`Aluguel: R$ ${contrato.valor_inicial.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
            doc.text(`IPTU: R$ ${contrato.valor_iptu.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
            doc.text(`Água: R$ ${contrato.valor_agua.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
            doc.text(`Luz: R$ ${contrato.valor_luz.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
            doc.text(`Outros: R$ ${contrato.valor_outros.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
            const total = contrato.valor_inicial + contrato.valor_iptu + contrato.valor_agua + contrato.valor_luz + contrato.valor_outros;
            doc.text(`TOTAL MENSAL: R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, { bold: true });
            doc.text(`Dia de vencimento: ${contrato.dia_vencimento}º dia de cada mês`);
            doc.moveDown(0.5);

            // Observações
            if (contrato.observacoes_contrato) {
                doc.fontSize(12).text('OBSERVAÇÕES', { underline: true });
                doc.moveDown(0.5);
                doc.fontSize(10);
                doc.text(contrato.observacoes_contrato);
                doc.moveDown(0.5);
            }

            // Footer
            doc.moveDown(2);
            doc.fontSize(9);
            doc.text('_________________________________________', { align: 'center' });
            doc.text('Assinatura do Locador', { align: 'center' });
            doc.moveDown(1);
            doc.text('_________________________________________', { align: 'center' });
            doc.text('Assinatura do Locatário', { align: 'center' });
            doc.moveDown(1);
            doc.fontSize(8);
            doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, { align: 'center' });

            doc.end();

            stream.on('finish', () => resolve(outputPath));
            stream.on('error', reject);
        } catch (err) {
            reject(err);
        }
    });
}

/**
 * Gera PDF de boleto/parcela
 * @param {Object} parcela - Dados da parcela
 * @param {String} outputPath - Caminho para salvar o PDF
 * @returns {Promise<string>} - Caminho do arquivo gerado
 */
function generateBoletoPDF(parcela, outputPath) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new pdfkit({ margin: 50 });
            const stream = require('fs').createWriteStream(outputPath);
            doc.pipe(stream);

            // Header
            doc.fontSize(16).text('BOLETO DE ALUGUEL', { align: 'center' });
            doc.moveDown(0.5);

            // Dados do inquilino
            doc.fontSize(11).text('LOCATÁRIO', { underline: true });
            doc.moveDown(0.3);
            doc.fontSize(10);
            doc.text(`Nome: ${parcela.inquilino_nome}`);
            doc.text(`CPF: ${parcela.inquilino_cpf}`);
            doc.moveDown(0.5);

            // Imóvel
            doc.fontSize(11).text('IMÓVEL', { underline: true });
            doc.moveDown(0.3);
            doc.fontSize(10);
            doc.text(`${parcela.imovel_nome || parcela.imovel_endereco}`);
            doc.text(`${parcela.imovel_endereco}${parcela.imovel_numero ? ', ' + parcela.imovel_numero : ''} - ${parcela.imovel_cidade}`);
            doc.text(`Unidade: ${parcela.unidade_identificador}`);
            doc.moveDown(0.5);

            // Dados da parcela
            doc.fontSize(11).text('DADOS DO PAGAMENTO', { underline: true });
            doc.moveDown(0.3);
            doc.fontSize(10);
            doc.text(`Descrição: ${parcela.descricao || 'Aluguel'}`);
            const vencimento = new Date(parcela.data_vencimento).toLocaleDateString('pt-BR');
            doc.text(`Vencimento: ${vencimento}`);
            doc.text(`Status: ${parcela.status_pagamento.toUpperCase()}`);
            doc.moveDown(0.5);

            // Valores
            const total = parcela.valor_base + parcela.valor_iptu + parcela.valor_agua + parcela.valor_luz + parcela.valor_outros - parcela.desconto_pontualidade;

            doc.fontSize(10);
            doc.text(`Aluguel: R$ ${parcela.valor_base.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
            if (parcela.valor_iptu > 0) doc.text(`IPTU: R$ ${parcela.valor_iptu.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
            if (parcela.valor_agua > 0) doc.text(`Água: R$ ${parcela.valor_agua.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
            if (parcela.valor_luz > 0) doc.text(`Luz: R$ ${parcela.valor_luz.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
            if (parcela.valor_outros > 0) {
                const labelOutros = (parcela.observacoes && parcela.observacoes.trim() !== '') ? parcela.observacoes.substring(0, 30) : 'Outros';
                doc.text(`${labelOutros}: R$ ${parcela.valor_outros.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
            }
            if (parcela.desconto_pontualidade > 0) doc.text(`Desconto: -R$ ${parcela.desconto_pontualidade.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, { color: '#22c55e' });

            doc.moveDown(0.5);
            doc.fontSize(14).text(`TOTAL: R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, { bold: true, underline: true });

            // Footer
            doc.moveDown(2);
            doc.fontSize(8);
            doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, { align: 'center' });
            doc.text('Este não é um documento oficial de cobrança.', { align: 'center' });

            doc.end();

            stream.on('finish', () => resolve(outputPath));
            stream.on('error', reject);
        } catch (err) {
            reject(err);
        }
    });
}

/**
 * Gera PDF de boletos em massa (4 por página)
 * @param {Array} parcelas - Array de parcelas
 * @param {String} outputPath - Caminho para salvar o PDF
 * @returns {Promise<string>} - Caminho do arquivo gerado
 */
function generateBulkBoletosPDF(parcelas, outputPath) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new pdfkit({ size: 'A4', margin: 0 });
            const stream = require('fs').createWriteStream(outputPath);
            doc.pipe(stream);

            const formatCurrency = (val) => {
                return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(val) || 0);
            };

            const formatDate = (date) => {
                if (!date) return '-';
                const d = new Date(date);
                return d.toLocaleDateString('pt-BR');
            };

            // Process logically in groups of 4
            for (let i = 0; i < parcelas.length; i++) {
                const p = parcelas[i];
                const pageIndex = i % 4;

                // Add new page if we are at the start of a new group of 4 (except first)
                if (i > 0 && pageIndex === 0) {
                    doc.addPage();
                }

                const startY = 10 + (pageIndex * 200); // Layout refined for A4 height
                const marginX = 40;
                const width = 515;
                const height = 190;

                // Draw Outer Box
                doc.rect(marginX, startY, width, height).stroke();

                // Row 1: Sacado & CPF
                doc.rect(marginX, startY, width, 25).fillAndStroke('#f3f4f6', '#000');
                doc.fillColor('#000').fontSize(8).text('Inquilino', marginX + 5, startY + 5);
                doc.fontSize(10).text(p.inquilino_nome || '', marginX + 5, startY + 14, { width: 350, ellipsis: true });

                doc.moveTo(marginX + 380, startY).lineTo(marginX + 380, startY + 25).stroke();
                doc.fontSize(8).text('CPF', marginX + 385, startY + 5);
                doc.fontSize(10).text(p.inquilino_cpf || '-', marginX + 385, startY + 14);

                // Row 2: Endereço & Unidade
                const row2Y = startY + 25;
                doc.rect(marginX, row2Y, width, 25).stroke();
                doc.fontSize(8).text('ENDEREÇO', marginX + 5, row2Y + 5);
                const endereco = `${p.imovel_endereco}${p.imovel_numero ? ', ' + p.imovel_numero : ''} - ${p.imovel_cidade}`;
                doc.fontSize(10).text(endereco, marginX + 5, row2Y + 14, { width: 350, ellipsis: true });

                doc.moveTo(marginX + 380, row2Y).lineTo(marginX + 380, row2Y + 25).stroke();
                doc.fontSize(8).text('UNIDADE', marginX + 385, row2Y + 5);
                doc.fontSize(10).text(`${p.unidade_identificador || ''}`, marginX + 385, row2Y + 14);

                // Split Area: Left (Values) | Right (Details)
                const splitY = row2Y + 25;
                const midX = marginX + (width / 2);
                doc.moveTo(midX, splitY).lineTo(midX, startY + height).stroke();

                // Left: Items
                doc.fontSize(10);
                let currentY = splitY + 10;
                doc.text('Aluguel', marginX + 5, currentY);
                doc.text(formatCurrency(p.valor_base), marginX + 150, currentY, { align: 'right', width: 100 });
                currentY += 15;

                const ipt = Number(p.valor_iptu) || 0;
                if (ipt > 0) {
                    doc.text('IPTU', marginX + 5, currentY);
                    doc.text(formatCurrency(ipt), marginX + 150, currentY, { align: 'right', width: 100 });
                    currentY += 15;
                }

                const ag = Number(p.valor_agua) || 0;
                if (ag > 0) {
                    doc.text('Água', marginX + 5, currentY);
                    doc.text(formatCurrency(ag), marginX + 150, currentY, { align: 'right', width: 100 });
                    currentY += 15;
                }

                const lz = Number(p.valor_luz) || 0;
                if (lz > 0) {
                    doc.text('Luz', marginX + 5, currentY);
                    doc.text(formatCurrency(lz), marginX + 150, currentY, { align: 'right', width: 100 });
                    currentY += 15;
                }

                const outr = Number(p.valor_outros) || 0;
                if (outr > 0) {
                    const labelOutros = (p.observacoes && p.observacoes.trim() !== '') ? p.observacoes.substring(0, 20) : 'Outros';
                    doc.text(labelOutros, marginX + 5, currentY);
                    doc.text(formatCurrency(outr), marginX + 150, currentY, { align: 'right', width: 100 });
                    currentY += 15;
                }

                const outros = ipt + ag + lz + outr;

                // Bruto Box
                const brutoY = startY + height - 30;
                doc.rect(marginX, brutoY, (width / 2), 30).fillAndStroke('#e5e7eb', '#000');
                doc.fillColor('#000').fontSize(10).text('TOTAL BRUTO', marginX + 5, brutoY + 10);
                doc.fontSize(12).text(formatCurrency(Number(p.valor_base) + outros), marginX + 150, brutoY + 10, { align: 'right', width: 100, bold: true });

                // Right: Vencimento & Obs
                doc.fontSize(8).text('REF', midX + 150, splitY + 5);
                doc.fontSize(10).text(p.descricao || `Parc. ${p.numero_parcela}`, midX + 150, splitY + 14);

                doc.fontSize(8).text('VENCIMENTO', midX + 5, splitY + 5);
                doc.fontSize(14).text(formatDate(p.data_vencimento), midX + 5, splitY + 14, { bold: true });



                doc.moveTo(midX, splitY + 35).lineTo(marginX + width, splitY + 35).stroke();
                doc.fontSize(8).text('OBSERVAÇÕES', midX + 5, splitY + 40);
                const desconto = Number(p.desconto_pontualidade) || 0;
                const total = (Number(p.valor_base) + outros) - desconto;
                doc.fontSize(9).text(`Até o vencimento: desconto de ${formatCurrency(desconto)}`, midX + 5, splitY + 48);

                const footerY = startY + height - 40;
                const totalBoxY = footerY - 18;
                doc.rect(midX, totalBoxY, width / 2, 18).fillAndStroke('#e5e7eb', '#000');

                doc.fillColor('#000').font('Helvetica-Bold').fontSize(12).text(
                    `Total a pagar: ${formatCurrency(total)}`,
                    midX, totalBoxY + 4,
                    { align: 'center', width: width / 2 }
                );

                doc.font('Helvetica');

                // Footer Row (Signature)
                doc.moveTo(midX, footerY).lineTo(marginX + width, footerY).stroke();
                doc.fontSize(8).text('DATA PAGTO', midX + 5, footerY + 5);
                doc.moveTo(midX + 120, footerY).lineTo(midX + 120, startY + height).stroke();
                doc.text('ASSINATURA', midX + 125, footerY + 5);

                // ID Stamp
                doc.fontSize(7).fillColor('#bbb').text(`ID: ${p.id.slice(0, 8)}`, marginX + width - 50, startY + height - 10);
                doc.fillColor('#000'); // Reset
            }

            doc.end();
            stream.on('finish', () => resolve(outputPath));
            stream.on('error', reject);
        } catch (err) {
            reject(err);
        }
    });
}

module.exports = {
    generateContratoPDF,
    generateBoletoPDF,
    generateBulkBoletosPDF,
};
