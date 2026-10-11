-- P8b: the location picker refuses a point in the river (bridge decks excepted), in SQL like every other check.
-- The river and the bridge-carrying roads come from navnagar.json via `npm run gen:city` (seed/02_city.sql).

create table city_water (
  id smallint primary key default 1 check (id = 1),
  river jsonb not null,            -- [[x, z], ...] centre line
  river_width real not null,       -- metres
  decks jsonb not null default '[]' -- [{ "points": [[x, z], ...], "half": metres }]: arterial/main roads, walkable over water
);
alter table city_water enable row level security;
revoke all on city_water from anon, authenticated;

-- Distance from a point to a polyline [[x, z], ...] (min over its segments).
create or replace function _polyline_dist(p_x real, p_z real, p_pts jsonb) returns double precision
language sql immutable set search_path = public as $$
  select min(sqrt(power(p_x - (ax + t * (bx - ax)), 2) + power(p_z - (az + t * (bz - az)), 2)))
  from (
    select ax, az, bx, bz,
      greatest(0, least(1, case when l2 = 0 then 0 else ((p_x - ax) * (bx - ax) + (p_z - az) * (bz - az)) / l2 end)) t
    from (
      select (a ->> 0)::float8 ax, (a ->> 1)::float8 az, (b ->> 0)::float8 bx, (b ->> 1)::float8 bz,
        power((b ->> 0)::float8 - (a ->> 0)::float8, 2) + power((b ->> 1)::float8 - (a ->> 1)::float8, 2) l2
      from jsonb_array_elements(p_pts) with ordinality e(a, i)
      join jsonb_array_elements(p_pts) with ordinality f(b, j) on j = i + 1
    ) seg
  ) s
$$;

create or replace function _in_river(p_x real, p_z real) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select _polyline_dist(p_x, p_z, c.river) < c.river_width / 2
      and not exists (select 1 from jsonb_array_elements(c.decks) d
                      where _polyline_dist(p_x, p_z, d -> 'points') <= (d ->> 'half')::float8)
    from city_water c where c.id = 1), false)
$$;

create or replace function locate_point(p_x real, p_z real) returns jsonb
language sql stable security definer set search_path = public as $$
  select case
    when _in_river(p_x, p_z) then
      jsonb_build_object('found', false, 'reason', 'river',
                         'message', 'This spot is in the river. Pick a point on land or on a bridge.')
    else coalesce((
      select jsonb_build_object('found', true, 'ward_id', w.id, 'ward_name', w.name_en, 'ward_name_hi', w.name_hi,
        'ward_name_mr', w.name_mr, 'x', p_x, 'z', p_z,
        'landmark', (select jsonb_build_object('id', l.id, 'name', l.name_en, 'name_hi', l.name_hi, 'name_mr', l.name_mr,
                       'distance_m', round(sqrt(power(l.x - p_x, 2) + power(l.z - p_z, 2))))
                     from landmarks l where sqrt(power(l.x - p_x, 2) + power(l.z - p_z, 2)) <= 300
                     order by power(l.x - p_x, 2) + power(l.z - p_z, 2) limit 1))
      from wards w where _point_in_polygon(p_x, p_z, w.polygon) order by w.id limit 1),
      jsonb_build_object('found', false, 'reason', 'outside',
                         'message', 'This spot is outside Navnagar. Pick a point inside the city.'))
  end
$$;
grant execute on function locate_point(real, real) to authenticated;
