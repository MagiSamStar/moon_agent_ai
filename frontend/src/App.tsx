import { useEffect, useMemo, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import './App.css'

type Section =
  | 'dashboard'
  | 'guidance'
  | 'planning'
  | 'journal'
  | 'affirmations'
  | 'calendar'
  | 'saved'
  | 'settings'

type ChatMessage = {
  role: 'user' | 'agent'
  content: string
  affirmationCard?: AffirmationCard | null
  suggestedTasks?: string[]
  tasksAdded?: boolean
}

type AffirmationCard = {
  card_title: string
  affirmation: string
  caption: string
  visual_prompt: string
  palette: string[]
}

type JournalEntry = {
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

type MoonContext = {
  phase: string
  illumination: number | null
  sign?: string | null
  house?: string | null
  next_full_moon?: string | null
  next_new_moon?: string | null
  energy_theme: string
}

type MoonCalendarDay = {
  date: string
  day: number
  phase: string
  illumination: number | null
  phase_state: string
}

type MoonCalendar = {
  year: number
  month: number
  days: MoonCalendarDay[]
}

type DailyTask = {
  id: string
  title: string
  category: string
  source: 'manual' | 'agent'
  moonPhase?: string
  createdAt: string
  completed: boolean
}

type CalendarCell =
  | {
      key: string
      empty: true
    }
  | {
      key: string
      empty: false
      day: MoonCalendarDay
    }

type SpeechRecognitionResultItem = {
  transcript: string
}

type SpeechRecognitionResult = {
  isFinal: boolean
  [index: number]: SpeechRecognitionResultItem
}

type SpeechRecognitionResultList = {
  length: number
  [index: number]: SpeechRecognitionResult
}

type SpeechRecognitionEvent = {
  resultIndex: number
  results: SpeechRecognitionResultList
}

type SpeechRecognitionErrorEvent = {
  error: string
}

type BrowserSpeechRecognition = {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition

type VoiceWindow = Window &
  typeof globalThis & {
    SpeechRecognition?: BrowserSpeechRecognitionConstructor
    webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor
  }

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const isLocalApi =
  API_URL.includes('localhost') || API_URL.includes('127.0.0.1')
const connectionLabel = isLocalApi ? 'Local API' : 'Live API'
const DAILY_TASKS_STORAGE_KEY = 'moon-agent-daily-tasks'

const navItems: { id: Section; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'D' },
  { id: 'guidance', label: 'Moonscope', icon: 'M' },
  { id: 'planning', label: 'Daily Planning', icon: 'P' },
  { id: 'journal', label: 'Journal', icon: 'J' },
  { id: 'affirmations', label: 'Affirmations', icon: 'A' },
  { id: 'calendar', label: 'Calendar', icon: 'C' },
  { id: 'saved', label: 'Saved Readings', icon: 'S' },
  { id: 'settings', label: 'Settings', icon: 'G' },
]

const initialMessages: ChatMessage[] = [
  {
    role: 'agent',
    content:
      "Welcome to Moon Agent. I'm here to help you align your intentions with lunar wisdom.\n\nWhat would you like to explore today?",
  },
]

const prompts = [
  'Plan my week with lunar guidance',
  'Reflect on my recent journal entries',
  'Set intentions for the full moon',
  'Create a personalized affirmation',
]

const moodOptions = ['Grateful', 'Focused', 'Hopeful', 'Tender', 'Energized']
const monthFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'long',
  year: 'numeric',
})
const weekdayFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
})

function linkifyUrls(text: string) {
  return text.replace(/(?<!\]\()https?:\/\/[^\s)]+/g, (url) => `[${url}](${url})`)
}

