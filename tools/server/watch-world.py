#!/usr/bin/env python3
"""Ask the world the question a player asks, and say so when it stops answering.

WHY NOT systemctl. Twice in one day this server was broken while systemd called it `active`: a
crash-loop where the unit is restarted faster than it fails, and a boot that reached "World ready"
and then could not read LoginServer.ts, so the world ran and no login could succeed. `is-active`
reported health through both. Nothing noticed either until somebody happened to be watching a
deploy scroll past.

WHY NOT A TCP CONNECT EITHER. The second of those had the game port open and listening. A connect
test would have passed it. What distinguishes a world that is serving from one that is merely
running is whether the LOGIN PATH answers, so that is what this asks: two bytes of the RS2
handshake out, seventeen back, and the status byte at offset 8 tells you. It is the first thing
tools/sim/pingwire.ts does before it logs in, for the same reason.

WHERE TO RUN IT, and this is most of the value. On the relay, not on the game box. A checker that
lives on the machine it watches cannot report that machine's death - a power cut at the house takes
the world and the watcher together and you hear nothing. The relay is separate hardware, separate
power, already up for the game's sake, and already the path every player takes: pointed at its own
forwarded port, one probe covers the engine, the WireGuard link, HAProxy, and the house having
lights. Running it on the game box instead still beats nothing, and the one thing it can never tell
you is the thing most likely to happen.

WHAT IT WILL NOT DO. It cannot tell you the relay itself is gone, because it would be gone with it.
For that you want something off both machines - a dead-man's switch like healthchecks.io, which the
backup job could check into as well. This is the half that needs no third party.

Install on the relay (Debian, which already has python3):

    scp tools/server/watch-world.py root@216.128.157.152:/usr/local/bin/dp-watch-world
    ssh root@216.128.157.152 'chmod +x /usr/local/bin/dp-watch-world && mkdir -p /var/lib/dp-watch'

    # a webhook for wherever you want to be told: Discord channel -> Edit Channel ->
    # Integrations -> Webhooks -> New Webhook -> Copy URL
    ssh root@216.128.157.152
    cat > /etc/default/dp-watch <<'EOF'
    WATCH_WEBHOOK=https://discord.com/api/webhooks/...
    EOF
    chmod 600 /etc/default/dp-watch

    # every minute
    crontab -l > /tmp/c 2>/dev/null || true
    echo '* * * * * . /etc/default/dp-watch && /usr/local/bin/dp-watch-world >> /var/log/dp-watch.log 2>&1' >> /tmp/c
    crontab /tmp/c && rm /tmp/c

Settings, all from the environment:

    WATCH_HOST      what to probe           default 127.0.0.1 (the relay's own listener)
    WATCH_PORT      and on which port       default 43594
    WATCH_WEBHOOK   where to say it         default empty, which only logs
    WATCH_FAILS     failures before a word  default 3
    WATCH_TIMEOUT   seconds per probe       default 10
    WATCH_STATE     where it remembers      default /var/lib/dp-watch/state.json
    WATCH_NAME      what to call the world  default 'the world'

WHAT THE PROBE COSTS THE WORLD. World.onClientData answers opcode 14 by sending eight zero bytes,
then the status, then eight of seed, and in between it counts the attempt against
NODE_RATELIMIT_ADDRESS_LOGIN - thirty per address per minute. One probe a minute spends one of those
thirty, and because HAProxy forwards each player's real address with PROXY v2, the probe sits in its
own bucket and cannot take a login slot from anybody. If you ever do see 'closed the connection
after 9 of 17 bytes', that is the limiter: the eight zeros had gone out, the refusal byte followed,
and something else is logging in from this probe's address.

THE TEST IS tools/sim/watchworld.ts, and it is worth knowing what it proves: it stands up fake
worlds in each of the states one can be in - serving, accepting and then silent, answering with a
refusal, cutting the reply short - and insists this tells them apart. The silent one is the point.
It shows a plain TCP connect succeeding against it on the same port, in the same run, before
showing this probe fail. That is the night of the dead login server, reproduced.

THREE FAILURES, NOT ONE. A deploy with --countdown takes the world down for about eighty seconds,
and a probe every minute would see one or two of those. Alerting on the first would page you for
every deploy, and an alert you learn to ignore is worse than none. Three consecutive failures is
three minutes of genuinely not answering.
"""
import json
import os
import socket
import sys
import time
import urllib.error
import urllib.request

