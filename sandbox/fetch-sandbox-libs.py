#!/usr/bin/env python3
"""Fetch the two bionic libs proot needs, from the Termux aarch64 repo.

proot's DT_NEEDED lists libhosdlatalloc.so (= talloc) and libandroidshmem.so;
neither ships with Android nor with the harness payload. Both are extracted
next to the proot binary, which the shell router puts on LD_LIBRARY_PATH.

Idempotent: existing files are left alone unless --force is given.
"""
import hashlib, io, os, re, sys, tarfile, urllib.request

BASE = "https://packages.termux.dev/apt/termux-main/"
INDEX = "https://packages.termux.dev/apt/termux-main/dists/stable/main/binary-aarch64/Packages"
WANT = {"libtalloc": {"libtalloc.so.2.5.0": "libhosdlatalloc.so", "libtalloc.so.2": "libhosdlatalloc.so"},
        "libandroid-shmem": {"libandroid-shmem.so": "libandroidshmem.so",
                             "libandroidshmem.so": "libandroidshmem.so"}}

def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "curl/8.0"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()

def ar_members(blob):
    assert blob[:8] == b"!<arch>\n", "not an ar archive"
    off, out = 8, {}
    while off + 60 <= len(blob):
        hdr = blob[off:off + 60]
        name = hdr[0:16].decode().strip().rstrip("/")
        size = int(hdr[48:58].decode().strip())
        out[name] = blob[off + 60: off + 60 + size]
        off += 60 + size + (size % 2)
    return out

def main():
    outdir = sys.argv[1] if len(sys.argv) > 1 else "."
    force = "--force" in sys.argv
    os.makedirs(outdir, exist_ok=True)

    text = fetch(INDEX).decode("utf-8", "replace")
    pkgs = {}
    for block in text.split("\n\n"):
        m = re.search(r"^Package: (libtalloc|libandroid-shmem)$", block, re.M)
        if m:
            pkgs[m.group(1)] = dict(re.findall(r"^(Version|Filename|SHA256): (.*)$", block, re.M))

    for name, mapping in WANT.items():
        targets = set(mapping.values())
        if all(os.path.exists(os.path.join(outdir, t)) for t in targets) and not force:
            print("[have]   %s -> %s" % (name, ", ".join(sorted(targets))))
            continue
        meta = pkgs.get(name)
        if not meta:
            print("[FAIL]   %s not found in the Termux index" % name)
            continue
        blob = fetch(BASE + meta["Filename"])
        got = hashlib.sha256(blob).hexdigest()
        if got != meta["SHA256"]:
            print("[FAIL]   %s sha256 mismatch (got %s)" % (name, got))
            continue
        members = ar_members(blob)
        data_name = next(n for n in members if n.startswith("data.tar"))
        tf = tarfile.open(fileobj=io.BytesIO(members[data_name]))
        for m in tf.getmembers():
            base = os.path.basename(m.name)
            if base in mapping and m.isfile():
                data = tf.extractfile(m).read()
                dst = os.path.join(outdir, mapping[base])
                with open(dst, "wb") as f:
                    f.write(data)
                os.chmod(dst, 0o755)
                print("[ok]     %s %s -> %s (%d bytes, sha256 %s)"
                      % (name, meta["Version"], dst, len(data), hashlib.sha256(data).hexdigest()[:16]))
                break
        else:
            print("[FAIL]   %s: no known library member in the deb" % name)

main()
