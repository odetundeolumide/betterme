INSERT INTO exams (code, name) VALUES
  ('WAEC','WAEC'), ('TOEFL','TOEFL'), ('SAT','SAT'), ('GRE','GRE')
ON CONFLICT (code) DO NOTHING;

INSERT INTO topics (id, exam_code, subject, name) VALUES
  (1,'WAEC','Mathematics','Algebra'),
  (2,'WAEC','Mathematics','Geometry'),
  (3,'WAEC','English','Comprehension'),
  (4,'TOEFL','Reading','Inference'),
  (5,'SAT','Math','Linear equations'),
  (6,'GRE','Quant','Arithmetic')
ON CONFLICT (id) DO NOTHING;
SELECT setval('topics_id_seq', 6);

INSERT INTO notes (topic_id, body_md) VALUES
  (1,'# Algebra — key ideas\n\n- Solve linear equations: isolate x.\n- Quadratic: ax^2+bx+c=0.'),
  (2,'# Geometry — key ideas\n\n- Angles in a triangle sum to 180°.\n- Pythagoras: a^2+b^2=c^2.'),
  (3,'# Comprehension — key ideas\n\n- Read the passage twice before the questions.\n- "It''s" = it is; "its" = belonging to it.')
ON CONFLICT (topic_id) DO NOTHING;

INSERT INTO questions (exam_code, topic_id, stem, options, answer_idx, explanation, difficulty) VALUES
('WAEC',1,'If 2x + 3 = 11, x = ?','["2","3","4","5"]',2,'2x = 8, so x = 4.',1),
('WAEC',1,'Roots of x^2 - 5x + 6 = 0?','["1,6","2,3","-2,-3","0,5"]',1,'(x-2)(x-3)=0.',2),
('WAEC',2,'Hypotenuse of a 3-4 right triangle?','["5","6","7","12"]',0,'3^2+4^2=25, sqrt=5.',1),
('WAEC',2,'Sum of interior angles of a triangle?','["90°","180°","270°","360°"]',1,'Always 180°.',1),
('WAEC',3,'Choose the correctly punctuated sentence.','["Its raining.","It''s raining.","Its'' raining.","It raining."]',1,'"It''s" = it is.',2),
('WAEC',1,'If f(x)=2x-1, f(4)=?','["6","7","8","9"]',1,'2*4-1=7.',1),
('TOEFL',4,'"It rained, so the match was cancelled." The inference is:','["Rain causes cancellation","Matches never cancel","Rain is unlikely","Cancellation causes rain"]',0,'Effect follows cause.',2),
('SAT',5,'If 3x - 7 = 11, x = ?','["5","6","7","8"]',1,'3x=18, x=6.',1),
('GRE',6,'Which is greatest: 2^10, 10^2, 100*10?','["2^10","10^2","100*10","all equal"]',0,'2^10=1024 > 1000 > 100.',2),
('WAEC',1,'Simplify: 3(x - 2) + 4 = ?','["3x-2","3x-10","3x+2","3x-6"]',0,'3x-6+4 = 3x-2.',1),
('WAEC',1,'If y = 5x and x = 3, y = ?','["8","12","15","53"]',2,'5*3=15.',1),
('WAEC',2,'A rectangle is 8cm by 5cm. Area?','["13cm²","26cm²","40cm²","45cm²"]',2,'8*5=40.',1),
('WAEC',2,'Each angle of an equilateral triangle?','["45°","60°","90°","120°"]',1,'180/3=60.',1),
('WAEC',3,'Choose the correct option: She ___ to school daily.','["go","goes","going","gone"]',1,'Third-person singular takes "goes".',1),
('WAEC',3,'Which word is a noun?','["quickly","beautiful","honesty","run"]',2,'Honesty names a thing.',1),
('WAEC',1,'Solve: x/4 = 5. x = ?','["9","16","20","24"]',2,'x = 5*4 = 20.',2),
('WAEC',2,'Diameter of a circle with radius 7cm?','["7cm","10.5cm","14cm","21cm"]',2,'d = 2r = 14.',2);
