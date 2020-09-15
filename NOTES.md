# Notes

## Bandcamp Feed Example Response

```json
{
    "version": "https:\/\/jsonfeed.org\/version\/1",
    "title": "Foozogz - Bandcamp Band",
    "home_page_url": "https:\/\/pepperbrony.bandcamp.com\/music",
    "feed_url": "http:\/\/rss-bridge-1.herokuapp.com\/?action=display&bridge=Bandcamp&context=By+band&band=pepperbrony&type=changes&limit=200&format=Json",
    "icon": "https:\/\/s4.bcbits.com\/img\/bc_favicon.ico",
    "favicon": "https:\/\/s4.bcbits.com\/img\/bc_favicon.ico",
    "items": [
        {
            "id": "18d022f0af18efc5fdc2fc67ec993e4049c8bb9d",
            "title": "Foozogz - New Journey",
            "author": {
                "name": "Foozogz"
            },
            "url": "https:\/\/pepperbrony.bandcamp.com\/track\/new-journey",
            "content_html": "<img src='https:\/\/f4.bcbits.com\/img\/a1484399738_23.jpg' \/><br\/>Foozogz - New Journey<br\/><p>BPM: 170<\/p>",
            "attachments": [
                {
                    "url": "https:\/\/f4.bcbits.com\/img\/a1484399738_16.jpg",
                    "mime_type": "image\/jpeg"
                }
            ],
            "tags": [
                "dnb",
                "electronic",
                "idm",
                "mlp",
                "pony",
                "mission-viejo"
            ]
        }
    ]
}
```

## YouTube-DL Commands

### Albums

```bash
youtube-dl --ignore-errors --write-info-json --write-thumbnail --add-metadata --verbose --no-progress -o "rips/$ARTIST/%(playlist)s/%(playlist_index)s - %(title)s.%(ext)s" --download-archive "rips/$ARTIST/.archive.txt" >> "rips/$ARTIST/.log.txt"
```

### Tracks

```bash
youtube-dl --ignore errors --write-info-json --write-thumbnail --add-metadata --verbose --no-progress -o "rips/$ARTIST/%(title)s.%(ext)s" --download-archive "rips/$ARTIST/.archive.txt" >> "rips/$ARTIST/.log.txt"
```