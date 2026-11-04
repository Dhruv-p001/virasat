# Open decisions

Decided on 2026-11-03 and recorded in ADR 0004 and ADR 0005:

- media linkage
- the correction chain
- cross-vault handover (schema now, UI in v2)
- hard delete on consent withdrawal
- web-first v1
- audience and style
- sign-in
- data region (India)
- working name

Decided on 2026-11-04:

- **Consent wording `2026-11-v1`** (`docs/consent.md`). Approved by the founder. Legal and native-speaker review is still open (items 1 and 5).
- **Maximum recording length: 10 minutes** (`MAX_RECORDING_SECONDS`).

Still open:

1. **Legal review before launch.** Counsel needs to review:
   - the consent wording (`docs/consent.md`)
   - the privacy notice
   - the transfer clauses: India storage, GDPR SCCs, DPDP notice
2. **SMS provider for phone OTP.** Pick one with good India and diaspora delivery that handles India's DLT template registration (e.g. Twilio Verify, MessageBird, Vonage). The founder creates the account.
3. **Email provider for sign-in (custom SMTP)**, plus a sending domain with SPF, DKIM and DMARC. Options: Postmark (recommended), Amazon SES in Mumbai, Resend. Supabase's built-in sender is for development only.
4. **Final product name** (before launch). See brief section 12.
5. **Native-speaker review** of the Hindi and Gujarati strings in `packages/i18n`, including the consent wording.
6. **Brief section 12:** extra launch languages after v1, and cookbook pricing.
