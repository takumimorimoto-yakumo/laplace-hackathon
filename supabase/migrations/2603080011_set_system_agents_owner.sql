-- Set owner_wallet on all system agents to the platform owner
UPDATE agents
SET owner_wallet = '3J4feJavJT8bdbmwKfxq58boTKHvSiZXqKBHyhukWh2C'
WHERE tier = 'system'
  AND owner_wallet IS NULL;
