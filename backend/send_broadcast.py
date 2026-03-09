"""One-off broadcast email script. Run: python send_broadcast.py"""

import asyncio
import ssl
import certifi
import aiosmtplib
from email.message import EmailMessage

import os

SMTP_HOST = "smtp.gmail.com"
SMTP_PORT = 587
SMTP_USER = os.environ["SMTP_USER"]
SMTP_PASSWORD = os.environ["SMTP_PASSWORD"]
FROM = f"YorkPulse <{SMTP_USER}>"

SUBJECT = "You were one of the first 🙏"

HTML = """
<div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #333;">

  <h2 style="color: #333; margin-bottom: 4px;">Hey,</h2>

  <p style="color: #555; line-height: 1.7;">
    Just wanted to send a quick personal thank you for signing up. Seeing around 100 of you join already is genuinely amazing.
  </p>

  <p style="color: #555; line-height: 1.7;">
    I actually pushed the site live a bit earlier than expected because I just wanted to get it out there and see what you guys think.
    Since it's still super early, I'm basically updating the site based on what you actually want. If you catch any bugs, have ideas,
    or want something changed, literally just reply to this email. I read all of them.
  </p>

  <p style="color: #555; line-height: 1.7;">
    Here's where I could use a hand: YorkPulse is built 100% by students, for students. But for a community platform to actually work,
    we need the community. I am personally doing everything I can right now to build up this user base, not for me, but I genuinely
    want people to use this wherever they find it useful. If you could drop the link to your friends or classmates, it would mean a lot.
    Once we hit that critical mass, the course chats and campus connections are going to absolutely blow up. It'll be exactly what York
    needs, but we just need the numbers to get there.
  </p>

  <p style="color: #555; line-height: 1.7;">
    I was going to stick with the cold pillow line, but let's be honest, you being one of the first users is already top tier behavior.
    10/10, no notes. Massive thank you.
  </p>

  <p style="color: #555; line-height: 1.7;">
    Oh, and one more thing: as a first 100 user, you'll be getting a special badge on your profile soon. Stay tuned.
  </p>

  <p style="color: #333; font-weight: bold; margin-bottom: 2px;">YorkPulse</p>
  <a href="https://yorkpulse.com" style="color: #667eea; text-decoration: none;">yorkpulse.com</a>

  <p style="color: #999; font-size: 12px; margin-top: 12px;">
    (P.S. Don't worry, I'm not putting you on a spammy email list. Just wanted to thank you and welcome!)
  </p>

  <div style="margin-top: 28px; text-align: center;">
    <img src="https://rnqnmztvffkgozdjfjsa.supabase.co/storage/v1/object/public/avatars/broadcast/nubcat.gif"
         alt="" width="100" style="border-radius: 8px; margin: 0 8px;" />
    <img src="https://rnqnmztvffkgozdjfjsa.supabase.co/storage/v1/object/public/avatars/broadcast/meme1.jpeg"
         alt="" width="200" style="border-radius: 8px; margin: 0 8px;" />
    <img src="https://rnqnmztvffkgozdjfjsa.supabase.co/storage/v1/object/public/avatars/broadcast/meme2.jpeg"
         alt="" width="200" style="border-radius: 8px; margin: 0 8px;" />
  </div>

</div>
"""

TEXT = """Hey,

Just wanted to send a quick personal thank you for signing up. Seeing around 100 of you join already is genuinely amazing.

I actually pushed the site live a bit earlier than expected because I just wanted to get it out there and see what you guys think. Since it's still super early, I'm basically updating the site based on what you actually want. If you catch any bugs, have ideas, or want something changed, literally just reply to this email. I read all of them.

Here's where I could use a hand: YorkPulse is built 100% by students, for students. But for a community platform to actually work, we need the community. I am personally doing everything I can right now to build up this user base, not for me, but I genuinely want people to use this wherever they find it useful. If you could drop the link to your friends or classmates, it would mean a lot. Once we hit that critical mass, the course chats and campus connections are going to absolutely blow up. It'll be exactly what York needs, but we just need the numbers to get there.

I was going to stick with the cold pillow line, but let's be honest, you being one of the first users is already top tier behavior. 10/10, no notes. Massive thank you.

Oh, and one more thing: as a first 100 user, you'll be getting a special badge on your profile soon. Stay tuned.

YorkPulse
yorkpulse.com

(P.S. Don't worry, I'm not putting you on a spammy email list. Just wanted to thank you and welcome!)
"""


async def send(to: str):
    msg = EmailMessage()
    msg["Subject"] = SUBJECT
    msg["From"] = FROM
    msg["To"] = to
    msg.set_content(TEXT)
    msg.add_alternative(HTML, subtype="html")

    tls_context = ssl.create_default_context(cafile=certifi.where())
    await aiosmtplib.send(
        msg,
        hostname=SMTP_HOST,
        port=SMTP_PORT,
        username=SMTP_USER,
        password=SMTP_PASSWORD,
        start_tls=True,
        tls_context=tls_context,
    )
    print(f"✓ Sent to {to}")


async def get_all_emails() -> list[str]:
    import asyncpg
    conn = await asyncpg.connect(
        os.environ["DATABASE_URL"],
        statement_cache_size=0,
    )
    rows = await conn.fetch(
        "SELECT email FROM users WHERE email_verified = true AND is_banned = false ORDER BY created_at"
    )
    await conn.close()
    return [r["email"] for r in rows]


async def main():
    import asyncio as _asyncio
    emails = await get_all_emails()
    print(f"Sending to {len(emails)} users...")
    for i, email in enumerate(emails, 1):
        try:
            await send(email)
        except Exception as e:
            print(f"✗ Failed {email}: {e}")
        await _asyncio.sleep(0.5)  # avoid Gmail rate limits
    print("Done.")


asyncio.run(main())
