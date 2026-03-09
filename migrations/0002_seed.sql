-- Seed: Default fields
INSERT INTO fields (id, name, address, is_default) VALUES
  ('field_salem_common', 'Salem Common', 'Washington Square, Salem, MA 01970', 1),
  ('field_bertram', 'Bertram Field', '4 Bertram St, Salem, MA 01970', 1),
  ('field_danvers_indoor', 'Danvers Indoor Sports Center', '20 Liberty St, Danvers, MA 01923', 1);

-- Seed: Superadmin user (password: changeme123 — must be changed on first login)
-- bcryptjs hash of 'changeme123' with 10 rounds
INSERT INTO users (id, name, email, password_hash, role) VALUES
  ('superadmin_001', 'John Hutton', 'jhutton1121@gmail.com', '$2a$10$5Djbc5Ox4gV8wah7JN0CjeNAr7N3pj/qxm2nZXxRjDog2QRyAzoqq', 'superadmin');
