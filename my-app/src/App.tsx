import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import './App.css'

type ChatMessage = {
  role: 'user' | 'agent'
  content: string
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const initialMessages: ChatMessage[] = [
  {
    role: 'user',
    content: 'What should I focus on today based on the moon?',
  },
  {
    role: 'agent',
    content:
      'Today asks for calm structure. Keep your plan small enough to finish, but meaningful enough to move your bigger vision forward.\n\n- Review your AI portfolio plan for 25 focused minutes.\n- Block one quiet hour for study before checking messages.\n- Save one reflection about what feels ready to release.\n\n**Affirmation:** I trust steady progress and honor my timing.',
  },
]

function linkifyUrls(text: string) {
  return text.replace(/(?<!\]\()https?:\/\/[^\s)]+/g, (url) => `[${url}](${url})`)
}

function App() {
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const userMessage = input.trim()
    if (!userMessage) return

    setError('')
    setInput('')
    setIsLoading(true)
    setMessages((current) => [
      ...current,
      { role: 'user', content: userMessage },
    ])

    try {
      const response = await fetch(`${API_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: userMessage }),
      })

      if (!response.ok) {
        throw new Error(`Moon Agent API returned ${response.status}`)
      }

      const data = (await response.json()) as { response?: string }
      setMessages((current) => [
        ...current,
        {
          role: 'agent',
          content: data.response || 'Moon Agent returned an empty response.',
        },
      ])
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : 'Unable to reach Moon Agent.'

      setError(`${message}. Confirm FastAPI is running at ${API_URL}.`)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="app-shell">
      <div className="moon-glow moon-glow-left" />
      <div className="moon-glow moon-glow-right" />

      <section className="hero-panel">
        <nav className="topbar" aria-label="Moon Agent navigation">
          <div className="brand-mark">
            <span className="brand-orb" />
            <span>Moon Agent</span>
          </div>
          <div className="status-pill">Local MCP Agent</div>
        </nav>

        <div className="hero-grid">
          <section className="intro-copy" aria-labelledby="page-title">
            <p className="eyebrow">Moon planning, grounded action</p>
            <h1 id="page-title">Turn lunar energy into a clear daily plan.</h1>
            <p className="lede">
              A calm planning companion that reads the current moon context,
              shapes it into practical tasks, and prepares actions for Calendar
              and Notion.
            </p>

            <div className="quick-actions" aria-label="Future agent actions">
              <button type="button">Schedule ritual</button>
              <button type="button">Save reflection</button>
              <button type="button">Create plan</button>
            </div>
          </section>

          <section className="insight-card" aria-label="Moon insight preview">
            <div className="phase-orbit">
              <div className="phase-moon" />
            </div>
            <p className="card-label">Tonight&apos;s focus</p>
            <h2>Refine, simplify, commit.</h2>
            <p>
              The current energy favors practical edits over big reinvention.
              Choose the one thing that creates momentum.
            </p>
            <div className="integration-row">
              <span>Calendar ready</span>
              <span>Notion ready</span>
            </div>
          </section>
        </div>
      </section>

      <section className="workspace-grid">
        <section className="chat-card" aria-label="Moon Agent chat">
          <div className="card-header">
            <div>
              <p className="card-label">Agent conversation</p>
              <h2>Daily guidance preview</h2>
            </div>
            <span className="live-dot">Connected locally</span>
          </div>

          <div className="messages">
            {messages.map((message, index) => (
              <article
                className={`message ${
                  message.role === 'user' ? 'user-message' : 'agent-message'
                }`}
                key={`${message.role}-${index}`}
              >
                {message.role === 'agent' && (
                  <div className="agent-avatar">☾</div>
                )}
                <div className="markdown-message">
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
                </div>
              </article>
            ))}

            {isLoading && (
              <article className="message agent-message">
                <div className="agent-avatar">☾</div>
                <div className="markdown-message">
                  <p>Moon Agent is thinking...</p>
                </div>
              </article>
            )}
          </div>

          {error && <p className="error-message">{error}</p>}

          <form
            className="composer"
            aria-label="Moon Agent chat input"
            onSubmit={handleSubmit}
          >
            <input
              type="text"
              placeholder="Ask Moon Agent for a plan..."
              value={input}
              onChange={(event) => setInput(event.target.value)}
              disabled={isLoading}
            />
            <button type="submit" disabled={isLoading || !input.trim()}>
              {isLoading ? 'Generating...' : 'Send'}
            </button>
          </form>
        </section>

        <aside className="side-stack" aria-label="Planning summary">
          <section className="mini-card">
            <p className="card-label">Planning mode</p>
            <h3>Spiritual, but practical</h3>
            <p>
              Built for daily plans, healing reflections, creative focus, and
              follow-through.
            </p>
          </section>

          <section className="mini-card">
            <p className="card-label">Connected tools</p>
            <div className="tool-list">
              <span>Google Calendar</span>
              <span>Notion pages</span>
              <span>Notion database</span>
              <span>Moon API</span>
            </div>
          </section>

          <section className="mini-card quote-card">
            <p>
              &quot;Make the plan gentle enough to begin, and clear enough to
              complete.&quot;
            </p>
          </section>
        </aside>
      </section>
    </main>
  )
}

export default App
