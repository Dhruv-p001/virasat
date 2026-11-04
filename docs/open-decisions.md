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

Still open:

1. **Consent wording** for recording elders and storing their voice. Needed before Phase 2, because the contributor page shows it.
2. **Privacy notice and transfer clauses.** Counsel needs to review these before launch: India storage, GDPR SCCs, DPDP notice.
3. **SMS provider for phone OTP.** Pick one with good India and diaspora delivery (e.g. Twilio, MessageBird, Vonage). The founder needs to create the account.
4. **Final product name** (before launch). See brief section 12.
5. **Brief section 12 items:**
   - maximum recording length
   - extra launch languages after v1
   - cookbook pricing
6. **Native-speaker review** of the Hindi and Gujarati UI strings in `packages/i18n`.
