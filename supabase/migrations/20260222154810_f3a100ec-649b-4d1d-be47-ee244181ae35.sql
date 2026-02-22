
INSERT INTO orders (order_number, channel, status, customer_id, subtotal, total_amount, delivery_charge)
VALUES
  ('TEST-D01', 'manual', 'delivered', 'c32b4b4b-2f04-46e0-acac-1bc88104f4f9', 500, 560, 60),
  ('TEST-D02', 'manual', 'delivered', '87001584-30a9-4d82-aadc-a8ba11e7ba7e', 800, 860, 60),
  ('TEST-D03', 'manual', 'delivered', 'c32b4b4b-2f04-46e0-acac-1bc88104f4f9', 1200, 1260, 60),
  ('TEST-D04', 'manual', 'delivered', 'eec8ac7a-849a-4802-98fc-008fffbc2199', 350, 410, 60),
  ('TEST-D05', 'manual', 'delivered', '87001584-30a9-4d82-aadc-a8ba11e7ba7e', 990, 1050, 60),
  ('TEST-S01', 'manual', 'shipped', 'c32b4b4b-2f04-46e0-acac-1bc88104f4f9', 450, 510, 60),
  ('TEST-S02', 'manual', 'shipped', 'eec8ac7a-849a-4802-98fc-008fffbc2199', 670, 730, 60),
  ('TEST-C01', 'manual', 'cancelled', '87001584-30a9-4d82-aadc-a8ba11e7ba7e', 300, 360, 60),
  ('TEST-C02', 'manual', 'cancelled', 'c32b4b4b-2f04-46e0-acac-1bc88104f4f9', 550, 610, 60),
  ('TEST-R01', 'manual', 'returned', 'eec8ac7a-849a-4802-98fc-008fffbc2199', 420, 480, 60),
  ('TEST-R02', 'manual', 'returned', '87001584-30a9-4d82-aadc-a8ba11e7ba7e', 780, 840, 60),
  ('TEST-PK1', 'manual', 'packed', 'c32b4b4b-2f04-46e0-acac-1bc88104f4f9', 600, 660, 60);
