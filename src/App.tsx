import { useEffect, useMemo, useState } from 'react'

type IconName =
  | 'branch' | 'arrow' | 'book' | 'chevron' | 'close'
  | 'menu' | 'minus' | 'plus'
  | 'search' | 'user'

type Narrator = {
  id: number
  initials: string
  name: string
  arabic: string
  era: string
  location: string
  role: string
  grade: string
  born: string
  died: string
  description: string
  birthDisplay: string
  birthPlace: string
  deathDisplay: string
  deathPlace: string
  tabaqah: string
  tawthiq: string
  regionRaw: string
}

type ProfileDraft = {
  name: string
  arabic_name: string
  grade: string
  tabaqah: string
  tawthiq: string
  birth_display: string
  birth_place: string
  death_display: string
  death_place: string
  region: string
  biography: string
}

type HadithRecord = {
  id: number
  hadith_number: string
  in_book_reference?: string
  book_title?: string
  chapter_number?: string
  chapter_title?: string
  chapter_title_arabic?: string
  arabic_matn?: string
  arabic_isnad?: string
  english_matn?: string
  topic?: string
  grade?: string
  preview?: string
}

type BookRecord = {
  number: number
  title: string
  title_arabic: string
  count: number
}

type EdgeRecord = {
  id: number
  teacher: number
  student: number
  terminology: string
  sequence: number
}

const PRODUCTION_API_ORIGIN = 'https://visual-isnad.onrender.com'

function resolveApiOrigin() {
  const fromEnv = String(import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/$/, '')
  if (fromEnv) return fromEnv
  if (typeof window !== 'undefined') {
    const host = window.location.hostname
    if (host === 'localhost' || host === '127.0.0.1') return ''
  }
  return PRODUCTION_API_ORIGIN
}

const API_ORIGIN = resolveApiOrigin()
const API_BASE = API_ORIGIN ? `${API_ORIGIN}/api/v1` : '/api/v1'

const dummyNarrators: Narrator[] = [
  { id: 30001, initials: 'MA', name: 'Muhammad al-Bukhari', arabic: 'محمد بن إسماعيل البخاري', era: '194–256 AH', location: 'Bukhara', role: 'Compiler', grade: 'Imam, Hafiz', born: '194 AH', died: '256 AH', description: 'A leading scholar of hadith...', birthDisplay: '194 AH', birthPlace: 'Bukhara', deathDisplay: '256 AH', deathPlace: 'Bukhara', tabaqah: '194–256 AH', tawthiq: 'Imam, Hafiz', regionRaw: 'Bukhara' },
  { id: 1, initials: 'ﷺ', name: 'Prophet Muhammad ﷺ', arabic: 'رسول الله محمد ﷺ', era: '53 BH–11 AH', location: 'Makkah · Madinah', role: 'Prophet', grade: 'Messenger of Allah', born: '53 BH', died: '11 AH', description: 'The final Messenger of Allah...', birthDisplay: '53 BH', birthPlace: 'Makkah', deathDisplay: '11 AH', deathPlace: 'Madinah', tabaqah: '53 BH–11 AH', tawthiq: 'Messenger of Allah', regionRaw: 'Makkah · Madinah' },
]

