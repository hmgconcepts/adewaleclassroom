# No-OBS Tablet Social Live — Practical Guide

## Goal

Stream a live ClassDeck lesson from your tablet to social media without OBS.

## Short answer

Use:

```text
ClassDeck tablet → WebRTC relay → YouTube/Facebook/Instagram/TikTok
```

This is necessary because browsers can send WebRTC, while social platforms commonly accept RTMP/RTMPS ingest.

## Teacher workflow

1. Start your class in `teach.html`.
2. Open **⚙ Settings**.
3. Tap **📡 Tablet Live**.
4. Enter your relay gateway URL.
5. Paste social platform publish URLs.
6. Choose landscape or vertical.
7. Tap **Start tablet social live**.

## Platform-specific notes

### YouTube

- Open YouTube Studio.
- Create a live stream.
- Copy the RTMP server/key.
- Paste full publish URL into ClassDeck Tablet Live.

### Facebook

- Open Facebook Live Producer.
- Use RTMPS if available.
- Copy the server/key or full URL.
- Start ClassDeck Tablet Live, then confirm Go Live in Facebook if required.

### Instagram

- Use a Professional/Creator account.
- Open Instagram Live Producer in a supported browser.
- Generate a fresh RTMPS URL/key.
- Vertical 9:16 is recommended.

### TikTok

- TikTok Live/RTMP access depends on account eligibility or Live Center access.
- Generate a stream URL/key from TikTok Live Center/Producer.
- Vertical 9:16 is recommended.

## Testing checklist

- Test with YouTube unlisted first.
- Use stable Wi-Fi.
- Plug tablet into power.
- Start ClassDeck local recording as backup.
- Keep relay health page open on another device if possible.
- Stop social live before closing the tablet browser.

## Privacy checklist

- Are students minors?
- Do you have consent to stream them publicly?
- Should student cameras be off during public stream?
- Should student names be hidden?
- Is the stream unlisted/private for school-only access?

## Troubleshooting

### Tablet says full screen capture unavailable

Use ClassDeck workspace capture. This still shows your lesson content.

### Relay not reachable

Check:

- DNS points to the server.
- Server ports 80/443/UDP 8000 are open.
- Docker services are running.
- HTTPS certificate issued successfully.

### Platform shows no signal

Check:

- Full RTMP/RTMPS URL includes stream key.
- Destination key is fresh.
- Relay controller logs.
- FFmpeg logs.

### Vertical stream looks wrong

Choose **Vertical 9:16** in Tablet Live for TikTok/Instagram.
