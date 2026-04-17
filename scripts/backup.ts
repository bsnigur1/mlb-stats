import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function backup() {
  const timestamp = new Date().toISOString().split('T')[0];
  const backupDir = path.join(process.cwd(), 'backups', timestamp);

  // Create backup directory
  fs.mkdirSync(backupDir, { recursive: true });

  const tables = [
    'players',
    'seasons',
    'sessions',
    'games',
    'game_players',
    'at_bats',
    'pitching_stats',
  ];

  console.log(`\n📦 Backing up to ${backupDir}\n`);

  for (const table of tables) {
    let allData: any[] = [];
    let offset = 0;
    const batchSize = 1000;

    // Fetch all records (handles pagination)
    while (true) {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .range(offset, offset + batchSize - 1);

      if (error) {
        console.error(`❌ Error backing up ${table}:`, error.message);
        break;
      }

      if (!data || data.length === 0) break;
      allData = [...allData, ...data];
      if (data.length < batchSize) break;
      offset += batchSize;
    }

    const filePath = path.join(backupDir, `${table}.json`);
    fs.writeFileSync(filePath, JSON.stringify(allData, null, 2));
    console.log(`✓ ${table}: ${allData.length} records`);
  }

  console.log(`\n✅ Backup complete!\n`);
}

backup().catch(console.error);
