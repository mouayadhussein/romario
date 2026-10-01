-- Migration 003: Seed data — 2 branches, 3 categories each, several items

INSERT INTO branches (id, name, slug, address, phone, whatsapp_number, map_url, working_hours, is_active, sort_order)
VALUES
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'الفرع الرئيسي',
    'main',
    'شارع الملك فيصل، وسط البلد',
    '0599000001',
    '970599000001',
    'https://maps.google.com/?q=31.9048,35.2040',
    'يومياً 10:00 ص – 11:00 م',
    true,
    1
  ),
  (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'فرع الشمال',
    'north',
    'شارع الجامعة، حي الشمال',
    '0599000002',
    '970599000002',
    'https://maps.google.com/?q=31.9200,35.2100',
    'يومياً 11:00 ص – 12:00 م',
    true,
    2
  )
ON CONFLICT (id) DO NOTHING;

-- Categories for main branch
INSERT INTO categories (id, branch_id, name, image_url, is_active, sort_order)
VALUES
  ('cccccccc-cccc-cccc-cccc-ccccccccccc1', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'مشاوي', NULL, true, 1),
  ('cccccccc-cccc-cccc-cccc-ccccccccccc2', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'سندويشات', NULL, true, 2),
  ('cccccccc-cccc-cccc-cccc-ccccccccccc3', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'مشروبات', NULL, true, 3)
ON CONFLICT (id) DO NOTHING;

-- Categories for north branch
INSERT INTO categories (id, branch_id, name, image_url, is_active, sort_order)
VALUES
  ('dddddddd-dddd-dddd-dddd-ddddddddddd1', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'مشاوي', NULL, true, 1),
  ('dddddddd-dddd-dddd-dddd-ddddddddddd2', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'سندويشات', NULL, true, 2),
  ('dddddddd-dddd-dddd-dddd-ddddddddddd3', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'مشروبات', NULL, true, 3)
ON CONFLICT (id) DO NOTHING;

-- Items for main branch
INSERT INTO items (category_id, name, description, price, image_url, is_available, sort_order)
VALUES
  ('cccccccc-cccc-cccc-cccc-ccccccccccc1', 'مشكل مشاوي', 'تشكيلة من اللحم والدجاج والكفتة مع أرز وسلطة', 65.00, NULL, true, 1),
  ('cccccccc-cccc-cccc-cccc-ccccccccccc1', 'شيش طاووق', 'قطع دجاج متبّلة مشوية على الفحم', 45.00, NULL, true, 2),
  ('cccccccc-cccc-cccc-cccc-ccccccccccc1', 'كفتة مشوية', 'كفتة لحم طازجة مع صوص طحينة', 50.00, NULL, true, 3),
  ('cccccccc-cccc-cccc-cccc-ccccccccccc2', 'شاورما دجاج', 'خبز عربي مع شاورما دجاج ومخللات', 22.00, NULL, true, 1),
  ('cccccccc-cccc-cccc-cccc-ccccccccccc2', 'برغر كلاسيك', 'برغر لحم 150غ مع جبنة وخضار', 28.00, NULL, true, 2),
  ('cccccccc-cccc-cccc-cccc-ccccccccccc2', 'فاهيتا دجاج', 'تورتيلا محشوة بدجاج فاهيتا', 25.00, NULL, false, 3),
  ('cccccccc-cccc-cccc-cccc-ccccccccccc3', 'عصير برتقال طازج', 'كوب 400 مل', 10.00, NULL, true, 1),
  ('cccccccc-cccc-cccc-cccc-ccccccccccc3', 'كولا', 'علبة 330 مل', 5.00, NULL, true, 2),
  ('cccccccc-cccc-cccc-cccc-ccccccccccc3', 'ماء معدني', 'زجاجة 500 مل', 3.00, NULL, true, 3);

-- Items for north branch
INSERT INTO items (category_id, name, description, price, image_url, is_available, sort_order)
VALUES
  ('dddddddd-dddd-dddd-dddd-ddddddddddd1', 'مشكل مشاوي', 'تشكيلة مشاوي للشمال', 70.00, NULL, true, 1),
  ('dddddddd-dddd-dddd-dddd-ddddddddddd1', 'لحم مشوي', 'قطع لحم طرية مع بطاطا', 55.00, NULL, true, 2),
  ('dddddddd-dddd-dddd-dddd-ddddddddddd2', 'شاورما لحم', 'شاورما لحم مع ثوم ومخلل', 25.00, NULL, true, 1),
  ('dddddddd-dddd-dddd-dddd-ddddddddddd2', 'كراب دجاج', 'كراب محشو بدجاج وجبنة', 20.00, NULL, true, 2),
  ('dddddddd-dddd-dddd-dddd-ddddddddddd3', 'ليمونادة', 'ليمونادة منزلية مثلّجة', 8.00, NULL, true, 1),
  ('dddddddd-dddd-dddd-dddd-ddddddddddd3', 'آيس تي', 'شاي مثلّج بالخوخ', 9.00, NULL, true, 2);
