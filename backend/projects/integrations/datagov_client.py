import time
import requests

BASE_URL = "https://api.data.gov.in/resource"

def fetch_resource(resource_id, api_key, limit=100, offset=0, retries=3, backoff=2, timeout=45):
    """Fetch one page of records from a data.gov.in resource.
    Retries on transient failures — the public API occasionally returns
    502/503/504, or simply takes too long to respond, even when the
    request itself is valid."""
    params = {"api-key": api_key, "format": "json", "limit": limit, "offset": offset}

    last_error = None
    for attempt in range(retries):
        try:
            resp = requests.get(f"{BASE_URL}/{resource_id}", params=params, timeout=timeout)
            resp.raise_for_status()
            return resp.json()
        except requests.exceptions.HTTPError as e:
            last_error = e
            if resp.status_code in (502, 503, 504):
                time.sleep(backoff * (attempt + 1))  # 2s, 4s, 6s
                continue
            raise  # non-transient error (e.g. 401 bad key, 404 bad resource id) — fail immediately
        except (requests.exceptions.Timeout, requests.exceptions.ConnectionError) as e:
            # the API just didn't respond in time, or the connection dropped —
            # also transient, also worth retrying
            last_error = e
            time.sleep(backoff * (attempt + 1))
            continue
    raise last_error

def fetch_all_records(resource_id, api_key, page_size=100, max_pages=50):
    """Paginate through a resource and return every record."""
    all_records = []
    for page in range(max_pages):
        data = fetch_resource(resource_id, api_key, limit=page_size, offset=page * page_size)
        records = data.get("records", [])
        if not records:
            break
        all_records.extend(records)
        if len(records) < page_size:
            break
    return all_records