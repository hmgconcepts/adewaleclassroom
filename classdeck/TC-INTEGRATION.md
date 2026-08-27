# Class Deck inside Tutoring Connect

Full HMG Academy Class Deck runtime, integrated so a studio can teach live
without leaving Tutoring Connect.

## Entry points

| Who | URL |
|---|---|
| Hub | `/class-deck.html` |
| Teacher studio | `/classdeck/teach.html` |
| Meet companion | `/classdeck/teach.html?meet=1` |
| Student join | `/classdeck/join.html` |
| Stream / social live | `/classdeck/stream.html` |

Pass `?room=CODE` to join a specific room. Store the join URL on a session
row as `meeting_url` if you want it on the calendar.

No AI API. Free PeerJS / browser WebRTC as shipped by Class Deck.
