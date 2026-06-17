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

export const createGeneratedBookCover = (title = '未知书名', author = '佚名') => {
    const safeTitle = title.toString().trim() || '未知书名'
    const safeAuthor = author.toString().trim() || '佚名'
    const shortTitle = safeTitle.length > 16 ? `${safeTitle.slice(0, 16)}...` : safeTitle
    const shortAuthor = safeAuthor.length > 18 ? `${safeAuthor.slice(0, 18)}...` : safeAuthor
    const initials = safeTitle.replace(/[《》\s]/g, '').slice(0, 2) || '书'

    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="480" height="720" viewBox="0 0 480 720">
  <defs>
    <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="#f8fafc"/>
      <stop offset="46%" stop-color="#dbeafe"/>
      <stop offset="100%" stop-color="#f5d0fe"/>
    </linearGradient>
    <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="18"/>
    </filter>
  </defs>
  <rect width="480" height="720" rx="42" fill="url(#bg)"/>
  <circle cx="360" cy="128" r="92" fill="#ffffff" opacity=".68" filter="url(#soft)"/>
  <circle cx="114" cy="548" r="118" fill="#ffffff" opacity=".46" filter="url(#soft)"/>
  <rect x="54" y="58" width="372" height="604" rx="32" fill="#ffffff" opacity=".42" stroke="#ffffff" stroke-width="2"/>
  <path d="M176 196c0-34 24-58 64-58s64 24 64 58v208c0 14-12 22-24 14l-40-25-40 25c-12 8-24 0-24-14V196z" fill="#111827" opacity=".82"/>
  <text x="240" y="495" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" font-size="42" font-weight="700" fill="#111827">${escapeSvg(initials)}</text>
  <text x="240" y="554" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" font-size="28" font-weight="700" fill="#111827">${escapeSvg(shortTitle)}</text>
  <text x="240" y="596" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" font-size="18" font-weight="500" fill="#64748b">${escapeSvg(shortAuthor)}</text>
</svg>`

    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

export const getBookCoverSrc = (book = {}) => book.cover || createGeneratedBookCover(book.title, book.author)

export const useGeneratedBookCover = (event, book = {}) => {
    const fallback = createGeneratedBookCover(book.title, book.author)
    if (event.currentTarget.src !== fallback) {
        event.currentTarget.src = fallback
    }
}

export const searchBookCover = async (title, author, isbn) => {
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

    return createGeneratedBookCover(book.title, book.author)
}

function escapeSvg(value = '') {
    return value
        .toString()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}
