-- Catálogo base de alimentos comunes en Uruguay (alcance GLOBAL).
-- Las porciones son orientativas; el plan de cada usuario las sobrescribe con reglas PLAN o USUARIO.
-- Fuentes consultadas: Guías Alimentarias para la Población Uruguaya (MSP/UDELAR, 2016)
--                      y Tabla de Composición de Alimentos del INCAP, publicación ME/057 (2012).

-- Reglas simples (NORMAL): alimento → un grupo, cantidad por porción
INSERT INTO food_rules
    (alcance, alimento, sinonimos, tipo, standard_group_key, cantidad_por_porcion, unidad, porcion_por_defecto)
VALUES
-- ── PROTEÍNAS ──────────────────────────────────────────────────────────────
('GLOBAL','huevo',            ARRAY['huevos','huevo frito','huevo revuelto','huevo duro','huevo pasado'],'NORMAL','proteinas',1,'unidad',1),
('GLOBAL','clara de huevo',   ARRAY['claras','claras de huevo'],'NORMAL','proteinas',2,'unidad',2),
('GLOBAL','pollo',            ARRAY['pechuga de pollo','muslo de pollo','filet de pollo','pollo a la plancha','pollo asado'],'NORMAL','proteinas',90,'g',1),
('GLOBAL','carne vacuna',     ARRAY['carne','bife','churrasquito','lomito','cuadril','paleta','carne picada'],'NORMAL','proteinas',90,'g',1),
('GLOBAL','cerdo',            ARRAY['carne de cerdo','filet de cerdo','bondiola','lomo de cerdo'],'NORMAL','proteinas',90,'g',1),
('GLOBAL','pescado',          ARRAY['merluza','lenguado','salmon','corvina','lisa'],'NORMAL','proteinas',90,'g',1),
('GLOBAL','atun en lata',     ARRAY['atun','atún','atún al natural','atun al natural','atun en aceite'],'NORMAL','proteinas',90,'g',1),
('GLOBAL','sardina',          ARRAY['sardinas','sardina en lata'],'NORMAL','proteinas',90,'g',1),
('GLOBAL','jamon cocido',     ARRAY['jamon','jamón','fiambre','jamon del diablo'],'NORMAL','proteinas',60,'g',1),
('GLOBAL','queso magro',      ARRAY['queso descremado','queso port salut light','queso cottage'],'NORMAL','proteinas',45,'g',1),
('GLOBAL','legumbres',        ARRAY['leguminosas'],'NORMAL','proteinas',0.5,'taza',1),
('GLOBAL','lenteja',          ARRAY['lentejas','lentejas cocidas'],'NORMAL','proteinas',0.5,'taza',1),
('GLOBAL','garbanzo',         ARRAY['garbanzos','garbanzos cocidos'],'NORMAL','proteinas',0.5,'taza',1),
('GLOBAL','poroto',           ARRAY['porotos','porotos negros','porotos blancos','frijoles'],'NORMAL','proteinas',0.5,'taza',1),
('GLOBAL','soja texturizada', ARRAY['proteina de soja','soja'],'NORMAL','proteinas',30,'g',1),
('GLOBAL','tofu',             ARRAY[]::TEXT[],'NORMAL','proteinas',90,'g',1),

-- ── CEREALES Y TUBÉRCULOS ──────────────────────────────────────────────────
('GLOBAL','arroz',            ARRAY['arroz blanco','arroz cocido','arroz integral'],'NORMAL','cereales_tuberculos',0.5,'taza',1),
('GLOBAL','pasta',            ARRAY['fideos','fideo','spaghetti','tallarines','pasta cocida','fideos cocidos','ñoquis'],'NORMAL','cereales_tuberculos',0.5,'taza',1),
('GLOBAL','papa',             ARRAY['papas','papa cocida','papa hervida','papa al horno'],'NORMAL','cereales_tuberculos',1,'unidad',1),
('GLOBAL','boniato',          ARRAY['boniatos','batata','camote'],'NORMAL','cereales_tuberculos',1,'unidad',1),
('GLOBAL','avena',            ARRAY['avena en copos','copos de avena','porridge'],'NORMAL','cereales_tuberculos',3,'cda',1),
('GLOBAL','polenta',          ARRAY['polenta cocida','harina de maiz'],'NORMAL','cereales_tuberculos',0.5,'taza',1),
('GLOBAL','quinoa',           ARRAY['quinua','quinoa cocida'],'NORMAL','cereales_tuberculos',0.5,'taza',1),
('GLOBAL','mandioca',         ARRAY['yuca','tapioca'],'NORMAL','cereales_tuberculos',0.5,'taza',1),
('GLOBAL','choclo',           ARRAY['choclo cocido','maiz cocido','elote'],'NORMAL','cereales_tuberculos',0.5,'taza',1),
('GLOBAL','pan',              ARRAY['pan blanco','pan lactal','rebanada de pan','feta de pan','pan de molde'],'NORMAL','cereales_tuberculos',1,'rebanada',1),
('GLOBAL','pan integral',     ARRAY['pan de molde integral','pan negro','pan multicereal'],'NORMAL','cereales_tuberculos',1,'rebanada',1),
('GLOBAL','galleta de agua',  ARRAY['galletas de agua','crackers','galleta crackers'],'NORMAL','cereales_tuberculos',3,'unidad',3),
('GLOBAL','galleta de arroz', ARRAY['galletas de arroz','galletita de arroz'],'NORMAL','cereales_tuberculos',2,'unidad',2),
('GLOBAL','tostada',          ARRAY['tostadas','pan tostado'],'NORMAL','cereales_tuberculos',1,'rebanada',1),
('GLOBAL','cereales de desayuno',ARRAY['corn flakes','granola','cereal de desayuno'],'NORMAL','cereales_tuberculos',30,'g',1),

