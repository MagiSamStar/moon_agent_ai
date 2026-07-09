import type { MoonCalendarDay } from '../types'

export function stripMarkdownForSpeech(text: string) {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_`>#-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function phaseClass(phase: string) {
  const normalized = phase.toLowerCase()
  if (normalized.includes('new')) return 'moon-new'
  if (normalized.includes('full')) return 'moon-full'
  if (normalized.includes('waning')) return 'moon-waning'
  return 'moon-waxing'
}

export function formatIllumination(value: number | null | undefined) {
  if (value === null || value === undefined) return 'Illumination unavailable'
  const normalized = value <= 1 ? value * 100 : value
  return `${Math.round(normalized)}% illuminated`
}

export function formatMoonEventDate(value?: string | null) {
  if (!value) return 'Pending'
  const date = new Date(`${value}T12:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
  }).format(date)
}

export function findPhaseEvent(
  days: MoonCalendarDay[] | undefined,
  phaseName: string,
) {
  const normalizedPhase = phaseName.toLowerCase()
  return days?.find((day) => day.phase.toLowerCase().includes(normalizedPhase))
}

export function greetingForNow(date = new Date()) {
  const hour = date.getHours()
  if (hour < 12) return 'Good Morning'
  if (hour < 18) return 'Good Afternoon'
  return 'Good Evening'
}
