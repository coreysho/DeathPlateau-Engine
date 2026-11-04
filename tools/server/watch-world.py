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

WHAT IT WILL NOT DO ALONE. It cannot tell you the relay itself is gone, because it would be gone
with it. That is what WATCH_PING is for: a URL off both machines that expects to hear from this
every minute and complains when it does not. It is checked in UNCONDITIONALLY, whatever the world
is doing - see check_in() for why that is the whole point - so the two signals never overlap:

    the webhook goes quiet and says nothing   ->   the world is fine
    the webhook speaks                        ->   the world is down, and here is why
    the PING stops                            ->   the RELAY is gone, or cron is, or this script is

Set it up at healthchecks.io (free for 20 checks; 'New Check' -> name it 'dp-watch-world'):

    period      1 minute    how often this is expected to check in
    grace       10 minutes  how much silence to forgive first - a reboot, a blip, a slow ping

so you hear about it after about ten minutes of the relay being unreachable rather than after one.
Add Discord to the healthchecks project too (Integrations -> Discord) and both halves land in the
same channel. Copy the check's ping URL into /etc/default/dp-watch alongside the webhook:

    export WATCH_PING='https://hc-ping.com/YOUR-UUID-HERE'

TREAT THAT URL AS A SECRET, not because it reads anything - it cannot - but because anybody holding
it can check in on this watcher's behalf and keep its death hidden. It lives in a 0600 file for
that reason, and this script never prints it, not even when the ping fails.

One ping a minute is inside the service's documented limit of five per minute per check. Do not run
this more often than that without raising the period to match.

Install on the relay (Debian, which already has python3). EVERY LINE IS ONE COMMAND and none
of them opens an editor, because the usual way to do this is `crontab -e` and `nano`, which a
browser terminal cannot give you. NO HEREDOCS EITHER: this block is indented, and an indented
`EOF` does not end a heredoc - it hangs the shell waiting for one that never comes.

From the GAME BOX, which can already ssh to the relay for the backup's sake, so the file never
has to touch a laptop:

    cd /opt/deathplateau/engine && git fetch origin 377-wip
    git show origin/377-wip:tools/server/watch-world.py | ssh root@10.8.0.1 'cat > /usr/local/bin/dp-watch-world'
    ssh root@10.8.0.1 'chmod +x /usr/local/bin/dp-watch-world && mkdir -p /var/lib/dp-watch'

ASK IT ONCE BY HAND BEFORE TRUSTING IT TO CRON. This also settles the one thing that differs
between relays: whether HAProxy is listening on loopback or only on the public address.

    ssh root@10.8.0.1 'WATCH_STATE=/tmp/probe.json /usr/local/bin/dp-watch-world'

    # 'ok - handshake accepted'  -> the default of 127.0.0.1 is right, carry on
    # a timeout or a refusal     -> check where HAProxy actually listens:
    #     ssh root@10.8.0.1 'ss -ltnp | grep 43594'
    #   and if it is bound to the public address only, add WATCH_HOST below

A webhook for wherever you want to be told. In Discord: the channel -> Edit Channel ->
Integrations -> Webhooks -> New Webhook -> Copy Webhook URL.

    ssh root@10.8.0.1 "printf 'export WATCH_WEBHOOK=%s\nexport WATCH_NAME=%s\n' \"'https://discord.com/api/webhooks/PASTE_YOURS'\" \"'Death Plateau'\" > /etc/default/dp-watch && chmod 600 /etc/default/dp-watch"

    # EXPORT, AND QUOTED, and this is the line most likely to be wrong. `. file` sets a SHELL
    # variable; a shell variable is not in the environment, so without `export` the probe's
    # os.environ never sees the webhook and the alert goes to the log and nowhere else - which
    # looks exactly like a working install until the night you need it. The quotes are for the
    # space in the name: `WATCH_NAME=Death Plateau` sourced is an attempt to run `Plateau`.

    # prove the webhook before the outage does: point it at a port nothing is on, with no
    # debounce, and watch the message arrive in the channel
    ssh root@10.8.0.1 '. /etc/default/dp-watch && WATCH_PORT=1 WATCH_FAILS=1 WATCH_STATE=/tmp/probe.json /usr/local/bin/dp-watch-world'
    ssh root@10.8.0.1 'rm -f /tmp/probe.json'

And the dead-man's switch, which is a separate line so you can leave it out. Create the check at
healthchecks.io first - period 1 minute, grace 10 minutes - and append its ping URL:

    ssh root@10.8.0.1 "printf 'export WATCH_PING=%s\n' \"'https://hc-ping.com/YOUR-UUID-HERE'\" >> /etc/default/dp-watch"

    # the next run should turn the check green at healthchecks.io within seconds
    ssh root@10.8.0.1 '. /etc/default/dp-watch && WATCH_STATE=/tmp/probe.json /usr/local/bin/dp-watch-world && rm -f /tmp/probe.json'