-- ── VERDURAS ───────────────────────────────────────────────────────────────
('GLOBAL','lechuga',          ARRAY['lechuga capuchina','lechuga mantecosa','hojas verdes','mix de hojas'],'NORMAL','verduras',2,'taza',1),
('GLOBAL','tomate',           ARRAY['tomate perita','tomate cherry','tomate fresco','tomates'],'NORMAL','verduras',1,'unidad',1),
('GLOBAL','zanahoria',        ARRAY['zanahorias','zanahoria rallada','zanahoria cocida'],'NORMAL','verduras',1,'unidad',1),
('GLOBAL','zapallito',        ARRAY['zucchini','zuchinni','zapallitos','zapallito verde'],'NORMAL','verduras',1,'unidad',1),
('GLOBAL','zapallo',          ARRAY['calabaza','zapallo cocido','zapallo en cubos'],'NORMAL','verduras',1,'taza',1),
('GLOBAL','brocoli',          ARRAY['brócoli','brócoli cocido','brocoli al vapor','brocoli cocido'],'NORMAL','verduras',1,'taza',1),
('GLOBAL','coliflor',         ARRAY['coliflor cocida','coliflor al vapor'],'NORMAL','verduras',1,'taza',1),
('GLOBAL','espinaca',         ARRAY['espinacas','espinaca cocida','espinaca fresca'],'NORMAL','verduras',1,'taza',1),
('GLOBAL','acelga',           ARRAY['acelgas','acelga cocida'],'NORMAL','verduras',1,'taza',1),
('GLOBAL','pepino',           ARRAY['pepinos'],'NORMAL','verduras',1,'unidad',1),
('GLOBAL','morron',           ARRAY['pimiento','morrón','morrón rojo','morron rojo','morrón verde','morrones'],'NORMAL','verduras',1,'unidad',1),
('GLOBAL','remolacha',        ARRAY['betarraga','remolacha cocida'],'NORMAL','verduras',1,'unidad',1),
('GLOBAL','cebolla',          ARRAY['cebollas','cebolla cruda','cebolla cocida'],'NORMAL','verduras',0.5,'unidad',1),
('GLOBAL','apio',             ARRAY['ramas de apio'],'NORMAL','verduras',1,'taza',1),
('GLOBAL','repollo',          ARRAY['col','repollo blanco','repollo colorado'],'NORMAL','verduras',1,'taza',1),
('GLOBAL','chauchas',         ARRAY['chaucha','porotos verdes','vainitas'],'NORMAL','verduras',1,'taza',1),
('GLOBAL','berenjena',        ARRAY['berenjenas','berenjena cocida','berenjena a la plancha'],'NORMAL','verduras',1,'taza',1),

-- ── FRUTAS ─────────────────────────────────────────────────────────────────
('GLOBAL','manzana',          ARRAY['manzana roja','manzana verde'],'NORMAL','frutas',1,'unidad',1),
('GLOBAL','banana',           ARRAY['banano','platano','plátano'],'NORMAL','frutas',1,'unidad',1),
('GLOBAL','naranja',          ARRAY['naranjas','jugo de naranja natural'],'NORMAL','frutas',1,'unidad',1),
('GLOBAL','mandarina',        ARRAY['mandarinas'],'NORMAL','frutas',2,'unidad',2),
('GLOBAL','pera',             ARRAY['peras'],'NORMAL','frutas',1,'unidad',1),
('GLOBAL','durazno',          ARRAY['duraznos','melocoton','melocotón'],'NORMAL','frutas',1,'unidad',1),
('GLOBAL','frutilla',         ARRAY['frutillas','fresa','fresas'],'NORMAL','frutas',1,'taza',1),
('GLOBAL','uva',              ARRAY['uvas'],'NORMAL','frutas',15,'unidad',15),
('GLOBAL','kiwi',             ARRAY['kiwis'],'NORMAL','frutas',1,'unidad',1),
('GLOBAL','pomelo',           ARRAY['pomelos','toronja'],'NORMAL','frutas',0.5,'unidad',1),
('GLOBAL','sandia',           ARRAY['sandía'],'NORMAL','frutas',1,'taza',1),
('GLOBAL','melon',            ARRAY['melón'],'NORMAL','frutas',1,'taza',1),
('GLOBAL','ciruela',          ARRAY['ciruelas','ciruela fresca'],'NORMAL','frutas',2,'unidad',2),

