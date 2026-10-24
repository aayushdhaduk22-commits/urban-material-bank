INSERT INTO materials (title,category,location,distance_km,price,unit,quantity,quality,condition_note,seller_name,seller_type,verified,image_theme)
SELECT 'Premium Red Clay Bricks','Bricks','Whitefield',4.2,6.50,'/piece',1850,'Excellent','Unused surplus from a completed residential project.','RKS Constructions','Contractor',true,'brick'
WHERE NOT EXISTS (SELECT 1 FROM materials WHERE title='Premium Red Clay Bricks' AND location='Whitefield');
INSERT INTO materials (title,category,location,distance_km,price,unit,quantity,quality,condition_note,seller_name,seller_type,verified,image_theme)
SELECT 'AAC Blocks 600×200×100','Blocks','HSR Layout',7.8,42.00,'/block',420,'Good','Clean, dry stock recovered after project scope reduction.','BuildRight Infra','Contractor',true,'block'
WHERE NOT EXISTS (SELECT 1 FROM materials WHERE title='AAC Blocks 600×200×100' AND location='HSR Layout');
INSERT INTO materials (title,category,location,distance_km,price,unit,quantity,quality,condition_note,seller_name,seller_type,verified,image_theme)
SELECT 'Teak Wood Doors — 8ft','Doors','Indiranagar',5.1,8500,'/door',12,'Excellent','Solid teak doors removed during a renovation; hardware included.','Mehta Estates','Property Owner',true,'door'
WHERE NOT EXISTS (SELECT 1 FROM materials WHERE title='Teak Wood Doors — 8ft' AND location='Indiranagar');
INSERT INTO materials (title,category,location,distance_km,price,unit,quantity,quality,condition_note,seller_name,seller_type,verified,image_theme)
SELECT 'Aluminium Sliding Windows','Windows','Koramangala',6.4,3200,'/window',18,'Good','Double-track frames with glass; minor cosmetic marks.','UrbanBuild Projects','Contractor',true,'window'
WHERE NOT EXISTS (SELECT 1 FROM materials WHERE title='Aluminium Sliding Windows' AND location='Koramangala');
INSERT INTO materials (title,category,location,distance_km,price,unit,quantity,quality,condition_note,seller_name,seller_type,verified,image_theme)
SELECT 'MS I-Beam 200mm','Steel','Peenya',14.5,78,'/kg',1250,'Excellent','Structural steel offcuts from a warehouse build.','SteelSpan Fabricators','Fabricator',true,'steel'
WHERE NOT EXISTS (SELECT 1 FROM materials WHERE title='MS I-Beam 200mm' AND location='Peenya');
INSERT INTO materials (title,category,location,distance_km,price,unit,quantity,quality,condition_note,seller_name,seller_type,verified,image_theme)
SELECT 'Vitrified Floor Tiles 600×600','Tiles','JP Nagar',10.2,28,'/sq ft',680,'Good','Factory-packed surplus; assorted neutral finishes.','Nexus Homes','Developer',false,'tile'
WHERE NOT EXISTS (SELECT 1 FROM materials WHERE title='Vitrified Floor Tiles 600×600' AND location='JP Nagar');