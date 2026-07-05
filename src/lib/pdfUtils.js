import jsPDF from 'jspdf'
import 'jspdf-autotable'
import { NOTO_SANS_DEVANAGARI_BASE64 } from './devanagariFont'

// Register Devanagari font once per doc
function addDevanagariFont(doc) {
  doc.addFileToVFS('NotoSansDevanagari.ttf', NOTO_SANS_DEVANAGARI_BASE64)
  doc.addFont('NotoSansDevanagari.ttf', 'Devanagari', 'normal')
}

// Sort items: highest quantity first
function sortItemsByQty(items) {
  return [...items].sort((a, b) => Number(b.quantity) - Number(a.quantity))
}

export function paymentLabel(status) {
  if (status === 'paid') return 'PAID'
  if (status === 'partial') return 'PARTIAL'
  return 'UNPAID'
}

export function paymentColor(status) {
  if (status === 'paid') return [46, 125, 50]
  if (status === 'partial') return [230, 81, 0]
  return [198, 40, 40]
}

// ── SINGLE BILL ──────────────────────────────────────────────
export function printSingleBill(order, items, retailer) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  addDevanagariFont(doc)

  const pageW = 210, margin = 18
  const sorted = sortItemsByQty(items)

  // ── Header band ──
  doc.setFillColor(59, 32, 7)
  doc.rect(0, 0, pageW, 42, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.text('PATIDAR K NAMKEEN', margin, 16)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text('Milk Distribution', margin, 23)
  doc.text(`${order.slot === 'morning' ? 'Morning' : 'Evening'} Order`, margin, 30)
  doc.text(`Bill No: ${order.id.toUpperCase().slice(-8)}`, pageW - margin, 14, { align: 'right' })
  doc.text(`Date: ${order.order_date}`, pageW - margin, 21, { align: 'right' })
  doc.text(`Printed: ${new Date().toLocaleDateString('en-IN')}`, pageW - margin, 28, { align: 'right' })

  // Payment badge
  const [pr, pg, pb] = paymentColor(order.payment_status)
  doc.setFillColor(pr, pg, pb)
  doc.roundedRect(pageW - margin - 28, 33, 28, 7, 2, 2, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(255, 255, 255)
  doc.text(paymentLabel(order.payment_status), pageW - margin - 14, 38, { align: 'center' })

  // ── Bill To — use autoTable so Devanagari font works reliably ──
  const retailerMeta = [
    retailer.phone ? `Ph: ${retailer.phone}` : null,
    retailer.area  ? `Area: ${retailer.area}` : null,
    retailer.address ? retailer.address : null,
  ].filter(Boolean).join('   ')

  doc.autoTable({
    startY: 50,
    margin: { left: margin, right: margin },
    theme: 'plain',
    styles: { fillColor: [253, 246, 236], cellPadding: { top: 2, bottom: 2, left: 5, right: 5 } },
    body: [
      // Row 1: label + gstin
      [
        { content: 'BILL TO', styles: { fontSize: 7, textColor: [138, 117, 96], font: 'helvetica', fontStyle: 'bold', cellPadding: { top: 5, left: 5, bottom: 1 } } },
        { content: retailer.gstin ? `GSTIN: ${retailer.gstin}` : '', styles: { fontSize: 8, textColor: [100, 100, 100], font: 'helvetica', halign: 'right', cellPadding: { top: 5, right: 5, bottom: 1 } } },
      ],
      // Row 2: retailer name (full width, helvetica bold — names are in English/Latin)
      [
        { content: retailer.name || '—', colSpan: 2, styles: { fontSize: 14, textColor: [59, 32, 7], font: 'helvetica', fontStyle: 'bold', cellPadding: { left: 5, top: 1, bottom: 2 } } },
      ],
      // Row 3: phone / area
      [
        { content: retailerMeta, colSpan: 2, styles: { fontSize: 8.5, textColor: [100, 100, 100], font: 'helvetica', cellPadding: { left: 5, top: 1, bottom: 6 } } },
      ],
    ],
    columnStyles: { 0: { cellWidth: (pageW - 2 * margin) * 0.6 }, 1: { cellWidth: (pageW - 2 * margin) * 0.4 } },
    tableWidth: pageW - 2 * margin,
  })

  let y = doc.lastAutoTable.finalY + 6

  // ── Items table ──
  doc.autoTable({
    startY: y,
    margin: { left: margin, right: margin },
    head: [['#', 'Product', 'Size / Variant', 'Rate (Rs.)', 'Qty', 'Amount (Rs.)']],
    body: sorted.map((item, i) => [
      i + 1,
      item.product_name,
      item.variant_name,
      Number(item.rate).toFixed(2),
      item.quantity,
      Number(item.amount).toFixed(2),
    ]),
    headStyles: { fillColor: [59, 32, 7], textColor: [255, 255, 255], fontSize: 8.5, fontStyle: 'bold', font: 'helvetica' },
    bodyStyles: { fontSize: 9, textColor: [59, 32, 7], font: 'Devanagari' },
    alternateRowStyles: { fillColor: [253, 248, 240] },
    columnStyles: {
      0: { font: 'helvetica', halign: 'center', cellWidth: 10 },
      3: { font: 'helvetica', halign: 'right' },
      4: { font: 'helvetica', halign: 'center', fontStyle: 'bold' },
      5: { font: 'helvetica', halign: 'right', fontStyle: 'bold' },
    },
  })

  y = doc.lastAutoTable.finalY + 4

  // ── Total bar ──
  doc.setFillColor(232, 132, 26)
  doc.rect(margin, y, pageW - 2 * margin, 12, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(255, 255, 255)
  doc.text('TOTAL', margin + 5, y + 8.5)
  doc.text(`Rs. ${Number(order.total).toFixed(2)}`, pageW - margin - 4, y + 8.5, { align: 'right' })

  y += 16

  // ── Pending block ──
  if (order.payment_status !== 'paid') {
    const pendingAmt = Number(order.total) - Number(order.amount_paid || 0)
    const paidAmt = Number(order.amount_paid || 0)
    doc.setFillColor(...paymentColor(order.payment_status))
    doc.rect(margin, y, pageW - 2 * margin, 10, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(255, 255, 255)
    if (order.payment_status === 'partial') {
      doc.text(`Paid: Rs.${paidAmt.toFixed(2)}`, margin + 5, y + 7)
      doc.text(`PENDING: Rs.${pendingAmt.toFixed(2)}`, pageW - margin - 4, y + 7, { align: 'right' })
    } else {
      doc.text(`AMOUNT PENDING: Rs.${Number(order.total).toFixed(2)}`, margin + 5, y + 7)
    }
    y += 14
  }

  if (order.notes) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(100)
    doc.text('Note: ' + order.notes, margin, y + 4)
  }

  // ── Footer ──
  const footerY = 272
  doc.setFillColor(245, 235, 220)
  doc.rect(0, footerY, pageW, 25, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(59, 32, 7)
  doc.text('Patidar K Namkeen - Milk Distribution', pageW / 2, footerY + 9, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(120)
  doc.text('Thank you for your business!', pageW / 2, footerY + 17, { align: 'center' })

  const filename = `Bill_${(retailer.name || 'order').replace(/[^\w]/g, '_')}_${order.order_date}.pdf`
  doc.save(filename)
}

// ── MULTI BILL (2-up or 4-up) ────────────────────────────────
export function printMultiBills(orders, orderItems, perPage) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  addDevanagariFont(doc)

  const pageW = 210, pageH = 297
  const cols = 2
  const rows = perPage === 2 ? 1 : 2

  // Gap between bills horizontally (between col 0 and col 1)
  const hGap = perPage === 4 ? 8 : 6
  // Outer margin
  const outerMargin = 8
  // Bill width: total width minus outer margins minus horizontal gap, divided by 2
  const billW = (pageW - 2 * outerMargin - hGap) / cols
  const billH = (pageH - 2 * outerMargin - (rows > 1 ? 6 : 0)) / rows

  let orderIndex = 0
  let firstPage = true

  while (orderIndex < orders.length) {
    if (!firstPage) doc.addPage()
    firstPage = false

    for (let row = 0; row < rows && orderIndex < orders.length; row++) {
      for (let col = 0; col < cols && orderIndex < orders.length; col++) {
        const order = orders[orderIndex]
        const items = sortItemsByQty(orderItems[order.id] || [])
        const retailer = order.retailers || {}

        // x accounts for outer margin + col offset + horizontal gap
        const x = outerMargin + col * (billW + hGap)
        const y = outerMargin + row * (billH + (rows > 1 ? 6 : 0))
        const bw = billW   // bill inner width
        const innerX = x + 2  // left edge for content
        const innerW = bw - 4 // usable content width inside bill

        doc.setDrawColor(180, 170, 160)
        doc.setLineWidth(0.4)
        doc.rect(x, y, bw, billH - 2)

        // ── Header ──
        doc.setFillColor(59, 32, 7)
        doc.rect(x, y, bw, 13, 'F')
        doc.setTextColor(255, 255, 255)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(8.5)
        doc.text('PATIDAR K NAMKEEN', innerX, y + 5.5)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(6.5)
        doc.text(`${order.order_date} | ${order.slot === 'morning' ? 'Morning' : 'Evening'}`, innerX, y + 10.5)
        doc.text(`#${order.id.toUpperCase().slice(-6)}`, x + bw - 3, y + 5.5, { align: 'right' })

        // Payment badge
        const [pr, pg, pb] = paymentColor(order.payment_status)
        doc.setFillColor(pr, pg, pb)
        doc.roundedRect(x + bw - 20, y + 7, 18, 5, 1, 1, 'F')
        doc.setTextColor(255, 255, 255)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(5.5)
        doc.text(paymentLabel(order.payment_status), x + bw - 11, y + 11, { align: 'center' })

        // ── Retailer box ──
        doc.autoTable({
          startY: y + 14,
          margin: { left: innerX, right: pageW - (x + bw) + 2 },
          theme: 'plain',
          styles: { fillColor: [253, 246, 236], cellPadding: { top: 1.5, bottom: 1.5, left: 2.5, right: 2.5 } },
          body: [
            [{ content: retailer.name || '—', styles: { fontSize: 9.5, textColor: [59, 32, 7], font: 'helvetica', fontStyle: 'bold' } }],
            [{ content: retailer.phone ? `Ph: ${retailer.phone}` : '', styles: { fontSize: 7, textColor: [100, 100, 100], font: 'helvetica' } }],
          ],
          tableWidth: innerW,
        })

        const afterRetailer = doc.lastAutoTable.finalY + 1.5

        // ── Items table ──
        doc.autoTable({
          startY: afterRetailer,
          margin: { left: innerX, right: pageW - (x + bw) + 2 },
          head: [['Product', 'Size', 'Qty', 'Rs.']],
          body: items.map(item => [
            item.product_name,
            item.variant_name,
            item.quantity,
            Number(item.amount).toFixed(0),
          ]),
          headStyles: {
            fillColor: [232, 132, 26], textColor: [255, 255, 255],
            fontSize: 7, fontStyle: 'bold',
            cellPadding: { top: 2, bottom: 2, left: 2, right: 1 },
            font: 'helvetica',
          },
          bodyStyles: {
            fontSize: 7.5, textColor: [59, 32, 7],
            cellPadding: { top: 2, bottom: 2, left: 2, right: 1 },
            font: 'Devanagari',
          },
          columnStyles: {
            0: { cellWidth: innerW * 0.42 },
            1: { cellWidth: innerW * 0.28 },
            2: { font: 'helvetica', halign: 'center', fontStyle: 'bold', cellWidth: innerW * 0.12 },
            3: { font: 'helvetica', halign: 'right', fontStyle: 'bold', cellWidth: innerW * 0.18 },
          },
          tableWidth: innerW,
        })

        const ty = doc.lastAutoTable.finalY + 1

        // ── Total bar ──
        doc.setFillColor(232, 132, 26)
        doc.rect(innerX, ty, innerW, 8, 'F')
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(9)
        doc.setTextColor(255, 255, 255)
        doc.text('TOTAL', innerX + 2, ty + 5.8)
        doc.text(`Rs.${Number(order.total).toFixed(2)}`, x + bw - 3, ty + 5.8, { align: 'right' })

        // ── Pending bar ──
        if (order.payment_status !== 'paid') {
          const pendingAmt = Number(order.total) - Number(order.amount_paid || 0)
          doc.setFillColor(...paymentColor(order.payment_status))
          doc.rect(innerX, ty + 9, innerW, 6, 'F')
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(6.5)
          doc.setTextColor(255, 255, 255)
          doc.text(`PENDING: Rs.${pendingAmt.toFixed(2)}`, x + bw - 3, ty + 13.5, { align: 'right' })
        }

        orderIndex++
      }
    }
  }

  doc.save(`Bills_${orders[0]?.order_date || 'today'}_${perPage}up.pdf`)
}

// ── PURCHASE / CONSOLIDATION ORDER ───────────────────────────
export function printPurchaseOrder(date, slot, orders, orderItems) {
  const map = {}
  orders.forEach(o => {
    ;(orderItems[o.id] || []).forEach(item => {
      const key = `${item.product_name}|||${item.variant_name}`
      if (!map[key]) {
        map[key] = { product: item.product_name, variant: item.variant_name, unit: item.unit, rate: item.rate, totalQty: 0, totalAmount: 0 }
      }
      map[key].totalQty += Number(item.quantity)
      map[key].totalAmount += Number(item.amount)
    })
  })

  const consolidated = Object.values(map).sort((a, b) => b.totalQty - a.totalQty)
  if (!consolidated.length) return false

  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  addDevanagariFont(doc)

  const pageW = 210, margin = 15

  doc.setFillColor(59, 32, 7)
  doc.rect(0, 0, pageW, 36, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(255, 255, 255)
  doc.text('PATIDAR K NAMKEEN', margin, 14)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text('Daily Purchase / Consolidation Order', margin, 22)
  doc.text(`Date: ${date}  |  Slot: ${slot === 'all' ? 'Full Day' : slot}  |  Shops: ${orders.length}`, margin, 29)

  doc.autoTable({
    startY: 44,
    margin: { left: margin, right: margin },
    head: [['#', 'Product', 'Size / Variant', 'Total Qty', 'Rate (Rs.)', 'Total Value (Rs.)']],
    body: consolidated.map((item, i) => [
      i + 1,
      item.product,
      item.variant,
      item.totalQty,
      Number(item.rate).toFixed(2),
      Number(item.totalAmount).toFixed(2),
    ]),
    headStyles: { fillColor: [59, 32, 7], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9, font: 'helvetica' },
    bodyStyles: { fontSize: 9.5, textColor: [59, 32, 7], font: 'Devanagari' },
    alternateRowStyles: { fillColor: [253, 248, 240] },
    columnStyles: {
      0: { font: 'helvetica', halign: 'center', cellWidth: 10 },
      3: { font: 'helvetica', halign: 'center', fontStyle: 'bold' },
      4: { font: 'helvetica', halign: 'right' },
      5: { font: 'helvetica', halign: 'right', fontStyle: 'bold' },
    },
  })

  const finalY = doc.lastAutoTable.finalY + 3
  const grandTotal = consolidated.reduce((s, i) => s + i.totalAmount, 0)
  doc.setFillColor(232, 132, 26)
  doc.rect(margin, finalY, pageW - 2 * margin, 11, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(255, 255, 255)
  doc.text('GRAND TOTAL', margin + 4, finalY + 7.5)
  doc.text(`Rs. ${grandTotal.toFixed(2)}`, pageW - margin - 3, finalY + 7.5, { align: 'right' })

  doc.save(`Purchase_Order_${date}.pdf`)
  return true
}