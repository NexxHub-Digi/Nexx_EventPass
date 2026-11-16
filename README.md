# Nexx EventPass

Web / Android / iOS event-ticketing and QR-based entry-verification platform — **UI/UX prototype**.

## Current state

This repository currently includes a self-contained, responsive HTML/CSS/JavaScript design prototype. It is **not** a deployed ticketing backend or secure operational gate scanner. QR visuals are illustrative, payment flows are mockups, and verification outcomes are UI simulations. Do not use this prototype for real-money event ticketing or access decisions.

## Run locally

Open `index.html` in a browser, or serve it:

```bash
python3 -m http.server 3000
```

Then open <http://localhost:3000>.

## Screens and flows

- Public events, guest discovery, event detail and ticket selection
- Organiser dashboard, event setup, ticket inventory and ticket designer
- Guest checkout preview and QR ticket wallet
- Staff gate scanner and approval / duplicate / invalid result states
- Ticket lifecycle, role-based access and handoff diagrams

## Production implementation plan

- `apps/web`: Next.js public site and organiser portal
- `apps/mobile`: Expo / React Native (Android and iOS)
- `packages/shared`: shared schemas and role definitions
- Supabase PostgreSQL with row-level security and audited API operations
- Signed, expiring or event-scoped QR credentials; issue only after confirmed payment or authorized complimentary issuance
- **Atomic** database redemption so concurrent scans cannot both admit the same ticket
- Verified payments, organiser roles, gate assignments, audit and revocation logs
- Integration and security tests before production launch

## Design source

[Figma design](https://www.figma.com/design/hIcS4ec1F0tX2BIkttaec0) — initial editable screens.

## Security

Never trust a locally decoded QR payload as admission authorization. The backend must validate the ticket signature and atomically mark first-use redemption. Avoid placing unnecessary guest personal data in QR codes.

## License

Copyright Nexx EventPass. License to be selected by the project owner.