Then every minute, and rotate what it writes - a line a minute is 1440 a day, and the log is the
only place the healthy runs are recorded, so it cannot simply go to /dev/null:

    ssh root@10.8.0.1 "(crontab -l 2>/dev/null; echo '* * * * * . /etc/default/dp-watch && /usr/local/bin/dp-watch-world >> /var/log/dp-watch.log 2>&1') | crontab -"
    ssh root@10.8.0.1 "printf '/var/log/dp-watch.log {\n  weekly\n  rotate 4\n  compress\n  missingok\n  notifempty\n  copytruncate\n}\n' > /etc/logrotate.d/dp-watch"

    # a couple of minutes later, the log should be filling up with ok lines
    ssh root@10.8.0.1 'tail -3 /var/log/dp-watch.log'

Settings, all from the environment:

    WATCH_HOST      what to probe           default 127.0.0.1 (the relay's own listener)
    WATCH_PORT      and on which port       default 43594
    WATCH_WEBHOOK   where to say it         default empty, which only logs
    WATCH_FAILS     failures before a word  default 3
    WATCH_TIMEOUT   seconds per probe       default 10
    WATCH_STATE     where it remembers      default /var/lib/dp-watch/state.json
    WATCH_NAME      what to call the world  default 'the world'
    WATCH_PING      a dead-man's switch     default empty, which checks in nowhere

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
PING = os.environ.get('WATCH_PING', '').strip()

# A NAME ON EVERY REQUEST, and this is not politeness. Discord sits behind Cloudflare, which
# refuses urllib's default `Python-urllib/3.x` with a 403 and Cloudflare error 1010 - "banned
# based on your browser's signature" - before Discord ever sees the message. The same request
# with a name on it gets through. Measured both ways against the real endpoint: default UA 403,
# named UA 404 'Unknown Webhook' from Discord itself on a deliberately fake URL.
#
# This is why the test asserts a User-Agent rather than only that a request arrived. A local sink
# accepts anything, so the first install of this looked perfect and threw every alert away.
USER_AGENT = 'DeathPlateau-watch-world/1.0 (+https://deathplateau.com)'

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
    request = urllib.request.Request(WEBHOOK, data=body, headers={'Content-Type': 'application/json', 'User-Agent': USER_AGENT})
    try:
        urllib.request.urlopen(request, timeout=TIMEOUT).close()
    except (urllib.error.URLError, OSError) as err:
        # the alert failing is itself worth a line, and must not stop the next probe
        say('WARNING: could not reach the webhook (%s)' % err)


def check_in():
    """Tell the dead-man's switch this ran - WHATEVER the world is doing.

    UNCONDITIONAL, and that is the entire design. The obvious thing is to check in only when the
    world is healthy, and it is wrong: a world outage would then stop the pings too, so the one
    question this is here to answer - IS THE RELAY STILL THERE - would give the same answer as the
    thing the webhook already told you about. One signal per failure, or neither can be trusted.

    So: the webhook says 'the world is down', and silence here says 'the watcher is not running' -
    which is the relay being gone, cron being broken, or this script itself having died. All three
    are invisible from the relay, and all three are now covered by the same missed ping.

    LAST THING IN THE RUN, deliberately. A check-in at the top would survive a crash in the probe
    and report health on a watcher that is not watching anything.
    """
    if not PING:
        return

    try:
        # a HEAD would do, but a GET is what every example uses and what the service documents
        request = urllib.request.Request(PING, headers={'User-Agent': USER_AGENT})
        urllib.request.urlopen(request, timeout=min(TIMEOUT, 10)).close()
    except (urllib.error.URLError, OSError) as err:
        # NOT the url, which carries the check's uuid - anybody holding it can check in on this
        # watcher's behalf and hide its death. The error alone is enough to diagnose with.
        say('WARNING: could not check in with the dead-man\'s switch (%s)' % err)


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
        code = 0
    else:
        fails += 1
        if down:
            say('still down (%d in a row): %s' % (fails, detail))
        elif fails >= FAILS:
            tell('%s is not answering on %s:%d - %s in a row. Last: %s' % (NAME, HOST, PORT, checks(fails), detail))
            down = True
        else:
            say('failed (%d of %d before saying anything): %s' % (fails, FAILS, detail))

        save(fails, down)
        code = 1

    # ONE PLACE, after both branches: a check-in inside the healthy branch would stop the moment
    # the world went down, which is exactly the opposite of what a dead-man's switch is for.
    check_in()
    return code


if __name__ == '__main__':
    sys.exit(main())
