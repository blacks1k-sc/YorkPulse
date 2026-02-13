```
TASK: Debug slow API response (12+ second latency)

PROBLEM:
- Endpoint taking 12.51 seconds total
- Waiting for server response: 6.20s (backend processing)
- Content Download: 6.31s (response size or network)
- This is unacceptably slow for any API call

INVESTIGATION STEPS:

1. IDENTIFY THE ENDPOINT:
- Check which route is being called (likely /auth/verify-email or similar)
- Look at the FastAPI route handler code
- Check terminal logs for this request

2. CHECK FOR BLOCKING OPERATIONS:
Common causes of 6+ second backend delays:
- Synchronous email sending (should be async)
- Slow database queries (missing indexes, N+1 queries)
- External API calls without timeouts
- Heavy computation in request handler
- Synchronous file I/O operations

3. ANALYZE DATABASE QUERIES:
- Add SQLAlchemy query logging:
```python
# In your FastAPI app setup or database config:
import logging
logging.basicConfig()
logging.getLogger('sqlalchemy.engine').setLevel(logging.INFO)
```
- Look for slow queries in logs (queries taking >100ms)
- Check if queries are missing indexes

4. CHECK EMAIL SENDING:
If this is email verification:
- Is email sending synchronous? Should use background tasks:
```python
from fastapi import BackgroundTasks

@app.post("/auth/verify-email")
async def verify_email(background_tasks: BackgroundTasks):
    # Don't wait for email
    background_tasks.add_task(send_email, user.email)
    return {"status": "email sent"}
```

5. CHECK RESPONSE SIZE:
- Log response size in backend
- Check if you're accidentally returning huge nested objects
- Verify serialization isn't loading entire database

6. ADD TIMING LOGS:
Add instrumentation to narrow down bottleneck:
```python
import time

@app.post("/auth/verify-email")
async def verify_email():
    start = time.time()
    
    # Database operation
    t1 = time.time()
    user = await get_user(email)
    print(f"DB query took: {time.time() - t1}s")
    
    # Email sending
    t2 = time.time()
    await send_email(user.email)
    print(f"Email send took: {time.time() - t2}s")
    
    print(f"Total handler time: {time.time() - start}s")
    return response
```

DELIVERABLES:
1. Identify which endpoint is slow (check Network tab Headers → Request URL)
2. Add timing logs to that endpoint
3. Enable SQLAlchemy query logging
4. Run the request again and share terminal output
5. Check for:
   - Slow database queries
   - Synchronous email/external API calls
   - Large response payloads
   - Missing async/await keywords
6. Provide fix recommendations with code changes

TECH CONTEXT:
- Backend: FastAPI with async SQLAlchemy
- Database: Supabase (PostgreSQL)
- This is localhost development environment

Focus on finding the exact bottleneck - 6 seconds is likely ONE blocking operation.
```