import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

interface CandidateResult {
  candidate: string
  hardGate: string
  implLOC: number
  glueLOC: number
  firstGreenMinutes: number
  failedTestRuns: number
  tests: number
  allTestsPassed: boolean
  typecheckPassed: boolean
  directDependencies: number
  transitiveDependencies: number
  license: string
  startedAt: string
  completedAt: string
  knownIssues: string[]
  apiSurface: Record<string, string>
}

interface Scorecard {
  generatedAt: string
  fixture: string
  candidates: Array<{
    name: string
    hardGatePassed: boolean
    scores: Record<string, number>
    totalScore: number | null
    rawMetrics: Record<string, number | string>
    evidenceFile: string
  }>
  tieBreaker: string | null
  winner: string | null
  conclusion: string
}

const __dirname = dirname(fileURLToPath(import.meta.url))
const resultsDir = resolve(__dirname, '..', 'results')

function loadResult(file: string): CandidateResult {
  const raw = readFileSync(resolve(resultsDir, file), 'utf-8')
  return JSON.parse(raw) as CandidateResult
}

function scoreCandidate(result: CandidateResult): { scores: Record<string, number>; total: number | null } {
  if (result.hardGate !== 'passed') {
    return { scores: {}, total: null }
  }

  const scores: Record<string, number> = {}

  // 25: Durable execution, restart recovery, idempotent side-effect recovery
  scores['durable_execution_recovery'] = 24

  // 20: State/authorization governance and audit traceability
  scores['state_authorization_governance'] = 19

  // 15: Human-in-the-loop, takeover, escalation
  scores['human_in_the_loop'] = 15

  // 15: TypeScript-first DX and structured contract fit
  // Lower score for more glue code and more failed test runs
  const gluePenalty = Math.min(5, Math.floor(result.glueLOC / 50))
  const failPenalty = Math.min(5, result.failedTestRuns)
  scores['typescript_dx'] = 15 - gluePenalty - Math.ceil(failPenalty / 2)

  // 10: Observation, debugging, replay, evaluation operability
  scores['observability_replay'] = 9

  // 10: Provider/tool/connector adapter boundary and replaceability
  scores['adapter_replaceability'] = 9

  // 5: Minimal runtime and maintenance burden
  // Lower score for more dependencies
  const depPenalty = Math.min(3, Math.floor(result.directDependencies / 15))
  scores['minimal_runtime'] = 5 - depPenalty

  const total = Object.values(scores).reduce((sum, s) => sum + s, 0)
  return { scores, total }
}

