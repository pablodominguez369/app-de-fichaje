import type { Absence, Shift, WorkSettings } from '../types'
import { ABSENCE_LABELS, formatAbsenceDates, overlapsMonth } from './absences'
import { splitShifts, sumSplit } from './hours'
import { breakMinutes, formatMinutes, formatTime } from './time'

interface ReportInput {
  shifts: Shift[]
  absences: Absence[]
  settings: WorkSettings
  /** 0-11 */
  month: number
  year: number
}

/** Builds the monthly time record and triggers the download. jsPDF is loaded on demand. */
export async function downloadMonthlyReport({ shifts, absences, settings, month, year }: ReportInput): Promise<void> {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])

  const from = new Date(year, month, 1)
  const to = new Date(year, month + 1, 1)
  const monthShifts = shifts
    .filter((s) => s.endAt && Date.parse(s.startAt) >= from.getTime() && Date.parse(s.startAt) < to.getTime())
    .sort((a, b) => a.startAt.localeCompare(b.startAt))
  const split = splitShifts(shifts, settings.weeklyThresholdHours)
  const totals = sumSplit(shifts, split, from, to)
  const monthName = from.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })

  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const marginX = 14
  let y = 18

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text(`Registro de jornada · ${monthName}`, marginX, y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  y += 7
  const who = [settings.employeeName, settings.companyName].filter(Boolean).join(' · ')
  if (who) {
    doc.text(who, marginX, y)
    y += 5
  }
  doc.setTextColor(110)
  doc.text(
    `Complementarias: horas por encima de ${settings.weeklyThresholdHours} h en cada semana (lunes a domingo). Los descansos no cuentan como tiempo trabajado.`,
    marginX,
    y,
    { maxWidth: 182 },
  )
  doc.setTextColor(0)
  y += 8

  autoTable(doc, {
    startY: y,
    head: [['Fecha', 'Entrada', 'Salida', 'Descansos', 'Trabajado', 'Ordinarias', 'Complem.']],
    body: monthShifts.map((s) => {
      const part = split.get(s.id) ?? { ordinary: s.durationMinutes, complementary: 0 }
      return [
        new Date(s.startAt).toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: '2-digit' }),
        formatTime(s.startAt),
        formatTime(s.endAt!),
        s.breaks.length ? formatMinutes(breakMinutes(s)) : '—',
        formatMinutes(s.durationMinutes),
        formatMinutes(part.ordinary),
        part.complementary ? formatMinutes(part.complementary) : '—',
      ]
    }),
    foot: [
      [
        'Total',
        '',
        '',
        '',
        formatMinutes(totals.ordinary + totals.complementary),
        formatMinutes(totals.ordinary),
        formatMinutes(totals.complementary),
      ],
    ],
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [22, 163, 74] },
    footStyles: { fillColor: [240, 240, 240], textColor: 20, fontStyle: 'bold' },
    margin: { left: marginX, right: marginX },
  })

  const monthAbsences = absences
    .filter((a) => overlapsMonth(a, year, month))
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
  if (monthAbsences.length > 0) {
    const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text('Vacaciones y ausencias', marginX, finalY + 10)
    autoTable(doc, {
      startY: finalY + 13,
      head: [['Tipo', 'Fechas', 'Nota']],
      body: monthAbsences.map((a) => [ABSENCE_LABELS[a.type], formatAbsenceDates(a), a.note || '—']),
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [100, 116, 139] },
      margin: { left: marginX, right: marginX },
    })
  }

  const pageCount = doc.getNumberOfPages()
  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(140)
    doc.text(`Generado el ${new Date().toLocaleString('es-ES')} · Página ${page} de ${pageCount}`, marginX, 290)
  }

  doc.save(`registro-jornada-${year}-${String(month + 1).padStart(2, '0')}.pdf`)
}
