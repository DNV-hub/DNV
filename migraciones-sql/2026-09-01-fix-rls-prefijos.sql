-- Supabase activa RLS por defecto en las tablas nuevas creadas desde el dashboard —
-- por eso "prefijos" quedó bloqueada para insert/select/update hasta que le agreguemos
-- políticas, igual que ya deben tenerlas tus otras tablas (supervisores, capataces,
-- sectores, frentes) para que la app funcione con ellas usando la llave "anon".
-- Corre esto una sola vez en el SQL Editor de Supabase.

create policy "prefijos_select_publico" on prefijos for select using (true);
create policy "prefijos_insert_publico" on prefijos for insert with check (true);
create policy "prefijos_update_publico" on prefijos for update using (true);
