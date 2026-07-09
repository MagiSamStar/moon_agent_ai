export type Section =
  | 'dashboard'
  | 'guidance'
  | 'planning'
  | 'journal'
  | 'affirmations'
  | 'calendar'
  | 'saved'
  | 'settings'

export type MobileTab = 'current' | 'chat' | 'planning' | 'journal' | 'settings'

export type ChatMessage = {
  role: 'user' | 'agent'
  content: string
  affirmationCard?: AffirmationCard | null
  suggestedTasks?: string[]
  tasksAdded?: boolean
}

export type AffirmationCard = {
  card_title: string
  affirmation: string
  caption: string
  visual_prompt: string
  palette: string[]
}

export type JournalEntry = {
  id: string
  text: string
  metadata: {
    created_at?: string
    mood?: string
    tags?: string[]
    moon_phase?: string
    entry_type?: string
  }
  distance?: number
}

export type MoonContext = {
  phase: string
  illumination: number | null
  sign?: string | null
  house?: string | null
  next_full_moon?: string | null
  next_new_moon?: string | null
  energy_theme: string
  chakra_focus?: string | null
  chakra_element?: string | null
  chakra_themes?: string[] | null
  shadow_themes?: string[] | null
  chakra_practice?: string | null
  chakra_affirmation?: string | null
}

export type MoonCalendarDay = {
  date: string
  day: number
  phase: string
  illumination: number | null
  phase_state: string
}

export type MoonCalendar = {
  year: number
  month: number
  days: MoonCalendarDay[]
}

export type DailyTask = {
  id: string
  title: string
  category: string
  source: 'manual' | 'agent'
  moonPhase?: string
  createdAt: string
  completed: boolean
}
