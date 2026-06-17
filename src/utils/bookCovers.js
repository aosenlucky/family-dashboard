const normalizeText = (value = '') => value
    .toString()
    .toLowerCase()
    .replace(/[《》<>【】[\]（）()“”"'’‘:：,，.。!！?？\s-]/g, '')

const getBestImage = (imageLinks = {}) => {
    const url = imageLinks.extraLarge
        || imageLinks.large
        || imageLinks.medium
        || imageLinks.small
        || imageLinks.thumbnail
        || imageLinks.smallThumbnail

    return url ? url.replace(/^http:/, 'https:') : ''
}

const scoreGoogleVolume = (volumeInfo = {}, expectedTitle = '', expectedAuthor = '') => {
    const wantedTitle = normalizeText(expectedTitle)
    const wantedAuthor = normalizeText(expectedAuthor)
    const title = normalizeText(volumeInfo.title)
    const subtitle = normalizeText(volumeInfo.subtitle)
    const authors = normalizeText((volumeInfo.authors || []).join(' '))

    let score = 0
    if (wantedTitle && title === wantedTitle) score += 80
    else if (wantedTitle && (title.includes(wantedTitle) || wantedTitle.includes(title))) score += 45
    else if (wantedTitle && subtitle.includes(wantedTitle)) score += 15

    if (wantedAuthor && authors.includes(wantedAuthor)) score += 35
    if (volumeInfo.imageLinks) score += 20
    if (volumeInfo.industryIdentifiers?.length) score += 5

    return score
}

const fetchJson = async (url) => {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Request failed: ${res.status}`)
    return res.json()
}

const searchGoogleBooksCover = async ({ title, author, isbn }) => {
    const queries = []
    if (isbn) queries.push(`isbn:${isbn}`)
    if (title && author) queries.push(`intitle:${title} inauthor:${author}`)
    if (title) queries.push(`intitle:${title}`)
    if (title && author) queries.push(`${title} ${author}`)

    for (const q of queries) {
        const data = await fetchJson(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=8&printType=books`)
        const candidates = (data.items || [])
            .map(item => ({
                cover: getBestImage(item.volumeInfo?.imageLinks),
                score: scoreGoogleVolume(item.volumeInfo, title, author)
            }))
            .filter(item => item.cover && item.score >= 50)
            .sort((a, b) => b.score - a.score)

        if (candidates[0]) return candidates[0].cover
    }

    return ''
}

const searchOpenLibraryCover = async ({ title, author, isbn }) => {
    if (isbn) {
        const isbnData = await fetchJson(`https://openlibrary.org/isbn/${encodeURIComponent(isbn)}.json`)
        const coverId = isbnData.covers?.[0]
        if (coverId) return `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`
    }

    if (!title) return ''

    const params = new URLSearchParams({ title })
    if (author) params.set('author', author)
    params.set('limit', '8')

    const data = await fetchJson(`https://openlibrary.org/search.json?${params.toString()}`)
    const wantedTitle = normalizeText(title)
    const wantedAuthor = normalizeText(author)
    const match = (data.docs || []).find(item => {
        const itemTitle = normalizeText(item.title)
        const itemAuthors = normalizeText((item.author_name || []).join(' '))
        return item.cover_i
            && (!wantedTitle || itemTitle.includes(wantedTitle) || wantedTitle.includes(itemTitle))
            && (!wantedAuthor || itemAuthors.includes(wantedAuthor))
    }) || (data.docs || []).find(item => item.cover_i)

    return match?.cover_i ? `https://covers.openlibrary.org/b/id/${match.cover_i}-L.jpg` : ''
}