function initialsFor(name: string) {
  const cleaned = name.replace(/[ﷺ()'"]/g, ' ').trim()
  if (cleaned.toLowerCase().includes('prophet')) return 'ﷺ'
  const parts = cleaned.split(/\s+/).filter(Boolean)
  if (!parts.length) return 'NA'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
}

function roleOf(raw: { id: number; name?: string; grade?: string; tabaqah?: string }) {
  const blob = `${raw.name || ''} ${raw.grade || ''} ${raw.tabaqah || ''}`.toLowerCase()
  if (raw.id === 1 || blob.includes('rasool') || blob.includes('prophet')) return 'Prophet'
  if (blob.includes('comp.') || blob.includes('sahabi') || blob.includes('companion')) return 'Companion'
  if (raw.id === 30001 || blob.includes('compiler')) return 'Compiler'
  if (blob.includes('tabi') || blob.includes('follower') || blob.includes("taba'")) return 'Successor'
  return 'Narrator'
}

type Generation = 'prophet' | 'companion' | 'successor' | 'scholar'

const GENERATION_RANK: Record<Generation, number> = {
  prophet: 0,
  companion: 1,
  successor: 2,
  scholar: 3,
}

function deathYearAh(person: { died?: string; deathDisplay?: string }) {
  const match = `${person.died || ''} ${person.deathDisplay || ''}`.match(/(\d+)\s*AH/i)
  return match ? Number(match[1]) : null
}

function generationOf(person: Narrator, index: number, count: number): Generation {
  if (person.role === 'Prophet' || person.id === 1) return 'prophet'
  if (person.role === 'Companion') return 'companion'
  if (person.role === 'Compiler' || person.id === 30001) return 'scholar'
  if (person.role === 'Successor') return 'successor'
  const death = deathYearAh(person)
  if (death != null) {
    if (death <= 50) return 'companion'
    if (death <= 180) return 'successor'
    return 'scholar'
  }
  if (index === 0) return 'prophet'
  if (index >= count - 1) return 'scholar'
  const share = index / Math.max(1, count - 1)
  if (share < 0.28) return 'companion'
  if (share < 0.68) return 'successor'
  return 'scholar'
}

function cleanPlace(value?: string) {
  return (value || '')
    .replace(/[()[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s*,\s*/g, ', ')
    .trim()
    .replace(/^,|,$/g, '')
}

function formatPlaces(value?: string) {
  const cleaned = cleanPlace(value)
  if (!cleaned || /^na$/i.test(cleaned)) return ''
  return cleaned
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part && !/^na$/i.test(part))
    .join(', ')
}

function joinYearAndPlace(year?: string, place?: string) {
  const displayYear = (year || '').trim()
  const displayPlace = formatPlaces(place)
  if (displayYear && displayPlace) return `${displayYear}, ${displayPlace}`
  return displayYear || displayPlace || '—'
}

function previewText(value: string, wordLimit: number) {
  const text = value.trim()
  if (!text) return { preview: '', truncated: false }
  const words = text.split(/\s+/).filter(Boolean)
  if (words.length <= wordLimit) return { preview: text, truncated: false }
  return { preview: `${words.slice(0, wordLimit).join(' ')}…`, truncated: true }
}

function biographyText(value?: string) {
  const text = (value || '').trim()
  if (!text) return ''
  const looksLikeInterests = /Tafsir\/Quran|Narrator\[Grade:/.test(text) && !text.slice(0, 90).includes('.')
  if (looksLikeInterests) return ''
  const arabic = (text.match(/[\u0600-\u06FF]/g) || []).length
  const latin = (text.match(/[A-Za-z]/g) || []).length
  if (arabic >= 12 && arabic >= latin) return ''
  return text
}

function mapNarrator(raw: any): Narrator {
  const name = raw.name || raw.arabic_name || 'Unknown'
  return {
    id: raw.id,
    initials: initialsFor(name),
    name,
    arabic: raw.arabic_name || raw.name || '',
    era: raw.tabaqah || raw.grade || 'Unknown',
    location: formatPlaces(raw.region) || formatPlaces(raw.birth_place) || 'Unknown',
    role: roleOf(raw),
    grade: raw.grade || raw.tawthiq || 'Unrated',
    born: joinYearAndPlace(raw.birth_display, raw.birth_place),
    died: joinYearAndPlace(
      raw.death_display || (raw.death_year ? `${raw.death_year} AH` : ''),
      raw.death_place,
    ),
    description: biographyText(raw.biography),
    birthDisplay: raw.birth_display || '',
    birthPlace: raw.birth_place || '',
    deathDisplay: raw.death_display || (raw.death_year ? `${raw.death_year} AH` : ''),
    deathPlace: raw.death_place || '',
    tabaqah: raw.tabaqah || '',
    tawthiq: raw.tawthiq || '',
    regionRaw: raw.region || '',
  }
}

function draftFromNarrator(person: Narrator): ProfileDraft {
  return {
    name: person.name,
    arabic_name: person.arabic,
    grade: person.grade === 'Unrated' ? '' : person.grade,
    tabaqah: person.tabaqah,
    tawthiq: person.tawthiq,
    birth_display: person.birthDisplay,
    birth_place: person.birthPlace,
    death_display: person.deathDisplay,
    death_place: person.deathPlace,
    region: person.regionRaw,
    biography: person.description,
  }
}

let sessionCsrf = ''
const EDITOR_TOKEN_KEY = 'visual-isnad-editor-token'

function editorToken() {
  try {
    return sessionStorage.getItem(EDITOR_TOKEN_KEY) || ''
  } catch {
    return ''
  }
}

function storeEditorToken(token: string) {
  try {
    if (token) sessionStorage.setItem(EDITOR_TOKEN_KEY, token)
    else sessionStorage.removeItem(EDITOR_TOKEN_KEY)
  } catch {
    /* ignore private-mode storage failures */
  }
}

function csrfToken() {
  const match = document.cookie.match(/(?:^|; )csrftoken=([^;]+)/)
  if (match) return decodeURIComponent(match[1])
  return sessionCsrf
}

async function fetchJson(path: string, init?: RequestInit) {
  const method = (init?.method || 'GET').toUpperCase()
  const mutating = method !== 'GET' && method !== 'HEAD'
  const needsSession = mutating || path.startsWith('/auth/')
  const token = editorToken()
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: needsSession || !API_ORIGIN ? 'include' : 'omit',
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(mutating && csrfToken() ? { 'X-CSRFToken': csrfToken() } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  })
  if (!response.ok) {
    let detail = `${path} failed (${response.status})`
    try {
      const errorBody = await response.json()
      if (errorBody?.detail) detail = String(errorBody.detail)
    } catch {
      /* keep the status message */
    }
    throw new Error(detail)
  }
  if (response.status === 204) return null
  const data = await response.json()
  if (data && typeof data.csrfToken === 'string' && data.csrfToken) {
    sessionCsrf = data.csrfToken
    delete data.csrfToken
  }
  if (data && typeof data.token === 'string' && data.token) {
    storeEditorToken(data.token)
    delete data.token
  }
  return data
}

function unwrapList<T>(payload: any): T[] {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.results)) return payload.results
  return []
}

function orderChain(edges: EdgeRecord[]) {
  if (!edges.length) return [] as number[]
  const byStudent = new Map(edges.map((edge) => [edge.student, edge]))
  const teachers = new Set(edges.map((edge) => edge.teacher))
  const students = new Set(edges.map((edge) => edge.student))
  let current = [...students].find((id) => !teachers.has(id))
  if (current == null) {
    const first = [...edges].sort((a, b) => a.sequence - b.sequence)[0]
    current = first?.student
  }
  const compilerToSource: number[] = []
  const seen = new Set<number>()
  while (current != null && !seen.has(current)) {
    seen.add(current)
    compilerToSource.push(current)
    current = byStudent.get(current)?.teacher
  }
  return compilerToSource.reverse()
}

const TIER_BANDS: Record<Generation, { top: number; height: number }> = {
  prophet: { top: 16, height: 72 },
  companion: { top: 96, height: 72 },
  successor: { top: 176, height: 226 },
  scholar: { top: 410, height: 188 },
}

const NODE_HEIGHT = 58

function layoutPositions(people: Narrator[]) {
  const count = people.length
  if (!count) return [] as { x: number; y: number }[]

  let minRank = 0
  const tiers = people.map((person, index) => {
    const guessed = generationOf(person, index, count)
    const rank = Math.max(minRank, GENERATION_RANK[guessed])
    minRank = rank
    return (Object.keys(GENERATION_RANK) as Generation[])[rank]
  })

  const grouped = new Map<Generation, number[]>()
  tiers.forEach((tier, index) => {
    const list = grouped.get(tier) || []
    list.push(index)
    grouped.set(tier, list)
  })

  const positions = Array.from({ length: count }, () => ({ x: 345, y: 20 }))
  grouped.forEach((indexes, tier) => {
    const band = TIER_BANDS[tier]
    const innerTop = band.top + 7
    const innerBottom = band.top + band.height - 7 - NODE_HEIGHT
    const n = indexes.length
    indexes.forEach((personIndex, slot) => {
      const y = n === 1
        ? innerTop + Math.max(0, (innerBottom - innerTop) / 2)
        : innerTop + (slot * (innerBottom - innerTop)) / Math.max(1, n - 1)
      const centered = n === 1 || personIndex === 0 || personIndex === count - 1
      const offset = centered ? 0 : slot % 2 === 0 ? -150 : 150
      positions[personIndex] = { x: 345 + offset, y }
    })
  })
  return positions
}

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, React.ReactNode> = {
    branch: <><path d="M6 3v8a4 4 0 0 0 4 4h8" /><path d="m15 12 3 3-3 3" /><path d="M6 8h5a4 4 0 0 0 4-4V3" /></>,
    search: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></>,
    book: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11a2 2 0 0 1 2 2v15a2.5 2.5 0 0 0-2.5-2.5H4Z" /><path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H15a2 2 0 0 0-2 2v15a2.5 2.5 0 0 1 2.5-2.5H20Z" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4.5 21a7.5 7.5 0 0 1 15 0" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    minus: <><path d="M5 12h14" /></>,
    menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
    arrow: <><path d="M5 12h14M14 7l5 5-5 5" /></>,
    chevron: <><path d="m8 10 4 4 4-4" /></>,
  }

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  )
}