-- ── ACEITES Y GRASAS (incluye palta) ───────────────────────────────────────
('GLOBAL','palta',            ARRAY['aguacate','avocado','paltas'],'NORMAL','aceites_grasas',0.5,'unidad',0.5),
('GLOBAL','aceite',           ARRAY['aceite de girasol','aceite de oliva','aceite vegetal'],'NORMAL','aceites_grasas',1,'cda',1),
('GLOBAL','manteca',          ARRAY['mantequilla'],'NORMAL','aceites_grasas',1,'cda',1),
('GLOBAL','mayonesa',         ARRAY['mayo'],'NORMAL','aceites_grasas',1,'cda',1),
('GLOBAL','nuez',             ARRAY['nueces'],'NORMAL','aceites_grasas',4,'unidad',4),
('GLOBAL','mani',             ARRAY['maní','cacahuete','maní tostado','mantequilla de mani'],'NORMAL','aceites_grasas',1,'cda',1),
('GLOBAL','almendra',         ARRAY['almendras'],'NORMAL','aceites_grasas',8,'unidad',8),
('GLOBAL','crema',            ARRAY['crema de leche','nata'],'NORMAL','aceites_grasas',1,'cda',1),

-- ── LÁCTEOS ────────────────────────────────────────────────────────────────
('GLOBAL','leche',            ARRAY['leche entera','leche descremada','leche semidescremada','leche fluida'],'NORMAL','lacteos',200,'ml',1),
('GLOBAL','yogur',            ARRAY['yogurt','yogur natural','yogur descremado','yogur griego'],'NORMAL','lacteos',200,'g',1),
('GLOBAL','queso',            ARRAY['queso fresco','queso semiduro','queso colonia','queso dambo','queso sardo','queso port salut'],'NORMAL','lacteos',45,'g',1),
('GLOBAL','queso rallado',    ARRAY['parmesano rallado'],'NORMAL','lacteos',2,'cda',1),
('GLOBAL','ricota',           ARRAY['requesón','requesón'],'NORMAL','lacteos',100,'g',1),
('GLOBAL','leche en polvo',   ARRAY['leche polvo','leche en polvo descremada'],'NORMAL','lacteos',3,'cda',1),

-- ── LIBRES ─────────────────────────────────────────────────────────────────
('GLOBAL','agua',             ARRAY['agua mineral','agua con gas','agua sin gas','agüita'],'LIBRE',NULL,NULL,NULL,1),
('GLOBAL','cafe',             ARRAY['café','cafe negro','espresso','cafe solo','café solo'],'LIBRE',NULL,NULL,NULL,1),
('GLOBAL','te',               ARRAY['té','te verde','te negro','te de yuyos','té verde'],'LIBRE',NULL,NULL,NULL,1),
('GLOBAL','mate',             ARRAY['mate amargo','matecito'],'LIBRE',NULL,NULL,NULL,1),
('GLOBAL','ajo',              ARRAY['diente de ajo','ajo picado'],'LIBRE',NULL,NULL,NULL,1),
('GLOBAL','condimentos',      ARRAY['sal','pimienta','oregano','curcuma','pimenton','comino','perejil','cilantro','aji molido'],'LIBRE',NULL,NULL,NULL,1),
('GLOBAL','infusion',         ARRAY['manzanilla','tilo','boldo','cedron','cedrón'],'LIBRE',NULL,NULL,NULL,1),
('GLOBAL','caldo',            ARRAY['caldo de verduras','caldo light','caldo de pollo light'],'LIBRE',NULL,NULL,NULL,1);

-- Reglas COMPUESTO: alimento → varios grupos (componentes en JSONB)
INSERT INTO food_rules
    (alcance, alimento, sinonimos, tipo, componentes, porcion_por_defecto)
VALUES
('GLOBAL','cafe con leche',
 ARRAY['café con leche','cafe cortado','café cortado'],
 'COMPUESTO',
 '[{"standardGroupKey":"lacteos","porciones":0.5}]'::JSONB,
 1),
('GLOBAL','mate cocido con leche',
 ARRAY['cocido con leche','mate cocido'],
 'COMPUESTO',
 '[{"standardGroupKey":"lacteos","porciones":0.5}]'::JSONB,
 1),
('GLOBAL','milanesa',
 ARRAY['milanesa de carne','milanesa de pollo','milanesa napolitana'],
 'COMPUESTO',
 '[{"standardGroupKey":"proteinas","porciones":1.0},{"standardGroupKey":"cereales_tuberculos","porciones":0.5}]'::JSONB,
 1),
('GLOBAL','tostada con palta',
 ARRAY['tostadas con palta','pan con palta'],
 'COMPUESTO',
 '[{"standardGroupKey":"cereales_tuberculos","porciones":1.0},{"standardGroupKey":"aceites_grasas","porciones":0.5}]'::JSONB,
 1);
