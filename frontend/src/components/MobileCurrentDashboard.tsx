import type { FormEvent } from 'react'
import type { DailyTask, MobileTab, MoonContext } from '../types'
import {
  formatMoonEventDate,
  greetingForNow,
  phaseClass,
  stripMarkdownForSpeech,
} from '../utils/moon'

type MobileAccordions = {
  intentions: boolean
  agent: boolean
}

type MobileCurrentDashboardProps = {
  completedTaskCount: number
  dailyTasks: DailyTask[]
  input: string
  isLoading: boolean
  latestAgentMessage: string
  mobileAccordions: MobileAccordions
  moonContext: MoonContext | null
  nextFullMoon?: string | null
  nextNewMoon?: string | null
  phase: string
  onInputChange: (value: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onTabChange: (tab: MobileTab) => void
  onToggleAccordion: (key: keyof MobileAccordions) => void
  onToggleTask: (taskId: string) => void
}

const defaultIntentions = [
  'Set 3 intentions for the cycle',
  'Evening gratitude ritual',
  'Ask Moon Agent for guidance',
]

export function MobileCurrentDashboard({
  completedTaskCount,
  dailyTasks,
  input,
  isLoading,
  latestAgentMessage,
  mobileAccordions,
  moonContext,
  nextFullMoon,
  nextNewMoon,
  phase,
  onInputChange,
  onSubmit,
  onTabChange,
  onToggleAccordion,
  onToggleTask,
}: MobileCurrentDashboardProps) {
  const shownTasks = dailyTasks.slice(0, 3)
  const totalTasks = dailyTasks.length || 3
  const progressPercent = Math.round((completedTaskCount / totalTasks) * 100)
  const currentIllumination =
    moonContext?.illumination === null || moonContext?.illumination === undefined
      ? 'Live'
      : `${Math.round(
          moonContext.illumination <= 1
            ? moonContext.illumination * 100
            : moonContext.illumination,
        )}% lit`

  return (
    <section className="mobile-dashboard">
      <header className="mobile-dashboard-header">
        <p>
          {new Intl.DateTimeFormat(undefined, {
            hour: 'numeric',
            minute: '2-digit',
          }).format(new Date())}
        </p>
        <h1>{greetingForNow()}</h1>
        <span>{phase}</span>
      </header>

      <section className="mobile-phase-card">
        <div className={`mobile-card-moon ${phaseClass(phase)}`} />
        <div>
          <div className="mobile-phase-title">
            <h2>{phase}</h2>
            <span>{currentIllumination}</span>
          </div>
          <p>{moonContext?.energy_theme || 'Loading moon energy for your day...'}</p>
          <div className="mobile-phase-tags">
            <span>{moonContext?.sign || 'Moon sign pending'}</span>
            <span>
              {moonContext?.house ? `House ${moonContext.house}` : 'House pending'}
            </span>
            <span>Momentum</span>
          </div>
          <button onClick={() => onTabChange('chat')} type="button">
            View lunar details
          </button>
        </div>
      </section>

      <section className="mobile-intentions-card mobile-accordion">
        <button
          aria-expanded={mobileAccordions.intentions}
          className="mobile-card-heading mobile-accordion-trigger"
          onClick={() => onToggleAccordion('intentions')}
          type="button"
        >
          <span className="mobile-heading-copy">
            <h2>Today's Intentions</h2>
            <small>
              {completedTaskCount}/{dailyTasks.length || defaultIntentions.length}{' '}
              complete
            </small>
          </span>
          <span className="mobile-accordion-icon">
            {mobileAccordions.intentions ? '-' : '+'}
          </span>
        </button>
        {mobileAccordions.intentions && (
          <div className="mobile-accordion-panel">
            <div className="mobile-progress">
              <span style={{ width: `${Math.max(progressPercent, 8)}%` }} />
            </div>
            <div className="mobile-intention-list">
              {shownTasks.map((task) => (
                <button
                  className={task.completed ? 'complete' : ''}
                  key={task.id}
                  onClick={() => onToggleTask(task.id)}
                  type="button"
                >
                  <span />
                  <strong>{task.title}</strong>
                </button>
              ))}
              {!shownTasks.length &&
                defaultIntentions.map((intention) => (
                  <button key={intention} type="button">
                    <span />
                    <strong>{intention}</strong>
                  </button>
                ))}
            </div>
            <button
              className="mobile-add-intention"
              onClick={() => onTabChange('planning')}
              type="button"
            >
              + Add intention
            </button>
          </div>
        )}
        {!mobileAccordions.intentions && shownTasks[0] && (
          <button
            className={
              shownTasks[0].completed
                ? 'mobile-accordion-preview complete'
                : 'mobile-accordion-preview'
            }
            onClick={() => onToggleTask(shownTasks[0].id)}
            type="button"
          >
            <span />
            <strong>{shownTasks[0].title}</strong>
          </button>
        )}
      </section>

      <section className="mobile-ai-card mobile-accordion">
        <button
          aria-expanded={mobileAccordions.agent}
          className="mobile-card-heading mobile-accordion-trigger"
          onClick={() => onToggleAccordion('agent')}
          type="button"
        >
          <span className="mobile-heading-copy">
            <h2>Moon Agent AI</h2>
            <small>
              {moonContext?.sign ? `Moon in ${moonContext.sign}` : 'Ask for guidance'}
            </small>
          </span>
          <span className="mobile-accordion-icon">
            {mobileAccordions.agent ? '-' : '+'}
          </span>
        </button>
        <div className="mobile-ai-preview">
          {stripMarkdownForSpeech(latestAgentMessage).slice(0, 128)}
        </div>
        {mobileAccordions.agent && (
          <div className="mobile-accordion-panel">
            <form className="mobile-ai-form" onSubmit={onSubmit}>
              <input
                disabled={isLoading}
                onChange={(event) => onInputChange(event.target.value)}
                placeholder="Ask the moon..."
                value={input}
              />
              <button disabled={isLoading || !input.trim()} type="submit">
                Send
              </button>
            </form>
            <button
              className="mobile-open-chat"
              onClick={() => onTabChange('chat')}
              type="button"
            >
              Open full chat
            </button>
          </div>
        )}
      </section>

      <section className="mobile-moon-meta">
        <span>Next Full: {formatMoonEventDate(nextFullMoon)}</span>
        <span>Next New: {formatMoonEventDate(nextNewMoon)}</span>
      </section>
    </section>
  )
}
