# Organiser Studio — Luxury Ticket Template Collection

The first design family is based on the seven STJ Masked Party references supplied in chat: five horizontal ticket designs and two portrait event posters.

## Built-in reusable designs

| Template key | Designer-facing name | Source visual cues |
|---|---|---|
| `stj-royal-gold` | Royal Gold Masquerade | Gold filigree frame, purple plumes, ornate mask, QR stub |
| `stj-velvet-crown` | Velvet Crown | Rich purple velvet, crown/gold typography, detachable stub |
| `stj-grand-gala` | Grand Gala Admission | Premium masquerade frame, gold pricing ribbon, event details |
| `stj-midnight-luxe` | Midnight Luxe | Black/plum luxe background, gold ornamentation |
| `stj-gold-script` | Gold Script Gala | Classic gold italic headline and decorative admission layout |

The poster collection adds **Masked Apartment Evening** (`stj-apartment-party`) and **Lounge Masquerade Night** (`stj-lounge-nights`), with dynamic event details and no QR. The selected poster is saved as `events.poster_template` and can appear in discovery when there is no approved uploaded cover photo.

These are **reusable SVG/CSS ticket and poster compositions** reflecting the visual language of the supplied samples, not flattened copies of the seven uploaded pictures. Organisers can also upload their own event artwork as `ticket_art`, which remains subject to Platform Admin media review.

## How it works

1. Organiser → **Create event** or select an existing unpublished event.
2. In **Ticket design collection**, choose a photo-real-inspired masquerade layout. The preview is labelled `NOT VALID FOR ENTRY`.
3. Edit **event title**, **venue**, **date/time**, **price**, **admission label** (e.g. `ADMIT ONE — MASK COMPULSORY`), and artwork. No supplied STJ text is hard-coded to other organisers' tickets.
4. Save/create. The selected key is stored in `events.ticket_theme`; the admission label is stored in `events.admission_label`.
5. The listing remains subject to Platform Admin verification. After a buyer pays and the organiser confirms funds, the backend issues tickets transactionally and snapshots both the theme and admission label in `ticket_deliveries`.
6. The User wallet renders the selected design and the **actual server-generated encrypted/signed QR** on its right-hand stub. A buyer can open **Enlarge secure entry QR** for scanning at small screen sizes. Scans are validated by the Gate API; the styled ticket does not replace the cryptographic credential.

## Safety and limitations

- The reusable preview deliberately contains **NO usable QR code**, and a clear preview watermark appears.
- A ticket's QR must never be captured in a static design and reused for other customers.
- The custom art uploader can accept the organiser's original artwork, but keep any printed/static QR from the source image out of the functional scan area.
- Five new ticket templates have been added to the platform theme catalogue and are visible to the Expo organiser theme list as well.
- The web studio has five detailed ticket compositions and two portrait promotional previews. The Expo organiser app has a compact live sample card for masquerade themes; the detailed full-layout editor is on web.
- The secure QR generator, ticket ownership, redemption/duplicate detection and organiser isolation remain server-side.