const coverStylePresets = {
    business: {
        background: ['#06162f', '#eff6ff', '#ffffff'],
        accent: '#2563eb',
        secondary: '#93c5fd',
        symbol: 'business'
    },
    literary: {
        background: ['#172033', '#d8b99a', '#f8efe4'],
        accent: '#9a5f47',
        secondary: '#f0c9a9',
        symbol: 'literary'
    },
    mystery: {
        background: ['#020617', '#1e293b', '#f1f5f9'],
        accent: '#111827',
        secondary: '#64748b',
        symbol: 'mystery'
    },
    scifi: {
        background: ['#031926', '#0f766e', '#e0f2fe'],
        accent: '#22d3ee',
        secondary: '#67e8f9',
        symbol: 'scifi'
    },
    memoir: {
        background: ['#2f1f18', '#d99b53', '#fff7ed'],
        accent: '#f59e0b',
        secondary: '#fde68a',
        symbol: 'memoir'
    },
    general: {
        background: ['#081225', '#334155', '#fff8e7'],
        accent: '#c4a36a',
        secondary: '#dbeafe',
        symbol: 'general'
    }
}

const inferCoverStyle = (title = '', author = '', explicitStyle = '') => {
    const explicit = normalizeText(explicitStyle)
    if (coverStylePresets[explicit]) return explicit

    const text = normalizeText(`${title} ${author}`)
    if (/商业|管理|增长|创业|财富|投资|原则|效率|习惯|思维|认知|领导|战略|自控|自我|成长|business|startup|growth|money|invest|atomic/.test(text)) return 'business'
    if (/悬疑|推理|谋杀|侦探|真相|嫌疑|白夜|暗黑|mystery|detective|crime|murder|thriller/.test(text)) return 'mystery'
    if (/科幻|宇宙|星球|银河|三体|基地|机器人|未来|时间|太空|scifi|sci-fi|space|future|robot/.test(text)) return 'scifi'
    if (/回忆录|自传|传记|人生|岁月|memoir|biography|autobiography/.test(text)) return 'memoir'
    if (/小说|文学|诗|散文|故事|文学史|novel|fiction|literature|poem/.test(text)) return 'literary'

    return 'general'
}

const renderCoverSymbol = (preset) => {
    const { accent, secondary, symbol } = preset
    if (symbol === 'business') {
        return `
  <g transform="translate(240 370)" opacity=".92">
    <path d="M-92 58 C-38 12, 10 -4, 78 -72" fill="none" stroke="${accent}" stroke-width="22" stroke-linecap="round"/>
    <path d="M42 -78 L92 -90 L80 -39" fill="none" stroke="${accent}" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="-98" cy="64" r="14" fill="${secondary}" opacity=".72"/>
  </g>`
    }

    if (symbol === 'literary') {
        return `
  <g transform="translate(240 380)" opacity=".88">
    <path d="M-116 -8 C-55 -82, 18 -74, 118 -22 C62 -20, 10 6, -42 72 C-78 44, -102 20, -116 -8Z" fill="${accent}" opacity=".68"/>
    <path d="M-82 36 C-34 4, 28 -6, 82 -52" fill="none" stroke="${secondary}" stroke-width="16" stroke-linecap="round" opacity=".72"/>
  </g>`
    }

    if (symbol === 'mystery') {
        return `
  <g transform="translate(240 382)">
    <ellipse cx="0" cy="86" rx="110" ry="18" fill="#020617" opacity=".28"/>
    <path d="M-34 68 C-30 20, -22 -28, 0 -58 C22 -28, 30 20, 34 68Z" fill="${accent}" opacity=".9"/>
    <circle cx="0" cy="-82" r="33" fill="#0f172a" opacity=".88"/>
    <path d="M-74 -44 C-24 -74, 24 -74, 74 -44" fill="none" stroke="${secondary}" stroke-width="10" stroke-linecap="round" opacity=".42"/>
  </g>`
    }

    if (symbol === 'scifi') {
        return `
  <g transform="translate(240 368)" opacity=".9">
    <circle cx="0" cy="0" r="76" fill="${accent}" opacity=".34"/>
    <circle cx="0" cy="0" r="50" fill="#e0f2fe" opacity=".76"/>
    <ellipse cx="0" cy="0" rx="122" ry="24" fill="none" stroke="${secondary}" stroke-width="12" opacity=".68" transform="rotate(-12)"/>
    <circle cx="104" cy="-88" r="5" fill="#ecfeff" opacity=".85"/>
    <circle cx="-132" cy="-58" r="3" fill="#ecfeff" opacity=".75"/>
  </g>`
    }

    if (symbol === 'memoir') {
        return `
  <g transform="translate(240 386)" opacity=".9">
    <circle cx="0" cy="-28" r="82" fill="${secondary}" opacity=".62"/>
    <path d="M-126 52 C-76 12, -34 12, 0 52 C34 12, 76 12, 126 52" fill="none" stroke="${accent}" stroke-width="14" stroke-linecap="round" opacity=".68"/>
    <circle cx="-92" cy="-102" r="10" fill="#fff7ed" opacity=".6"/>
    <circle cx="112" cy="-78" r="7" fill="#fff7ed" opacity=".52"/>
  </g>`
    }

    return `
  <g transform="translate(240 374)" opacity=".9">
    <circle cx="0" cy="0" r="92" fill="${accent}" opacity=".18"/>
    <path d="M0 -104 L92 0 L0 104 L-92 0Z" fill="${accent}" opacity=".64"/>
    <circle cx="0" cy="0" r="38" fill="${secondary}" opacity=".72"/>
  </g>`
}