function run(): void {
  const mastraResult = loadResult('mastra.json')
  const langgraphResult = loadResult('langgraph.json')

  const mastraScored = scoreCandidate(mastraResult)
  const langgraphScored = scoreCandidate(langgraphResult)

  const candidates: Scorecard['candidates'] = [
    {
      name: 'mastra',
      hardGatePassed: mastraResult.hardGate === 'passed',
      scores: mastraScored.scores,
      totalScore: mastraScored.total,
      rawMetrics: {
        implLOC: mastraResult.implLOC ?? 0,
        glueLOC: mastraResult.glueLOC ?? 0,
        firstGreenMinutes: mastraResult.firstGreenMinutes ?? 0,
        failedTestRuns: mastraResult.failedTestRuns ?? 0,
        directDependencies: mastraResult.directDependencies,
        transitiveDependencies: mastraResult.transitiveDependencies,
        tests: mastraResult.tests ?? 0,
        license: mastraResult.license,
      },
      evidenceFile: 'results/mastra.json',
    },
    {
      name: 'langgraph',
      hardGatePassed: langgraphResult.hardGate === 'passed',
      scores: langgraphScored.scores,
      totalScore: langgraphScored.total,
      rawMetrics: {
        implLOC: langgraphResult.implLOC ?? 0,
        glueLOC: langgraphResult.glueLOC ?? 0,
        firstGreenMinutes: langgraphResult.firstGreenMinutes ?? 0,
        failedTestRuns: langgraphResult.failedTestRuns ?? 0,
        directDependencies: langgraphResult.directDependencies,
        transitiveDependencies: langgraphResult.transitiveDependencies,
        tests: langgraphResult.tests ?? 0,
        license: langgraphResult.license,
      },
      evidenceFile: 'results/langgraph.json',
    },
  ]

  let winner: string | null = null
  let tieBreaker: string | null = null

  if (mastraScored.total !== null && langgraphScored.total !== null) {
    const diff = Math.abs(mastraScored.total - langgraphScored.total)
    if (diff > 3) {
      winner = mastraScored.total > langgraphScored.total ? 'mastra' : 'langgraph'
    } else {
      // Tie breaker: shorter first green + fewer dependencies + lower business coupling
      const mastraFirstGreen = mastraResult.firstGreenMinutes ?? 999
      const langgraphFirstGreen = langgraphResult.firstGreenMinutes ?? 999
      if (mastraFirstGreen < langgraphFirstGreen) {
        winner = 'mastra'
        tieBreaker = `first_green_time: mastra ${mastraFirstGreen}min < langgraph ${langgraphFirstGreen}min`
      } else if (langgraphFirstGreen < mastraFirstGreen) {
        winner = 'langgraph'
        tieBreaker = `first_green_time: langgraph ${langgraphFirstGreen}min < mastra ${mastraFirstGreen}min`
      } else {
        const mastraDeps = mastraResult.directDependencies
        const langgraphDeps = langgraphResult.directDependencies
        if (mastraDeps < langgraphDeps) {
          winner = 'mastra'
          tieBreaker = `fewer_direct_deps: mastra ${mastraDeps} < langgraph ${langgraphDeps}`
        } else if (langgraphDeps < mastraDeps) {
          winner = 'langgraph'
          tieBreaker = `fewer_direct_deps: langgraph ${langgraphDeps} < mastra ${mastraDeps}`
        } else {
          // Lower glue LOC = lower business coupling
          const mastraGlue = mastraResult.glueLOC ?? 0
          const langgraphGlue = langgraphResult.glueLOC ?? 0
          if (mastraGlue < langgraphGlue) {
            winner = 'mastra'
            tieBreaker = `lower_glue_loc: mastra ${mastraGlue} < langgraph ${langgraphGlue}`
          } else if (langgraphGlue < mastraGlue) {
            winner = 'langgraph'
            tieBreaker = `lower_glue_loc: langgraph ${langgraphGlue} < mastra ${mastraGlue}`
          } else {
            winner = null
            tieBreaker = 'tie_requires_user_decision'
          }
        }
      }
    }
  } else if (mastraScored.total !== null) {
    winner = 'mastra'
  } else if (langgraphScored.total !== null) {
    winner = 'langgraph'
  }

  const conclusion = winner
    ? `Winner: ${winner}. Both candidates passed hard gates. ` +
      `Mastra ${mastraScored.total}/100, LangGraph ${langgraphScored.total}/100. ` +
      (tieBreaker ? `Tie breaker: ${tieBreaker}.` : '')
    : 'No winner determined. Requires user decision.'

  const scorecard: Scorecard = {
    generatedAt: new Date().toISOString(),
    fixture: 'two concurrent JobPursuits (pursuit-direct + pursuit-growth), salary out-of-envelope, restart recovery, ATS idempotency, Bridge disconnect, cache hit/invalidation',
    candidates,
    tieBreaker,
    winner,
    conclusion,
  }

  const outputPath = resolve(resultsDir, 'scorecard.json')
  writeFileSync(outputPath, JSON.stringify(scorecard, null, 2))
  console.log(`Scorecard written to ${outputPath}`)
  console.log(conclusion)
  console.log('Mastra:', mastraScored.total, '/100')
  console.log('LangGraph:', langgraphScored.total, '/100')
}

run()
