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

const navItems: { id: Section; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'D' },
  { id: 'guidance', label: 'Moon Guidance', icon: 'M' },
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
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  const calendarTitle = monthFormatter.format(calendarDate)
  const phase = moonContext?.phase || 'Moon phase unavailable'

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
      }
      const content = data.response || 'Moon Agent returned an empty response.'
      setMessages((current) => [
        ...current,
        {
          role: 'agent',
          content,
          affirmationCard: data.affirmation_card || null,
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

        <section className="moon-context-card">
          <div className="symbol-pill">M</div>
          <div>
            <h2>{phase} Context</h2>
            <p>
              {moonContext
                ? `${formatIllumination(moonContext.illumination)}. ${moonContext.energy_theme}`
                : moonError || 'Loading live moon context...'}
            </p>
            <div className="tag-row">
              <span>Manifestation</span>
              <span>Completion</span>
              <span>Reflection</span>
            </div>
          </div>
        </section>

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
                    cell.day?.date === todayKey ? 'today' : ''
                  }`}
                  key={cell.key}
                >
                  <div className="cell-top">
                    <span>{cell.day?.day}</span>
                    <span
                      className={`mini-moon ${phaseClass(cell.day?.phase || '')}`}
                      title={cell.day?.phase}
                    />
                  </div>
                  {cell.day?.phase.toLowerCase().includes('new') && (
                    <span className="event-chip lunar">New Moon Ritual</span>
                  )}
                  {cell.day?.phase.toLowerCase().includes('full') && (
                    <span className="event-chip lunar">Full Moon Reflection</span>
                  )}
                  {cell.day?.day === 24 && <span className="event-chip">Journaling</span>}
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
            and Calendar tabs for the live Moon Agent experience.
          </p>
        </section>
      </section>
    )
  }

  function renderActiveScreen() {
    if (activeSection === 'dashboard') return renderDashboard()
    if (activeSection === 'journal') return renderJournal()
    if (activeSection === 'calendar') return renderCalendar()
    if (activeSection === 'guidance') {
      return renderPlaceholder('Moon Guidance', 'Understand the current lunar energy.')
    }
    if (activeSection === 'planning') {
      return renderPlaceholder('Daily Planning', 'Build a grounded plan for today.')
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
          <p>Current Phase</p>
          <div className={`phase-visual ${phaseClass(phase)}`} />
          <h2>{phase}</h2>
          <span>{formatIllumination(moonContext?.illumination)}</span>
          <div className="rail-divider" />
          <small>
            {moonContext?.next_full_moon
              ? `Full Moon: ${moonContext.next_full_moon}`
              : moonContext?.next_new_moon
                ? `New Moon: ${moonContext.next_new_moon}`
                : moonError || 'Live moon event loading'}
          </small>
        </section>

        <section className="rail-card">
          <h3>Lunar Energy</h3>
          <p>{moonContext?.energy_theme || 'Loading current moon guidance...'}</p>
        </section>

        <section className="rail-card">
          <h3>Astrology Focus</h3>
          <p>
            {moonContext?.sign
              ? `Moon in ${moonContext.sign}${moonContext.house ? `, house ${moonContext.house}` : ''}.`
              : 'Sign and house data will appear when available.'}
          </p>
        </section>

        <section className="rail-card">
          <h3>Emotional Themes</h3>
          <div className="theme-tags">
            <span>Clarity</span>
            <span>Confidence</span>
            <span>Completion</span>
            <span>Gratitude</span>
          </div>
        </section>

        <section className="rail-card quote">
          <p>"I am aligned with the rhythms of nature. My intentions are manifesting beautifully."</p>
        </section>
      </aside>
    </main>
  )
}

export default App
