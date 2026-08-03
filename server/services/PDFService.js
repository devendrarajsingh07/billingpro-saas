'use strict';

const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');

class PDFService {
  /**
   * Generates a professional invoice PDF stream/buffer.
   */
  static async generateInvoicePDF(invoice) {
    // Pre-generate QR code BEFORE entering the synchronous PDFKit drawing phase.
    // This avoids the `new Promise(async executor)` anti-pattern where async
    // rejections can escape the promise and become unhandled rejections.
    let qrBuffer = null;
    try {
      // Only generate the payment QR if the company has configured their UPI VPA.
      // invoice.company_upi_id is populated by InvoiceService.sendInvoiceEmail()
      // from the enrichedInvoice object (which reads companies.upi_id via DB).
      // If unset, we skip the QR silently — the invoice still renders correctly.
      if (invoice.company_upi_id) {
        const paymentString = `upi://pay?pa=${encodeURIComponent(invoice.company_upi_id)}&pn=${encodeURIComponent(invoice.company_name || 'BillingPro')}&am=${invoice.grand_total}&cu=${invoice.currency_code || 'INR'}&tr=INV-${invoice.invoice_no}`;
        qrBuffer = await QRCode.toBuffer(paymentString, { width: 85, margin: 1 });
      }
    } catch (_err) {
      // QR fallback — invoice still renders without it
    }

    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: 'A4', margin: 40 });
        const chunks = [];

        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', (err) => reject(err));

        // ═══════════════════════════════════════════════════
        // BACKGROUND WATERMARK
        // ═══════════════════════════════════════════════════
        if (invoice.status === 'draft' || invoice.status === 'cancelled') {
          doc.save();
          doc.opacity(0.08);
          doc.fontSize(80).fillColor('#64748b');
          doc.rotate(45, { origin: [300, 400] });
          doc.text(invoice.status.toUpperCase(), 120, 360, { align: 'center', width: 360 });
          doc.restore();
        }

        // ═══════════════════════════════════════════════════
        // HEADER / COMPANY INFO
        // ═══════════════════════════════════════════════════
        doc.fillColor('#1e293b');
        doc.fontSize(20).font('Helvetica-Bold').text(invoice.company_name || 'BILLINGPRO INC.', 40, 40);
        doc.fontSize(9).font('Helvetica').fillColor('#64748b');
        doc.text(invoice.company_address || '100 Innovation Way, Suite 400', 40, 65);
        doc.text(`${invoice.company_city || 'Bangalore'}, ${invoice.company_state || 'Karnataka'} - ${invoice.company_postal || '560001'}`, 40, 77);
        doc.text(`Email: ${invoice.company_email || 'billing@billingpro.com'} | GSTIN: ${invoice.company_gstin || '29AAAAA0000A1Z5'}`, 40, 89);

        // ═══════════════════════════════════════════════════
        // INVOICE METADATA (Top Right)
        // ═══════════════════════════════════════════════════
        doc.fillColor('#4f46e5');
        doc.fontSize(16).font('Helvetica-Bold').text('INVOICE', 300, 40, { align: 'right', width: 255 });
        doc.fontSize(9).font('Helvetica').fillColor('#1e293b');
        doc.text(`Invoice No: ${invoice.invoice_no}`, 300, 62, { align: 'right', width: 255 });
        doc.text(`Date: ${invoice.date}`, 300, 78, { align: 'right', width: 255 });
        doc.text(`Due Date: ${invoice.due_date || 'N/A'}`, 300, 94, { align: 'right', width: 255 });
        
        // Status Badge
        doc.save();
        const badgeColor = invoice.status === 'paid' ? '#22c55e' : invoice.status === 'overdue' ? '#ef4444' : '#f59e0b';
        doc.opacity(0.1);
        doc.rect(480, 100, 75, 18).fill(badgeColor);
        doc.restore();
        doc.fillColor(badgeColor).font('Helvetica-Bold').fontSize(8).text(invoice.status.toUpperCase(), 480, 105, { align: 'center', width: 75 });

        // Horizontal Line Divider
        doc.moveTo(40, 130).lineTo(555, 130).strokeColor('#e2e8f0').lineWidth(1).stroke();

        // ═══════════════════════════════════════════════════
        // BILL TO & SHIP TO
        // ═══════════════════════════════════════════════════
        doc.fillColor('#64748b').font('Helvetica-Bold').fontSize(9).text('BILL TO', 40, 145);
        doc.fillColor('#1e293b').fontSize(11).font('Helvetica-Bold').text(invoice.customer_name, 40, 160);
        doc.fontSize(9).font('Helvetica').fillColor('#64748b');
        doc.text(invoice.customer_billing_address || 'No billing address provided.', 40, 175, { width: 230 });
        doc.text(`Email: ${invoice.customer_email || 'N/A'}`, 40, 205);
        doc.text(`GSTIN: ${invoice.customer_gstin || 'N/A'}`, 40, 217);

        // Shipping details (optional column)
        doc.fillColor('#64748b').font('Helvetica-Bold').fontSize(9).text('SHIP TO', 320, 145);
        doc.fillColor('#1e293b').fontSize(11).font('Helvetica-Bold').text(invoice.customer_name, 320, 160);
        doc.fontSize(9).font('Helvetica').fillColor('#64748b');
        doc.text(invoice.customer_shipping_address || invoice.customer_billing_address || 'Same as billing.', 320, 175, { width: 230 });

        // ═══════════════════════════════════════════════════
        // ITEMS TABLE HEADER
        // ═══════════════════════════════════════════════════
        const tableTop = 260;
        doc.save();
        doc.rect(40, tableTop, 515, 20).fill('#f1f5f9');
        doc.restore();

        doc.fillColor('#475569').font('Helvetica-Bold').fontSize(8);
        doc.text('#', 45, tableTop + 6, { width: 20 });
        doc.text('ITEM & DESCRIPTION', 75, tableTop + 6, { width: 200 });
        doc.text('QTY', 285, tableTop + 6, { width: 40, align: 'right' });
        doc.text('UNIT PRICE', 335, tableTop + 6, { width: 65, align: 'right' });
        doc.text('TAX', 410, tableTop + 6, { width: 50, align: 'right' });
        doc.text('TOTAL', 475, tableTop + 6, { width: 75, align: 'right' });

        // ═══════════════════════════════════════════════════
        // ITEMS TABLE ROWS
        // ═══════════════════════════════════════════════════
        let currentY = tableTop + 20;
        doc.font('Helvetica').fontSize(8).fillColor('#1e293b');

        let index = 1;
        for (const item of invoice.items) {
          // Alternating row background
          if (index % 2 === 0) {
            doc.save();
            doc.rect(40, currentY, 515, 22).fill('#f8fafc');
            doc.restore();
          }

          doc.fillColor('#64748b').text(String(index), 45, currentY + 7);
          doc.fillColor('#1e293b').font('Helvetica-Bold').text(item.description || item.product_name, 75, currentY + 7, { width: 200, height: 12, ellipsis: true });
          
          doc.font('Helvetica').text(String(item.qty), 285, currentY + 7, { width: 40, align: 'right' });
          doc.text(Number(item.unit_price).toFixed(2), 335, currentY + 7, { width: 65, align: 'right' });
          doc.text(`${item.tax_rate}%`, 410, currentY + 7, { width: 50, align: 'right' });
          doc.font('Helvetica-Bold').text(Number(item.total).toFixed(2), 475, currentY + 7, { width: 75, align: 'right' });

          doc.moveTo(40, currentY + 22).lineTo(555, currentY + 22).strokeColor('#f1f5f9').lineWidth(0.5).stroke();
          currentY += 22;
          index++;
        }

        // ═══════════════════════════════════════════════════
        // TOTALS SUMMARY & QR CODE
        // ═══════════════════════════════════════════════════
        const totalsY = currentY + 15;

        if (qrBuffer) {
          doc.image(qrBuffer, 40, totalsY, { width: 85 });
          doc.fontSize(7).fillColor('#94a3b8').text('Scan to Pay via UPI', 40, totalsY + 90, { width: 85, align: 'center' });
        }

        // Subtotal, Discount, Tax, Grand Total
        let rightY = totalsY;
        doc.font('Helvetica').fontSize(9).fillColor('#64748b');
        doc.text('Subtotal:', 350, rightY, { width: 100, align: 'right' });
        doc.font('Helvetica-Bold').fillColor('#1e293b').text(Number(invoice.subtotal).toFixed(2), 460, rightY, { width: 90, align: 'right' });
        
        rightY += 16;
        if (invoice.discount_amount > 0) {
          // Fix: show % only for percentage-type discounts
          const discountLabel = invoice.discount_type === 'percentage'
            ? `Discount (${invoice.discount_value}%)`
            : 'Discount';
          doc.font('Helvetica').fillColor('#64748b').text(`${discountLabel}:`, 350, rightY, { width: 100, align: 'right' });
          doc.font('Helvetica-Bold').fillColor('#ef4444').text(`-${Number(invoice.discount_amount).toFixed(2)}`, 460, rightY, { width: 90, align: 'right' });
          rightY += 16;
        }

        doc.font('Helvetica').fillColor('#64748b').text('Tax Amount:', 350, rightY, { width: 100, align: 'right' });
        doc.font('Helvetica-Bold').fillColor('#1e293b').text(Number(invoice.tax_amount).toFixed(2), 460, rightY, { width: 90, align: 'right' });
        
        rightY += 18;
        doc.moveTo(350, rightY).lineTo(555, rightY).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
        
        rightY += 8;
        doc.fontSize(11).font('Helvetica-Bold').fillColor('#4f46e5');
        doc.text('Grand Total:', 350, rightY, { width: 100, align: 'right' });
        doc.text(`${invoice.currency_code || 'INR'} ${Number(invoice.grand_total).toFixed(2)}`, 460, rightY, { width: 90, align: 'right' });

        rightY += 18;
        doc.fontSize(9).font('Helvetica').fillColor('#64748b');
        doc.text('Amount Paid:', 350, rightY, { width: 100, align: 'right' });
        doc.font('Helvetica-Bold').fillColor('#22c55e').text(Number(invoice.amount_paid).toFixed(2), 460, rightY, { width: 90, align: 'right' });

        rightY += 16;
        doc.font('Helvetica').fillColor('#64748b').text('Balance Due:', 350, rightY, { width: 100, align: 'right' });
        doc.font('Helvetica-Bold').fillColor('#ef4444').text(Number(invoice.amount_due).toFixed(2), 460, rightY, { width: 90, align: 'right' });

        // ═══════════════════════════════════════════════════
        // TERMS & CONDITIONS / SIGNATURE
        // ═══════════════════════════════════════════════════
        const footerY = Math.max(totalsY + 130, rightY + 30);
        doc.moveTo(40, footerY).lineTo(555, footerY).strokeColor('#e2e8f0').lineWidth(0.5).stroke();

        doc.fillColor('#64748b').fontSize(8).font('Helvetica-Bold').text('TERMS & CONDITIONS', 40, footerY + 12);
        doc.font('Helvetica').fillColor('#94a3b8').text(invoice.terms_conditions || '1. Payments are due within payment term period.\n2. Please mention the invoice number on your wire transfer reference details.', 40, footerY + 25, { width: 300 });

        // Authorized Signature Area
        doc.fillColor('#64748b').font('Helvetica-Bold').text('AUTHORIZED SIGNATURE', 400, footerY + 12, { align: 'right', width: 155 });
        doc.moveTo(420, footerY + 60).lineTo(555, footerY + 60).strokeColor('#cbd5e1').lineWidth(0.5).stroke();
        doc.fontSize(7).fillColor('#94a3b8').text('Signature / Stamp', 400, footerY + 65, { align: 'right', width: 155 });

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Generates a professional Customer Account Statement PDF.
   */
  static async generateStatementPDF(customer, invoices, payments, company) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: 'A4', margin: 40 });
        const chunks = [];

        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', (err) => reject(err));

        // Header / Company Info
        doc.fillColor('#1e293b');
        doc.fontSize(18).font('Helvetica-Bold').text(company.name || 'BILLINGPRO INC.', 40, 40);
        doc.fontSize(9).font('Helvetica').fillColor('#64748b');
        doc.text(company.address || '', 40, 60);
        doc.text(`${company.city || ''}, ${company.state || ''} - ${company.postal_code || ''}`, 40, 72);
        doc.text(`Email: ${company.email || ''} | GSTIN: ${company.gst_number || ''}`, 40, 84);

        // Statement Metadata
        doc.fillColor('#4f46e5');
        doc.fontSize(15).font('Helvetica-Bold').text('CUSTOMER STATEMENT', 350, 40, { align: 'right', width: 205 });
        doc.fontSize(9).font('Helvetica').fillColor('#1e293b');
        doc.text(`Date Generated: ${new Date().toISOString().split('T')[0]}`, 350, 60, { align: 'right', width: 205 });

        // Divider
        doc.moveTo(40, 110).lineTo(555, 110).strokeColor('#e2e8f0').lineWidth(1).stroke();

        // Customer Details
        doc.fillColor('#64748b').font('Helvetica-Bold').fontSize(9).text('STATEMENT FOR', 40, 125);
        doc.fillColor('#1e293b').fontSize(11).font('Helvetica-Bold').text(customer.name, 40, 140);
        doc.fontSize(9).font('Helvetica').fillColor('#64748b');
        doc.text(customer.billing_address || 'No billing address provided.', 40, 155, { width: 250 });
        doc.text(`Email: ${customer.email || 'N/A'} | Phone: ${customer.phone || 'N/A'}`, 40, 185);

        // Summary Calculations
        const totalBilled = invoices.reduce((sum, inv) => sum + (inv.grand_total || 0), 0);
        const totalPaid   = payments.reduce((sum, pay) => sum + (pay.amount || 0), 0);
        const balanceDue  = Math.max(0, totalBilled - totalPaid);

        // Summary Boxes
        const boxY = 210;
        doc.save();
        doc.rect(40, boxY, 160, 45).fill('#f8fafc');
        doc.rect(210, boxY, 160, 45).fill('#f8fafc');
        doc.rect(380, boxY, 175, 45).fill('#f8fafc');
        doc.restore();

        // Billed Box
        doc.fontSize(8).fillColor('#64748b').text('TOTAL BILLED', 40, boxY + 8, { align: 'center', width: 160 });
        doc.fontSize(12).font('Helvetica-Bold').fillColor('#1e293b').text(Number(totalBilled).toFixed(2), 40, boxY + 22, { align: 'center', width: 160 });

        // Paid Box
        doc.fontSize(8).font('Helvetica').fillColor('#64748b').text('TOTAL PAID', 210, boxY + 8, { align: 'center', width: 160 });
        doc.fontSize(12).font('Helvetica-Bold').fillColor('#22c55e').text(Number(totalPaid).toFixed(2), 210, boxY + 22, { align: 'center', width: 160 });

        // Balance Box
        doc.fontSize(8).font('Helvetica').fillColor('#64748b').text('BALANCE DUE', 380, boxY + 8, { align: 'center', width: 175 });
        doc.fontSize(12).font('Helvetica-Bold').fillColor('#ef4444').text(Number(balanceDue).toFixed(2), 380, boxY + 22, { align: 'center', width: 175 });

        // Ledger Table Header
        let y = 280;
        doc.save();
        doc.rect(40, y, 515, 20).fill('#f1f5f9');
        doc.restore();

        doc.fillColor('#475569').font('Helvetica-Bold').fontSize(8);
        doc.text('DATE', 45, y + 6);
        doc.text('TRANSACTION / TYPE', 120, y + 6);
        doc.text('REFERENCE', 280, y + 6);
        doc.text('DEBIT (BILLED)', 380, y + 6, { align: 'right', width: 80 });
        doc.text('CREDIT (PAID)', 470, y + 6, { align: 'right', width: 80 });

        // Merge and sort all items (invoices + payments) chronologically
        const ledger = [
          ...invoices.map(inv => ({
            date: inv.date,
            type: 'Invoice',
            ref: inv.invoice_no,
            debit: inv.grand_total,
            credit: 0
          })),
          ...payments.map(p => ({
            date: p.paid_at || p.created_at?.split('T')[0] || '',
            type: `Payment (${p.method?.toUpperCase()})`,
            ref: p.reference_no || `PAY-${p.id}`,
            debit: 0,
            credit: p.amount
          }))
        ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        doc.font('Helvetica').fontSize(8).fillColor('#334155');
        y += 20;

        for (const item of ledger) {
          // Page breaks if table overflows
          if (y > 750) {
            doc.addPage();
            y = 40;
            // Draw table headers again
            doc.save();
            doc.rect(40, y, 515, 20).fill('#f1f5f9');
            doc.restore();
            doc.fillColor('#475569').font('Helvetica-Bold');
            doc.text('DATE', 45, y + 6);
            doc.text('TRANSACTION / TYPE', 120, y + 6);
            doc.text('REFERENCE', 280, y + 6);
            doc.text('DEBIT (BILLED)', 380, y + 6, { align: 'right', width: 80 });
            doc.text('CREDIT (PAID)', 470, y + 6, { align: 'right', width: 80 });
            doc.font('Helvetica').fontSize(8).fillColor('#334155');
            y += 25;
          }

          doc.text(item.date, 45, y);
          doc.text(item.type, 120, y);
          doc.text(item.ref, 280, y);
          doc.text(item.debit > 0 ? Number(item.debit).toFixed(2) : '-', 380, y, { align: 'right', width: 80 });
          doc.text(item.credit > 0 ? Number(item.credit).toFixed(2) : '-', 470, y, { align: 'right', width: 80 });

          // Underline
          doc.moveTo(40, y + 15).lineTo(555, y + 15).strokeColor('#f1f5f9').lineWidth(0.5).stroke();
          y += 20;
        }

        // Footer note
        doc.fontSize(7).fillColor('#94a3b8').text('Thank you for choosing BillingPro. If you have any questions about this statement, please contact us.', 40, y + 20, { align: 'center', width: 515 });

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }
}

module.exports = PDFService;
