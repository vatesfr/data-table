# Security Policy

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security vulnerabilities.

Report them privately by emailing **julien.fontanet@vates.tech**. Include as much detail as possible:
- A description of the vulnerability and its potential impact
- Steps to reproduce or a proof-of-concept
- The affected package(s) and version(s)

You can expect an acknowledgement within 48 hours and a resolution timeline within 7 days of confirmation.

## Scope

This library processes data entirely client-side and makes no network requests. The main security surface is the `render` prop (React) and `#cell-*` slots (Vue), which allow arbitrary rendering of row data — callers are responsible for sanitising any HTML they render inside those.
