-- Supabase activa RLS por defecto en las tablas nuevas creadas desde el dashboard —
-- por eso "redline_supervisores" quedó bloqueada para insert/select/update hasta que le
-- agreguemos políticas, igual que se hizo antes con "prefijos" (ver
-- 2026-09-01-fix-rls-prefijos.sql) para que la app funcione con ella usando la llave "anon".
-- Corre esto una sola vez en el SQL Editor de Supabase.

create policy "redline_supervisores_select_publico" on redline_supervisores for select using (true);
create policy "redline_supervisores_insert_publico" on redline_supervisores for insert with check (true);
create policy "redline_supervisores_update_publico" on redline_supervisores for update using (true);
