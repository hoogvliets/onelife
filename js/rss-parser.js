// RSS/Atom Feed Parser Module
// Parses RSS 2.0 and Atom feeds into standardized JSON format

/**
 * Main entry point - detects feed type and parses accordingly
 * @param {string} xmlString - Raw XML feed content
 * @param {string} feedUrl - Source URL of the feed
 * @returns {Array} - Array of parsed feed items
 */
function parseRSSFeed(xmlString, feedUrl) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, 'text/xml');

    // Check for XML parsing errors
    const parserError = doc.querySelector('parsererror');
    if (parserError) {
        console.error('XML parsing failed for', feedUrl);
        throw new Error('XML parsing failed');
    }

    // Detect feed type
    const isAtom = doc.querySelector('feed') !== null;
    const isRSS = doc.querySelector('rss') !== null || doc.querySelector('channel') !== null;

    if (isAtom) {
        return parseAtomFeed(doc, feedUrl);
    } else if (isRSS) {
        return parseRSS2Feed(doc, feedUrl);
    } else {
        console.error('Unknown feed format for', feedUrl);
        throw new Error('Unknown feed format');
    }
}

/**
 * Parse RSS 2.0 feed format
 * @param {Document} doc - Parsed XML document
 * @param {string} feedUrl - Source URL
 * @returns {Array} - Normalized feed items
 */
function parseRSS2Feed(doc, feedUrl) {
    const channel = doc.querySelector('channel');
    if (!channel) {
        console.error('No channel element found in RSS feed');
        return [];
    }

    const sourceName = getTextContent(channel, 'title') || extractDomain(feedUrl);
    const items = Array.from(doc.querySelectorAll('item'));

    console.log(`Parsing RSS 2.0 feed: ${sourceName} (${items.length} items)`);

    return items.map(item => {
        const title = getTextContent(item, 'title') || 'Untitled';
        const link = getTextContent(item, 'link') || feedUrl;
        const summary = getTextContent(item, 'description') || getTextContent(item, 'content:encoded') || '';

        // Author priority: author > dc:creator > feed title
        const author = getTextContent(item, 'author') ||
            getTextContent(item, 'dc\\:creator') ||
            sourceName;

        // Date priority: pubDate > dc:date > current
        const pubDate = getTextContent(item, 'pubDate') ||
            getTextContent(item, 'dc\\:date');

        // Tags/categories
        const tags = Array.from(item.querySelectorAll('category'))
            .map(cat => cat.textContent.trim())
            .filter(tag => tag);

        // ID priority: guid > link
        const id = getTextContent(item, 'guid') || link;

        return {
            title: title,
            link: link,
            summary: summary,
            author: author,
            source: sourceName,
            published: parseDateToISO(pubDate),
            image: extractImageFromRSSItem(item),
            tags: tags,
            id: id
        };
    });
}

/**
 * Parse Atom feed format
 * @param {Document} doc - Parsed XML document
 * @param {string} feedUrl - Source URL
 * @returns {Array} - Normalized feed items
 */
function parseAtomFeed(doc, feedUrl) {
    const feed = doc.querySelector('feed');
    if (!feed) {
        console.error('No feed element found in Atom feed');
        return [];
    }

    const sourceName = getTextContent(feed, 'title') || extractDomain(feedUrl);
    const entries = Array.from(doc.querySelectorAll('entry'));

    console.log(`Parsing Atom feed: ${sourceName} (${entries.length} entries)`);

    return entries.map(entry => {
        const title = getTextContent(entry, 'title') || 'Untitled';

        // Atom uses <link rel="alternate" href="..."/>
        const linkEl = entry.querySelector('link[rel="alternate"]') ||
            entry.querySelector('link');
        const link = linkEl ? linkEl.getAttribute('href') : feedUrl;

        // Content priority: content > summary
        const summary = getTextContent(entry, 'content') ||
            getTextContent(entry, 'summary') || '';

        // Author
        const author = getTextContent(entry, 'author > name') || sourceName;

        // Date priority: published > updated
        const dateString = getTextContent(entry, 'published') ||
            getTextContent(entry, 'updated');

        // Categories
        const tags = Array.from(entry.querySelectorAll('category'))
            .map(cat => cat.getAttribute('term'))
            .filter(tag => tag);

        // ID
        const id = getTextContent(entry, 'id') || link;

        return {
            title: title,
            link: link,
            summary: summary,
            author: author,
            source: sourceName,
            published: parseDateToISO(dateString),
            image: extractImageFromAtomEntry(entry),
            tags: tags,
            id: id
        };
    });
}

