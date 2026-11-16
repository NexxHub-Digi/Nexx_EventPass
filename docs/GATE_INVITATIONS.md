# Gate team onboarding
Organisers can invite **any email**, including people who are not registered yet. The POST /api/gates response returns a one-time **72-hour invitation URL**. Copy and send it privately to that recipient using a trusted channel. Automatic sending is not yet configured.
The invitee opens /invite/gate, registers/signs in with the invited email (password or Google), and explicitly accepts. Server performs a transaction: token hash, expiration, event ownership, active organiser status, recipient email match, creation of an event-scoped gate assignment, and single-use token invalidation.
Organiser may revoke the invitation and resulting gate assignment via DELETE /api/gates. Re-inviting produces a new token and invalidates the prior one. Never publish a link or place it on a public webpage.
An operator has gate permissions **only for the assigned event** and no organiser/admin rights. For security, an organiser cannot silently assign a person solely by knowing their email: invitation acceptance is required.

## Add an existing operator immediately
An organiser may choose **Add existing verified operator** for an already registered, active, Google-verified account. The backend assigns that account to the selected event only. This does not promote the account to organiser or admin. If the person is unregistered or has no verified Google identity, choose **Invite** to generate a private link they can accept using email/password or Google. Both modes are revocable.
