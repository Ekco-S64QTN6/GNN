"""Kill the leftover polling shells without killing the one running this.

Every `while pgrep ...; do sleep N; done` I used to wait on a background
task left a shell behind. They are idle, but there are nineteen of them.

The safe way to do this is to work out this process's own ancestry first
and never touch it — matching on a command line is how a pkill ends up
killing the shell that issued it, which has happened four times today.
"""
import os
import signal
import subprocess

PATTERNS = ('while pgrep', 'until ', 'do sleep', 'n -lt ')


def ancestry(pid):
    """Every pid from here up to init."""
    seen = []
    while pid and pid > 1:
        seen.append(pid)
        try:
            with open('/proc/%d/stat' % pid) as fh:
                pid = int(fh.read().split(') ', 1)[1].split()[1])
        except OSError:
            break
    return set(seen)


def main():
    mine = ancestry(os.getpid())
    out = subprocess.run(
        ['ps', '-eo', 'pid,comm,args', '--no-headers'],
        capture_output=True, text=True).stdout

    targets = []
    for line in out.splitlines():
        parts = line.split(None, 2)
        if len(parts) < 3:
            continue
        pid, comm, args = int(parts[0]), parts[1], parts[2]
        if pid in mine:
            continue
        if comm not in ('bash', 'sh'):
            continue
        if not any(p in args for p in PATTERNS):
            continue
        targets.append((pid, args[:70]))

    if not targets:
        print('no leftover polling shells')
        return 0
    for pid, args in targets:
        try:
            os.killpg(os.getpgid(pid), signal.SIGTERM)
        except (OSError, ProcessLookupError):
            try:
                os.kill(pid, signal.SIGTERM)
            except OSError:
                pass
    print('terminated %d polling shells' % len(targets))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
