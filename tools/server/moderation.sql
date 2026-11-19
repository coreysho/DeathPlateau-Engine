-- ============================================================================================
-- Death Plateau moderation queries.  SQLite.  Read-only - none of these writes anything.
--
-- WHY THESE EXIST: neither chat table holds a username.  public_chat is keyed by login session
-- and private_chat by account number, and the schema declares no relations, so a table browser
-- shows uuids and integers with every name in another table.  These do the joins.
--
-- :name is a bound parameter.  In Datasette it becomes a text box.  Elsewhere, replace it with
-- a quoted username.  Matching is case- and space-insensitive: Bob Smith finds bob_smith.
-- ============================================================================================


-- ---------------------------------------------------------------------------- 1. player_chat
-- Everything one player said, public and private, newest first, names resolved.
select
    pc.timestamp as said_at,
    'public' as kind,
    a.username as who,
    '' as to_who,
    pc.message as message,
    ((pc.coord >> 14) & 16383) || ', ' || (pc.coord & 16383) || ', level ' || ((pc.coord >> 28) & 3) as tile
from public_chat pc
join session s on s.uuid = pc.session_uuid
join account a on a.id = s.account_id
where lower(replace(a.username, ' ', '_')) = lower(replace(:name, ' ', '_'))
union all
select
    p.timestamp,
    'private',
    sender.username,
    recip.username,
    p.message,
    ((p.coord >> 14) & 16383) || ', ' || (p.coord & 16383) || ', level ' || ((p.coord >> 28) & 3)
from private_chat p
join account sender on sender.id = p.account_id
join account recip on recip.id = p.to_account_id
where lower(replace(sender.username, ' ', '_')) = lower(replace(:name, ' ', '_'))
   or lower(replace(recip.username, ' ', '_')) = lower(replace(:name, ' ', '_'))
order by said_at desc
limit 500;


-- ---------------------------------------------------------------------------- 2. player_alts
-- Other accounts seen from the same address or the same machine.
--
-- TWO SENTINELS ARE EXCLUDED, AND NEITHER OF THEM IS NULL.  This is the whole correctness of
-- the query, and both were found the hard way.
--
--   uid = 0.  uid is the client's install id, and signlink.getuid returns 0 when it cannot read
--   uid.dat, so zero means "unknown" and is shared by every player whose client failed to read
--   it.
--
--   ip = 'unknown'.  normalizeAddress (src/server/ConnectionLimiter.ts) returns the LITERAL
--   STRING 'unknown' when a socket has no address - which Node does for a connection already
--   destroyed by the time the event fires - and that string goes straight into session.ip.  It
--   is not NULL, so "where ip is not null" lets it through, and then every bad-socket login
--   matches every other one.  On the live server that turned eight unrelated players, each with
--   one or two such logins, into the owner's alts.
--
-- shared_address IS THEREFORE PART OF THE OUTPUT.  A match that cannot name the address it
-- matched on is a match nobody can check, and that is how the above went unnoticed.
with mine as (
    select s.uid, s.ip
    from session s
    join account a on a.id = s.account_id
    where lower(replace(a.username, ' ', '_')) = lower(replace(:name, ' ', '_'))
),
my_ips as (
    select distinct ip from mine
    where ip is not null and ip <> '' and ip <> 'unknown'
),
my_uids as (
    select distinct uid from mine where uid <> 0
)
select
    other.username as account,
    case
        when max(s.uid <> 0 and s.uid in (select uid from my_uids)) = 1
         and max(s.ip in (select ip from my_ips)) = 1 then 'same PC + address'
        when max(s.uid <> 0 and s.uid in (select uid from my_uids)) = 1 then 'same PC'
        else 'same address'
    end as link,
    group_concat(distinct case when s.ip in (select ip from my_ips) then s.ip end) as shared_address,
    count(*) as logins,
    min(s.timestamp) as first_seen,
    max(s.timestamp) as last_seen,
    case when other.banned_until > datetime('now') then 'BANNED until ' || other.banned_until else '' end as banned,
    case when other.muted_until > datetime('now') then 'MUTED until '  || other.muted_until else '' end as muted
from session s
join account other on other.id = s.account_id
where other.username != (select username from account where lower(replace(username, ' ', '_')) = lower(replace(:name, ' ', '_')))
  and (
        s.ip in (select ip from my_ips)
     or (s.uid <> 0 and s.uid in (select uid from my_uids))
  )
group by other.id
order by link = 'same address', last_seen desc;


-- --------------------------------------------------------------------------- 3. crowded_ips
-- Context for query 2.  An address many accounts have used is a household, a phone network or
-- a VPN, and an address match there means nothing on its own.
select
    ip,
    case when ip is null or ip = '' or ip = 'unknown'
         then 'NOT AN ADDRESS - the socket had none. Never a link between accounts.'
         else '' end as note,
    count(distinct account_id) as accounts,
    count(*) as logins,
    max(timestamp) as last_seen
from session
where ip is not null
group by ip
having count(distinct account_id) > 1
order by accounts desc;


-- ------------------------------------------------------------------------------ 4. pm_pairs
-- Who private-messages whom, and how much.  A ring of accounts feeding one of them shows up
-- here as a column of rows pointing at the same name.
select
    sender.username as from_who,
    recip.username as to_who,
    count(*) as messages,
    min(p.timestamp) as first_seen,
    max(p.timestamp) as last_seen
from private_chat p
join account sender on sender.id = p.account_id
join account recip on recip.id = p.to_account_id
group by p.account_id, p.to_account_id
order by messages desc
limit 200;