function App() {
  const [books, setBooks] = useState<BookRecord[]>([])
  const [hadithsByBook, setHadithsByBook] = useState<Record<number, HadithRecord[]>>({})
  const [expandedBook, setExpandedBook] = useState<number | null>(1)
  const [currentHadith, setCurrentHadith] = useState<HadithRecord | null>(null)
  const [narrators, setNarrators] = useState<Narrator[]>(dummyNarrators)
  const [edges, setEdges] = useState<EdgeRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [selectedHadithId, setSelectedHadithId] = useState<number | null>(null)
  const [selectedHadithNumber, setSelectedHadithNumber] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [query, setQuery] = useState('')
  const [searchHits, setSearchHits] = useState<Narrator[]>([])
  const [zoom, setZoom] = useState(100)
  const [panelOpen, setPanelOpen] = useState(() =>
    typeof window === 'undefined' ? true : window.matchMedia('(min-width: 1101px)').matches,
  )
  const [catalogOpen, setCatalogOpen] = useState(false)
  const [highlightMadar, setHighlightMadar] = useState(false)
  const [tracePath, setTracePath] = useState(false)
  const [selectedEdge, setSelectedEdge] = useState<number | null>(null)
  const [editingProfile, setEditingProfile] = useState(false)
  const [profileDraft, setProfileDraft] = useState<ProfileDraft>(draftFromNarrator(dummyNarrators[0]))
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileSaveError, setProfileSaveError] = useState('')
  const [editor, setEditor] = useState({ authenticated: false, can_edit_biographies: false, username: '', initials: '' })
  const [authOpen, setAuthOpen] = useState(false)
  const [loginUser, setLoginUser] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loginBusy, setLoginBusy] = useState(false)
  const [hadithReaderOpen, setHadithReaderOpen] = useState(false)
  const [inspectedNarrator, setInspectedNarrator] = useState<Narrator | null>(null)

  const applyChain = (payload: { narrators?: unknown; edges?: unknown }) => {
    const mapped = unwrapList<any>(payload?.narrators).map(mapNarrator)
    const chainEdges = unwrapList<EdgeRecord>(payload?.edges)
    if (!mapped.length && !chainEdges.length) return
    setNarrators(mapped.length ? mapped : dummyNarrators)
    setEdges(chainEdges)
    const ordered = orderChain(chainEdges)
    setSelectedId(ordered[Math.floor(ordered.length / 2)] ?? mapped[0]?.id ?? null)
    setSelectedEdge(null)
  }

  const loadBookHadiths = async (bookNumber: number) => {
    const payload = await fetchJson(`/hadiths/?book=${bookNumber}&compact=1&page_size=600`)
    const hadiths = unwrapList<HadithRecord>(payload)
    setHadithsByBook((current) => ({ ...current, [bookNumber]: hadiths }))
    return hadiths
  }

  const selectHadith = async (hadith: Pick<HadithRecord, 'id' | 'hadith_number'>, bookNumber?: number) => {
    setHadithReaderOpen(false)
    setCatalogOpen(false)
    setSelectedHadithId(hadith.id)
    setSelectedHadithNumber(hadith.hadith_number)
    if (bookNumber != null) setExpandedBook(bookNumber)
    try {
      const detail = await fetchJson(`/hadiths/${encodeURIComponent(hadith.hadith_number)}/?chain=1`)
      setCurrentHadith(detail)
      applyChain(detail)
      setLoadError('')
    } catch (error) {
      console.error('Hadith detail fetch error:', error)
      setLoadError('Could not load this hadith.')
    }
  }

  const toggleBook = async (bookNumber: number) => {
    if (expandedBook === bookNumber) {
      setExpandedBook(null)
      return
    }
    setExpandedBook(bookNumber)
    if (!hadithsByBook[bookNumber]) {
      try {
        await loadBookHadiths(bookNumber)
      } catch (error) {
        console.error('Book list fetch error:', error)
      }
    }
  }

  useEffect(() => {
    const loadCatalog = async () => {
      try {
        const boot = await fetchJson('/hadiths/bootstrap/')
        const bookList = Array.isArray(boot?.books) ? boot.books as BookRecord[] : []
        setBooks(bookList)
        const firstBook = bookList[0]?.number ?? 1
        setExpandedBook(firstBook)
        if (boot?.hadith) {
          setCurrentHadith(boot.hadith)
          setSelectedHadithId(boot.hadith.id)
          setSelectedHadithNumber(boot.hadith.hadith_number)
          applyChain({
            narrators: boot.narrators || boot.hadith.narrators,
            edges: boot.edges || boot.hadith.edges,
          })
          setLoadError('')
        }
        setIsLoading(false)
        void loadBookHadiths(firstBook).catch((error) => {
          console.error('Book list fetch error:', error)
        })
      } catch (error) {
        console.error('API Fetch Error:', error)
        setLoadError(
          API_ORIGIN
            ? 'Could not reach the API. Please try again later.'
            : 'Could not reach the API. Start Django on port 8000.',
        )
        setIsLoading(false)
      }
    }
    loadCatalog()
  }, [])

  useEffect(() => {
    void fetchJson('/auth/me/')
      .then((payload) => setEditor(payload))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!query.trim()) {
      setSearchHits([])
      return
    }
    const handle = window.setTimeout(async () => {
      try {
        const payload = await fetchJson(`/narrators/?search=${encodeURIComponent(query.trim())}&page_size=12`)
        setSearchHits(unwrapList<any>(payload).map(mapNarrator))
      } catch {
        setSearchHits(
          narrators.filter((item) =>
            `${item.name} ${item.arabic} ${item.location}`.toLowerCase().includes(query.toLowerCase()),
          ),
        )
      }
    }, 250)
    return () => window.clearTimeout(handle)
  }, [query, narrators])

  useEffect(() => {
    setEditingProfile(false)
    setProfileSaveError('')
  }, [selectedId])

  useEffect(() => {
    if (!editor.can_edit_biographies) setEditingProfile(false)
  }, [editor.can_edit_biographies])

  useEffect(() => {
    if (!hadithReaderOpen && !inspectedNarrator && !catalogOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (inspectedNarrator) setInspectedNarrator(null)
      else if (hadithReaderOpen) setHadithReaderOpen(false)
      else setCatalogOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [hadithReaderOpen, inspectedNarrator, catalogOpen])

  const chainIds = useMemo(() => orderChain(edges), [edges])
  const totalHadiths = books.reduce((sum, book) => sum + book.count, 0)
  const selectedBookNumber = Number(currentHadith?.in_book_reference?.match(/Book\s+(\d+)/i)?.[1] || expandedBook || 1)
  const activeBook = books.find((book) => book.number === selectedBookNumber)
  const chainNarrators = chainIds
    .map((id) => narrators.find((item) => item.id === id))
    .filter((item): item is Narrator => Boolean(item))
  const positions = layoutPositions(chainNarrators)
  const selected = narrators.find((item) => item.id === selectedId) ?? chainNarrators[0] ?? dummyNarrators[0]
  const madarId = chainNarrators[Math.floor(chainNarrators.length / 2)]?.id

  const startEditingProfile = () => {
    setProfileDraft(draftFromNarrator(selected))
    setProfileSaveError('')
    setEditingProfile(true)
  }

  const updateDraft = (field: keyof ProfileDraft, value: string) => {
    setProfileDraft((current) => ({ ...current, [field]: value }))
  }

  const saveProfile = async () => {
    if (selectedId == null) return
    setProfileSaving(true)
    setProfileSaveError('')
    try {
      const raw = await fetchJson(`/narrators/${selectedId}/`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: profileDraft.name.trim(),
          arabic_name: profileDraft.arabic_name.trim(),
          grade: profileDraft.grade.trim(),
          tabaqah: profileDraft.tabaqah.trim(),
          tawthiq: profileDraft.tawthiq.trim(),
          birth_display: profileDraft.birth_display.trim(),
          birth_place: profileDraft.birth_place.trim(),
          death_display: profileDraft.death_display.trim(),
          death_place: profileDraft.death_place.trim(),
          region: profileDraft.region.trim(),
          biography: profileDraft.biography.trim(),
        }),
      })
      const mapped = mapNarrator(raw)
      setNarrators((current) => {
        const remaining = current.filter((item) => item.id !== selectedId)
        return [...remaining, mapped]
      })
      setEditingProfile(false)
    } catch {
      setProfileSaveError('Could not save this profile. Sign in as an editor first.')
    } finally {
      setProfileSaving(false)
    }
  }

  const selectNarrator = (id: number) => {
    setSelectedId(id)
    setCatalogOpen(false)
    setPanelOpen(true)
    void (async () => {
      try {
        const raw = await fetchJson(`/narrators/${id}/`)
        const mapped = mapNarrator(raw)
        setNarrators((current) => {
          const remaining = current.filter((item) => item.id !== id)
          return [...remaining, mapped]
        })
      } catch {
        /* keep the mapped list payload if the detail request fails */
      }
    })()
  }

  const openNarratorPage = (person: Narrator) => {
    setQuery('')
    setSearchHits([])
    setInspectedNarrator(person)
    void (async () => {
      try {
        const raw = await fetchJson(`/narrators/${person.id}/`)
        setInspectedNarrator(mapNarrator(raw))
      } catch {
        /* keep the search-hit payload if the detail request fails */
      }
    })()
  }

  const edgeByPair = (teacherId: number, studentId: number) =>
    edges.find((edge) => edge.teacher === teacherId && edge.student === studentId)

  const selectedEdgeRecord = edges.find((edge) => edge.id === selectedEdge)
  const englishTitle = currentHadith
    ? (currentHadith.chapter_title || currentHadith.topic || `Hadith ${currentHadith.hadith_number}`).replace(/^Chapter:\s*/i, '')
    : isLoading
      ? 'Loading Hadiths...'
      : 'Hadith not loaded'
  const arabicTitle = (currentHadith?.chapter_title_arabic || '').trim()
  const englishMatn = currentHadith?.english_matn || ''
  const arabicText = (currentHadith?.arabic_matn || '').replace(/^["«\s]+/, '').trim()
  const arabicIsnad = (currentHadith?.arabic_isnad || '').trim()
  const englishPreview = previewText(englishMatn, 28)
  const arabicPreview = previewText(arabicText, 18)
  const hadithIsLong = englishPreview.truncated || arabicPreview.truncated

  const listPreview = (hadith: HadithRecord) => {
    if (hadith.preview) return hadith.preview
    const narrated = hadith.english_matn?.match(/^Narrated\s+([^:]+):/i)?.[1]
    if (narrated) return `Narrated ${narrated.trim()}`
    return `Hadith ${hadith.hadith_number}`
  }

  const nodeLocation = (value: string) => (value.length > 18 ? `${value.slice(0, 17)}…` : value)

  return (
    <div className="app-shell">
      <header className="topbar">
        <a
          className="brand"
          href="/"
          aria-label="Visual Isnad home"
          onClick={(event) => event.preventDefault()}
        >
          <span className="brand-mark"><span>سند</span></span>
          <span className="brand-copy">
            <strong>Visual Isnad</strong>
            <small>Trace the tradition</small>
          </span>
        </a>

        <div className="search-wrap">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search all 14,000+ narrators..."
            aria-label="Search hadiths and narrators"
          />
          <Icon name="search" size={18} />
          {query && (
            <div className="search-results">
              {searchHits.length ? searchHits.map((item) => (
                <button key={item.id} onClick={() => openNarratorPage(item)}>
                  <span className="result-avatar">{item.initials}</span>
                  <span><strong>{item.name}</strong><small>{item.location} · {item.era}</small></span>
                  <Icon name="arrow" size={15} />
                </button>
              )) : <p>No narrators found</p>}
            </div>
          )}
        </div>

        <nav className="top-actions" aria-label="Editor access">
          <div className="auth-wrap">
            <button
              className="editor-button"
              aria-label={editor.authenticated ? `Signed in as ${editor.username}` : 'Editor sign in'}
              onClick={() => {
                setAuthOpen((open) => !open)
                setLoginError('')
              }}
            >
              {editor.authenticated ? editor.username : 'Editor'}
            </button>
            {authOpen && (
              <div className="auth-menu">
                {editor.authenticated ? (
                  <>
                    <p><strong>{editor.username}</strong><small>{editor.can_edit_biographies ? 'Can edit narrator profiles' : 'Signed in'}</small></p>
                    <button
                      type="button"
                      onClick={async () => {
                        const payload = await fetchJson('/auth/logout/', { method: 'POST' })
                        storeEditorToken('')
                        setEditor(payload)
                        setEditingProfile(false)
                        setAuthOpen(false)
                      }}
                    >
                      Sign out
                    </button>
                  </>
                ) : (
                  <form
                    onSubmit={async (event) => {
                      event.preventDefault()
                      setLoginBusy(true)
                      setLoginError('')
                      try {
                        await fetchJson('/auth/me/')
                        const payload = await fetchJson('/auth/login/', {
                          method: 'POST',
                          body: JSON.stringify({ username: loginUser, password: loginPassword }),
                        })
                        setEditor(payload)
                        setLoginPassword('')
                        setAuthOpen(false)
                      } catch (error) {
                        setLoginError(
                          error instanceof Error && error.message
                            ? error.message
                            : 'Staff username and password required.',
                        )
                      } finally {
                        setLoginBusy(false)
                      }
                    }}
                  >
                    <p><strong>Editor sign in</strong><small>Only staff can edit narrator profiles.</small></p>
                    <input
                      value={loginUser}
                      onChange={(event) => setLoginUser(event.target.value)}
                      placeholder="Username"
                      autoComplete="username"
                      aria-label="Username"
                    />
                    <input
                      type="password"
                      value={loginPassword}
                      onChange={(event) => setLoginPassword(event.target.value)}
                      placeholder="Password"
                      autoComplete="current-password"
                      aria-label="Password"
                    />
                    {loginError ? <small className="auth-error">{loginError}</small> : null}
                    <button type="submit" disabled={loginBusy}>{loginBusy ? 'Signing in…' : 'Sign in'}</button>
                  </form>
                )}
              </div>
            )}
          </div>
        </nav>
      </header>

      <div className="mobile-toolbar" aria-label="Mobile navigation">
        <button
          type="button"
          className={catalogOpen ? 'active' : ''}
          onClick={() => {
            setPanelOpen(false)
            setCatalogOpen((open) => !open)
          }}
        >
          <Icon name="book" />
          <span>Books &amp; hadiths</span>
        </button>
        <button
          type="button"
          className={panelOpen ? 'active' : ''}
          onClick={() => {
            setCatalogOpen(false)
            setPanelOpen(true)
          }}
        >
          <Icon name="user" />
          <span>Narrator</span>
        </button>
      </div>

      <div className="workspace">
        <aside className={`sidebar ${catalogOpen ? 'open' : ''}`}>
          <div className="sidebar-heading">
            <p>Collection</p>
            <button
              className="sidebar-close"
              type="button"
              aria-label="Close books"
              onClick={() => setCatalogOpen(false)}
            >
              <Icon name="close" />
            </button>
          </div>
          <button className="collection-select">
            <span className="collection-icon"><Icon name="book" /></span>
            <span><strong>Sahih al-Bukhari</strong><small>{totalHadiths.toLocaleString()} narrations</small></span>
            <Icon name="chevron" size={16} />
          </button>

          <div className="chapter-label"><span>Books</span><span>{books.length || '—'}</span></div>
          <div className="book-nav">
            {books.map((book) => {
              const open = expandedBook === book.number
              const items = hadithsByBook[book.number]
              return (
                <div key={book.number} className={`book-group ${open ? 'open' : ''}`}>
                  <button
                    className={`chapter-button ${open ? 'active' : ''}`}
                    onClick={() => toggleBook(book.number)}
                    aria-expanded={open}
                  >
                    <span className="chapter-number">{String(book.number).padStart(2, '0')}</span>
                    <span>
                      <strong>{book.title}</strong>
                      <small>{book.title_arabic}</small>
                    </span>
                    <em>{book.count}</em>
                  </button>
                  {open && (
                    <div className="hadith-list">
                      {items?.map((hadith) => (
                        <button
                          key={hadith.id}
                          className={hadith.id === selectedHadithId ? 'active' : ''}
                          onClick={() => selectHadith(hadith, book.number)}
                        >
                          <span>{hadith.hadith_number}</span>
                          <div>
                            <strong>{listPreview(hadith)}</strong>
                            <small>{hadith.in_book_reference || `Book ${book.number}`}</small>
                          </div>
                        </button>
                      ))}
                      {!items && <p className="book-loading">Loading hadiths…</p>}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </aside>

        <main className="main-content">
          <section className="hadith-header">
            <div className="breadcrumb">
              <span>Sahih al-Bukhari</span><b>/</b><span>{activeBook?.title || currentHadith?.chapter_title?.replace(/^Chapter:\s*/i, '') || 'Collection'}</span><b>/</b><strong>Hadith {currentHadith?.hadith_number || '—'}</strong>
            </div>
            <div className="hadith-title-row">
              <div className="hadith-title-copy">
                <p className="eyebrow">{currentHadith?.in_book_reference || 'DATABASE RECORD'} · {currentHadith?.hadith_number || '—'}</p>
                <h1>{loadError || englishTitle}</h1>
                {arabicTitle && !loadError ? (
                  <p className="hadith-arabic-title" dir="rtl" lang="ar">{arabicTitle}</p>
                ) : null}
              </div>
            </div>

            <div className="hadith-text">
              <div className="quote-rule"><span>{currentHadith?.hadith_number || '1'}</span></div>
              <div className="translation">
                <p>
                  {isLoading
                    ? 'Loading hadiths...'
                    : (hadithIsLong ? englishPreview.preview : englishMatn) || 'English translation is not available for this record.'}
                </p>
                <button type="button" onClick={() => setHadithReaderOpen(true)} disabled={!currentHadith || isLoading}>
                  Read full hadith <Icon name="arrow" size={15} />
                </button>
              </div>
              <p className="arabic-text" lang="ar" dir="rtl">
                {isLoading ? 'Loading...' : (hadithIsLong ? arabicPreview.preview : arabicText)}
              </p>
            </div>
          </section>

          <section className="visualizer">
            <div className="visualizer-toolbar">
              <div>
                <p className="eyebrow">TRANSMISSION PATH</p>
                <h2>Chain of narration <span>{chainNarrators.length} nodes · {edges.length} transmissions</span></h2>
              </div>
              <div className="graph-actions">
                <button className={tracePath ? 'active' : ''} onClick={() => setTracePath(!tracePath)}><Icon name="branch" size={14} /> Trace path</button>
                <button className={highlightMadar ? 'active gold' : ''} onClick={() => setHighlightMadar(!highlightMadar)}><span className="radar-dot" /> Highlight Madar</button>
              </div>
            </div>

            <div className="graph-canvas">
              <div className="graph-legend">
                <span><i className="legend-path" /> Selected isnad</span>
                <span><i className="legend-madar" /> Common link (Madar)</span>
                <span><i className="legend-direction" /> Direction of transmission</span>
              </div>

              <div className="network-stage" style={{ transform: `scale(${zoom / 100})` }}>
                <svg className="network-svg" viewBox="0 0 900 620" role="img" aria-label="Directed chain of narration">
                  <defs>
                    <marker id="arrowhead" markerWidth="8" markerHeight="8" refX="5" refY="3" orient="auto">
                      <path d="M0,0 L0,6 L6,3 z" fill={tracePath ? '#2b6a5e' : '#8ca49e'} />
                    </marker>
                    <filter id="node-shadow" x="-20%" y="-20%" width="140%" height="150%">
                      <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#243c37" floodOpacity=".08" />
                    </filter>
                  </defs>

                  <g className="tier-bands">
                    <rect x="22" y="16" width="856" height="72" rx="11" className="tier-prophet" />
                    <rect x="22" y="96" width="856" height="72" rx="11" />
                    <rect x="22" y="176" width="856" height="226" rx="11" />
                    <rect x="22" y="410" width="856" height="188" rx="11" />
                    <text x="42" y="42">PROPHETIC ERA</text>
                    <text x="42" y="122">COMPANION</text>
                    <text x="42" y="202">SUCCESSORS · TĀBIʿŪN</text>
                    <text x="42" y="436">HADITH SCHOLARS</text>
                  </g>

                  <g className={`transmission-edges ${tracePath ? 'tracing' : ''}`}>
                    {chainNarrators.slice(0, -1).map((teacher, index) => {
                      const student = chainNarrators[index + 1]
                      const from = positions[index]
                      const to = positions[index + 1]
                      const edge = edgeByPair(teacher.id, student.id)
                      const startX = from.x + 105
                      const startY = from.y + 58
                      const endX = to.x + 105
                      const endY = to.y
                      const path = `M${startX} ${startY} C${startX} ${(startY + endY) / 2}, ${endX} ${(startY + endY) / 2}, ${endX} ${endY}`
                      return (
                        <g
                          key={edge?.id ?? `${teacher.id}-${student.id}`}
                          onClick={() => setSelectedEdge(edge?.id ?? null)}
                          className={selectedEdge === edge?.id ? 'selected' : ''}
                        >
                          <path className="edge-hit" d={path} />
                          <path d={path} markerEnd="url(#arrowhead)" />
                          <text x={(startX + endX) / 2 + 8} y={(startY + endY) / 2}>{edge?.terminology || 'عن'}</text>
                        </g>
                      )
                    })}
                  </g>

                  {chainNarrators.map((narrator, index) => {
                    const position = positions[index]
                    const isMadar = narrator.id === madarId
                    return (
                      <g
                        key={narrator.id}
                        className={`svg-node ${selectedId === narrator.id ? 'selected' : ''} ${isMadar && highlightMadar ? 'madar' : ''}`}
                        transform={`translate(${position.x} ${position.y})`}
                        onClick={() => selectNarrator(narrator.id)}
                        role="button"
                        tabIndex={0}
                      >
                        <rect width="210" height="58" rx="10" filter="url(#node-shadow)" />
                        <circle cx="28" cy="29" r="18" />
                        <text className="initials" x="28" y="32" textAnchor="middle">{narrator.initials}</text>
                        <text className="node-name" x="56" y="22">{narrator.name.length > 22 ? `${narrator.name.slice(0, 21)}…` : narrator.name}</text>
                        <text className="node-meta" x="56" y="38">{narrator.died.split(',')[0]} · {nodeLocation(narrator.location)}</text>
                        <rect className="role-pill" x="148" y="10" width="52" height="15" rx="4" />
                        <text className="role-text" x="174" y="20" textAnchor="middle">{narrator.role}</text>
                        {isMadar && highlightMadar && <><circle className="pulse" cx="205" cy="5" r="7" /><text className="madar-mark" x="205" y="8" textAnchor="middle">M</text></>}
                      </g>
                    )
                  })}
                </svg>
              </div>

              {selectedEdgeRecord && (
                <div className="edge-evidence">
                  <div className="evidence-icon"><Icon name="branch" /></div>
                  <div>
                    <span>TRANSMISSION EVIDENCE</span>
                    <strong>
                      {narrators.find((item) => item.id === selectedEdgeRecord.teacher)?.name}
                      {' narrated to '}
                      {narrators.find((item) => item.id === selectedEdgeRecord.student)?.name}
                    </strong>
                    <small>Hadith {currentHadith?.hadith_number} · Terminology: {selectedEdgeRecord.terminology}</small>
                  </div>
                  <button onClick={() => setSelectedEdge(null)} aria-label="Close evidence"><Icon name="close" size={15} /></button>
                </div>
              )}

              <div className="zoom-controls">
                <button onClick={() => setZoom(Math.min(110, zoom + 5))} aria-label="Zoom in"><Icon name="plus" /></button>
                <span>{zoom}%</span>
                <button onClick={() => setZoom(Math.max(85, zoom - 5))} aria-label="Zoom out"><Icon name="minus" /></button>
              </div>
              <div className="graph-hint">Drag to pan · Select a node or transmission</div>
            </div>
          </section>
        </main>

        <aside className={`detail-panel ${panelOpen ? 'open' : ''}`}>
          <div className="panel-top">
            <span>Narrator profile</span>
            <button onClick={() => setPanelOpen(false)} aria-label="Close profile"><Icon name="close" /></button>
          </div>
          {editingProfile ? (
            <form
              className="profile-edit"
              onSubmit={(event) => {
                event.preventDefault()
                void saveProfile()
              }}
            >
              <label>
                <span>English name</span>
                <input value={profileDraft.name} onChange={(event) => updateDraft('name', event.target.value)} />
              </label>
              <label>
                <span>Arabic name</span>
                <input dir="rtl" value={profileDraft.arabic_name} onChange={(event) => updateDraft('arabic_name', event.target.value)} />
              </label>
              <label>
                <span>Grade</span>
                <input value={profileDraft.grade} onChange={(event) => updateDraft('grade', event.target.value)} />
              </label>
              <label>
                <span>Generation</span>
                <input value={profileDraft.tabaqah} onChange={(event) => updateDraft('tabaqah', event.target.value)} />
              </label>
              <label>
                <span>Reliability</span>
                <input value={profileDraft.tawthiq} onChange={(event) => updateDraft('tawthiq', event.target.value)} />
              </label>
              <label>
                <span>Born</span>
                <input value={profileDraft.birth_display} onChange={(event) => updateDraft('birth_display', event.target.value)} placeholder="e.g. 194 AH" />
              </label>
              <label>
                <span>Birth place</span>
                <input value={profileDraft.birth_place} onChange={(event) => updateDraft('birth_place', event.target.value)} />
              </label>
              <label>
                <span>Died</span>
                <input value={profileDraft.death_display} onChange={(event) => updateDraft('death_display', event.target.value)} placeholder="e.g. 256 AH" />
              </label>
              <label>
                <span>Death place</span>
                <input value={profileDraft.death_place} onChange={(event) => updateDraft('death_place', event.target.value)} />
              </label>
              <label>
                <span>Region</span>
                <input value={profileDraft.region} onChange={(event) => updateDraft('region', event.target.value)} />
              </label>
              <label>
                <span>Biography</span>
                <textarea
                  className="profile-bio-editor"
                  value={profileDraft.biography}
                  onChange={(event) => updateDraft('biography', event.target.value)}
                  rows={7}
                  dir="auto"
                />
              </label>
              {profileSaveError ? <p className="profile-bio-error">{profileSaveError}</p> : null}
              <div className="profile-bio-actions">
                <button type="submit" disabled={profileSaving}>{profileSaving ? 'Saving…' : 'Save profile'}</button>
                <button type="button" onClick={() => setEditingProfile(false)} disabled={profileSaving}>Cancel</button>
              </div>
            </form>
          ) : (
            <>
              <div className="profile-intro">
                <span className="profile-avatar">{selected.initials}</span>
                <p className="profile-arabic" dir="rtl">{selected.arabic}</p>
                <h2>{selected.name}</h2>
                <div className="profile-tags"><span>{selected.role}</span><span>{selected.grade}</span></div>
              </div>

              <div className="profile-stats">
                <div><small>Born</small><strong>{selected.born}</strong></div>
                <div><small>Died</small><strong>{selected.died}</strong></div>
                <div><small>Region</small><strong>{selected.location}</strong></div>
              </div>

              <div className="profile-section">
                <h3>Biography</h3>
                <p className="profile-bio" dir="auto">
                  {selected.description || 'No biographical notes stored for this narrator yet.'}
                </p>
                {editor.can_edit_biographies ? (
                  <button type="button" onClick={startEditingProfile}>
                    Edit profile <Icon name="arrow" size={15} />
                  </button>
                ) : null}
              </div>
            </>
          )}

          <div className="profile-section relationship-grid">
            <button>
              <small>Direct teachers</small>
              <strong>{edges.filter((edge) => edge.student === selected.id).length || '—'}</strong>
              <span>In this chain</span>
            </button>
            <button>
              <small>Direct students</small>
              <strong>{edges.filter((edge) => edge.teacher === selected.id).length || '—'}</strong>
              <span>In this chain</span>
            </button>
            <button>
              <small>Chain position</small>
              <strong>{Math.max(1, chainIds.indexOf(selected.id) + 1)} / {chainIds.length || 1}</strong>
              <span>This narration</span>
            </button>
          </div>
        </aside>

        {(catalogOpen || panelOpen) && (
          <button
            type="button"
            className="mobile-overlay"
            aria-label={catalogOpen ? 'Close books' : 'Close narrator profile'}
            onClick={() => {
              setCatalogOpen(false)
              if (window.matchMedia('(max-width: 1100px)').matches) setPanelOpen(false)
            }}
          />
        )}

        {!panelOpen && (
          <button className="reopen-panel" type="button" onClick={() => setPanelOpen(true)}>
            <Icon name="user" /> Narrator profile
          </button>
        )}
      </div>

      {inspectedNarrator && (
        <div className="hadith-reader" role="dialog" aria-modal="true" aria-labelledby="narrator-reader-title">
          <button
            type="button"
            className="hadith-reader-backdrop"
            aria-label="Close narrator profile"
            onClick={() => setInspectedNarrator(null)}
          />
          <article className="hadith-reader-page narrator-reader-page">
            <header className="hadith-reader-top">
              <div className="narrator-reader-intro">
                <span className="profile-avatar">{inspectedNarrator.initials}</span>
                <p className="eyebrow">Narrator</p>
                <p className="profile-arabic" dir="rtl">{inspectedNarrator.arabic}</p>
                <h2 id="narrator-reader-title">{inspectedNarrator.name}</h2>
                <div className="profile-tags">
                  <span>{inspectedNarrator.role}</span>
                  <span>{inspectedNarrator.grade}</span>
                </div>
              </div>
              <button type="button" onClick={() => setInspectedNarrator(null)} aria-label="Close">
                <Icon name="close" />
              </button>
            </header>
            <dl className="hadith-reader-meta">
              <div><dt>Born</dt><dd>{inspectedNarrator.born}</dd></div>
              <div><dt>Died</dt><dd>{inspectedNarrator.died}</dd></div>
              <div><dt>Region</dt><dd>{inspectedNarrator.location}</dd></div>
              <div><dt>Generation</dt><dd>{inspectedNarrator.era}</dd></div>
            </dl>
            <div className="hadith-reader-body">
              <section>
                <h3>Biography</h3>
                <p dir="auto">{inspectedNarrator.description || 'No biographical notes stored for this narrator yet.'}</p>
              </section>
            </div>
          </article>
        </div>
      )}

      {hadithReaderOpen && currentHadith && (
        <div className="hadith-reader" role="dialog" aria-modal="true" aria-labelledby="hadith-reader-title">
          <button
            type="button"
            className="hadith-reader-backdrop"
            aria-label="Close full hadith"
            onClick={() => setHadithReaderOpen(false)}
          />
          <article className="hadith-reader-page">
            <header className="hadith-reader-top">
              <div>
                <p className="eyebrow">Sahih al-Bukhari</p>
                <h2 id="hadith-reader-title">{englishTitle}</h2>
                {arabicTitle ? <p className="hadith-arabic-title" dir="rtl" lang="ar">{arabicTitle}</p> : null}
              </div>
              <button type="button" onClick={() => setHadithReaderOpen(false)} aria-label="Close">
                <Icon name="close" />
              </button>
            </header>
            <dl className="hadith-reader-meta">
              <div><dt>Book</dt><dd>{activeBook ? `${activeBook.number}. ${activeBook.title}` : (currentHadith.book_title || 'Sahih al-Bukhari')}</dd></div>
              <div><dt>Reference</dt><dd>{currentHadith.in_book_reference || `Hadith ${currentHadith.hadith_number}`}</dd></div>
              <div><dt>Hadith no.</dt><dd>{currentHadith.hadith_number}</dd></div>
              {currentHadith.grade ? <div><dt>Grade</dt><dd>{currentHadith.grade}</dd></div> : null}
            </dl>
            <div className="hadith-reader-body">
              {arabicText ? (
                <section>
                  <h3>Arabic</h3>
                  <p className="arabic-text" lang="ar" dir="rtl">{arabicText}</p>
                </section>
              ) : null}
              <section>
                <h3>English</h3>
                <p>{englishMatn || 'English translation is not available for this record.'}</p>
              </section>
              {arabicIsnad && arabicIsnad !== arabicText ? (
                <section>
                  <h3>Isnad</h3>
                  <p className="arabic-text" lang="ar" dir="rtl">{arabicIsnad}</p>
                </section>
              ) : null}
            </div>
          </article>
        </div>
      )}
    </div>
  )
}

export default App
