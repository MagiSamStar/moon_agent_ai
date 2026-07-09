import { ChakraEnergyCard } from './ChakraEnergyCard'
import type { MoonContext } from '../types'
import { formatIllumination, phaseClass } from '../utils/moon'

type RightRailProps = {
  moonContext: MoonContext | null
  moonError: string
  phase: string
}

export function RightRail({ moonContext, moonError, phase }: RightRailProps) {
  return (
    <aside className="right-rail">
      <section className="rail-card phase-card">
        <p>
          {moonContext?.sign ? `Current Moon in ${moonContext.sign}` : 'Current Moon'}
        </p>
        <div className={`phase-visual ${phaseClass(phase)}`} />
        <h2>{phase}</h2>
        <span>{formatIllumination(moonContext?.illumination)}</span>
      </section>

      <ChakraEnergyCard context={moonContext} error={moonError} />

      <section className="rail-card quote">
        <p>"Make the plan gentle enough to begin, and clear enough to complete."</p>
      </section>
    </aside>
  )
}
