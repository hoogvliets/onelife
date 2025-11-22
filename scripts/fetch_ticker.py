import feedparser
from datetime import datetime
from dateutil import parser

def fetch_guardian_ticker():
    """Fetch top headlines from The Guardian RSS feed for the ticker."""
    url = "https://www.theguardian.com/world/rss"
    try:
        feed = feedparser.parse(url)
        if feed.bozo:
            print(f"Error parsing Guardian feed: {feed.bozo_exception}")
            return []
        
        posts = []
        # Limit to top 8 headlines
        for entry in feed.entries[:8]:
            # Parse date
            published_date = None
            if hasattr(entry, 'published'):
                try:
                    dt = parser.parse(entry.published)
                    published_date = dt.isoformat()
                except:
                    published_date = datetime.now().isoformat()
            
            posts.append({
                'title': entry.title,
                'link': entry.link,
                'published': published_date
            })
        return posts
    except Exception as e:
        print(f"Failed to fetch Guardian ticker: {str(e)}")
        return []

if __name__ == "__main__":
    import json
    import os
    
    posts = fetch_guardian_ticker()
    os.makedirs('data', exist_ok=True)
    with open('data/ticker.json', 'w') as f:
        json.dump(posts, f, indent=2)
    print(f"Fetched {len(posts)} Guardian headlines for ticker.")
