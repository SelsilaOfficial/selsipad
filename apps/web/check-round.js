const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};
envContent.split('\n').forEach((line) => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) envVars[match[1].trim()] = match[2].trim();
});

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY);
const ID = '48bbbef4-baa5-454d-a405-a356ec75723a';

async function main() {
  let { data: round, error } = await supabase
    .from('launch_rounds')
    .select('id, status, round_address, params, chain_id, projects(name, symbol)')
    .eq('id', ID)
    .single();

  if (error || !round) {
    const res = await supabase
      .from('launch_rounds')
      .select('id, status, round_address, params, chain_id, projects(name, symbol)')
      .eq('project_id', ID)
      .order('created_at', { ascending: false })
      .limit(1);
    round = res.data?.[0];
  }

  if (!round) {
    console.log('NOT FOUND');
    return;
  }

  const p = round.params || {};
  console.log('=== DB Data ===');
  console.log('Project:', round.projects?.name, '(' + (round.projects?.symbol || '?') + ')');
  console.log('Status:', round.status);
  console.log('Round Address:', round.round_address);
  console.log('Chain ID:', round.chain_id);
  console.log('DB softcap:', p.softcap);
  console.log('DB hardcap:', p.hardcap);
  console.log('DB price:', p.price);
  console.log('DB min_contribution:', p.min_contribution);
  console.log('DB max_contribution:', p.max_contribution);
  console.log('DB token_for_sale:', p.token_for_sale);

  if (round.round_address) {
    const { ethers } = require('ethers');
    const rpc = envVars.BSC_TESTNET_RPC_URL || 'https://bsc-testnet-rpc.publicnode.com';
    const provider = new ethers.JsonRpcProvider(rpc);
    const abi = [
      'function softCap() view returns (uint256)',
      'function hardCap() view returns (uint256)',
      'function minContribution() view returns (uint256)',
      'function maxContribution() view returns (uint256)',
      'function pricePerToken() view returns (uint256)',
    ];
    const c = new ethers.Contract(round.round_address, abi, provider);
    try {
      const [sc, hc, minC, maxC, ppt] = await Promise.all([
        c.softCap(),
        c.hardCap(),
        c.minContribution(),
        c.maxContribution(),
        c.pricePerToken(),
      ]);
      console.log('\n=== Smart Contract ===');
      console.log('SC softCap:', ethers.formatEther(sc), 'BNB');
      console.log('SC hardCap:', ethers.formatEther(hc), 'BNB');
      console.log('SC minContribution:', ethers.formatEther(minC), 'BNB');
      console.log('SC maxContribution:', ethers.formatEther(maxC), 'BNB');
      console.log('SC pricePerToken:', ethers.formatEther(ppt), 'BNB');
    } catch (e) {
      console.log('\nSC read error:', e.message?.substring(0, 200));
    }
  }
}
main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
