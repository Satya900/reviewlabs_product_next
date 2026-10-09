# Supabase auth email templates

Paste these into Supabase → Authentication → Emails → Templates.

| Template | File | Subject line |
|---|---|---|
| Magic Link | `magic-link.html` | Your Reviewlabs sign-in link |
| Confirm signup | `confirm-signup.html` | Confirm your Reviewlabs account |

Both use `{{ .ConfirmationURL }}`, which Supabase fills in. Emails go out through
custom SMTP (Resend). Supabase can't set a Reply-To header, so the footer points
people to the support inbox instead.
