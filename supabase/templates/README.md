# Supabase auth email templates

Paste each file into Supabase → Authentication → Emails → Templates.

| Supabase template | File | Subject line |
|---|---|---|
| Confirm signup | `confirm-signup.html` | Verify your Reviewlabs email |
| Reset password | `reset-password.html` | Reset your Reviewlabs password |
| Change email address | `change-email.html` | Confirm your new Reviewlabs email |

The links go to `/auth/confirm` with a `token_hash`, so they work even when opened
on a different device or browser from the one used to sign up. `{{ .SiteURL }}` is
the Site URL in Supabase → Authentication → URL Configuration
(`https://reviewlabs.space`).

Emails go out through custom SMTP (Resend). Supabase can't set a Reply-To header,
so the footer points people to the support inbox instead.
