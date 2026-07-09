import { Show, SignUpButton, UserButton } from '@clerk/react'

const features = [
  {
    title: 'AI Moon Assistant',
    description:
      'Ask for grounded lunar guidance, planning support, reflections, and personalized next steps.',
  },
  {
    title: 'Moonscope',
    description:
      'Read the current moon phase, sign, illumination, and daily energetic themes in one place.',
  },
  {
    title: 'Daily Planning',
    description:
      'Turn guidance into practical tasks, track completion, and keep your day aligned with intention.',
  },
  {
    title: 'Journal Memory',
    description:
      'Save reflections, search past entries, and keep your inner work connected to your planning flow.',
  },
  {
    title: 'Lunar Calendar',
    description:
      'Explore monthly moon phases and upcoming lunar moments for planning, reflection, and rituals.',
  },
  {
    title: 'Chakra Insights',
    description:
      'Pair moon context with chakra themes, affirmations, and gentle practices for deeper alignment.',
  },
]

const workflow = [
  'Ask Moon Agent what needs your attention today.',
  'Move suggested actions into your daily plan.',
  'Reflect in the journal and save what matters.',
  'Use the lunar calendar to keep your rhythm visible.',
]

export default function LandingPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#050816] text-slate-100">
      <section className="relative">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(129,140,248,0.24),transparent_34%),radial-gradient(circle_at_80%_20%,rgba(236,72,153,0.13),transparent_28%),linear-gradient(180deg,#050816_0%,#090d1f_55%,#050816_100%)]" />
        <div className="absolute left-1/2 top-24 -z-10 h-72 w-72 -translate-x-1/2 rounded-full bg-indigo-400/10 blur-3xl" />

        <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-8">
          <a className="flex items-center gap-3" href="/">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-indigo-300 to-sky-500 font-black text-slate-950 shadow-lg shadow-indigo-500/20">
              M
            </span>
            <span>
              <span className="block text-lg font-extrabold tracking-tight">
                Moon Agent
              </span>
              <span className="block text-xs font-medium text-slate-400">
                Lunar planning assistant
              </span>
            </span>
          </a>

          <div className="hidden items-center gap-7 text-sm font-medium text-slate-300 md:flex">
            <a className="transition hover:text-white" href="#features">
              Features
            </a>
            <a className="transition hover:text-white" href="#workflow">
              Workflow
            </a>
            <a className="transition hover:text-white" href="/app">
              Demo
            </a>
          </div>

          <div className="flex items-center gap-3">
            <a
              className="hidden rounded-lg border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-white/20 hover:bg-white/5 sm:inline-flex"
              href="/app"
            >
              Open Demo
            </a>
            <Show when="signed-out">
              <SignUpButton mode="modal">
                <button
                  className="rounded-lg bg-indigo-300 px-4 py-2 text-sm font-bold text-slate-950 shadow-lg shadow-indigo-500/20 transition hover:bg-indigo-200"
                  type="button" disabled={true}
                >
                  Sign Up
                </button>
              </SignUpButton>
            </Show>
            <Show when="signed-in">
              <UserButton />
            </Show>
          </div>
        </nav>

        <div className="  bg-black grid min-h-[calc(100vh-88px)]  items-center gap-14 px-6 py-16 lg:grid-cols-[1fr_0.9fr] lg:px-8 lg:py-20">
          <section className="max-w-3xl">
       
            <h1 className="text-5xl font-black leading-[0.98] tracking-tight text-white sm:text-6xl lg:text-7xl">
              Plan your day in alignment with the moon.
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
              Moon Agent combines lunar context, AI chat, daily planning,
              journaling, and calendar awareness so your intentions can become
              concrete next steps.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <a
                className="inline-flex items-center justify-center rounded-xl bg-indigo-300 px-6 py-3 font-bold text-slate-950 shadow-xl shadow-indigo-500/20 transition hover:bg-indigo-200"
                href="/app"
              >
                Open Dashboard Demo
              </a>
              <a
                className="inline-flex items-center justify-center rounded-xl border border-white/10 px-6 py-3 font-bold text-white transition hover:border-white/20 hover:bg-white/5"
                href="#features"
              >
                Explore Features
              </a>
            </div>

          </section>

          <section
            aria-label="Moon Agent dashboard preview"
            className="relative mx-auto w-full max-w-xl"
          >
            <div className="absolute -inset-4 " />
            <div className="relative overflow-hidden  ">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-indigo-200">
                    Moon Agent
                  </p>
                  <h2 className="mt-2 text-2xl font-black text-white">
                    Today&apos;s Guidance
                  </h2>
                </div>
                <div className="grid h-16 w-16 place-items-center rounded-full bg-[linear-gradient(90deg,#c4d1e4_0_52%,#111833_53%_100%)] shadow-[0_0_48px_rgba(164,169,230,0.22)]" />
              </div>

              <div className="grid gap-4">
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-sm text-slate-400">AI Moon Assistant</p>
                  <p className="mt-2 text-lg font-semibold text-white">
                    “Help me turn today&apos;s lunar energy into a realistic plan.”
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-2xl border border-indigo-300/20 bg-indigo-300/10 p-4">
                    <p className="text-sm text-indigo-100">Current phase</p>
                    <p className="mt-4 text-2xl font-black text-white">
                      Waxing
                    </p>
                  </div>
                  <div className="rounded-2xl border border-fuchsia-300/20 bg-fuchsia-300/10 p-4">
                    <p className="text-sm text-fuchsia-100">Focus</p>
                    <p className="mt-4 text-2xl font-black text-white">
                      Build
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="font-semibold text-white">Daily plan</p>
                    <span className="rounded-full bg-emerald-300/10 px-3 py-1 text-xs font-bold text-emerald-200">
                      2/4 done
                    </span>
                  </div>
                  <div className="space-y-3 text-sm text-slate-300">
                    <p className="rounded-xl bg-white/[0.04] px-3 py-2">
                      Set one clear intention
                    </p>
                    <p className="rounded-xl bg-white/[0.04] px-3 py-2">
                      Journal what needs momentum
                    </p>
                    <p className="rounded-xl bg-white/[0.04] px-3 py-2">
                      Review the lunar calendar
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-7xl px-6 py-24 lg:px-8">
        <div className="max-w-3xl">
          <p className="text-sm font-bold uppercase tracking-[0.28em] text-indigo-300">
            Current features
          </p>
          <h2 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-5xl">
            Everything in the dashboard has a purpose.
          </h2>
          <p className="mt-5 text-lg leading-8 text-slate-300">
            Moon Agent is already built around the core loop: understand the
            lunar context, ask for guidance, plan the day, and reflect with
            memory.
          </p>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <article
              className="rounded-2xl border border-white/10 bg-white/[0.035] p-6 transition hover:-translate-y-1 hover:border-indigo-300/30 hover:bg-white/[0.055]"
              key={feature.title}
            >
              <div className="mb-5 grid h-11 w-11 place-items-center rounded-xl bg-indigo-300/10 text-lg font-black text-indigo-200">
                {feature.title.slice(0, 1)}
              </div>
              <h3 className="text-xl font-black text-white">{feature.title}</h3>
              <p className="mt-3 leading-7 text-slate-400">
                {feature.description}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section
        id="workflow"
        className="px-6 py-24 lg:px-8 bg-black"
      >
        <div className="">
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1fr] lg:items-center">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.28em] text-indigo-200">
                Workflow
              </p>
              <h2 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-5xl">
                A calmer loop for planning and reflection.
              </h2>
              <p className="mt-5 text-lg leading-8 text-slate-300">
                The demo shows how Moon Agent can turn spiritual context into
                practical action without losing the reflective part of the work.
              </p>
            </div>

            <ol className="grid gap-4">
              {workflow.map((step, index) => (
                <li
                  className="flex gap-4 rounded-2xl "
                  key={step}
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-indigo-300 font-black text-slate-950">
                    {index + 1}
                  </span>
                  <span className="pt-1 text-lg font-semibold text-slate-100">
                    {step}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 pb-24 pt-24 text-center lg:px-8">
        <p className="text-sm font-bold uppercase tracking-[0.28em] text-indigo-300">
          Try the demo
        </p>
        <h2 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-5xl">
          Open the current Moon Agent dashboard.
        </h2>
        <p className="mt-5 text-lg leading-8 text-slate-300">
          Create an account with Clerk when you are ready, or open the dashboard
          demo now.
        </p>
        <div className="mt-8 flex justify-center">
          <a
            className="inline-flex items-center justify-center rounded-xl bg-indigo-300 px-6 py-3 font-bold text-slate-950 shadow-xl shadow-indigo-500/20 transition hover:bg-indigo-200"
            href="/app"
          >
            Launch Dashboard Demo
          </a>
        </div>
      </section>
    </main>
  )
}
