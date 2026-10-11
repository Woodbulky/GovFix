-- Advisor fix: pin search_path on the audit guard trigger function.
alter function audit_events_guard() set search_path = public;
