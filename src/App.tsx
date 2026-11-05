import { useEffect, useMemo, useState } from 'react'

type IconName =
  | 'branch' | 'arrow' | 'book' | 'chevron' | 'close'
  | 'layers' | 'menu' | 'minus' | 'more' | 'plus'
  | 'search' | 'share' | 'user'

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
}

type HadithRecord = {
  id: number
  hadith_number: string
  in_book_reference?: string
  book_title?: string
  chapter_title?: string
  chapter_title_arabic?: string
  arabic_matn?: string
  arabic_isnad?: string
  english_matn?: string
  topic?: string
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

const API_BASE = '/api/v1'

const dummyNarrators: Narrator[] = [
  { id: 30001, initials: 'MA', name: 'Muhammad al-Bukhari', arabic: 'محمد بن إسماعيل البخاري', era: '194–256 AH', location: 'Bukhara', role: 'Compiler', grade: 'Imam, Hafiz', born: '194 AH', died: '256 AH', description: 'A leading scholar of hadith...' },
  { id: 1, initials: 'ﷺ', name: 'Prophet Muhammad ﷺ', arabic: 'رسول الله محمد ﷺ', era: '53 BH–11 AH', location: 'Makkah · Madinah', role: 'Prophet', grade: 'Messenger of Allah', born: '53 BH', died: '11 AH', description: 'The final Messenger of Allah...' },
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
  if (blob.includes('comp.')) return 'Companion'
  if (raw.id === 30001 || blob.includes('compiler')) return 'Compiler'
  if (blob.includes('tabi') || blob.includes('follower') || blob.includes("taba'")) return 'Successor'
  return 'Narrator'
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
    description: raw.biography || raw.tags || '',
  }
}

