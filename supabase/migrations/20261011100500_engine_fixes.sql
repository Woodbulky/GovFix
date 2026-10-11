-- P2 fixes found while running the engine tests (migrations are append-only).

create or replace function _load_scenario() returns int
language plpgsql security definer set search_path = public as $$
declare
  s record; v_now timestamptz := now_sim(); v_id uuid; v_sub timestamptz; v_hours int; v_policy int;
  v_dept text; v_lm landmarks; v_n int := 0;
begin
  for s in select * from (values
    -- n,   citizen,  ward, lm, dx,  dz,  category,               state,         officer,   age_h, k_h, lang, description
    (117, 'ramesh', 1,  4,  20,  -15, 'garbage_not_collected', 'CLOSED',      'gaikwad', 120, 70,  'hi', 'मंडी के पास दो दिन से कचरा नहीं उठाया गया है।'),
    (118, 'sunita', 8,  14, -30, 25,  'no_water_supply',       'CLOSED',      'patil',   150, 100, 'mr', 'टेकडी भागात सकाळपासून पाणी आले नाही.'),
    (119, 'aisha',  10, 16, 40,  10,  'streetlight_out',       'SUBMITTED',   null,      2,   0,   'en', 'Two streetlights near the IT Park gate are not working.'),
    (120, 'ramesh', 3,  9,  -40, 30,  'pothole',               'SUBMITTED',   null,      6,   0,   'hi', 'स्टेशन के सामने सड़क पर बड़ा गड्ढा है।'),
    (121, 'sunita', 7,  3,  25,  20,  'stray_animals',         'SUBMITTED',   null,      1,   0,   'mr', 'मंडई हॉलजवळ भटकी कुत्री जमा झाली आहेत.'),
    (122, 'aisha',  4,  11, -25, 35,  'garbage_not_collected', 'TRIAGED',     null,      5,   0,   'en', 'Garbage pile outside the college gate since Monday.'),
    (123, 'ramesh', 9,  15, 50,  -20, 'drainage_overflow',     'TRIAGED',     null,      3,   0,   'hi', 'स्कूल के पास नाली ओवरफ्लो हो रही है।'),
    (124, 'sunita', 5,  12, -60, 40,  'water_leak',            'ASSIGNED',    'patil',   10,  0,   'mr', 'तलाव उद्यानाजवळ जलवाहिनी फुटली आहे.'),
    (125, 'aisha',  6,  13, 30,  -50, 'streetlight_out',       'ASSIGNED',    'more',    55,  0,   'en', 'Streetlights on the plant road have been off for two nights.'),
    (126, 'ramesh', 2,  7,  -45, -30, 'garbage_not_collected', 'ASSIGNED',    'gaikwad', 30,  0,   'hi', 'पुराने पुल के पास कचरा जमा हो गया है।'),
    (127, 'sunita', 7,  2,  40,  -40, 'drainage_overflow',     'IN_PROGRESS', 'pawar',   20,  0,   'mr', 'नमनपा कार्यालयाजवळ गटार तुंबले आहे, रस्त्यावर पाणी साचले.'),
    (128, 'aisha',  3,  10, 35,  45,  'pothole',               'IN_PROGRESS', 'shaikh',  40,  0,   'en', 'Deep pothole at the bus stand exit, buses swerve around it.'),
    (129, 'ramesh', 8,  14, 45,  -35, 'stray_animals',         'IN_PROGRESS', 'joshi',   56,  0,   'hi', 'पानी की टंकी के पास आवारा कुत्तों का झुंड है।'),
    (130, 'sunita', 1,  5,  -20, -40, 'no_water_supply',       'IN_PROGRESS', 'kale',    12,  0,   'mr', 'गणपती मंदिराच्या गल्लीत दोन दिवस पाणी नाही.'),
    (131, 'ramesh', 7,  1,  150, 200, 'water_leak',            'ASSIGNED',    'patil',   20,  0,   'hi', 'घंटाघर के पास वाली गली में पाइपलाइन से पानी बह रहा है।'),
    (132, 'sunita', 6,  13, -40, 60,  'water_leak',            'NEEDS_INFO',  'patil',   16,  3,   'mr', 'जलशुद्धीकरण केंद्राजवळ रस्त्यावर पाणी वाहत आहे.'),
    (133, 'aisha',  10, 16, -50, -45, 'garbage_not_collected', 'NEEDS_INFO',  'gaikwad', 10,  2,   'en', 'Bins near the IT Park lanes are overflowing.'),
    (134, 'ramesh', 4,  11, 45,  -25, 'streetlight_out',       'RESOLVED',    'more',    30,  5,   'hi', 'कॉलेज गेट के सामने की स्ट्रीटलाइट बंद है।'),
    (135, 'sunita', 7,  1,  -60, 50,  'garbage_not_collected', 'RESOLVED',    'gaikwad', 26,  20,  'mr', 'घंटाघर चौकाजवळ कचरा उचलला नाही.'),
    (136, 'aisha',  5,  12, 55,  30,  'pothole',               'RESOLVED',    'shaikh',  100, 50,  'en', 'Pothole on the lake road near the garden entrance.'),
    (137, 'ramesh', 2,  6,  30,  -25, 'drainage_overflow',     'REOPENED',    'pawar',   60,  6,   'hi', 'घाट के पास नाली फिर से भर गई है।'),
    (138, 'sunita', 9,  15, -35, 40,  'other',                 'REJECTED',    null,      40,  0,   'mr', 'शाळेच्या मैदानातील खाजगी झाडाची फांदी तुटली आहे.'),
    (139, 'aisha',  7,  1,  160, 185, 'water_leak',            'REJECTED',    null,      18,  0,   'en', 'Water leaking from a pipe in the lane behind Ghantaghar.'),
    (140, 'ramesh', 6,  13, 60,  -45, 'garbage_not_collected', 'TRIAGED',     null,      26,  0,   'hi', 'प्लांट रोड पर कचरा तीन दिन से पड़ा है।'),
    (141, 'aisha',  5,  12, -45, -55, 'drainage_overflow',     'CLOSED',      'pawar',   200, 180, 'en', 'Drain near the lake garden is blocked and smells.')
  ) as t(n, citizen, ward, lm, dx, dz, cat, st, officer, age_h, k_h, lang, descr) order by n loop
    v_sub := v_now - make_interval(hours => s.age_h);
    select * into v_lm from landmarks where id = s.lm;
    select department_code into v_dept from categories where code = s.cat;
    select id, resolution_hours into v_policy, v_hours from sla_policies
      where category_code = s.cat and effective_from <= v_now order by effective_from desc, id desc limit 1;

    insert into requests (ticket_no, citizen_id, channel, language, description, ward_id, landmark_id, loc_x, loc_z,
      category_hint, category_code, department_code, state, assigned_officer_id, submitted_at, triage_due_at,
      sla_policy_id, sla_clock_start, resolution_due_at, paused_since, resolved_at, closed_at, reopen_count,
      duplicate_of, updated_at)
    values (
      format('NMC-%s-%s', extract(year from v_now)::int, lpad(s.n::text, 6, '0')),
      _demo_uid(s.citizen), (case when s.n % 4 = 0 then 'voice' else 'web' end)::channel, s.lang, s.descr,
      s.ward, s.lm, v_lm.x + s.dx, v_lm.z + s.dz, s.cat,
      case when s.st not in ('SUBMITTED', 'REJECTED') then s.cat end,
      case when s.st not in ('SUBMITTED', 'REJECTED') then v_dept end,
      s.st::request_state,
      case when s.st not in ('REOPENED') then _demo_uid(s.officer) end,
      v_sub, v_sub + make_interval(hours => 4),
      case when s.st not in ('SUBMITTED', 'REJECTED') then v_policy end,
      case when s.st = 'REOPENED' then v_now - make_interval(hours => s.k_h)
           when s.st not in ('SUBMITTED', 'REJECTED') then v_sub end,
      case when s.st = 'REOPENED' then v_now + make_interval(hours => v_hours - s.k_h)
           when s.st not in ('SUBMITTED', 'REJECTED') then v_sub + make_interval(hours => v_hours) end,
      case when s.st = 'NEEDS_INFO' then v_now - make_interval(hours => s.k_h) end,
      case when s.st in ('RESOLVED', 'CLOSED') then v_now - make_interval(hours => s.k_h)
           when s.st = 'REOPENED' then v_now - make_interval(hours => 30) end,
      case when s.st = 'CLOSED' then v_now - make_interval(hours => s.k_h - 10) end,
      case when s.st = 'REOPENED' then 1 else 0 end,
      case when s.n = 139 then (select id from requests where ticket_no like '%-000131') end,
      v_now)
    returning id into v_id;

    if s.st = 'NEEDS_INFO' then
      insert into request_messages (request_id, author_id, kind, visibility, body, language, created_at)
      values (v_id, _demo_uid(s.officer), 'info_question', 'citizen',
        case s.lang when 'mr' then 'गळती नेमकी कोणत्या इमारतीजवळ आहे ते कृपया सांगा.'
                    else 'Could you tell us which lane it is? There are three near the gate.' end,
        s.lang, v_now - make_interval(hours => s.k_h));
    end if;

    perform append_audit(null, 'system', 'system', v_id, 'scenario_seed', null, s.st::request_state, 'accepted', null,
      case s.n when 138 then 'Outside NMC jurisdiction: private property'
               when 139 then 'Duplicate of NMC-' || extract(year from v_now)::int || '-000131' end,
      jsonb_build_object('ticket_no', format('NMC-%s-%s', extract(year from v_now)::int, lpad(s.n::text, 6, '0'))));
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

