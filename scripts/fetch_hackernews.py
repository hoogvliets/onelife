import feedparser
from datetime import datetime
from dateutil import parser

def fetch_hackernews():
    url = "https://news.ycombinator.com/rss"
    try:
        feed = feedparser.parse(url)
        posts = []
        for entry in feed.entries[:20]: # Top 20 posts
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
                'source': 'Hacker News',
                'published': published_date,
                'author': 'Hacker News', # HN RSS doesn't always provide author in a clean way
                'summary': entry.summary if hasattr(entry, 'summary') else ''
            })
        return posts
    except Exception as e:
        print(f"Failed to fetch Hacker News: {str(e)}")
        return []

if __name__ == "__main__":
    import json
    import os
    
    posts = fetch_hackernews()
    os.makedirs('data', exist_ok=True)
    with open('data/raw_hackernews.json', 'w') as f:
        json.dump(posts, f, indent=2)
    print(f"Fetched {len(posts)} HN posts.")
