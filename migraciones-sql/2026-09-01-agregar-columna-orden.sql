-- Agrega una columna "orden" a cada tabla, para poder guardar el orden
-- que se define arrastrando en el panel admin. Se puede correr una sola vez.

alter table supervisores add column if not exists orden integer;
alter table capataces    add column if not exists orden integer;
alter table sectores     add column if not exists orden integer;
alter table frentes      add column if not exists orden integer;

-- Rellena un orden inicial (por orden de creación / id) para las filas que ya existen,
-- así el primer arrastre parte de un orden razonable en vez de estar todo en null.
update supervisores set orden = sub.rn
  from (select id, row_number() over (order by id) as rn from supervisores) sub
  where supervisores.id = sub.id and supervisores.orden is null;

update capataces set orden = sub.rn
  from (select id, row_number() over (order by id) as rn from capataces) sub
  where capataces.id = sub.id and capataces.orden is null;

update sectores set orden = sub.rn
  from (select id, row_number() over (order by id) as rn from sectores) sub
  where sectores.id = sub.id and sectores.orden is null;

-- Frentes se ordenan dentro de cada sector, no globalmente.
update frentes set orden = sub.rn
  from (select id, row_number() over (partition by sector_id order by id) as rn from frentes) sub
  where frentes.id = sub.id and frentes.orden is null;