function stripMarkdownForSpeech(text: string) {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_`>#-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseTags(value: string) {
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
}

function formatEntryDate(value?: string) {
  if (!value) return 'Saved recently'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Saved recently'

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

function phaseClass(phase: string) {
  const normalized = phase.toLowerCase()
  if (normalized.includes('new')) return 'moon-new'
  if (normalized.includes('full')) return 'moon-full'
  if (normalized.includes('waning')) return 'moon-waning'
  return 'moon-waxing'
}

function formatIllumination(value: number | null | undefined) {
  if (value === null || value === undefined) return 'Illumination unavailable'
  const normalized = value <= 1 ? value * 100 : value
  return `${Math.round(normalized)}% illuminated`
}

function phaseReading(phase: string) {
  const normalized = phase.toLowerCase()
  if (normalized.includes('new')) {
    return {
      soulMessage:
        'This moon opens a quiet doorway. Let yourself begin again without needing to prove that the past was wrong.',
      healingFocus:
        'Plant one honest intention and protect it from noise, comparison, and urgency.',
      reflectionPrompt:
        'What part of me is ready for a fresh beginning, even if it still feels tender?',
      affirmation: 'I am allowed to begin softly and trust what is taking root.',
    }
  }
  if (normalized.includes('waxing')) {
    return {
      soulMessage:
        'This moon supports growth through devotion. Small choices matter today, especially the ones that help you keep faith with yourself.',
      healingFocus:
        'Build momentum without abandoning your nervous system. Let progress feel steady instead of forced.',
      reflectionPrompt:
        'Where am I ready to give consistent energy without rushing the outcome?',
      affirmation: 'I honor my growth through steady, loving action.',
    }
  }
  if (normalized.includes('full')) {
    return {
      soulMessage:
        'This moon illuminates what is complete, what is true, and what can no longer be hidden from your heart.',
      healingFocus:
        'Let clarity be gentle. Celebrate what has bloomed and release the pressure to hold everything at once.',
      reflectionPrompt:
        'What truth is becoming visible, and how can I meet it with compassion?',
      affirmation: 'I welcome clarity and release what no longer needs my energy.',
    }
  }
  if (normalized.includes('waning')) {
    return {
      soulMessage:
        'This moon invites release. You do not have to carry every old pattern into the next version of your life.',
      healingFocus:
        'Make space through forgiveness, rest, and honest simplification.',
      reflectionPrompt:
        'What am I ready to lay down so my spirit can breathe more freely?',
      affirmation: 'I release with grace and return to what restores me.',
    }
  }

  return {
    soulMessage:
      'The moon invites you to listen inward before choosing your next step. There is wisdom in moving with the rhythm you actually have today.',
    healingFocus:
      'Stay close to your body, your truth, and one grounded action that supports your peace.',
    reflectionPrompt: 'What does my inner self need me to notice today?',
    affirmation: 'I trust my inner timing and move with gentle awareness.',
  }
}

function signReading(sign?: string | null) {
  const normalized = sign?.toLowerCase()
  const themes: Record<string, string> = {
    aries: 'courage, honest desire, and clean action',
    taurus: 'stability, self-worth, and devotion to what nourishes you',
    gemini: 'curiosity, expression, and the stories you are ready to rewrite',
    cancer: 'emotional safety, tenderness, and the wisdom of your inner home',
    leo: 'creative courage, visibility, and heart-led confidence',
    virgo: 'healing through small rituals, discernment, and sacred order',
    libra: 'balance, relational healing, and choices that restore harmony',
    scorpio: 'deep release, emotional truth, and quiet transformation',
    sagittarius: 'faith, perspective, and the freedom to seek wider meaning',
    capricorn: 'grounded commitment, maturity, and devotion to the long path',
    aquarius: 'liberation, future vision, and honoring your authentic frequency',
    pisces: 'intuition, compassion, dreams, and spiritual surrender',
  }

  if (normalized && themes[normalized]) return themes[normalized]
  return 'inner listening, emotional clarity, and the medicine of the present moment'
}

function houseReading(house?: string | null) {
  const houses: Record<string, string> = {
    '1': 'your identity, body, and personal renewal',
    '2': 'self-worth, money, values, and emotional security',
    '3': 'communication, learning, siblings, and daily thought patterns',
    '4': 'home, ancestry, belonging, and private emotional healing',
    '5': 'creativity, joy, romance, and the courage to be seen',
    '6': 'wellness, routines, service, and the rituals that sustain you',
    '7': 'partnerships, boundaries, repair, and mutual care',
    '8': 'shadow work, intimacy, grief, and transformation',
    '9': 'faith, wisdom, travel, study, and spiritual meaning',
    '10': 'calling, visibility, leadership, and long-term direction',
    '11': 'community, friendship, hopes, and collective belonging',
    '12': 'rest, dreams, closure, intuition, and spiritual protection',
  }

  return house ? houses[house] : undefined
}

function createTaskId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function loadStoredTasks(): DailyTask[] {
  if (typeof window === 'undefined') return []

  try {
    const storedTasks = window.localStorage.getItem(DAILY_TASKS_STORAGE_KEY)
    return storedTasks ? (JSON.parse(storedTasks) as DailyTask[]) : []
  } catch {
    return []
  }
}

function App() {
  const [activeSection, setActiveSection] = useState<Section>('dashboard')
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [voiceError, setVoiceError] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [readAloud, setReadAloud] = useState(false)
  const [moonContext, setMoonContext] = useState<MoonContext | null>(null)
  const [moonError, setMoonError] = useState('')
  const [journalText, setJournalText] = useState('')
  const [journalMood, setJournalMood] = useState('Grateful')
  const [journalTags, setJournalTags] = useState('')
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([])
  const [journalSearchQuery, setJournalSearchQuery] = useState('')
  const [journalSearchResults, setJournalSearchResults] = useState<JournalEntry[]>([])
  const [journalStatus, setJournalStatus] = useState('')
  const [journalError, setJournalError] = useState('')
  const [isSavingJournal, setIsSavingJournal] = useState(false)
  const [isLoadingJournal, setIsLoadingJournal] = useState(false)
  const [isSearchingJournal, setIsSearchingJournal] = useState(false)
  const [calendarDate, setCalendarDate] = useState(() => new Date())
  const [moonCalendar, setMoonCalendar] = useState<MoonCalendar | null>(null)
  const [calendarError, setCalendarError] = useState('')
  const [isCalendarLoading, setIsCalendarLoading] = useState(false)
  const [dailyTasks, setDailyTasks] = useState<DailyTask[]>(() => loadStoredTasks())
  const [newTaskText, setNewTaskText] = useState('')
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  const calendarTitle = monthFormatter.format(calendarDate)
  const phase = moonContext?.phase || 'Moon phase unavailable'
  const todayLabel = weekdayFormatter.format(new Date())
  const completedTaskCount = dailyTasks.filter((task) => task.completed).length
  const activeTask = dailyTasks.find((task) => !task.completed)
  const focusedHours = completedTaskCount ? (completedTaskCount * 1.5).toFixed(1) : '0'

  const calendarCells = useMemo<CalendarCell[]>(() => {
    const year = calendarDate.getFullYear()
    const month = calendarDate.getMonth()
    const firstDay = new Date(year, month, 1).getDay()
    return [
      ...Array.from({ length: firstDay }, (_, index) => ({
        key: `empty-${index}`,
        empty: true as const,
      })),
      ...(moonCalendar?.days || []).map((day) => ({
        key: day.date,
        empty: false as const,
        day,
      })),
    ]
  }, [calendarDate, moonCalendar])

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop()
      window.speechSynthesis?.cancel()
    }
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, isLoading])

  useEffect(() => {
    void loadMoonContext()
  }, [])

  useEffect(() => {
    if (activeSection === 'journal' && journalEntries.length === 0) {
      void loadJournalEntries()
    }
  }, [activeSection, journalEntries.length])

  useEffect(() => {
    if (activeSection === 'calendar') {
      void loadMoonCalendar(calendarDate)
    }
  }, [activeSection, calendarDate])

  useEffect(() => {
    window.localStorage.setItem(DAILY_TASKS_STORAGE_KEY, JSON.stringify(dailyTasks))
  }, [dailyTasks])

  async function loadMoonContext() {
    setMoonError('')
    try {
      const response = await fetch(`${API_URL}/moon-context`)
      if (!response.ok) throw new Error(`Moon API returned ${response.status}`)
      setMoonContext((await response.json()) as MoonContext)
    } catch (caughtError) {
      const message =
        caughtError instanceof Error ? caughtError.message : 'Unable to load moon data.'
      setMoonError(message)
    }
  }

  async function loadMoonCalendar(date: Date) {
    setIsCalendarLoading(true)
    setCalendarError('')

    try {
      const year = date.getFullYear()
      const month = date.getMonth() + 1
      const response = await fetch(`${API_URL}/moon-calendar?year=${year}&month=${month}`)
      if (!response.ok) throw new Error(`Lunar calendar returned ${response.status}`)
      setMoonCalendar((await response.json()) as MoonCalendar)
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : 'Unable to load lunar calendar.'
      setCalendarError(message)
    } finally {
      setIsCalendarLoading(false)
    }
  }

  async function loadJournalEntries() {
    setIsLoadingJournal(true)
    setJournalError('')

    try {
      const response = await fetch(`${API_URL}/journal?limit=10`)
      if (!response.ok) throw new Error(`Journal API returned ${response.status}`)
      const data = (await response.json()) as { entries?: JournalEntry[] }
      setJournalEntries(data.entries || [])
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : 'Unable to load journal entries.'
      setJournalError(message)
    } finally {
      setIsLoadingJournal(false)
    }
  }

  async function handleJournalSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const text = journalText.trim()
    if (!text) return

    setIsSavingJournal(true)
    setJournalStatus('')
    setJournalError('')

    try {
      const response = await fetch(`${API_URL}/journal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          mood: journalMood || null,
          tags: parseTags(journalTags),
        }),
      })

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          detail?: string
        } | null
        throw new Error(data?.detail || `Journal API returned ${response.status}`)
      }

      const savedEntry = (await response.json()) as JournalEntry
      setJournalEntries((current) => [savedEntry, ...current])
      setJournalText('')
      setJournalTags('')
      setJournalStatus('Journal entry saved to memory.')
    } catch (caughtError) {
      const message =
        caughtError instanceof Error ? caughtError.message : 'Unable to save entry.'
      setJournalError(message)
    } finally {
      setIsSavingJournal(false)
    }
  }

  async function handleJournalSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const query = journalSearchQuery.trim()
    if (!query) return

    setIsSearchingJournal(true)
    setJournalStatus('')
    setJournalError('')

    try {
      const response = await fetch(`${API_URL}/journal/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, limit: 5 }),
      })

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          detail?: string
        } | null
        throw new Error(data?.detail || `Journal search returned ${response.status}`)
      }

      const data = (await response.json()) as { entries?: JournalEntry[] }
      setJournalSearchResults(data.entries || [])
    } catch (caughtError) {
      const message =
        caughtError instanceof Error ? caughtError.message : 'Unable to search memory.'
      setJournalError(message)
    } finally {
      setIsSearchingJournal(false)
    }
  }

  function speakAgentResponse(text: string) {
    if (!readAloud || !('speechSynthesis' in window)) return
    const spokenText = stripMarkdownForSpeech(text)
    if (!spokenText) return

    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(spokenText)
    utterance.lang = 'en-US'
    utterance.rate = 0.92
    utterance.pitch = 1
    window.speechSynthesis.speak(utterance)
  }

  function toggleReadAloud() {
    setVoiceError('')

    if (!('speechSynthesis' in window)) {
      setVoiceError('Read-aloud is not supported in this browser.')
      return
    }

    setReadAloud((enabled) => {
      if (enabled) window.speechSynthesis.cancel()
      return !enabled
    })
  }

  function startListening() {
    setVoiceError('')
    const voiceWindow = window as VoiceWindow
    const Recognition =
      voiceWindow.SpeechRecognition || voiceWindow.webkitSpeechRecognition

    if (!Recognition) {
      setVoiceError('Voice input is not supported in this browser. Try Chrome or Edge.')
      return
    }

    if (isListening) {
      recognitionRef.current?.stop()
      return
    }

    const recognition = new Recognition()
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = 'en-US'
    let finalTranscript = ''

    recognition.onresult = (event) => {
      let interimTranscript = ''
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index]
        const transcript = result[0]?.transcript || ''
        if (result.isFinal) {
          finalTranscript += transcript
        } else {
          interimTranscript += transcript
        }
      }
      setInput(`${finalTranscript}${interimTranscript}`.trim())
    }

    recognition.onerror = (event) => {
      setVoiceError(
        event.error === 'not-allowed'
          ? 'Microphone access was blocked. Allow mic access and try again.'
          : `Voice input stopped: ${event.error}.`,
      )
      setIsListening(false)
    }
    recognition.onend = () => setIsListening(false)
    recognitionRef.current = recognition
    setIsListening(true)
    recognition.start()
  }

  async function sendMessage(message: string) {
    const userMessage = message.trim()
    if (!userMessage) return

    setError('')
    setVoiceError('')
    setInput('')
    setIsLoading(true)
    recognitionRef.current?.stop()
    window.speechSynthesis?.cancel()
    setMessages((current) => [...current, { role: 'user', content: userMessage }])

    try {
      const response = await fetch(`${API_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage }),
      })

      if (!response.ok) {
        if (response.status === 429) {
          const data = (await response.json()) as { detail?: string }
          throw new Error(data.detail || 'Demo chat limit reached. Please try again later.')
        }
        throw new Error(`Moon Agent API returned ${response.status}`)
      }

      const data = (await response.json()) as {
        response?: string
        affirmation_card?: AffirmationCard | null
        suggested_tasks?: string[]
      }
      const content = data.response || 'Moon Agent returned an empty response.'
      setMessages((current) => [
        ...current,
        {
          role: 'agent',
          content,
          affirmationCard: data.affirmation_card || null,
          suggestedTasks: data.suggested_tasks || [],
          tasksAdded: false,
        },
      ])
      speakAgentResponse(content)
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : 'Unable to reach Moon Agent.'
      setError(`${message}. Unable to reach Moon Agent API at ${API_URL}.`)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await sendMessage(input)
  }

  function moveCalendar(delta: number) {
    setCalendarDate(
      (current) => new Date(current.getFullYear(), current.getMonth() + delta, 1),
    )
  }

  function addManualTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const title = newTaskText.trim()
    if (!title) return

    setDailyTasks((current) => [
      ...current,
      {
        id: createTaskId(),
        title,
        category: 'Personal',
        source: 'manual',
        moonPhase: phase,
        createdAt: new Date().toISOString(),
        completed: false,
      },
    ])
    setNewTaskText('')
  }

  function toggleTask(taskId: string) {
    setDailyTasks((current) =>
      current.map((task) =>
        task.id === taskId ? { ...task, completed: !task.completed } : task,
      ),
    )
  }

  function addAgentTasks(messageIndex: number, suggestedTasks: string[]) {
    const cleanedTasks = suggestedTasks
      .map((task) => task.trim())
      .filter(Boolean)

    if (!cleanedTasks.length) return

    setDailyTasks((current) => {
      const existingTitles = new Set(
        current.map((task) => task.title.trim().toLowerCase()),
      )
      const newTasks = cleanedTasks
        .filter((task) => !existingTitles.has(task.toLowerCase()))
        .map((task) => ({
          id: createTaskId(),
          title: task,
          category: 'Moon Agent',
          source: 'agent' as const,
          moonPhase: phase,
          createdAt: new Date().toISOString(),
          completed: false,
        }))

      return [...current, ...newTasks]
    })
    setMessages((current) =>
      current.map((message, index) =>
        index === messageIndex ? { ...message, tasksAdded: true } : message,
      ),
    )
    setActiveSection('planning')
  }

  function renderJournalEntry(entry: JournalEntry) {
    return (
      <article className="entry-card" key={entry.id}>
        <div className="entry-meta">
          <span>{formatEntryDate(entry.metadata.created_at)}</span>
          {entry.metadata.moon_phase && <span>{entry.metadata.moon_phase}</span>}
          {entry.metadata.mood && <span>{entry.metadata.mood}</span>}
        </div>
        <p>{entry.text}</p>
      </article>
    )
  }

  function renderDashboard() {
    return (
      <section className="screen dashboard-screen">
        <header className="screen-header">
          <div>
            <h1>AI Moon Assistant</h1>
            <p>Guided by lunar wisdom</p>
          </div>
          <span className="status-chip">{connectionLabel}</span>
        </header>

      
        <section className="chat-panel">
          <div className="messages">
            {messages.map((message, index) => (
              <article
                className={`message-row ${message.role === 'user' ? 'is-user' : ''}`}
                key={`${message.role}-${index}`}
              >
                {message.role === 'agent' && <span className="message-avatar">M</span>}
                <div className="message-bubble">
                  <ReactMarkdown
                    components={{
                      a: ({ href, children }) => (
                        <a href={href} target="_blank" rel="noreferrer">
                          {children}
                        </a>
                      ),
                    }}
                  >
                    {linkifyUrls(message.content)}
                  </ReactMarkdown>
                  {message.affirmationCard && (
                    <div
                      className="affirmation-card"
                      style={{
                        background: `linear-gradient(135deg, ${
                          message.affirmationCard.palette?.[0] || '#22263a'
                        }, ${
                          message.affirmationCard.palette?.[1] || '#6875ad'
                        })`,
                      }}
                    >
                      <p>Affirmation Card</p>
                      <h3>{message.affirmationCard.card_title}</h3>
                      <strong>{message.affirmationCard.affirmation}</strong>
                      <span>{message.affirmationCard.caption}</span>
                    </div>
                  )}
                  {!!message.suggestedTasks?.length && (
                    <div className="task-transfer">
                      <p>
                        {message.tasksAdded
                          ? 'Added to Daily Planning.'
                          : `${message.suggestedTasks.length} suggested task${
                              message.suggestedTasks.length === 1 ? '' : 's'
                            } found.`}
                      </p>
                      {!message.tasksAdded && (
                        <button
                          onClick={() =>
                            addAgentTasks(index, message.suggestedTasks || [])
                          }
                          type="button"
                        >
                          Add to Daily Planning
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </article>
            ))}
            {isLoading && (
              <article className="message-row">
                <span className="message-avatar">M</span>
                <div className="message-bubble">Moon Agent is thinking...</div>
              </article>
            )}
            <div ref={messagesEndRef} />
          </div>

          {error && <p className="error-text">{error}</p>}
          {voiceError && <p className="warning-text">{voiceError}</p>}

          <div className="prompt-grid">
            {prompts.map((prompt) => (
              <button
                className="prompt-card"
                disabled={isLoading}
                key={prompt}
                onClick={() => void sendMessage(prompt)}
                type="button"
              >
                <span>{prompt}</span>
              </button>
            ))}
          </div>

          <form className="composer" onSubmit={handleSubmit}>
            <input
              disabled={isLoading}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask Moon Agent for a plan..."
              type="text"
              value={input}
            />
            <button
              aria-pressed={isListening}
              className={isListening ? 'icon-button active' : 'icon-button'}
              disabled={isLoading}
              onClick={startListening}
              type="button"
            >
              Mic
            </button>
            <button
              aria-pressed={readAloud}
              className={readAloud ? 'icon-button active' : 'icon-button'}
              onClick={toggleReadAloud}
              type="button"
            >
              Audio
            </button>
            <button disabled={isLoading || !input.trim()} type="submit">
              {isLoading ? 'Generating...' : 'Send'}
            </button>
          </form>
        </section>
      </section>
    )
  }

  function renderPlanning() {
    return (
      <section className="screen planning-screen">
        <header className="screen-header">
          <div>
            <h1>Daily Planning</h1>
            <p>AI-powered task management aligned with lunar energies</p>
          </div>
          <span className="status-chip">{todayLabel}</span>
        </header>

        <section className="planning-roadmap">
          <div className="symbol-pill">M</div>
          <div>
            <h2>AI Daily Roadmap</h2>
            <p>
              {moonContext
                ? `Based on the current ${phase}, today supports: ${moonContext.energy_theme}`
                : moonError || 'Loading live lunar guidance for today...'}
            </p>
            <div className="tag-row">
              <span>High Energy Day</span>
              <span>Focus on Completion</span>
            </div>
          </div>
        </section>

        <section className="planning-stats" aria-label="Daily planning stats">
          <div className="stat-card">
            <span>Done</span>
            <strong>
              {completedTaskCount}/{dailyTasks.length}
            </strong>
            <small>Tasks Complete</small>
          </div>
          <div className="stat-card">
            <span>Moon</span>
            <strong>
              {moonContext?.illumination === null || moonContext?.illumination === undefined
                ? 'Live'
                : `${Math.round(
                    moonContext.illumination <= 1
                      ? moonContext.illumination * 100
                      : moonContext.illumination,
                  )}%`}
            </strong>
            <small>Lunar Alignment</small>
          </div>
          <div className="stat-card">
            <span>Time</span>
            <strong>{focusedHours}h</strong>
            <small>Focused Time</small>
          </div>
        </section>

        <form className="task-entry-panel" onSubmit={addManualTask}>
          <input
            onChange={(event) => setNewTaskText(event.target.value)}
            placeholder="Add a new task..."
            value={newTaskText}
          />
          <button disabled={!newTaskText.trim()} type="submit">
            + Add
          </button>
        </form>

        <section className="task-section">
          <h2>Today's Tasks</h2>
          <div className="task-list">
            {dailyTasks.map((task) => (
              <article
                className={task.completed ? 'task-card completed' : 'task-card'}
                key={task.id}
              >
                <button
                  aria-label={
                    task.completed ? `Mark ${task.title} incomplete` : `Complete ${task.title}`
                  }
                  className={task.completed ? 'task-check done' : 'task-check'}
                  onClick={() => toggleTask(task.id)}
                  type="button"
                />
                <div className="task-details">
                  <strong>{task.title}</strong>
                  <div className="task-chips">
                    <span className="task-chip">{task.category}</span>
                    {task.source === 'agent' && (
                      <span className="task-chip lunar">Moon Agent</span>
                    )}
                    {task.moonPhase && <span className="task-chip">{task.moonPhase}</span>}
                  </div>
                </div>
              </article>
            ))}
            {!dailyTasks.length && (
              <p className="muted-text">
                No tasks yet. Add one above or transfer tasks from Moon Agent.
              </p>
            )}
          </div>
        </section>

        <section className="panel recommended-schedule">
          <h2>Recommended Schedule</h2>
          <div className="schedule-list">
            <div className="schedule-row">
              <span className="schedule-time">9:00 - 11:00</span>
              <div>
                <strong>
                  Deep Work - {activeTask ? activeTask.title : 'Set your priority task'}
                </strong>
                <small>Peak lunar energy</small>
              </div>
            </div>
            <div className="schedule-row">
              <span className="schedule-time">11:00 - 12:00</span>
              <div>
                <strong>Reflection - Review goals</strong>
                <small>Ground the next step</small>
              </div>
            </div>
            <div className="schedule-row">
              <span className="schedule-time">14:00 - 16:00</span>
              <div>
                <strong>Collaboration - Team session</strong>
                <small>Share progress and adjust priorities</small>
              </div>
            </div>
          </div>
        </section>
      </section>
    )
  }

  function renderMoonscope() {
    const reading = phaseReading(phase)
    const signTheme = signReading(moonContext?.sign)
    const houseTheme = houseReading(moonContext?.house)

    return (
      <section className="screen moonscope-screen">
        <header className="screen-header">
          <div>
            <h1>Moonscope</h1>
            <p>A daily moon reading for reflection, healing, and soul alignment</p>
          </div>
          <span className="status-chip">{todayLabel}</span>
        </header>

        <section className="moonscope-hero">
          <div className={`phase-visual ${phaseClass(phase)}`} />
          <div>
            <p className="coming-soon-kicker">Today's reading</p>
            <h2>
              {moonContext?.sign
                ? `${phase} in ${moonContext.sign}`
                : phase}
            </h2>
            <p>
              {moonContext
                ? `${formatIllumination(moonContext.illumination)}. This moonscope centers ${signTheme}.`
                : moonError || 'Loading the current moon reading...'}
            </p>
            <div className="tag-row">
              <span>{moonContext?.sign || 'Moon sign pending'}</span>
              <span>{moonContext?.house ? `House ${moonContext.house}` : 'House pending'}</span>
              <span>{moonContext?.energy_theme || 'Live moon energy'}</span>
            </div>
          </div>
        </section>

        <section className="moonscope-grid">
          <article className="panel moonscope-card wide">
            <span>Soul Message</span>
            <h2>What the moon is asking you to hear</h2>
            <p>{reading.soulMessage}</p>
          </article>

          <article className="panel moonscope-card">
            <span>Healing Focus</span>
            <h2>Where to soften</h2>
            <p>{reading.healingFocus}</p>
          </article>

          <article className="panel moonscope-card">
            <span>Zodiac Current</span>
            <h2>{moonContext?.sign ? `Moon in ${moonContext.sign}` : 'Moon sign pending'}</h2>
            <p>
              Today's emotional weather moves through {signTheme}. Let that theme
              guide how you respond to yourself and others.
            </p>
          </article>

          <article className="panel moonscope-card">
            <span>House Theme</span>
            <h2>{moonContext?.house ? `House ${moonContext.house}` : 'House pending'}</h2>
            <p>
              {houseTheme
                ? `This energy may show up through ${houseTheme}.`
                : 'The house placement is still loading, so stay with the broader moon message for now.'}
            </p>
          </article>

          <article className="panel moonscope-card">
            <span>Reflection Prompt</span>
            <h2>Journal with the moon</h2>
            <p>{reading.reflectionPrompt}</p>
          </article>

          <article className="panel moonscope-card affirmation">
            <span>Affirmation</span>
            <h2>Healing words for today</h2>
            <p>{reading.affirmation}</p>
          </article>
        </section>
      </section>
    )
  }

  function renderJournal() {
    return (
      <section className="screen journal-screen">
        <header className="screen-header">
          <div>
            <h1>Journal</h1>
            <p>Reflect, process, and grow with AI-guided prompts</p>
          </div>
          <button onClick={() => setJournalText('How am I honoring my intentions?')} type="button">
            New Entry
          </button>
        </header>

        <section className="panel journal-editor">
          <div className="panel-title">
            <h2>New Journal Entry</h2>
            <span>{phase}</span>
          </div>
          <form onSubmit={handleJournalSave}>
            <textarea
              disabled={isSavingJournal}
              onChange={(event) => setJournalText(event.target.value)}
              placeholder="How am I honoring my intentions?"
              value={journalText}
            />
            <div className="form-row">
              <select
                disabled={isSavingJournal}
                onChange={(event) => setJournalMood(event.target.value)}
                value={journalMood}
              >
                {moodOptions.map((mood) => (
                  <option key={mood} value={mood}>
                    Mood: {mood}
                  </option>
                ))}
              </select>
              <input
                disabled={isSavingJournal}
                onChange={(event) => setJournalTags(event.target.value)}
                placeholder="Tags, comma separated"
                value={journalTags}
              />
              <button disabled={isSavingJournal || !journalText.trim()} type="submit">
                {isSavingJournal ? 'Saving...' : 'Save Entry'}
              </button>
            </div>
          </form>
          {journalStatus && <p className="success-text">{journalStatus}</p>}
          {journalError && <p className="error-text">{journalError}</p>}
        </section>

        <section className="panel">
          <h2>AI Journaling Prompts</h2>
          <p>{moonContext?.energy_theme || 'Prompts will align with live lunar context.'}</p>
          <div className="prompt-grid compact">
            {[
              'What am I grateful for today?',
              'What lessons did I learn this week?',
              'How am I honoring my intentions?',
              'What do I need to release before the next moon phase?',
            ].map((prompt) => (
              <button
                className="prompt-card"
                key={prompt}
                onClick={() => setJournalText(prompt)}
                type="button"
              >
                {prompt}
              </button>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel-title">
            <h2>Recent Entries</h2>
            <button disabled={isLoadingJournal} onClick={loadJournalEntries} type="button">
              {isLoadingJournal ? 'Loading...' : 'Refresh'}
            </button>
          </div>
          <form className="memory-search" onSubmit={handleJournalSearch}>
            <input
              disabled={isSearchingJournal}
              onChange={(event) => setJournalSearchQuery(event.target.value)}
              placeholder="Search journal memories..."
              value={journalSearchQuery}
            />
            <button disabled={isSearchingJournal || !journalSearchQuery.trim()} type="submit">
              Search
            </button>
          </form>
          <div className="entry-list">
            {(journalSearchResults.length ? journalSearchResults : journalEntries).map(
              renderJournalEntry,
            )}
            {!journalEntries.length && !journalSearchResults.length && (
              <p className="muted-text">No journal entries saved yet.</p>
            )}
          </div>
        </section>
      </section>
    )
  }

  function renderCalendar() {
    const today = new Date()
    const todayKey = today.toISOString().slice(0, 10)

    return (
      <section className="screen calendar-screen">
        <header className="screen-header">
          <div>
            <h1>Lunar Calendar</h1>
            <p>View your schedule aligned with moon phases and cosmic events</p>
          </div>
        </header>

        <section className="panel calendar-panel">
          <div className="calendar-toolbar">
            <h2>{calendarTitle}</h2>
            <div>
              <button onClick={() => moveCalendar(-1)} type="button">
                Prev
              </button>
              <button onClick={() => setCalendarDate(new Date())} type="button">
                Today
              </button>
              <button onClick={() => moveCalendar(1)} type="button">
                Next
              </button>
            </div>
          </div>
          {isCalendarLoading && <p className="muted-text">Loading lunar calendar...</p>}
          {calendarError && <p className="error-text">{calendarError}</p>}
          <div className="calendar-weekdays">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className="calendar-grid">
            {calendarCells.map((cell) =>
              cell.empty ? (
                <div className="calendar-cell empty" key={cell.key} />
              ) : (
                <div
                  className={`calendar-cell ${
                    cell.day.date === todayKey ? 'today' : ''
                  }`}
                  key={cell.key}
                >
                  <div className="cell-top">
                    <span>{cell.day.day}</span>
                    <span
                      className={`mini-moon ${phaseClass(cell.day.phase)}`}
                      title={cell.day.phase}
                    />
                  </div>
                  {cell.day.phase.toLowerCase().includes('new') && (
                    <span className="event-chip lunar">New Moon Ritual</span>
                  )}
                  {cell.day.phase.toLowerCase().includes('full') && (
                    <span className="event-chip lunar">Full Moon Reflection</span>
                  )}
                  {cell.day.day === 24 && <span className="event-chip">Journaling</span>}
                </div>
              ),
            )}
          </div>
        </section>
      </section>
    )
  }

  function renderPlaceholder(title: string, description: string) {
    return (
      <section className="screen">
        <header className="screen-header">
          <div>
            <h1>{title}</h1>
            <p>{description}</p>
          </div>
        </header>
        <section className="panel placeholder-panel">
          <span className="coming-soon-kicker">Coming soon</span>
          <h2>{title} is on the roadmap</h2>
          <p>
            This section is not active yet. For now, use the Dashboard, Journal,
            Calendar, and Daily Planning tabs for the live Moon Agent experience.
          </p>
        </section>
      </section>
    )
  }

  function renderActiveScreen() {
    if (activeSection === 'dashboard') return renderDashboard()
    if (activeSection === 'planning') return renderPlanning()
    if (activeSection === 'journal') return renderJournal()
    if (activeSection === 'calendar') return renderCalendar()
    if (activeSection === 'guidance') {
      return renderMoonscope()
    }
    if (activeSection === 'affirmations') {
      return renderPlaceholder('Affirmations', 'Create a personalized affirmation card.')
    }
    if (activeSection === 'saved') {
      return renderPlaceholder('Saved Readings', 'Review saved moon guidance and plans.')
    }
    return renderPlaceholder('Settings', 'Adjust your Moon Agent preferences.')
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-icon">M</span>
          <div>
            <strong>Moon Agent</strong>
            <small>AI Planning Assistant</small>
          </div>
        </div>
        <nav>
          {navItems.map((item) => (
            <button
              className={activeSection === item.id ? 'nav-item active' : 'nav-item'}
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              type="button"
            >
              <span>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      <section className="main-workspace">{renderActiveScreen()}</section>

      <aside className="right-rail">
        <section className="rail-card phase-card">
          <p>
            {moonContext?.sign ? `Current Moon in ${moonContext.sign}` : 'Current Moon'}
          </p>
          <div className={`phase-visual ${phaseClass(phase)}`} />
          <h2>{phase}</h2>
          <span>{formatIllumination(moonContext?.illumination)}</span>
        </section>

        <section className="rail-card">
          <h3>Energy Theme</h3>
          <p>
            {moonContext?.energy_theme ||
              moonError ||
              'Live lunar guidance will appear when the backend is available.'}
          </p>
        </section>

        <section className="rail-card quote">
          <p>"Make the plan gentle enough to begin, and clear enough to complete."</p>
        </section>
      </aside>
    </main>
  )
}

export default App
