#!/usr/bin/env python3
"""Publish reels to @dreamtincode through Instagram's official API.

Setup (once, by the account owner):
  * Instagram professional account (Creator) + a Meta developer app with the Instagram product,
    permission instagram_business_content_publish (Instagram Login) or instagram_content_publish
    (Facebook Login, with the account linked to a Facebook Page).
  * Environment secrets:  IG_ACCESS_TOKEN  (long-lived token)   IG_USER_ID  (the account's numeric id)
    optional:              IG_API_HOST (default graph.instagram.com; use graph.facebook.com for Facebook Login)
                           IG_API_VERSION (default v21.0)
  * Network allowlist: graph.instagram.com, graph.facebook.com, rupload.facebook.com

Commands:
  python3 post_reel.py check                      # verify token and account, posts nothing
  python3 post_reel.py due [--dry-run]            # post today's entry from schedule.json (America/Chicago date)
  python3 post_reel.py post FILE --caption TEXT   # post one file now

Limits worth knowing: the API cannot attach Instagram's licensed/trending audio or add in-app text,
so every file in schedule.json already carries its own soundtrack and burned-in hook.
"""
import argparse, datetime, json, os, sys, time, urllib.error, urllib.parse, urllib.request
from zoneinfo import ZoneInfo

HERE = os.path.dirname(os.path.abspath(__file__))
SCHEDULE = os.path.join(HERE, "schedule.json")
HOST = os.environ.get("IG_API_HOST", "graph.instagram.com")
VER = os.environ.get("IG_API_VERSION", "v21.0")
TZ = ZoneInfo("America/Chicago")


def env(name):
    v = os.environ.get(name)
    if not v:
        sys.exit(f"missing environment variable {name} (add it as an environment secret)")
    return v


def call(method, url, params=None, data=None, headers=None):
    if params:
        url += ("&" if "?" in url else "?") + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, data=data, method=method, headers=headers or {})
    try:
        with urllib.request.urlopen(req, timeout=300) as r:
            return json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors="replace")
        sys.exit(f"{method} {url.split('?')[0]} -> HTTP {e.code}: {body}")


def api(method, path, **params):
    params["access_token"] = env("IG_ACCESS_TOKEN")
    return call(method, f"https://{HOST}/{VER}/{path}", params)


def check():
    me = api("GET", "me", fields="id,username,account_type" if HOST == "graph.instagram.com" else "id,name")
    print("token ok:", me)
    print("IG_USER_ID:", env("IG_USER_ID"))


def publish(path, caption):
    token, uid = env("IG_ACCESS_TOKEN"), env("IG_USER_ID")
    size = os.path.getsize(path)
    # 1) create a resumable REELS container
    c = api("POST", f"{uid}/media", media_type="REELS", upload_type="resumable", caption=caption, share_to_feed="true")
    cid, uri = c["id"], c.get("uri") or f"https://rupload.facebook.com/ig-api-upload/{VER}/{c['id']}"
    print("container", cid)
    # 2) upload the file bytes straight from disk
    with open(path, "rb") as fh:
        up = call("POST", uri, data=fh.read(), headers={"Authorization": f"OAuth {token}", "offset": "0", "file_size": str(size)})
    print("upload", up)
    # 3) wait for Instagram to process the video
    for _ in range(60):
        st = api("GET", cid, fields="status_code,status")
        code = st.get("status_code")
        if code == "FINISHED":
            break
        if code in ("ERROR", "EXPIRED"):
            sys.exit(f"processing failed: {st}")
        time.sleep(10)
    else:
        sys.exit("timed out waiting for processing")
    # 4) publish
    m = api("POST", f"{uid}/media_publish", creation_id=cid)
    info = api("GET", m["id"], fields="permalink,timestamp")
    print("published", m["id"], info.get("permalink"))
    return m["id"], info.get("permalink")


def due(dry):
    sched = json.load(open(SCHEDULE))
    today = datetime.datetime.now(TZ).date().isoformat()
    todo = [e for e in sched["posts"] if e["date"] == today and not e.get("posted")]
    if not todo:
        print(f"nothing scheduled for {today}")
        return
    for e in todo:
        f = os.path.join(HERE, e["file"])
        print(f"{today}: {e['title']} ({e['file']})")
        if dry:
            print("--- caption ---\n" + e["caption"] + "\n--- (dry run, not posted)")
            continue
        mid, link = publish(f, e["caption"])
        e.update(posted=datetime.datetime.now(TZ).isoformat(timespec="minutes"), media_id=mid, permalink=link)
        json.dump(sched, open(SCHEDULE, "w"), indent=2, ensure_ascii=False)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("check")
    d = sub.add_parser("due"); d.add_argument("--dry-run", action="store_true")
    p = sub.add_parser("post"); p.add_argument("file"); p.add_argument("--caption", required=True)
    a = ap.parse_args()
    if a.cmd == "check": check()
    elif a.cmd == "due": due(a.dry_run)
    else: publish(a.file, a.caption)
