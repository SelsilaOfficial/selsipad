import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();

  // Check projects
  const { data: projects } = await supabase
    .from('projects')
    .select('id, name, status, type')
    .limit(10);

  // Check launch_rounds
  const { data: rounds } = await supabase
    .from('launch_rounds')
    .select(`
      id,
      status,
      type,
      contract_address,
      project:projects(name)
    `)
    .limit(10);

  // Check approved rounds
  const { data: approvedRounds } = await supabase
    .from('launch_rounds')
    .select(`
      id,
      status,
      type,
      contract_address,
      project:projects(name)
    `)
    .in('status', ['APPROVED', 'DEPLOYED', 'LIVE', 'ACTIVE'])
    .limit(10);

  return NextResponse.json({
    projects,
    allRounds: rounds,
    approvedRounds,
  });
}
