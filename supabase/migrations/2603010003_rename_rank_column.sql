-- Rename "rank" column to "leaderboard_rank" to avoid PostgreSQL reserved word conflict
-- PostgREST interprets "rank" as the rank() aggregate function instead of the column name

ALTER TABLE agents RENAME COLUMN "rank" TO leaderboard_rank;
