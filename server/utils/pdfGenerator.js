const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const path = require('path');

/**
 * Generate a professional invoice PDF buffer with QR code, watermark & logo.
 * @param {Object} invoice  - Invoice with items, payments, and customer details
 * @param {Object} user     - The business owner/user
 * @returns {Promise<Buffer>}
 */
const generateInvoicePDF = async (invoice, user) => {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const buffers = [];

      doc.on('data', chunk => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      // ── Palette ─────────────────────────────────────────────────────────────
      const PRIMARY  = '#2563EB';
      const DARK     = '#1E293B';
      const MUTED    = '#64748B';
      const LIGHT_BG = '#F8FAFC';
      const BORDER   = '#E2E8F0';
      const SUCCESS  = '#16A34A';
      const DANGER   = '#DC2626';

      const pageW    = doc.page.width;
      const pageH    = doc.page.height;
      const margin   = 50;
      const contentW = pageW - margin * 2;

      // ── Generate QR code ────────────────────────────────────────────────────
      const qrData = `Invoice: ${invoice.invoice_no} | Amount: ₹${Number(invoice.grand_total || 0).toFixed(2)} | ${user.company_name || user.name}`;
      let qrImageBuffer = null;
      try {
        qrImageBuffer = await QRCode.toBuffer(qrData, {
          type: 'png', width: 100, margin: 1,
          color: { dark: '#1E293B', light: '#FFFFFF' }
        });
      } catch (qrErr) {
        console.warn('QR code generation failed:', qrErr.message);
      }

      // ── Helper: filled rect ─────────────────────────────────────────────────
      const filledRect = (x, y, w, h, color) =>
        doc.save().fillColor(color).rect(x, y, w, h).fill().restore();

      // ── Helper: h-rule ───────────────────────────────────────────────────────
      const hRule = (y, color = BORDER, thick = 0.5) =>
        doc.save().strokeColor(color).lineWidth(thick)
           .moveTo(margin, y).lineTo(pageW - margin, y).stroke().restore();

      // ── PAID WATERMARK ───────────────────────────────────────────────────────
      if (invoice.status === 'paid') {
        doc.save();
        doc.rotate(-45, { origin: [pageW / 2, pageH / 2] });
        doc.fillColor('#22c55e').opacity(0.06).fontSize(90).font('Helvetica-Bold')
           .text('PAID', 0, pageH / 2 - 60, { width: pageW, align: 'center' });
        doc.restore();
      }
      if (invoice.status === 'overdue') {
        doc.save();
        doc.rotate(-45, { origin: [pageW / 2, pageH / 2] });
        doc.fillColor('#ef4444').opacity(0.06).fontSize(80).font('Helvetica-Bold')
           .text('OVERDUE', 0, pageH / 2 - 60, { width: pageW, align: 'center' });
        doc.restore();
      }

      // ── HEADER BAND ─────────────────────────────────────────────────────────
      filledRect(0, 0, pageW, 130, PRIMARY);

      // Company logo (if exists)
      const logoPath = user.logo ? path.join(__dirname, '..', user.logo) : null;
      let hasLogo = false;
      if (logoPath) {
        try {
          const fs = require('fs');
          if (fs.existsSync(logoPath)) {
            doc.image(logoPath, margin, 20, { height: 60, fit: [80, 60] });
            hasLogo = true;
          }
        } catch {}
      }

      // Company name
      const nameX = hasLogo ? margin + 90 : margin;
      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(20)
         .text(user.company_name || user.name || 'Your Company', nameX, 28, { width: contentW * 0.55 });

      if (user.gst_number) {
        doc.font('Helvetica').fontSize(9).fillColor('rgba(255,255,255,0.75)')
           .text(`GSTIN: ${user.gst_number}`, nameX, 54);
      }
      if (user.phone) {
        doc.font('Helvetica').fontSize(9).fillColor('rgba(255,255,255,0.75)')
           .text(`📞 ${user.phone}`, nameX, 66);
      }

      // INVOICE label + number + QR code
      const rightX = pageW - margin - 155;

      doc.font('Helvetica-Bold').fontSize(26).fillColor('#FFFFFF')
         .text('INVOICE', rightX, 20, { width: 155, align: 'right' });
      doc.font('Helvetica').fontSize(10).fillColor('rgba(255,255,255,0.9)')
         .text(invoice.invoice_no, rightX, 52, { width: 155, align: 'right' });

      // QR code in header (top-right corner)
      if (qrImageBuffer) {
        try {
          doc.image(qrImageBuffer, pageW - margin - 52, 5, { width: 48, height: 48 });
        } catch {}
      }

      let y = 148;

      // ── STATUS BADGE ────────────────────────────────────────────────────────
      const statusColors = { paid: SUCCESS, draft: MUTED, sent: PRIMARY, pending: '#D97706', overdue: DANGER, cancelled: '#6B7280' };
      const badgeColor = statusColors[invoice.status] || MUTED;
      const statusLabel = (invoice.status || 'draft').toUpperCase();
      const badgeW = 90;
      const badgeX = pageW - margin - badgeW;

      filledRect(badgeX, y - 6, badgeW, 22, badgeColor);
      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(8)
         .text(statusLabel, badgeX, y - 2, { width: badgeW, align: 'center' });

      // ── INVOICE META ────────────────────────────────────────────────────────
      const fmtDate = d => d
        ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
        : '—';

      doc.fillColor(DARK).font('Helvetica').fontSize(9);
      doc.text(`Invoice Date: `, margin, y, { continued: true })
         .font('Helvetica-Bold').text(fmtDate(invoice.date));
      y += 13;
      doc.font('Helvetica').text(`Due Date:      `, margin, y, { continued: true })
         .font('Helvetica-Bold').text(fmtDate(invoice.due_date));
      y += 28;
      hRule(y);
      y += 14;

      // ── BILLED TO / FROM ────────────────────────────────────────────────────
      const col2x = margin + contentW / 2;

      doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(8)
         .text('BILLED TO', margin, y)
         .text('FROM', col2x, y);
      y += 13;

      // Customer
      doc.fillColor(DARK).font('Helvetica-Bold').fontSize(11)
         .text(invoice.customer_name || '—', margin, y, { width: contentW / 2 - 10 });
      doc.font('Helvetica').fontSize(9).fillColor(MUTED);
      let cy = y + 14;
      if (invoice.customer_email)   { doc.text(invoice.customer_email,   margin, cy, { width: contentW / 2 - 10 }); cy += 11; }
      if (invoice.customer_phone)   { doc.text(invoice.customer_phone,   margin, cy, { width: contentW / 2 - 10 }); cy += 11; }
      if (invoice.customer_address) { doc.text(invoice.customer_address, margin, cy, { width: contentW / 2 - 10 }); cy += 11; }
      if (invoice.customer_gst)     { doc.text(`GSTIN: ${invoice.customer_gst}`, margin, cy); cy += 11; }

      // Seller
      doc.fillColor(DARK).font('Helvetica-Bold').fontSize(11)
         .text(user.company_name || user.name, col2x, y, { width: contentW / 2 });
      doc.font('Helvetica').fontSize(9).fillColor(MUTED);
      let uy = y + 14;
      if (user.email)      { doc.text(user.email,          col2x, uy, { width: contentW / 2 }); uy += 11; }
      if (user.phone)      { doc.text(user.phone,          col2x, uy, { width: contentW / 2 }); uy += 11; }
      if (user.gst_number) { doc.text(`GSTIN: ${user.gst_number}`, col2x, uy, { width: contentW / 2 }); uy += 11; }
      if (user.address)    { doc.text(user.address,        col2x, uy, { width: contentW / 2 }); uy += 11; }

      y = Math.max(cy, uy) + 18;
      hRule(y);
      y += 14;

      // ── ITEMS TABLE ─────────────────────────────────────────────────────────
      const cols = {
        desc:   { x: margin,              w: contentW * 0.38 },
        qty:    { x: margin + contentW * 0.38, w: contentW * 0.10 },
        price:  { x: margin + contentW * 0.48, w: contentW * 0.16 },
        gst:    { x: margin + contentW * 0.64, w: contentW * 0.10 },
        amount: { x: margin + contentW * 0.74, w: contentW * 0.26 },
      };

      // Header
      filledRect(margin, y, contentW, 22, PRIMARY);
      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(8);
      doc.text('DESCRIPTION', cols.desc.x + 4,  y + 7, { width: cols.desc.w });
      doc.text('QTY',         cols.qty.x,        y + 7, { width: cols.qty.w,   align: 'center' });
      doc.text('UNIT PRICE',  cols.price.x,      y + 7, { width: cols.price.w, align: 'right' });
      doc.text('GST %',       cols.gst.x,        y + 7, { width: cols.gst.w,   align: 'center' });
      doc.text('AMOUNT',      cols.amount.x,     y + 7, { width: cols.amount.w - 4, align: 'right' });
      y += 22;

      // Rows
      const items = invoice.items || [];
      items.forEach((item, idx) => {
        const rowH = 24;
        if (idx % 2 === 0) filledRect(margin, y, contentW, rowH, LIGHT_BG);
        doc.save().strokeColor(BORDER).lineWidth(0.3).rect(margin, y, contentW, rowH).stroke().restore();

        doc.fillColor(DARK).font('Helvetica').fontSize(9);
        doc.text(item.description || '—',               cols.desc.x + 4,  y + 7, { width: cols.desc.w - 4, ellipsis: true });
        doc.text(String(item.qty),                      cols.qty.x,       y + 7, { width: cols.qty.w,    align: 'center' });
        doc.text(`₹${Number(item.price).toFixed(2)}`,   cols.price.x,     y + 7, { width: cols.price.w,  align: 'right' });
        doc.text(`${Number(item.gst || 0).toFixed(1)}%`,cols.gst.x,       y + 7, { width: cols.gst.w,    align: 'center' });
        doc.font('Helvetica-Bold')
           .text(`₹${Number(item.total).toFixed(2)}`,   cols.amount.x,    y + 7, { width: cols.amount.w - 4, align: 'right' });
        y += rowH;
      });

      y += 18;

      // ── GST SUMMARY ─────────────────────────────────────────────────────────
      const gstRates = {};
      items.forEach(item => {
        const rate = item.gst || 0;
        const base = item.qty * item.price;
        const gstAmt = base * rate / 100;
        gstRates[rate] = (gstRates[rate] || { base: 0, gst: 0 });
        gstRates[rate].base += base;
        gstRates[rate].gst += gstAmt;
      });

      const nonZeroGst = Object.entries(gstRates).filter(([r]) => Number(r) > 0);
      if (nonZeroGst.length > 0) {
        const gstX = margin;
        const gstW = contentW * 0.45;
        doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(8).text('GST SUMMARY', gstX, y);
        y += 12;
        filledRect(gstX, y, gstW, 18, LIGHT_BG);
        doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(8);
        doc.text('GST Rate', gstX + 4, y + 5, { width: gstW * 0.3 });
        doc.text('Taxable Amt', gstX + gstW * 0.3, y + 5, { width: gstW * 0.35, align: 'right' });
        doc.text('GST Amt', gstX + gstW * 0.65, y + 5, { width: gstW * 0.35, align: 'right' });
        y += 18;
        nonZeroGst.forEach(([rate, vals]) => {
          doc.fillColor(DARK).font('Helvetica').fontSize(8);
          doc.text(`${rate}%`, gstX + 4, y + 4, { width: gstW * 0.3 });
          doc.text(`₹${vals.base.toFixed(2)}`, gstX + gstW * 0.3, y + 4, { width: gstW * 0.35, align: 'right' });
          doc.text(`₹${vals.gst.toFixed(2)}`, gstX + gstW * 0.65, y + 4, { width: gstW * 0.35, align: 'right' });
          y += 16;
        });
      }

      // ── TOTALS BOX ──────────────────────────────────────────────────────────
      const totalsX = pageW - margin - 220;
      const totalsW = 220;
      const totalsStartY = y - (nonZeroGst.length > 0 ? (nonZeroGst.length + 1) * 16 + 30 : 0);

      const addTotalRow = (label, value, bold = false, color = DARK) => {
        const rowH = 20;
        doc.fillColor(MUTED).font('Helvetica').fontSize(9)
           .text(label, totalsX + 8, y + 3, { width: 120 });
        doc.fillColor(color).font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 10 : 9)
           .text(`₹${Number(value || 0).toFixed(2)}`, totalsX + 128, y + 3, { width: 84, align: 'right' });
        hRule(y + rowH, BORDER, 0.3);
        y += rowH;
      };

      filledRect(totalsX, y, totalsW, 20, LIGHT_BG);
      doc.fillColor(PRIMARY).font('Helvetica-Bold').fontSize(8).text('SUMMARY', totalsX + 8, y + 6);
      y += 20;
      addTotalRow('Subtotal',   invoice.subtotal);
      addTotalRow('GST Amount', invoice.gst_amount);
      if (Number(invoice.discount) > 0) addTotalRow('Discount', invoice.discount, false, DANGER);
      // Grand total
      filledRect(totalsX, y, totalsW, 26, PRIMARY);
      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(10)
         .text('GRAND TOTAL', totalsX + 8, y + 8, { width: 120 });
      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(11)
         .text(`₹${Number(invoice.grand_total || 0).toFixed(2)}`, totalsX + 128, y + 7, { width: 84, align: 'right' });
      y += 26;

      // ── NOTES ───────────────────────────────────────────────────────────────
      if (invoice.notes) {
        y += 16;
        doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(8).text('NOTES', margin, y);
        y += 11;
        doc.fillColor(DARK).font('Helvetica').fontSize(9)
           .text(invoice.notes, margin, y, { width: contentW });
        y += doc.heightOfString(invoice.notes, { width: contentW }) + 10;
      }

      // ── PAYMENTS ────────────────────────────────────────────────────────────
      const payments = invoice.payments || [];
      if (payments.length > 0) {
        y += 8;
        doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(8).text('PAYMENT HISTORY', margin, y);
        y += 12;
        payments.forEach(p => {
          doc.fillColor(DARK).font('Helvetica').fontSize(9)
             .text(
               `${fmtDate(p.date)} — ${(p.method || '').toUpperCase()} — ₹${Number(p.amount).toFixed(2)}${p.note ? '  (' + p.note + ')' : ''}`,
               margin, y, { width: contentW }
             );
          y += 13;
        });
      }

      // ── SIGNATURE AREA ───────────────────────────────────────────────────────
      if (y < pageH - 120) {
        const sigY = pageH - 110;
        hRule(sigY, BORDER, 0.5);
        const sigWidth = 160;

        // Authorized signature box
        doc.save()
           .rect(pageW - margin - sigWidth, sigY + 8, sigWidth, 40)
           .stroke(BORDER)
           .restore();
        doc.fillColor(MUTED).font('Helvetica').fontSize(8)
           .text('Authorized Signatory', pageW - margin - sigWidth, sigY + 52, { width: sigWidth, align: 'center' });
        doc.fillColor(DARK).font('Helvetica-Bold').fontSize(9)
           .text(user.company_name || user.name, pageW - margin - sigWidth, sigY + 62, { width: sigWidth, align: 'center' });
      }

      // ── FOOTER ──────────────────────────────────────────────────────────────
      const footerY = pageH - 48;
      filledRect(0, footerY, pageW, 48, PRIMARY);
      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(10)
         .text('Thank you for your business!', margin, footerY + 8, { width: contentW, align: 'center' });
      doc.fillColor('rgba(255,255,255,0.7)').font('Helvetica').fontSize(8)
         .text(
           `${user.company_name || user.name} • Powered by Billingly • ${new Date().toLocaleDateString('en-IN')}`,
           margin, footerY + 24, { width: contentW, align: 'center' }
         );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};

module.exports = generateInvoicePDF;
