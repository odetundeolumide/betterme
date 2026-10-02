INSERT INTO questions (exam_code, topic_id, stem, options, answer_idx, explanation, difficulty)
SELECT v.exam_code, v.topic_id, v.stem, v.options::jsonb, v.answer_idx, v.explanation, v.difficulty
FROM (VALUES
  ('WAEC',11,'Solve: 3x - 7 = 14.','["5","6","7","8"]',2,'Add 7 to both sides: 3x = 21, so x = 7.',1),
  ('WAEC',11,'Solve: 5(x - 2) = 30.','["4","6","8","10"]',2,'Divide by 5 to get x - 2 = 6; therefore x = 8.',1),
  ('WAEC',11,'Solve: (2x / 3) + 4 = 10.','["6","8","9","12"]',2,'Subtract 4 to get 2x/3 = 6; multiply by 3/2 to get x = 9.',2),
  ('WAEC',11,'Solve: 4x + 3 = 2x + 15.','["4","5","6","9"]',2,'Subtract 2x and 3 from both sides: 2x = 12, so x = 6.',1),
  ('WAEC',11,'The roots of (x + 2)(x - 3) = 0 are','["-2 and 3","2 and -3","-2 and -3","2 and 3"]',0,'A product is zero when either factor is zero: x = -2 or x = 3.',2),
  ('WAEC',11,'What is the positive root of x^2 - 9 = 0?','["-9","-3","3","9"]',2,'x^2 = 9 gives x = ±3; the positive root is 3.',1),
  ('WAEC',11,'Find the next term: 5, 9, 13, 17, ...','["19","20","21","22"]',2,'The sequence increases by 4 each time; 17 + 4 = 21.',1),
  ('WAEC',11,'The nth term of a sequence is 3n + 2. Find its 10th term.','["30","31","32","35"]',2,'Substitute n = 10: 3(10) + 2 = 32.',1),
  ('WAEC',11,'Simplify: 2^3 × 2^4.','["2^7","2^12","4^7","4^12"]',0,'For powers with the same base, add the exponents: 2^(3+4) = 2^7.',2),
  ('WAEC',11,'Evaluate √196.','["12","13","14","16"]',2,'14 × 14 = 196, so √196 = 14.',1),
  ('WAEC',11,'Evaluate log₁₀(1000).','["2","3","10","100"]',1,'10^3 = 1000, so log₁₀(1000) = 3.',2),
  ('WAEC',11,'Find 15% of 240.','["24","30","36","40"]',2,'15% of 240 is 0.15 × 240 = 36.',1),
  ('WAEC',11,'A trader buys an item for ₦5,000 and makes a 20% profit. What is the selling price?','["₦5,200","₦5,800","₦6,000","₦6,200"]',2,'Profit = 20% of ₦5,000 = ₦1,000; selling price = ₦6,000.',1),
  ('WAEC',11,'Divide 64 in the ratio 3:5. What is the smaller share?','["16","24","32","40"]',1,'There are 8 parts; each is 64/8 = 8. The smaller share is 3 × 8 = 24.',1),
  ('WAEC',11,'Find the simple interest on ₦20,000 at 5% per year for 3 years.','["₦1,000","₦2,500","₦3,000","₦5,000"]',2,'I = Prt/100 = 20,000 × 5 × 3 / 100 = ₦3,000.',2),
  ('WAEC',11,'A vehicle travels 180 km in 3 hours. What is its average speed?','["50 km/h","60 km/h","90 km/h","540 km/h"]',1,'Speed = distance/time = 180/3 = 60 km/h.',1),
  ('WAEC',11,'Convert 2.5 km to metres.','["25 m","250 m","2,050 m","2,500 m"]',3,'One kilometre is 1,000 metres; 2.5 × 1,000 = 2,500 m.',1),
  ('WAEC',11,'Find the perimeter of a rectangle measuring 12 cm by 7 cm.','["19 cm","38 cm","84 cm","168 cm"]',1,'Perimeter = 2(12 + 7) = 38 cm.',1),
  ('WAEC',11,'Find the area of a triangle with base 12 cm and perpendicular height 9 cm.','["21 cm²","42 cm²","54 cm²","108 cm²"]',2,'Area = 1/2 × base × height = 1/2 × 12 × 9 = 54 cm².',1),
  ('WAEC',11,'A circle has diameter 14 cm. Using π = 22/7, find its circumference.','["22 cm","44 cm","88 cm","154 cm"]',1,'Circumference = πd = 22/7 × 14 = 44 cm.',1),
  ('WAEC',11,'Find the volume of a cuboid measuring 4 cm by 3 cm by 5 cm.','["12 cm³","20 cm³","47 cm³","60 cm³"]',3,'Volume = length × width × height = 4 × 3 × 5 = 60 cm³.',1),
  ('WAEC',11,'A right-angled triangle has shorter sides 5 cm and 12 cm. Find its hypotenuse.','["13 cm","15 cm","17 cm","60 cm"]',0,'By Pythagoras, c² = 5² + 12² = 169, so c = 13 cm.',2),
  ('WAEC',11,'An angle and 125° are supplementary. Find the angle.','["45°","55°","65°","125°"]',1,'Supplementary angles sum to 180°; 180° - 125° = 55°.',1),
  ('WAEC',11,'Two angles of a triangle are 48° and 67°. Find the third angle.','["55°","65°","75°","85°"]',1,'Angles in a triangle sum to 180°; 180° - 48° - 67° = 65°.',1),
  ('WAEC',11,'An exterior angle of a triangle is 120°. One opposite interior angle is 45°. Find the other opposite interior angle.','["65°","75°","85°","165°"]',1,'An exterior angle equals the sum of the two opposite interior angles: 120° - 45° = 75°.',2),
  ('WAEC',11,'Find the median of 3, 4, 7, 9, 12.','["4","7","8","9"]',1,'The numbers are already in order; the middle value is 7.',1),
  ('WAEC',11,'A fair six-sided die is rolled. What is the probability of getting a number greater than 4?','["1/6","1/3","1/2","2/3"]',1,'The favourable outcomes are 5 and 6: 2/6 = 1/3.',1),
  ('WAEC',11,'A bag contains 5 red and 3 blue balls. One ball is chosen at random. What is the probability it is red?','["3/8","1/2","5/8","5/3"]',2,'There are 8 balls in total and 5 are red, so the probability is 5/8.',1),
  ('WAEC',11,'Express 0.375 as a fraction in its lowest terms.','["3/8","3/5","5/8","375/100"]',0,'0.375 = 375/1000; dividing numerator and denominator by 125 gives 3/8.',2),
  ('WAEC',11,'Simplify 42/56 to its lowest terms.','["2/3","3/4","4/5","6/7"]',1,'The highest common factor is 14; 42/56 = 3/4.',1),
  ('WAEC',11,'Find the lowest common multiple of 12 and 18.','["6","24","36","72"]',2,'The smallest number divisible by both 12 and 18 is 36.',1),
  ('WAEC',11,'Find the highest common factor of 24 and 36.','["6","8","12","18"]',2,'The greatest number that divides both 24 and 36 is 12.',1),
  ('WAEC',11,'Factorise 12x + 18 completely.','["2(6x + 9)","3(4x + 6)","6(2x + 3)","12(x + 18)"]',2,'The highest common factor is 6: 12x + 18 = 6(2x + 3).',1),
  ('WAEC',11,'If x + y = 11 and x - y = 3, find x.','["4","7","8","14"]',1,'Adding the equations gives 2x = 14, so x = 7.',2),
  ('WAEC',11,'Solve the inequality 3x + 2 < 11.','["x < 3","x > 3","x < 9","x > 9"]',0,'Subtract 2: 3x < 9. Divide by 3: x < 3.',2),
  ('WAEC',11,'Find the midpoint of the line segment joining (2, 4) and (8, 10).','["(3, 7)","(5, 7)","(5, 14)","(10, 14)"]',1,'Midpoint = ((2+8)/2, (4+10)/2) = (5, 7).',1),
  ('WAEC',11,'Find the gradient of the line through (1, 2) and (5, 14).','["2","3","4","12"]',1,'Gradient = (14 - 2)/(5 - 1) = 12/4 = 3.',2),
  ('WAEC',11,'Find the mean of 4, 8, 10 and 14.','["8","9","10","36"]',1,'Mean = (4 + 8 + 10 + 14)/4 = 36/4 = 9.',1),
  ('WAEC',11,'Find the mode of 2, 3, 3, 4, 5.','["2","3","4","5"]',1,'The mode is the value occurring most often; 3 appears twice.',1)
) AS v(exam_code, topic_id, stem, options, answer_idx, explanation, difficulty)
WHERE NOT EXISTS (
  SELECT 1 FROM questions q
  WHERE q.exam_code = v.exam_code AND q.topic_id = v.topic_id AND q.stem = v.stem
);
