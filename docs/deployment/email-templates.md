# Supabase Auth email templates

Paste each block below into **Supabase → Authentication → Emails** for the matching
template. They match the Orindle design system (`src/styles/tokens.css`): Plus Jakarta
Sans with a sans-serif fallback, `#3178fb` primary, `#171d3a` ink, `#6a6f8b` muted,
`#e6e9f2` border, `#fbfcff` canvas, 14px card radius.

Two things worth knowing before pasting:

1. **No tracking pixels, no remote images.** The wordmark is text. Remote images are
   blocked by default in most inboxes and a broken image icon at the top of a security
   email reads as a phishing attempt.
2. **Every template repeats the URL as plain text** under the button. A button that
   fails to render (or is stripped by a corporate gateway) turns the only way to confirm
   an account into a dead end.

## Which URL variable to use

Use `{{ .ConfirmationURL }}`. It is the one Supabase fills for every template, and this
app's `/auth/verify` route accepts both shapes it can contain (`?token_hash=` or
`?token=`).

`{{ .TokenHash }}` is available if you prefer to build the link yourself:

```
{{ .SiteURL }}/auth/verify?token_hash={{ .TokenHash }}&type=signup&next=/dashboard
```

That form is slightly better because it skips the auth server's own redirect hop, but
both work. `{{ .Token }}` is the raw 6-digit OTP and is **not** a link — it is only
useful if you also turn on "email OTP" sign-in.

`{{ .RedirectTo }}` is the `redirect_to` this app requested, and it is already a safe
internal URL (validated by `safeRedirectPath`). Redirecting to `{{ .ConfirmationURL }}`
and letting `/auth/verify` decide is the intended flow, so you do not need it in these
templates.

---

## 1. Confirm signup

**Subject:** `Confirm your Orindle email`

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <title>Confirm your Orindle email</title>
  </head>
  <body style="margin:0;padding:0;background:#fbfcff;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
      Confirm your email address to finish setting up your Orindle account.
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fbfcff;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#ffffff;border:1px solid #e6e9f2;border-radius:14px;">
            <tr>
              <td style="padding:28px 28px 0;">
                <span style="font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:18px;font-weight:800;letter-spacing:-0.02em;color:#171d3a;">Orindle</span>
              </td>
            </tr>
            <tr>
              <td style="padding:22px 28px 0;">
                <h1 style="margin:0;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:22px;line-height:1.3;letter-spacing:-0.02em;color:#171d3a;">Confirm your email address</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:12px 28px 0;">
                <p style="margin:0 0 12px;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:14.5px;line-height:1.65;color:#6a6f8b;">
                  Hi {{ .Data.full_name }}, confirm <strong style="color:#171d3a;">{{ .Email }}</strong> to finish setting up your Orindle account. Your 10&nbsp;GB of free storage is waiting.
                </p>
                <p style="margin:0;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:14.5px;line-height:1.65;color:#6a6f8b;">
                  This link works once and expires in 24 hours.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 28px 0;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="border-radius:10px;background:#3178fb;">
                      <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:13px 22px;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">Confirm email address</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:22px 28px 0;">
                <p style="margin:0 0 6px;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:#8b90a8;">
                  If the button doesn&rsquo;t work, copy this address into your browser:
                </p>
                <p style="margin:0;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11.5px;line-height:1.6;color:#3178fb;word-break:break-all;">
                  {{ .ConfirmationURL }}
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:26px 28px 26px;">
                <div style="border-top:1px solid #e6e9f2;padding-top:16px;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:12px;line-height:1.65;color:#6a6f8b;">
                  Didn&rsquo;t sign up? Ignore this email and nothing will happen &mdash; the address is not added to any list.<br />
                  Questions go to <a href="mailto:tejassutar.business@gmail.com" style="color:#3178fb;text-decoration:none;">tejassutar.business@gmail.com</a>.<br />
                  <span style="color:#8b90a8;">Orindle &middot; {{ .SiteURL }}</span>
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
```

---

## 2. Invite user

**Subject:** `You've been invited to Orindle`

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <title>You've been invited to Orindle</title>
  </head>
  <body style="margin:0;padding:0;background:#fbfcff;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
      You've been invited to join Orindle. Accept the invitation to set your password.
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fbfcff;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#ffffff;border:1px solid #e6e9f2;border-radius:14px;">
            <tr>
              <td style="padding:28px 28px 0;">
                <span style="font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:18px;font-weight:800;letter-spacing:-0.02em;color:#171d3a;">Orindle</span>
              </td>
            </tr>
            <tr>
              <td style="padding:22px 28px 0;">
                <h1 style="margin:0;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:22px;line-height:1.3;letter-spacing:-0.02em;color:#171d3a;">You&rsquo;ve been invited</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:12px 28px 0;">
                <p style="margin:0 0 12px;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:14.5px;line-height:1.65;color:#6a6f8b;">
                  An Orindle account has been created for <strong style="color:#171d3a;">{{ .Email }}</strong>. Accept the invitation to choose your password and sign in.
                </p>
                <p style="margin:0;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:14.5px;line-height:1.65;color:#6a6f8b;">
                  Your invitation link works once. If it has expired, ask your workspace owner to send a new one.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 28px 0;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="border-radius:10px;background:#3178fb;">
                      <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:13px 22px;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">Accept invitation</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:22px 28px 0;">
                <p style="margin:0 0 6px;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:#8b90a8;">
                  If the button doesn&rsquo;t work, copy this address into your browser:
                </p>
                <p style="margin:0;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11.5px;line-height:1.6;color:#3178fb;word-break:break-all;">
                  {{ .ConfirmationURL }}
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:26px 28px 26px;">
                <div style="border-top:1px solid #e6e9f2;padding-top:16px;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:12px;line-height:1.65;color:#6a6f8b;">
                  Weren&rsquo;t expecting this? You can ignore this email and the invitation will expire on its own.<br />
                  Questions go to <a href="mailto:tejassutar.business@gmail.com" style="color:#3178fb;text-decoration:none;">tejassutar.business@gmail.com</a>.<br />
                  <span style="color:#8b90a8;">Orindle &middot; {{ .SiteURL }}</span>
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
```

---

## 3. Change email address

**Subject:** `Confirm your new Orindle email address`

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <title>Confirm your new Orindle email address</title>
  </head>
  <body style="margin:0;padding:0;background:#fbfcff;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
      Confirm your new email address to finish changing it on your Orindle account.
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fbfcff;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#ffffff;border:1px solid #e6e9f2;border-radius:14px;">
            <tr>
              <td style="padding:28px 28px 0;">
                <span style="font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:18px;font-weight:800;letter-spacing:-0.02em;color:#171d3a;">Orindle</span>
              </td>
            </tr>
            <tr>
              <td style="padding:22px 28px 0;">
                <h1 style="margin:0;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:22px;line-height:1.3;letter-spacing:-0.02em;color:#171d3a;">Confirm your new email</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:12px 28px 0;">
                <p style="margin:0 0 12px;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:14.5px;line-height:1.65;color:#6a6f8b;">
                  A request was made to change the email address on your Orindle account to <strong style="color:#171d3a;">{{ .Email }}</strong>. Confirm it below and that becomes the address you sign in with.
                </p>
                <p style="margin:0 0 12px;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:14.5px;line-height:1.65;color:#6a6f8b;">
                  Until you confirm, your current address stays active &mdash; nothing changes on its own.
                </p>
                <p style="margin:0;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:14.5px;line-height:1.65;color:#6a6f8b;">
                  The link works once and expires in 24 hours.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 28px 0;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="border-radius:10px;background:#3178fb;">
                      <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:13px 22px;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">Confirm new email</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:22px 28px 0;">
                <p style="margin:0 0 6px;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:#8b90a8;">
                  If the button doesn&rsquo;t work, copy this address into your browser:
                </p>
                <p style="margin:0;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11.5px;line-height:1.6;color:#3178fb;word-break:break-all;">
                  {{ .ConfirmationURL }}
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:26px 28px 26px;">
                <div style="border-top:1px solid #e6e9f2;padding-top:16px;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:12px;line-height:1.65;color:#6a6f8b;">
                  If you didn&rsquo;t ask for this, don&rsquo;t confirm &mdash; and reply to this email so we can look at the account.<br />
                  Questions go to <a href="mailto:tejassutar.business@gmail.com" style="color:#3178fb;text-decoration:none;">tejassutar.business@gmail.com</a>.<br />
                  <span style="color:#8b90a8;">Orindle &middot; {{ .SiteURL }}</span>
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
```

