-- Advisor fix: pin search_path on the small helper functions from P2.
alter function _channel() set search_path = public;
alter function _state_label(request_state) set search_path = public;
alter function _notification_templates() set search_path = public;
alter function _action_label(text) set search_path = public;
alter function _role_label(text) set search_path = public;
alter function _point_in_polygon(float8, float8, jsonb) set search_path = public;