HOST = os.environ.get('WATCH_HOST', '127.0.0.1')
PORT = int(os.environ.get('WATCH_PORT', '43594'))
WEBHOOK = os.environ.get('WATCH_WEBHOOK', '').strip()
FAILS = int(os.environ.get('WATCH_FAILS', '3'))
TIMEOUT = float(os.environ.get('WATCH_TIMEOUT', '10'))
STATE = os.environ.get('WATCH_STATE', '/var/lib/dp-watch/state.json')
NAME = os.environ.get('WATCH_NAME', 'the world')

HANDSHAKE = bytes([14, 0])  # Client.login's first write: the opcode and a name hash
REPLY = 17  # eight bytes ignored, the status, then eight of server seed
STATUS_AT = 8


def checks(n):
    return '1 check' if n == 1 else '%d checks' % n


def say(message):
    print('%s  %s' % (time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), message), flush=True)


def probe():
    """(healthy, what happened). Healthy means the login path answered and said proceed."""
    try:
        with socket.create_connection((HOST, PORT), TIMEOUT) as sock:
            sock.settimeout(TIMEOUT)
            sock.sendall(HANDSHAKE)

            got = b''
            while len(got) < REPLY:
                chunk = sock.recv(REPLY - len(got))
                if not chunk:
                    return False, 'closed the connection after %d of %d bytes' % (len(got), REPLY)
                got += chunk

            status = got[STATUS_AT]
            if status == 0:
                return True, 'handshake accepted'
            # answering but refusing: an update pending, the world full, a ban on this address.
            # Worth telling somebody either way - it is not serving, whatever the reason.
            return False, 'refused the handshake with status %d' % status
    except OSError as err:
        return False, '%s: %s' % (type(err).__name__, err)


def load():
    try:
        with open(STATE, encoding='utf-8') as handle:
            was = json.load(handle)
            return int(was.get('fails', 0)), bool(was.get('down', False))
    except (OSError, ValueError):
        # no state, or state we cannot read: start from healthy. The cost of being wrong is one
        # missed alert on the first run after a disk problem, against crashing every minute.
        return 0, False


def save(fails, down):
    try:
        os.makedirs(os.path.dirname(STATE), exist_ok=True)
        with open(STATE, 'w', encoding='utf-8') as handle:
            json.dump({'fails': fails, 'down': down, 'at': time.time()}, handle)
    except OSError as err:
        say('WARNING: could not write %s (%s) - every run will look like the first' % (STATE, err))


def tell(message):
    """Say it out loud. The log always gets it; the webhook gets it if there is one."""
    say(message)

    if not WEBHOOK:
        say('(no WATCH_WEBHOOK set, so that went to this log and nowhere else)')
        return

    body = json.dumps({'content': message}).encode('utf-8')
    request = urllib.request.Request(WEBHOOK, data=body, headers={'Content-Type': 'application/json'})
    try:
        urllib.request.urlopen(request, timeout=TIMEOUT).close()
    except (urllib.error.URLError, OSError) as err:
        # the alert failing is itself worth a line, and must not stop the next probe
        say('WARNING: could not reach the webhook (%s)' % err)


def main():
    healthy, detail = probe()
    fails, down = load()

    if healthy:
        if down:
            tell('%s is answering again (%s:%d).' % (NAME, HOST, PORT))
        elif fails:
            say('recovered before saying anything, after %d failure(s): %s' % (fails, detail))
        else:
            say('ok - %s' % detail)
        save(0, False)
        return 0

    fails += 1
    if down:
        say('still down (%d in a row): %s' % (fails, detail))
    elif fails >= FAILS:
        tell('%s is not answering on %s:%d - %s in a row. Last: %s' % (NAME, HOST, PORT, checks(fails), detail))
        down = True
    else:
        say('failed (%d of %d before saying anything): %s' % (fails, FAILS, detail))

    save(fails, down)
    return 1


if __name__ == '__main__':
    sys.exit(main())