/**
 * Extract image URL from RSS 2.0 item
 * Priority: media:content > media:thumbnail > enclosure > description HTML
 * @param {Element} item - RSS item element
 * @returns {string|null} - Image URL or null
 */
function extractImageFromRSSItem(item) {
    // 1. media:content (RSS Media extension)
    let mediaContent = item.querySelector('media\\:content[medium="image"]') ||
        item.querySelector('media\\:content');
    if (mediaContent) {
        const url = mediaContent.getAttribute('url');
        if (url) return url;
    }

    // 2. media:thumbnail
    let mediaThumbnail = item.querySelector('media\\:thumbnail');
    if (mediaThumbnail) {
        const url = mediaThumbnail.getAttribute('url');
        if (url) return url;
    }

    // 3. enclosure with image type
    let enclosure = item.querySelector('enclosure[type^="image"]');
    if (enclosure) {
        const url = enclosure.getAttribute('url');
        if (url) return url;
    }

    // 4. Parse description/content HTML for img tags
    const description = getTextContent(item, 'description') ||
        getTextContent(item, 'content:encoded');
    if (description) {
        const imgMatch = description.match(/<img[^>]+src=["']([^"'>]+)["']/i);
        if (imgMatch && imgMatch[1]) return imgMatch[1];
    }

    return null;
}

/**
 * Extract image URL from Atom entry
 * @param {Element} entry - Atom entry element
 * @returns {string|null} - Image URL or null
 */
function extractImageFromAtomEntry(entry) {
    // 1. link rel="enclosure" with image type
    let enclosure = entry.querySelector('link[rel="enclosure"][type^="image"]');
    if (enclosure) {
        const href = enclosure.getAttribute('href');
        if (href) return href;
    }

    // 2. Parse content/summary HTML for img tags
    const content = getTextContent(entry, 'content') ||
        getTextContent(entry, 'summary');
    if (content) {
        const imgMatch = content.match(/<img[^>]+src=["']([^"'>]+)["']/i);
        if (imgMatch && imgMatch[1]) return imgMatch[1];
    }

    return null;
}

/**
 * Get text content from element using CSS selector
 * @param {Element} element - Parent element
 * @param {string} selector - CSS selector
 * @returns {string|null} - Text content or null
 */
function getTextContent(element, selector) {
    const el = element.querySelector(selector);
    return el ? el.textContent.trim() : null;
}

/**
 * Parse date string to ISO 8601 format
 * Handles RFC 822 (RSS 2.0) and ISO 8601 (Atom) formats
 * @param {string} dateString - Date string from feed
 * @returns {string} - ISO 8601 formatted date
 */
function parseDateToISO(dateString) {
    if (!dateString) {
        return new Date().toISOString();
    }

    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) {
            console.warn('Invalid date:', dateString);
            return new Date().toISOString();
        }
        return date.toISOString();
    } catch (error) {
        console.warn('Date parsing failed:', dateString, error);
        return new Date().toISOString();
    }
}

/**
 * Extract domain name from URL
 * @param {string} url - Full URL
 * @returns {string} - Domain name without www
 */
function extractDomain(url) {
    try {
        const urlObj = new URL(url);
        return urlObj.hostname.replace('www.', '');
    } catch (error) {
        console.warn('Invalid URL:', url);
        return 'Unknown';
    }
}
