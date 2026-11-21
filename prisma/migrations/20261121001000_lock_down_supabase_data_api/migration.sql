-- HabitHop accesses application tables through its authenticated Prisma server.
-- Browser-facing Supabase API roles must not read or write these tables directly.
DO $$
DECLARE
  app_table text;
  api_role text;
BEGIN
  FOREACH app_table IN ARRAY ARRAY[
    'User', 'Profile', 'Session', 'AuditLog', 'Task', 'DayLog', 'UserPet',
    'Preferences', 'ShopItem', 'UserItem', 'Achievement', 'Notification',
    'WeeklyLeague', 'WeeklyReport', 'Friendship', 'FriendInvite', 'UserBlock',
    'DuoStreak', 'SharedStudyGoal', 'SharedGoalProgress', 'UserStats',
    'PendingUpload', 'StoredFile', 'MotivationNote', 'FavoriteQuote',
    'MaterialFolder', 'Material', 'Memory', '_prisma_migrations'
  ] LOOP
    IF to_regclass(format('public.%I', app_table)) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', app_table);

      FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
        IF to_regrole(api_role) IS NOT NULL THEN
          EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM %I', app_table, api_role);
        END IF;
      END LOOP;
    END IF;
  END LOOP;
END
$$;
