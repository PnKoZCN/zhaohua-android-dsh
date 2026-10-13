#!/usr/bin/env python3
"""Hardlink-tolerant tar.gz extractor for the ZhaoHua proot sandbox.

Why: this device's /data (f2fs, inline_data) and /sdcard (FUSE) both reject
link(2) with EPERM, so GNU tar cannot lay down an Alpine minirootfs
(busybox applets + apk keys are hardlinks). This extractor parses the tar
stream itself and turns every hardlink into an independent copy of the
already-extracted target.

Usage: zh-extract.py <rootfs.tar.gz> <dest-dir>
"""
import os
import shutil
import stat
import sys
import tarfile
import time

COPY_CHUNK = 1 << 20


def safe_target(root, name):
    rel = name.lstrip("./")
    if not rel or rel == ".":
        return None
    dest = os.path.join(root, rel)
    if os.path.commonpath([os.path.abspath(root), os.path.abspath(dest)]) != os.path.abspath(root):
        raise RuntimeError("path escapes root: %s" % name)
    return dest


def extract(tar_path, root):
    os.makedirs(root, exist_ok=True)
    stats = {"dir": 0, "file": 0, "symlink": 0, "hardlink_copy": 0, "skipped": 0}
    tf = tarfile.open(tar_path, "r:gz")
    try:
        for m in tf:
            try:
                dest = safe_target(root, m.name)
                if dest is None:
                    stats["skipped"] += 1
                    continue

                if m.isdir():
                    os.makedirs(dest, exist_ok=True)
                    stats["dir"] += 1
                elif m.issym():
                    os.makedirs(os.path.dirname(dest), exist_ok=True)
                    if os.path.lexists(dest):
                        os.remove(dest) if not os.path.isdir(dest) else shutil.rmtree(dest)
                    os.symlink(m.linkname, dest)
                    stats["symlink"] += 1
                elif m.islnk():
                    os.makedirs(os.path.dirname(dest), exist_ok=True)
                    src = safe_target(root, m.linkname)
                    if os.path.lexists(dest):
                        if os.path.isdir(dest) and not os.path.islink(dest):
                            shutil.rmtree(dest)
                        else:
                            os.remove(dest)
                    if src and os.path.exists(src) and not os.path.islink(src):
                        shutil.copyfile(src, dest)
                        stats["hardlink_copy"] += 1
                    else:
                        # target not yet on disk -> defer by extracting its member
                        stats["skipped"] += 1
                elif m.isfile():
                    os.makedirs(os.path.dirname(dest), exist_ok=True)
                    if os.path.lexists(dest):
                        if os.path.isdir(dest) and not os.path.islink(dest):
                            shutil.rmtree(dest)
                        else:
                            os.remove(dest)
                    with tf.extractfile(m) as fin, open(dest, "wb") as fout:
                        shutil.copyfileobj(fin, fout, COPY_CHUNK)
                    os.chmod(dest, stat.S_IMODE(m.mode))
                    if m.mtime:
                        try:
                            os.utime(dest, (m.mtime, m.mtime))
                        except OSError:
                            pass
                    stats["file"] += 1
                else:  # char/block/fifo -> not usable without root
                    stats["skipped"] += 1
            except Exception as e:  # noqa: BLE001 - report and keep going
                sys.stderr.write("WARN %s: %s\n" % (m.name, e))
    finally:
        tf.close()

    # busybox applets are zero-length hardlink members; the copy above may have
    # produced empty files if the link target appeared later in the stream.
    # Repair: any 0-byte file under bin/sbin/usr/bin that has a sibling busybox
    # becomes a symlink to busybox (proot resolves symlinks fine).
    repaired = 0
    for d in ("bin", "sbin", "usr/bin", "usr/sbin"):
        bb = os.path.join(root, "bin", "busybox")
        dd = os.path.join(root, d)
        if not (os.path.isdir(dd) and os.path.isfile(bb)):
            continue
        for f in os.listdir(dd):
            p = os.path.join(dd, f)
            if os.path.isfile(p) and not os.path.islink(p) and os.path.getsize(p) == 0:
                os.remove(p)
                os.symlink("/bin/busybox", p)
                repaired += 1
    stats["busybox_symlink_repair"] = repaired
    return stats


def main():
    if len(sys.argv) != 3:
        sys.stderr.write("usage: zh-extract.py <rootfs.tar.gz> <dest-dir>\n")
        return 64
    tar_path, root = sys.argv[1], sys.argv[2]
    t0 = time.time()
    stats = extract(tar_path, root)
    marker = os.path.join(root, "usr", "bin", "zh-setup")
    print("dest=%s  %.1fs  %s" % (root, time.time() - t0, stats))
    print("marker usr/bin/zh-setup: %s" % ("OK" if os.path.exists(marker) else "MISSING"))
    return 0 if os.path.exists(marker) else 1


if __name__ == "__main__":
    sys.exit(main())
