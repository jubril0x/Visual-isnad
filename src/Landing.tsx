import type { MouseEvent } from 'react'

type LandingProps = {
  onExplore: () => void
}

function goExplore(event: MouseEvent<HTMLAnchorElement>, onExplore: () => void) {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return
  event.preventDefault()
  onExplore()
}

export default function Landing({ onExplore }: LandingProps) {
  return (
    <div className="landing">
      <header className="landing-nav">
        <a className="brand" href="/" aria-label="Visual Isnad home">
          <span className="brand-mark"><span>سند</span></span>
          <span className="brand-copy">
            <strong>Visual Isnad</strong>
            <small>Trace the tradition</small>
          </span>
        </a>
        <nav className="landing-links" aria-label="Page">
          <a href="#about">About</a>
          <a href="#features">Features</a>
          <a href="#narrators">Narrators</a>
          <a href="#methodology">Methodology</a>
        </nav>
        <a className="landing-cta" href="/explore" onClick={(event) => goExplore(event, onExplore)}>
          Open explorer <span aria-hidden="true">→</span>
        </a>
      </header>

      <section className="landing-hero">
        <div className="landing-hero-copy">
          <p className="landing-kicker">A new way to explore hadith</p>
          <h1>
            See the chain.<br />
            <em>Trace the tradition.</em>
          </h1>
          <p className="landing-lead">
            Explore the transmission of Sahih al-Bukhari through interactive isnad
            graphs, connecting every narrator, generation, and path in one scholarly workspace.
            More collections will join the same explorer later.
          </p>
          <div className="landing-hero-actions">
            <a className="landing-cta" href="/explore" onClick={(event) => goExplore(event, onExplore)}>
              Explore the isnad <span aria-hidden="true">→</span>
            </a>
            <a className="landing-ghost" href="#how-it-works">
              Learn how it works
            </a>
          </div>
          <div className="landing-stats">
            <div className="landing-avatars" aria-hidden="true">
              <span>MA</span><span>SU</span><span>YI</span><span>UK</span>
            </div>
            <p><strong>7,563</strong> narrations ready to explore</p>
            <p><strong>14,000+</strong> narrator profiles</p>
          </div>
        </div>

        <div className="landing-hero-stage">
          <div className="landing-product">
            <div className="landing-chrome">
              <p className="landing-chrome-title">Sahih al-Bukhari · Hadith 1</p>
            </div>
            <div className="landing-product-body">
              <div className="landing-product-head">
                <div>
                  <small>Transmission path · طريق الرواية</small>
                  <p className="landing-product-ar" lang="ar" dir="rtl">إِنَّمَا الْأَعْمَالُ بِالنِّيَّاتِ</p>
                  <strong>Actions are by intentions</strong>
                </div>
                <span>8 nodes</span>
              </div>
              <div className="landing-chain" aria-hidden="true">
                <div className="landing-band">
                  <small>Prophetic era</small>
                  <article className="landing-node landing-node-end">
                    <span>ﷺ</span>
                    <div>
                      <b>Prophet Muhammad ﷺ</b>
                      <p lang="ar" dir="rtl">رسول الله محمد ﷺ</p>
                    </div>
                  </article>
                </div>
                <div className="landing-band">
                  <small>Companions</small>
                  <article className="landing-node landing-node-start">
                    <span>UK</span>
                    <div>
                      <b>Umar ibn al-Khattab</b>
                      <p lang="ar" dir="rtl">عمر بن الخطاب</p>
                    </div>
                  </article>
                </div>
                <div className="landing-band">
                  <small>Successors</small>
                  <article className="landing-node landing-node-end">
                    <span>AQ</span>
                    <div>
                      <b>Alqamah ibn Waqqas</b>
                      <p lang="ar" dir="rtl">علقمة بن وقاص</p>
                    </div>
                  </article>
                </div>
                <div className="landing-band">
                  <small>Scholars</small>
                  <article className="landing-node landing-node-start madar">
                    <span>YI</span>
                    <div>
                      <b>Yahya ibn Saʿid</b>
                      <small>Madar</small>
                      <p lang="ar" dir="rtl">يحيى بن سعيد</p>
                    </div>
                    <em className="landing-madar-badge" aria-hidden="true">M</em>
                  </article>
                </div>
              </div>
            </div>
            <a
              className="landing-product-open"
              href="/explore"
              onClick={(event) => goExplore(event, onExplore)}
            >
              This is a preview. open the live explorer
            </a>
          </div>
        </div>
      </section>

      <section className="landing-about" id="about">
        <div>
          <p className="landing-kicker">From text to understanding</p>
          <h2>Every narration carries a <em>human chain.</em></h2>
        </div>
        <div>
          <p>
            An isnad is more than a list of names. It is a living record of knowledge moving
            across people, places, and generations.
          </p>
          <p>
            Visual Isnad turns linear transmission text into an interactive map, so scholarly
            relationships are easier to study without simplifying their meaning.
          </p>
          <a className="landing-text-link" href="/explore" onClick={(event) => goExplore(event, onExplore)}>
            Discover the platform <span aria-hidden="true">→</span>
          </a>
        </div>
      </section>

      <section className="landing-features" id="features">
        <div className="landing-features-head">
          <p className="landing-kicker">Designed for discovery</p>
          <h2>Research with clarity</h2>
          <p>
            Analytical tools presented with the care and context that sacred scholarship deserves.
          </p>
        </div>
        <div className="landing-feature-grid">
          <article className="landing-card landing-card-dark">
            <span>01</span>
            <svg className="landing-card-art" viewBox="0 0 220 90" aria-hidden="true">
              <circle cx="28" cy="48" r="12" fill="#f4efe4" />
              <circle cx="108" cy="28" r="16" fill="#d4a017" />
              <circle cx="188" cy="52" r="12" fill="#f4efe4" />
              <path d="M40 48 C70 48, 80 28, 92 28M124 28 C150 28, 160 52, 176 52" fill="none" stroke="#8fb3ab" strokeWidth="2" />
            </svg>
            <h3>Interactive isnad graphs</h3>
            <p>Follow directed transmission paths, move through generations, and select any narrator to inspect the chain.</p>
          </article>
          <article className="landing-card">
            <span>02</span>
            <div className="landing-card-chip">
              <strong>SU</strong>
              <div>
                <b>Sufyan ibn Uyaynah</b>
                <small lang="ar" dir="rtl">سفيان بن عيينة</small>
                <small>107–198 AH · Makkah</small>
              </div>
            </div>
            <h3>Rich narrator profiles</h3>
            <p>Open biographies, reliability notes, teachers, students, regions, and dates without leaving the workspace.</p>
          </article>
          <article className="landing-card">
            <span>03</span>
            <svg className="landing-card-art light" viewBox="0 0 220 90" aria-hidden="true">
              <circle cx="36" cy="46" r="11" fill="#edd8bf" />
              <circle cx="110" cy="46" r="14" fill="#c5ddd6" />
              <circle cx="184" cy="46" r="11" fill="#edd8bf" />
              <path d="M47 46 L96 46M124 46 L173 46M96 36 L124 56M96 56 L124 36" fill="none" stroke="#7fa397" strokeWidth="1.8" />
            </svg>
            <h3>Trace paths and common links</h3>
            <p>Highlight the route of a narration and surface the madar so shared links in the chain stand out.</p>
          </article>
        </div>
      </section>

      <section className="landing-narrators" id="narrators">
        <div>
          <p className="landing-kicker">Look up any narrator</p>
          <h2>Find a narrator. Read their <em>biography.</em></h2>
          <p>
            The explorer is not only a graph of chains. You can search more than 14,000 narrator
            records, open a profile, and read stored biographical notes alongside dates, places,
            generation, and reliability.
          </p>
          <ul>
            <li>
              <strong>Search by name</strong>
              <span>Type a narrator in the explorer search to jump straight to their record.</span>
            </li>
            <li>
              <strong>Open a full profile</strong>
              <span>See English and Arabic names, dates, region, and generation in one place.</span>
            </li>
            <li>
              <strong>Read the biography</strong>
              <span>Each profile can include a biography drawn from the stored scholarly notes.</span>
            </li>
          </ul>
          <a className="landing-text-link" href="/explore" onClick={(event) => goExplore(event, onExplore)}>
            Search narrators in the explorer <span aria-hidden="true">→</span>
          </a>
        </div>
        <aside className="landing-profile-preview" aria-hidden="true">
          <div className="landing-lookup">
            <span className="landing-lookup-icon">⌕</span>
            Sufyan ibn Uyaynah
          </div>
          <div className="landing-lookup-hit">
            <span>SU</span>
            <div>
              <b>Sufyan ibn Uyaynah</b>
              <small lang="ar" dir="rtl">سفيان بن عيينة</small>
            </div>
          </div>
          <article className="landing-profile-card">
            <p className="landing-kicker">Narrator profile</p>
            <p className="landing-profile-ar" lang="ar" dir="rtl">سفيان بن عيينة</p>
            <h3>Sufyan ibn Uyaynah</h3>
            <div className="landing-profile-meta">
              <div><small>Born</small><strong>107 AH</strong></div>
              <div><small>Died</small><strong>198 AH</strong></div>
              <div><small>Region</small><strong>Makkah</strong></div>
            </div>
            <h4>Biography</h4>
            <p>
              A major hadith scholar of Makkah. Open any narrator from search or from a chain
              to read their stored biography and related details.
            </p>
          </article>
        </aside>
      </section>

      <section className="landing-method" id="methodology">
        <div>
          <p className="landing-kicker">Scholarly by design</p>
          <h2>Context first. <em>Always.</em></h2>
          <p>
            Visual Isnad is an exploration and analysis tool—not an independent authority on
            hadith authenticity. Every relationship stays connected to its canonical source
            and biographical record.
          </p>
          <ol>
            <li>
              <strong>Source-preserving</strong>
              <span>Canonical Arabic text is never silently altered.</span>
            </li>
            <li>
              <strong>Transparent connections</strong>
              <span>Every edge traces back to its associated hadith record.</span>
            </li>
            <li>
              <strong>Bilingual by default</strong>
              <span>Designed for clear Arabic RTL and English LTR reading.</span>
            </li>
          </ol>
        </div>
        <aside className="landing-quote">
          <p className="landing-quote-ar" lang="ar" dir="rtl">إِنَّمَا الْأَعْمَالُ بِالنِّيَّاتِ</p>
          <p className="landing-quote-en">“Actions are judged by intentions.”</p>
          <small>Sahih al-Bukhari · Hadith 1</small>
        </aside>
      </section>

      <section className="landing-how" id="how-it-works">
        <p className="landing-kicker">Begin your exploration</p>
        <h2>Follow the chain. Discover the connection.</h2>
        <a className="landing-cta landing-cta-lg" href="/explore" onClick={(event) => goExplore(event, onExplore)}>
          Open the Visual Isnad explorer <span aria-hidden="true">→</span>
        </a>
        <p className="landing-how-note">No account required · Sahih al-Bukhari is live now · other collections coming</p>
      </section>

      <footer className="landing-footer">
        <a className="brand" href="/">
          <span className="brand-mark"><span>سند</span></span>
          <span className="brand-copy">
            <strong>Visual Isnad</strong>
            <small>Trace the tradition</small>
          </span>
        </a>
        <p>An academic visualization project for the study of hadith transmission. · مشروع لتصور أسانيد الحديث</p>
        <nav>
          <a href="#about">About</a>
          <a href="#narrators">Narrators</a>
          <a href="#methodology">Methodology</a>
          <a href="/explore" onClick={(event) => goExplore(event, onExplore)}>Explorer</a>
        </nav>
      </footer>
    </div>
  )
}
