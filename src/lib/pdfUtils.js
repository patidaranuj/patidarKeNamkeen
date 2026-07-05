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

// ── MULTI BILL (2-up portrait OR 4-up landscape) ─────────────
export function printMultiBills(orders, orderItems, perPage) {
  // 4-up: landscape A4 (297 × 210), 2 cols × 2 rows — each bill ~140 × 96mm
  // 2-up: portrait A4 (210 × 297), 1 col × 2 rows  — each bill ~194 × 140mm
  const is4up = perPage === 4
  const orientation = is4up ? 'landscape' : 'portrait'
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation })
  addDevanagariFont(doc)

  // Page dimensions after orientation
  const pageW = is4up ? 297 : 210
  const pageH = is4up ? 210 : 297

  const cols = 2
  const rows = is4up ? 2 : 1
  const outerMargin = 8
  const hGap = 10   // gap between left and right bill
  const vGap = is4up ? 8 : 0  // gap between top and bottom bill (4-up only)

  const billW = (pageW - 2 * outerMargin - hGap) / cols
  const billH = (pageH - 2 * outerMargin - (rows > 1 ? vGap : 0)) / rows

  // Font sizes — bigger in landscape because each bill is wider
  const fs = {
    brandName:    is4up ? 10   : 13,
    dateLine:     is4up ? 7.5  : 9,
    badge:        is4up ? 6.5  : 8,
    retailerName: is4up ? 11   : 14,
    retailerMeta: is4up ? 8    : 9.5,
    tableHead:    is4up ? 8.5  : 10,
    tableBody:    is4up ? 9    : 11,
    totalBar:     is4up ? 10.5 : 13,
    pendingBar:   is4up ? 8    : 10,
  }

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

        const x  = outerMargin + col * (billW + hGap)
        const y  = outerMargin + row * (billH + vGap)
        const bw = billW
        const bh = billH - 2
        const iX = x + 3          // inner left
        const iW = bw - 6         // inner usable width

        // Bill border
        doc.setDrawColor(160, 148, 136)
        doc.setLineWidth(0.5)
        doc.rect(x, y, bw, bh)

        // ── Header band ──
        const headerH = is4up ? 14 : 17
        doc.setFillColor(59, 32, 7)
        doc.rect(x, y, bw, headerH, 'F')
        doc.setTextColor(255, 255, 255)

        doc.setFont('helvetica', 'bold')
        doc.setFontSize(fs.brandName)
        doc.text('PATIDAR K NAMKEEN', iX, y + (is4up ? 6 : 7.5))

        doc.setFont('helvetica', 'normal')
        doc.setFontSize(fs.dateLine)
        doc.text(
          `${order.order_date}  |  ${order.slot === 'morning' ? '☀ Morning' : '☾ Evening'}`,
          iX, y + (is4up ? 11.5 : 13.5)
        )
        doc.text(
          `#${order.id.toUpperCase().slice(-6)}`,
          x + bw - 4, y + (is4up ? 6 : 7.5),
          { align: 'right' }
        )

        // Payment badge
        const [pr, pg, pb] = paymentColor(order.payment_status)
        const badgeW = is4up ? 20 : 24
        const badgeH = is4up ? 5.5 : 6.5
        doc.setFillColor(pr, pg, pb)
        doc.roundedRect(x + bw - badgeW - 2, y + headerH - badgeH - 1.5, badgeW, badgeH, 1.5, 1.5, 'F')
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(fs.badge)
        doc.setTextColor(255, 255, 255)
        doc.text(
          paymentLabel(order.payment_status),
          x + bw - (badgeW / 2) - 2, y + headerH - 3,
          { align: 'center' }
        )

        // ── Retailer box ──
        const retailerMeta = [
          retailer.phone && `Ph: ${retailer.phone}`,
          retailer.area  && retailer.area,
        ].filter(Boolean).join('   ')

        doc.autoTable({
          startY: y + headerH + 1,
          margin: { left: iX, right: pageW - (x + bw) + 3 },
          theme: 'plain',
          styles: {
            fillColor: [253, 246, 236],
            cellPadding: { top: 1.5, bottom: 1, left: 2.5, right: 2.5 },
          },
          body: [
            [{
              content: retailer.name || '—',
              styles: { fontSize: fs.retailerName, textColor: [59, 32, 7], font: 'helvetica', fontStyle: 'bold' },
            }],
            [{
              content: retailerMeta,
              styles: { fontSize: fs.retailerMeta, textColor: [100, 100, 100], font: 'helvetica' },
            }],
          ],
          tableWidth: iW,
        })

        const afterRetailer = doc.lastAutoTable.finalY + 2

        // ── Items table ──
        doc.autoTable({
          startY: afterRetailer,
          margin: { left: iX, right: pageW - (x + bw) + 3 },
          head: [['Product', 'Size / Variant', 'Qty', 'Rs.']],
          body: items.map(item => [
            item.product_name,
            item.variant_name,
            item.quantity,
            Number(item.amount).toFixed(0),
          ]),
          headStyles: {
            fillColor: [232, 132, 26],
            textColor: [255, 255, 255],
            fontSize: fs.tableHead,
            fontStyle: 'bold',
            font: 'helvetica',
            cellPadding: { top: 2.5, bottom: 2.5, left: 2.5, right: 1.5 },
          },
          bodyStyles: {
            fontSize: fs.tableBody,
            textColor: [40, 20, 5],
            font: 'Devanagari',
            cellPadding: { top: 2.5, bottom: 2.5, left: 2.5, right: 1.5 },
          },
          alternateRowStyles: { fillColor: [253, 248, 242] },
          columnStyles: {
            0: { cellWidth: iW * 0.40 },
            1: { cellWidth: iW * 0.30 },
            2: { cellWidth: iW * 0.12, font: 'helvetica', fontStyle: 'bold', halign: 'center' },
            3: { cellWidth: iW * 0.18, font: 'helvetica', fontStyle: 'bold', halign: 'right' },
          },
          tableWidth: iW,
        })

        const ty = doc.lastAutoTable.finalY + 1.5

        // ── Total bar ──
        const totalH = is4up ? 9 : 11
        doc.setFillColor(232, 132, 26)
        doc.rect(iX, ty, iW, totalH, 'F')
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(fs.totalBar)
        doc.setTextColor(255, 255, 255)
        doc.text('TOTAL', iX + 3, ty + totalH - 2.5)
        doc.text(`Rs.${Number(order.total).toFixed(2)}`, x + bw - 4, ty + totalH - 2.5, { align: 'right' })

        // ── Pending bar ──
        if (order.payment_status !== 'paid') {
          const pendingAmt = Number(order.total) - Number(order.amount_paid || 0)
          const paidAmt    = Number(order.amount_paid || 0)
          const pendingH   = is4up ? 7 : 8.5
          doc.setFillColor(...paymentColor(order.payment_status))
          doc.rect(iX, ty + totalH + 1, iW, pendingH, 'F')
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(fs.pendingBar)
          doc.setTextColor(255, 255, 255)
          if (order.payment_status === 'partial') {
            doc.text(`Paid: Rs.${paidAmt.toFixed(2)}`, iX + 3, ty + totalH + 1 + pendingH - 2)
            doc.text(`PENDING: Rs.${pendingAmt.toFixed(2)}`, x + bw - 4, ty + totalH + 1 + pendingH - 2, { align: 'right' })
          } else {
            doc.text(`PENDING: Rs.${Number(order.total).toFixed(2)}`, x + bw - 4, ty + totalH + 1 + pendingH - 2, { align: 'right' })
          }
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