async function fetchJson(path: string) {
  const response = await fetch(`${API_BASE}${path}`)
  if (!response.ok) throw new Error(`${path} failed (${response.status})`)
  return response.json()
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

function layoutPositions(count: number) {
  if (count <= 0) return []
  return Array.from({ length: count }, (_, index) => {
    const t = count === 1 ? 0 : index / (count - 1)
    const y = 20 + t * 500
    const offset = index === 0 || index === count - 1 ? 0 : index % 2 === 0 ? -160 : 160
    return { x: 345 + offset, y }
  })
}

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, React.ReactNode> = {
    branch: <><path d="M6 3v8a4 4 0 0 0 4 4h8" /><path d="m15 12 3 3-3 3" /><path d="M6 8h5a4 4 0 0 0 4-4V3" /></>,
    search: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></>,
    book: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11a2 2 0 0 1 2 2v15a2.5 2.5 0 0 0-2.5-2.5H4Z" /><path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H15a2 2 0 0 0-2 2v15a2.5 2.5 0 0 1 2.5-2.5H20Z" /></>,
    layers: <><path d="m12 3-9 5 9 5 9-5-9-5Z" /><path d="m3 12 9 5 9-5" /><path d="m3 16 9 5 9-5" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4.5 21a7.5 7.5 0 0 1 15 0" /></>,
    share: <><circle cx="18" cy="5" r="2" /><circle cx="6" cy="12" r="2" /><circle cx="18" cy="19" r="2" /><path d="m8 11 8-5M8 13l8 5" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    minus: <><path d="M5 12h14" /></>,
    menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
    more: <><circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" /></>,
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
  const [view, setView] = useState<'tabaqat' | 'network'>('tabaqat')
  const [zoom, setZoom] = useState(100)
  const [panelOpen, setPanelOpen] = useState(true)
  const [highlightMadar, setHighlightMadar] = useState(false)
  const [tracePath, setTracePath] = useState(false)
  const [selectedEdge, setSelectedEdge] = useState<number | null>(null)

  const loadBookHadiths = async (bookNumber: number) => {
    const payload = await fetchJson(`/hadiths/?book=${bookNumber}&compact=1&page_size=600`)
    const hadiths = unwrapList<HadithRecord>(payload)
    setHadithsByBook((current) => ({ ...current, [bookNumber]: hadiths }))
    return hadiths
  }

  const selectHadith = async (hadith: Pick<HadithRecord, 'id' | 'hadith_number'>, bookNumber?: number) => {
    setSelectedHadithId(hadith.id)
    setSelectedHadithNumber(hadith.hadith_number)
    if (bookNumber != null) setExpandedBook(bookNumber)
    try {
      const detail = await fetchJson(`/hadiths/${encodeURIComponent(hadith.hadith_number)}/`)
      setCurrentHadith(detail)
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
        const catalog = await fetchJson('/hadiths/books/')
        const bookList = Array.isArray(catalog) ? catalog as BookRecord[] : []
        setBooks(bookList)
        const firstBook = bookList[0]?.number ?? 1
        setExpandedBook(firstBook)
        const hadiths = await loadBookHadiths(firstBook)
        if (hadiths[0]) await selectHadith(hadiths[0], firstBook)
        else setLoadError('')
      } catch (error) {
        console.error('API Fetch Error:', error)
        setLoadError('Could not reach the API. Start Django on port 8000.')
      } finally {
        setIsLoading(false)
      }
    }
    loadCatalog()
  }, [])

  useEffect(() => {
    if (selectedHadithId == null) return
    const chainQuery = selectedHadithNumber
      ? `hadith_number=${encodeURIComponent(selectedHadithNumber)}`
      : `hadith_id=${selectedHadithId}`
    const loadChain = async () => {
      try {
        const [narratorPayload, edgePayload] = await Promise.all([
          fetchJson(`/narrators/?${chainQuery}`),
          fetchJson(`/edges/?${chainQuery}`),
        ])
        const mapped = unwrapList<any>(narratorPayload).map(mapNarrator)
        const chainEdges = unwrapList<EdgeRecord>(edgePayload)
        setNarrators(mapped.length ? mapped : dummyNarrators)
        setEdges(chainEdges)
        const ordered = orderChain(chainEdges)
        setSelectedId(ordered[Math.floor(ordered.length / 2)] ?? mapped[0]?.id ?? null)
        setSelectedEdge(null)
      } catch (error) {
        console.error('Chain fetch error:', error)
      }
    }
    loadChain()
  }, [selectedHadithId, selectedHadithNumber])

  useEffect(() => {
    if (!query.trim()) {
      setSearchHits([])
      return
    }
    const handle = window.setTimeout(async () => {
      try {
        const payload = await fetchJson(`/narrators/?search=${encodeURIComponent(query.trim())}`)
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

  const chainIds = useMemo(() => orderChain(edges), [edges])
  const totalHadiths = books.reduce((sum, book) => sum + book.count, 0)
  const selectedBookNumber = Number(currentHadith?.in_book_reference?.match(/Book\s+(\d+)/i)?.[1] || expandedBook || 1)
  const activeBook = books.find((book) => book.number === selectedBookNumber)
  const chainNarrators = chainIds
    .map((id) => narrators.find((item) => item.id === id))
    .filter((item): item is Narrator => Boolean(item))
  const positions = layoutPositions(chainNarrators.length)
  const selected = narrators.find((item) => item.id === selectedId) ?? chainNarrators[0] ?? dummyNarrators[0]
  const madarId = chainNarrators[Math.floor(chainNarrators.length / 2)]?.id

  const selectNarrator = (id: number) => {
    setSelectedId(id)
    setPanelOpen(true)
    setQuery('')
  }

  const edgeByPair = (teacherId: number, studentId: number) =>
    edges.find((edge) => edge.teacher === teacherId && edge.student === studentId)

  const selectedEdgeRecord = edges.find((edge) => edge.id === selectedEdge)
  const englishTitle = currentHadith
    ? (currentHadith.chapter_title || currentHadith.topic || `Hadith ${currentHadith.hadith_number}`).replace(/^Chapter:\s*/i, '')
    : isLoading
      ? 'Loading from API...'
      : 'Hadith not loaded'
  const arabicTitle = (currentHadith?.chapter_title_arabic || '').trim()
  const arabicText = (currentHadith?.arabic_matn || '').replace(/^["«\s]+/, '').trim()

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
        <a className="brand" href="#" aria-label="Visual Isnad home">
          <span className="brand-mark"><span>سند</span></span>
          <span className="brand-copy">
            <strong>Visual Isnad</strong>
            <small>Trace the tradition</small>
          </span>
        </a>

        <div className="search-wrap">
          <Icon name="search" size={19} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search all 14,000+ narrators..."
            aria-label="Search hadiths and narrators"
          />
          <kbd>⌘ K</kbd>
          {query && (
            <div className="search-results">
              {searchHits.length ? searchHits.map((item) => (
                <button key={item.id} onClick={() => selectNarrator(item.id)}>
                  <span className="result-avatar">{item.initials}</span>
                  <span><strong>{item.name}</strong><small>{item.location} · {item.era}</small></span>
                  <Icon name="arrow" size={15} />
                </button>
              )) : <p>No narrators found</p>}
            </div>
          )}
        </div>

        <nav className="top-actions" aria-label="Main navigation">
          <button><Icon name="book" /> <span>Collection</span></button>
          <button><Icon name="layers" /> <span>Methodology</span></button>
          <button className="language-button">ع <span>العربية</span></button>
          <button className="avatar-button" aria-label="Profile">AK</button>
        </nav>
      </header>

      <div className="workspace">
        <aside className="sidebar">
          <div className="sidebar-heading">
            <p>Collection</p>
            <button aria-label="Collection options"><Icon name="more" /></button>
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
              <div className="header-actions">
                <button><Icon name="share" /><span>Share</span></button>
                <button aria-label="More options"><Icon name="more" /></button>
              </div>
            </div>

            <div className="hadith-text">
              <div className="quote-rule"><span>{currentHadith?.hadith_number || '1'}</span></div>
              <div className="translation">
                <p>{isLoading ? 'Loading from API...' : (currentHadith?.english_matn || 'English translation is not available for this record.')}</p>
                <button>Read full hadith <Icon name="arrow" size={15} /></button>
              </div>
              <p className="arabic-text" lang="ar" dir="rtl">
                {isLoading ? 'Loading...' : arabicText}
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
                <button><Icon name="layers" size={14} /> Compare <b>2</b></button>
                <div className="view-toggle">
                  <button className={view === 'tabaqat' ? 'active' : ''} onClick={() => setView('tabaqat')}>Tabaqat</button>
                  <button className={view === 'network' ? 'active' : ''} onClick={() => setView('network')}>Network</button>
                </div>
              </div>
            </div>

            <div className={`graph-canvas graph-${view}`}>
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
            <p>{selected.description || 'No biographical notes stored for this narrator yet.'}</p>
            <button>View full biography <Icon name="arrow" size={15} /></button>
          </div>

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

          <div className="source-note">
            <Icon name="book" />
            <div><small>Primary source</small><strong>all_rawis + Sahih al-Bukhari</strong><span>Live records</span></div>
          </div>
        </aside>

        {!panelOpen && (
          <button className="reopen-panel" onClick={() => setPanelOpen(true)}>
            <Icon name="user" /> Narrator profile
          </button>
        )}
      </div>
    </div>
  )
}

export default App
