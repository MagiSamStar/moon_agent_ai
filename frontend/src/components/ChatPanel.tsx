import type { FormEvent, RefObject } from 'react'
import ReactMarkdown from 'react-markdown'
import type { ChatMessage } from '../types'

type ChatPanelProps = {
  className?: string
  messages: ChatMessage[]
  prompts: string[]
  input: string
  isLoading: boolean
  error: string
  voiceError: string
  isListening: boolean
  readAloud: boolean
  messagesEndRef: RefObject<HTMLDivElement | null>
  onInputChange: (value: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onPrompt: (prompt: string) => void
  onStartListening: () => void
  onToggleReadAloud: () => void
  onAddAgentTasks: (messageIndex: number, suggestedTasks: string[]) => void
}

function linkifyUrls(text: string) {
  return text.replace(/(?<!\]\()https?:\/\/[^\s)]+/g, (url) => `[${url}](${url})`)
}

export function ChatPanel({
  className = 'chat-panel',
  messages,
  prompts,
  input,
  isLoading,
  error,
  voiceError,
  isListening,
  readAloud,
  messagesEndRef,
  onInputChange,
  onSubmit,
  onPrompt,
  onStartListening,
  onToggleReadAloud,
  onAddAgentTasks,
}: ChatPanelProps) {
  return (
    <section className={className}>
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
                    }, ${message.affirmationCard.palette?.[1] || '#6875ad'})`,
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
                        onAddAgentTasks(index, message.suggestedTasks || [])
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
            onClick={() => onPrompt(prompt)}
            type="button"
          >
            <span>{prompt}</span>
          </button>
        ))}
      </div>

      <form className="composer" onSubmit={onSubmit}>
        <input
          disabled={isLoading}
          onChange={(event) => onInputChange(event.target.value)}
          placeholder="Ask Moon Agent for a plan..."
          type="text"
          value={input}
        />
        <button
          aria-pressed={isListening}
          className={isListening ? 'icon-button active' : 'icon-button'}
          disabled={isLoading}
          onClick={onStartListening}
          type="button"
        >
          Mic
        </button>
        <button
          aria-pressed={readAloud}
          className={readAloud ? 'icon-button active' : 'icon-button'}
          onClick={onToggleReadAloud}
          type="button"
        >
          Audio
        </button>
        <button disabled={isLoading || !input.trim()} type="submit">
          {isLoading ? 'Generating...' : 'Send'}
        </button>
      </form>
    </section>
  )
}
