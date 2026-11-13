# Security

## Reporting a vulnerability
Please do not open a public issue for a security problem. Use GitHub's **Report a vulnerability** button on the
repository's Security tab (private vulnerability reporting), and include what you found and how to reproduce it.

## How this project is protected
- No keys or personal details are stored in the code. They live in environment variables (`.env`, Vercel, n8n).
- Every database table has row-level security. Leads, agreements and their history cannot be deleted, and the
  rules that gate releasing an owner's contact details are enforced by the database itself.
- Dashboard access is checked on every page and every action, with short-lived sign-ins that refresh quietly.
- Public forms are cleaned on the server, rate limited, and protected against bots.
- Emailed links are single-use, expire quickly and are stored only as hashes.