---

## 4. Reset password

**Subject:** `Reset your Orindle password`

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <title>Reset your Orindle password</title>
  </head>
  <body style="margin:0;padding:0;background:#fbfcff;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
      Choose a new password for your Orindle account. This link expires in one hour.
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fbfcff;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#ffffff;border:1px solid #e6e9f2;border-radius:14px;">
            <tr>
              <td style="padding:28px 28px 0;">
                <span style="font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:18px;font-weight:800;letter-spacing:-0.02em;color:#171d3a;">Orindle</span>
              </td>
            </tr>
            <tr>
              <td style="padding:22px 28px 0;">
                <h1 style="margin:0;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:22px;line-height:1.3;letter-spacing:-0.02em;color:#171d3a;">Reset your password</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:12px 28px 0;">
                <p style="margin:0 0 12px;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:14.5px;line-height:1.65;color:#6a6f8b;">
                  Use the button below to choose a new password for <strong style="color:#171d3a;">{{ .Email }}</strong>.
                </p>
                <p style="margin:0;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:14.5px;line-height:1.65;color:#6a6f8b;">
                  The link works once and expires in one hour.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 28px 0;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="border-radius:10px;background:#3178fb;">
                      <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:13px 22px;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">Choose a new password</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:22px 28px 0;">
                <p style="margin:0 0 6px;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:#8b90a8;">
                  If the button doesn&rsquo;t work, copy this address into your browser:
                </p>
                <p style="margin:0;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11.5px;line-height:1.6;color:#3178fb;word-break:break-all;">
                  {{ .ConfirmationURL }}
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:26px 28px 26px;">
                <div style="border-top:1px solid #e6e9f2;padding-top:16px;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:12px;line-height:1.65;color:#6a6f8b;">
                  If you didn&rsquo;t ask for this, ignore this email &mdash; your password has not changed. If you get these repeatedly, reply and we&rsquo;ll help you secure the account.<br />
                  Questions go to <a href="mailto:tejassutar.business@gmail.com" style="color:#3178fb;text-decoration:none;">tejassutar.business@gmail.com</a>.<br />
                  <span style="color:#8b90a8;">Orindle &middot; {{ .SiteURL }}</span>
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
```

---

## One required project setting

**Authentication → URL Configuration → Redirect URLs** must include:

```
https://orindle.com/auth/verify
https://orindle.com/auth/callback
https://www.orindle.com/auth/verify
https://www.orindle.com/auth/callback
```

`/auth/verify` is the new confirmation handler; a redirect URL that is not on the
allow-list is silently replaced by the Site URL, which lands people on the marketing
page with a token in the query string and no way to use it.

The **Site URL** should be `https://orindle.com`.
