export type ChakraEnergy = {
  sign?: string | null
  energy_theme?: string | null
  chakra_focus?: string | null
  chakra_element?: string | null
  chakra_themes?: string[] | null
  shadow_themes?: string[] | null
  chakra_practice?: string | null
  chakra_affirmation?: string | null
}

type ChakraEnergyCardProps = {
  context?: ChakraEnergy | null
  error?: string
}

function cleanList(value?: string[] | null) {
  return (value || []).filter(Boolean)
}

export function ChakraEnergyCard({ context, error }: ChakraEnergyCardProps) {
  const themes = cleanList(context?.chakra_themes).slice(0, 4)
  const shadowThemes = cleanList(context?.shadow_themes).slice(0, 3)
  const chakraName =
    context?.chakra_focus && context.chakra_focus !== 'General Energy'
      ? context.chakra_focus
      : null
  const fallback =
    context?.energy_theme ||
    error ||
    'Live chakra guidance will appear when the moon context is available.'

  if (!context || !chakraName) {
    return (
      <section className="rail-card chakra-card">
        <h3>Current Chakra is loading</h3>
        <p>{fallback}</p>
      </section>
    )
  }

  return (
    <section className="rail-card chakra-card">
      <p>{context.sign ? `Moon in ${context.sign}` : 'Current moon'}</p>
      <h3>Current Chakra is {chakraName}</h3>
      {context.chakra_element && (
        <span className="chakra-element">{context.chakra_element} element</span>
      )}

      {!!themes.length && (
        <div className="chakra-chip-row" aria-label="Chakra themes">
          {themes.map((theme) => (
            <span key={theme}>{theme}</span>
          ))}
        </div>
      )}

      <div className="chakra-guidance">
        <strong>Practice</strong>
        <p>{context.chakra_practice || fallback}</p>
      </div>

      {context.chakra_affirmation && (
        <blockquote>{context.chakra_affirmation}</blockquote>
      )}

      {!!shadowThemes.length && (
        <div className="chakra-shadow">
          <strong>Watch for</strong>
          <span>{shadowThemes.join(', ')}</span>
        </div>
      )}
    </section>
  )
}
