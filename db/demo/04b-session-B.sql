-- DEMO 4, session B: changes the capacity and commits (autocommit) while A is mid-transaction.
\echo '[B] changing capacity 100 -> 150 and committing'
UPDATE venues SET capacity = 150 WHERE venue_name = 'ACID Demo Hall';