export const createGeneratedBookCover = (title = '未知书名', author = '佚名', coverStyle = '') => {
    const styleKey = inferCoverStyle(title, author, coverStyle)
    const preset = coverStylePresets[styleKey]
    const [top, middle, bottom] = preset.background

    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="480" height="720" viewBox="0 0 480 720">
  <defs>
    <linearGradient id="bg" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0%" stop-color="${top}"/>
      <stop offset="58%" stop-color="${middle}"/>
      <stop offset="100%" stop-color="${bottom}"/>
    </linearGradient>
    <radialGradient id="paperGlow" cx="50%" cy="72%" r="62%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity=".42"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
    <filter id="grain" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="3" stitchTiles="stitch"/>
      <feColorMatrix type="saturate" values="0"/>
      <feComponentTransfer>
        <feFuncA type="table" tableValues="0 .055"/>
      </feComponentTransfer>
    </filter>
  </defs>
  <rect width="480" height="720" fill="url(#bg)"/>
  <rect width="480" height="720" fill="url(#paperGlow)"/>
  <rect width="480" height="720" fill="#ffffff" opacity=".035"/>
  <rect width="480" height="720" filter="url(#grain)" opacity=".34"/>
  <path d="M64 184 C142 160, 308 160, 416 198" fill="none" stroke="#ffffff" stroke-width="1.4" opacity=".16"/>
  ${renderCoverSymbol(preset)}
</svg>`

    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

export const getBookCoverSrc = (book = {}) => book.cover || createGeneratedBookCover(book.title, book.author, book.coverStyle)

export const useGeneratedBookCover = (event, book = {}) => {
    const fallback = createGeneratedBookCover(book.title, book.author, book.coverStyle)
    if (event.currentTarget.src !== fallback) {
        event.currentTarget.src = fallback
    }
}

export const searchBookCover = async (title, author, isbn, coverStyle) => {
    const book = {
        title: title?.trim() || '未知书名',
        author: author?.trim() || '佚名',
        isbn: isbn?.trim()
    }

    try {
        const googleCover = await searchGoogleBooksCover(book)
        if (googleCover) return googleCover
    } catch (e) {
        console.warn('Google Books cover lookup failed', e)
    }

    try {
        const openLibraryCover = await searchOpenLibraryCover(book)
        if (openLibraryCover) return openLibraryCover
    } catch (e) {
        console.warn('Open Library cover lookup failed', e)
    }

    return createGeneratedBookCover(book.title, book.author, coverStyle)
}
