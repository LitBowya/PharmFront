import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ExportRow {
  checkinId: number
  checkInAt: Date | string | null
  checkOutAt: Date | string | null
  visitorName: string
  visitorPhone: string | null
  purpose: string
  host: string
  department: string | null
  receptionistName: string | null
  notes: string | null
}

export interface ExportSummary {
  totalCheckins: number
  totalCheckouts: number
  onSite: number
}

export interface ReceptionistSummaryRow {
  name: string
  checkins: number
  checkouts: number
}

export interface ExportPayload {
  rows: ExportRow[]
  summary: ExportSummary
  receptionistSummary: ReceptionistSummaryRow[]
  dateFrom: string
  dateTo: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(d: Date | string | null): string {
  if (!d) return '—'
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function duration(
  checkIn: Date | string | null,
  checkOut: Date | string | null,
): string {
  if (!checkIn || !checkOut) return '—'
  const inMs = new Date(checkIn).getTime()
  const outMs = new Date(checkOut).getTime()
  const diffMin = Math.round((outMs - inMs) / 60_000)
  if (diffMin < 60) return `${diffMin}m`
  const h = Math.floor(diffMin / 60)
  const m = diffMin % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function dateLabel(from: string, to: string): string {
  if (from === to) return from
  return `${from} – ${to}`
}

// ─── CSV Export ───────────────────────────────────────────────────────────────

export function downloadCSV(payload: ExportPayload, filename?: string): void {
  const headers = [
    'ID',
    'Visitor Name',
    'Phone',
    'Purpose',
    'Host',
    'Department',
    'Receptionist',
    'Check-In Time',
    'Check-Out Time',
    'Duration',
    'Status',
    'Notes',
  ]

  const escape = (val: string | null | undefined): string => {
    const s = val ?? ''
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`
    }
    return s
  }

  const lines: string[] = [headers.map(escape).join(',')]

  for (const row of payload.rows) {
    lines.push(
      [
        String(row.checkinId),
        row.visitorName,
        row.visitorPhone ?? '',
        row.purpose,
        row.host,
        row.department ?? '',
        row.receptionistName ?? '',
        fmt(row.checkInAt),
        fmt(row.checkOutAt),
        duration(row.checkInAt, row.checkOutAt),
        row.checkOutAt ? 'Departed' : 'On Site',
        row.notes ?? '',
      ]
        .map(escape)
        .join(','),
    )
  }

  // Append summary rows
  lines.push('')
  lines.push('SUMMARY')
  lines.push(`Total Check-ins,${payload.summary.totalCheckins}`)
  lines.push(`Total Check-outs,${payload.summary.totalCheckouts}`)
  lines.push(`Currently On Site,${payload.summary.onSite}`)

  if (payload.receptionistSummary.length > 0) {
    lines.push('')
    lines.push('RECEPTIONIST BREAKDOWN')
    lines.push('Name,Check-ins,Check-outs')
    for (const r of payload.receptionistSummary) {
      lines.push(`${escape(r.name)},${r.checkins},${r.checkouts}`)
    }
  }

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download =
    filename ??
    `pharmfront-report-${dateLabel(payload.dateFrom, payload.dateTo)}.csv`
  anchor.click()
  URL.revokeObjectURL(url)
}

// ─── PDF Export ───────────────────────────────────────────────────────────────

export function downloadPDF(payload: ExportPayload, filename?: string): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()

  // ── Header ────────────────────────────────────────────────────────────────
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text('PharmFront — Visitor Report', 14, 16)

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100)
  doc.text(`Period: ${dateLabel(payload.dateFrom, payload.dateTo)}`, 14, 23)
  doc.text(
    `Generated: ${new Date().toLocaleString('en-GB')}`,
    pageWidth - 14,
    23,
    { align: 'right' },
  )

  // ── Summary Boxes ─────────────────────────────────────────────────────────
  doc.setTextColor(0)
  const boxW = 50
  const boxH = 14
  const boxY = 28
  const boxes = [
    { label: 'Total Check-ins', value: String(payload.summary.totalCheckins) },
    {
      label: 'Total Check-outs',
      value: String(payload.summary.totalCheckouts),
    },
    { label: 'Still On Site', value: String(payload.summary.onSite) },
  ]
  boxes.forEach((b, i) => {
    const x = 14 + i * (boxW + 4)
    doc.setFillColor(240, 253, 250)
    doc.setDrawColor(20, 184, 166)
    doc.roundedRect(x, boxY, boxW, boxH, 2, 2, 'FD')
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(80)
    doc.text(b.label, x + 3, boxY + 4.5)
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(20, 100, 90)
    doc.text(b.value, x + 3, boxY + 11)
  })

  // ── Receptionist Summary ──────────────────────────────────────────────────
  let cursorY = boxY + boxH + 6

  if (payload.receptionistSummary.length > 0) {
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(0)
    doc.text('Receptionist Summary', 14, cursorY + 4)
    cursorY += 6

    autoTable(doc, {
      startY: cursorY,
      head: [['Receptionist', 'Check-ins', 'Check-outs']],
      body: payload.receptionistSummary.map((r) => [
        r.name,
        String(r.checkins),
        String(r.checkouts),
      ]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: {
        fillColor: [20, 184, 166],
        textColor: 255,
        fontStyle: 'bold',
      },
      alternateRowStyles: { fillColor: [240, 253, 250] },
      tableWidth: 110,
      margin: { left: 14 },
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cursorY = (doc as any).lastAutoTable.finalY + 8
  }

  // ── Visitor Detail Table ──────────────────────────────────────────────────
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0)
  doc.text('Visitor Detail', 14, cursorY + 4)
  cursorY += 6

  autoTable(doc, {
    startY: cursorY,
    head: [
      [
        '#',
        'Visitor',
        'Phone',
        'Purpose',
        'Host',
        'Dept',
        'Receptionist',
        'Check-In',
        'Check-Out',
        'Duration',
        'Status',
      ],
    ],
    body: payload.rows.map((row, i) => [
      String(i + 1),
      row.visitorName,
      row.visitorPhone ?? '—',
      row.purpose,
      row.host,
      row.department ?? '—',
      row.receptionistName ?? '—',
      fmt(row.checkInAt),
      fmt(row.checkOutAt),
      duration(row.checkInAt, row.checkOutAt),
      row.checkOutAt ? 'Departed' : 'On Site',
    ]),
    styles: { fontSize: 7, cellPadding: 1.5, overflow: 'ellipsize' },
    headStyles: {
      fillColor: [99, 102, 241],
      textColor: 255,
      fontStyle: 'bold',
    },
    alternateRowStyles: { fillColor: [248, 248, 255] },
    columnStyles: {
      0: { cellWidth: 8 },
      7: { cellWidth: 30 },
      8: { cellWidth: 30 },
      9: { cellWidth: 16 },
      10: { cellWidth: 18 },
    },
    margin: { left: 14, right: 14 },
    didDrawPage: (hookData) => {
      // Footer on every page
      const pageCount = doc.getNumberOfPages()
      doc.setFontSize(7)
      doc.setTextColor(150)
      doc.text(
        `PharmFront Report | Page ${hookData.pageNumber} of ${pageCount}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 6,
        { align: 'center' },
      )
    },
  })

  doc.save(
    filename ??
      `pharmfront-report-${dateLabel(payload.dateFrom, payload.dateTo)}.pdf`,
  )
}
