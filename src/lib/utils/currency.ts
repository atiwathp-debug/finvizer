const thbFormatter = new Intl.NumberFormat('th-TH', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** Formats a number as Thai Baht, e.g. 1250 -> "฿1,250.00". */
export function formatTHB(amount: number): string {
  return `฿${thbFormatter.format(amount)}`
}

const dateFormatter = new Intl.DateTimeFormat('th-TH', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

/** Formats an ISO date string (YYYY-MM-DD) as a Thai-locale date, e.g. "02 ก.ค. 2569". */
export function formatThaiDate(isoDate: string): string {
  return dateFormatter.format(new Date(isoDate))
}
